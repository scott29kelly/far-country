/**
 * LIVE gamepad probe — boots the REAL engine in Playwright Chromium/WebGPU
 * with navigator.getGamepads() overridden BEFORE boot by a page-controlled
 * fake pad (no OS controller needed). Complements tools/probe-gamepad.ts
 * (CPU physics): this one proves the browser-side seam — GamepadInput's
 * default navigator source, the rAF-driven update loop, and NavigationUI's
 * PAD pill — against the running dev server.
 *
 *   npx tsx tools/probe-gamepad-live.ts [--port 5173] [--scene sanity]
 *
 * --port targets a non-default dev server (worktree sessions must not probe
 * another checkout's :5173); launchWebGPU's secure-context probe still uses
 * :5173 — any localhost server there satisfies it.
 */

import { launchWebGPU, laasUrl } from './launch';

interface Args {
  port: number;
  scene: string;
}
const args: Args = { port: 5173, scene: 'sanity' };
for (let i = 2; i < process.argv.length; i += 2) {
  const k = process.argv[i];
  const v = process.argv[i + 1];
  if (k === '--port' && v) args.port = Number(v);
  if (k === '--scene' && v) args.scene = v;
}

const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures.push(name);
};

const { browser } = await launchWebGPU(`http://localhost:${args.port}`);
const page = await browser.newPage();
// install the controllable fake BEFORE any engine code runs — GamepadInput's
// default source closes over navigator.getGamepads at call time, so this
// exercises the real production seam
await page.addInitScript(() => {
  const w = window as unknown as { __fakePads: unknown[] };
  w.__fakePads = [null];
  (navigator as { getGamepads: () => unknown[] }).getGamepads = () => w.__fakePads;
});
const base = `http://localhost:${args.port}/`;
await page.goto(laasUrl({ scene: args.scene, hud: false }, base), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => (window as unknown as { __laas: { ready: boolean } }).__laas?.ready, undefined, {
  timeout: 180_000,
});

const pill = (): Promise<string> =>
  page.evaluate(() => document.getElementById('nav-toggle')?.textContent ?? '');
const pose = (): Promise<{ p: number[]; yaw: number }> =>
  page.evaluate(() => {
    const h = (window as unknown as { __laas: { getPose(): { p: number[]; yaw: number } } }).__laas;
    return h.getPose();
  });
/** mutate the fake pad in-page; null clears the slot */
const setPad = (patch: { axes?: number[]; pressed?: number[]; mapping?: string } | null): Promise<void> =>
  page.evaluate((p) => {
    const w = window as unknown as { __fakePads: unknown[] };
    if (!p) {
      w.__fakePads = [null];
      return;
    }
    const buttons = Array.from({ length: 17 }, (_, i) => ({
      pressed: (p.pressed ?? []).includes(i),
      touched: (p.pressed ?? []).includes(i),
      value: (p.pressed ?? []).includes(i) ? 1 : 0,
    }));
    w.__fakePads = [
      {
        id: 'Fake Xbox 360 Controller (live probe)',
        index: 0,
        connected: true,
        mapping: p.mapping ?? 'standard',
        axes: p.axes ?? [0, 0, 0, 0],
        buttons,
        timestamp: performance.now(),
      },
    ];
  }, patch);
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---- 1: no pad, no PAD hint ------------------------------------------------
{
  const t = await pill();
  check('L1 pill has no PAD hint before a pad is exposed', !t.includes('PAD'), `pill "${t}"`);
}

// ---- 2: pad exposure surfaces PAD in the pill ------------------------------
{
  await setPad({});
  await wait(400);
  const t = await pill();
  check('L2 pill shows PAD once the pad is exposed', t.includes('PAD'), `pill "${t}"`);
}

// ---- 3: left stick flies forward through the real rAF loop -----------------
{
  const before = await pose();
  await setPad({ axes: [0, -1, 0, 0] });
  await wait(1000);
  await setPad({});
  const after = await pose();
  const moved = Math.hypot(after.p[0] - before.p[0], after.p[2] - before.p[2]);
  // threshold is deliberately loose: fly movement integrates SIM time and the
  // engine caps dt at 0.1 s, so under GPU contention (another session flying
  // the NJ scene on the same iGPU) a 1 s wall window can hold ~0.25 s of sim —
  // ~5 m. The check is "the stick moves the camera", not a speed benchmark.
  check('L3 left stick moves the camera (fly, speed 24)', moved > 3, `${moved.toFixed(1)} m in ~1 s wall`);
}

// ---- 4: right stick steers at the gentle rate ------------------------------
{
  const before = await pose();
  await setPad({ axes: [0, 0, 1, 0] });
  await wait(1000);
  await setPad({});
  const after = await pose();
  const dyaw = before.yaw - after.yaw; // yaw decreases on right deflection
  check('L4 right stick yaws gently (~1.2 rad/s)', dyaw > 0.7 && dyaw < 1.7, `Δyaw ${dyaw.toFixed(2)} rad in ~1 s`);
}

// ---- 4b: drift-level deflection holds the camera exactly still -------------
// Live analogue of CPU probe-gamepad check A (the radial-deadzone contract).
// A pad resting on the desk drifts a little on every axis: hypot(0.1, 0.1)
// = 0.14 sits under the 0.15 radial deadzone, so shapeStick returns exact
// zero and the camera must not move at all. Threshold provenance: with the
// deadzone intact the shaped input is exactly 0 and the pose reads are
// deterministic, so clean runs measure 0.000 m; with the deadzone zeroed
// this drift flies at mag 0.14 x 24 m/s ~ 3.4 m/s (~0.9 m even if GPU
// contention caps the window at 0.25 s of sim time). 0.05 m / 0.01 rad
// separates the two states by more than an order of magnitude either way.
// Added 2026-08-27 (FC-0025): the zeroed-deadzone mutation left every prior
// live check green because they only present axes at exactly 0 or +/-1,
// where shapeStick is deadzone-invariant.
{
  const before = await pose();
  await setPad({ axes: [0.1, 0.1, 0.1, 0.1] });
  await wait(1000);
  await setPad({});
  const after = await pose();
  const moved = Math.hypot(after.p[0] - before.p[0], after.p[1] - before.p[1], after.p[2] - before.p[2]);
  const dyaw = Math.abs(after.yaw - before.yaw);
  check(
    'L15 drift-level axes leave the camera exactly still (deadzone)',
    moved < 0.05 && dyaw < 0.01,
    `moved ${moved.toFixed(3)} m, |Δyaw| ${dyaw.toFixed(4)} rad in ~1 s of drift`,
  );
}

// ---- 5: RB steps the fly speed (pill reflects it) --------------------------
{
  await setPad({ pressed: [5] });
  await wait(200);
  await setPad({});
  await wait(200);
  const t = await pill();
  check('L5 RB steps fly speed 24 → 60', t.includes('60 m/s'), `pill "${t}"`);
}

// ---- 5b/5c: D-pad right/left step the speed (Scott's legible bindings) -----
{
  await setPad({ pressed: [15] }); // D-pad right
  await wait(200);
  await setPad({});
  await wait(200);
  const t = await pill();
  check('L13 D-pad right steps fly speed 60 → 150', t.includes('150 m/s'), `pill "${t}"`);
  await setPad({ pressed: [14] }); // D-pad left
  await wait(200);
  await setPad({});
  await wait(200);
  const t2 = await pill();
  check('L14 D-pad left steps back 150 → 60', t2.includes('60 m/s'), `pill "${t2}"`);
}

// ---- 6: pad removal clears the PAD hint ------------------------------------
{
  await setPad(null);
  await wait(400);
  const t = await pill();
  check('L6 PAD hint clears on disconnect', !t.includes('PAD'), `pill "${t}"`);
}

// ---- 7-10: the dev-only ?padtest=1 diagnostic panel ------------------------
// (dev server ⇒ import.meta.env.DEV is true; the production bundle
// dead-code-eliminates the panel, same contract as EditPanel)
{
  await page.goto(laasUrl({ scene: args.scene, hud: false, extra: { padtest: '1' } }, base), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(() => (window as unknown as { __laas: { ready: boolean } }).__laas?.ready, undefined, {
    timeout: 180_000,
  });
  const panel = (sel: string): Promise<string> =>
    page.evaluate((s) => document.querySelector(s)?.textContent ?? '', sel);

  await setPad({});
  await wait(400);
  check('L7 padtest panel mounts', (await panel('#padtest .pt-head')).includes('GAMEPAD'), 'panel head present');
  const okVerdict = await panel('#padtest .pt-verdict');
  check(
    'L8 standard mapping reads as recognised',
    okVerdict.includes('standard') && okVerdict.includes('apply as-is'),
    `verdict "${okVerdict.slice(0, 60)}…"`,
  );

  // pad controls overlay: auto-shown on first activation, View (b8) toggles
  const helpVisible = (): Promise<boolean> =>
    page.evaluate(() => {
      const el = document.getElementById('pad-help');
      return !!el && !el.hidden;
    });
  check('L11 controls overlay auto-shows on first pad activation', await helpVisible(), 'pad-help visible');
  await setPad({ pressed: [8] });
  await wait(200);
  await setPad({});
  await wait(200);
  check('L12 View button hides the overlay', !(await helpVisible()), 'pad-help hidden after View');

  // guided capture: press A / B / Y and confirm the recorded indices
  await page.click('#padtest .pt-btn');
  for (const index of [0, 1, 3]) {
    await wait(450); // clear the capture debounce
    await setPad({ pressed: [index] });
    await wait(220);
    await setPad({});
  }
  await wait(300);
  const rows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#padtest .pt-cap-row')).map((r) => r.textContent ?? ''),
  );
  const captured = rows.filter((r) => r.includes('matches standard'));
  check(
    'L9 guided capture records A/B/Y on their standard indices',
    captured.length >= 3,
    `${captured.length} rows matched standard — ${captured.slice(0, 3).map((r) => r.trim()).join(' | ')}`,
  );

  // a generic-HID pad must be called out rather than silently mis-bound
  await setPad({ mapping: '' });
  await wait(400);
  const warn = await panel('#padtest .pt-verdict');
  check(
    'L10 nonstandard mapping is flagged, not silently accepted',
    warn.includes('NONSTANDARD'),
    `verdict "${warn.slice(0, 60)}…"`,
  );
}

await browser.close();
console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAILURE(S): ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
