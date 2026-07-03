/**
 * probe-walkfling-live.ts — in-browser walk-feel verification of the
 * walker-fling fix (STATUS 2026-07-03) on REAL hardware: real GPU terrain,
 * the scene's ACTUAL groundProbe wrap chain (not the CPU mirror in
 * probe-walkfling.ts), real trusted keyboard input via Playwright CDP.
 *
 * One NJ boot per scenario group, from the handoff checklist:
 *   A  the reported repro path: pool0-rect entry snap (A0, pre-fix 797 m)
 *      then wading north across the pool-rect line (~z 2060) to the wall
 *      cascade — must stay wading;
 *   B  walk-entry snap ON the meridian corridor under the crown basin
 *      (pre-fix 3600 m — the worst documented magnitude), then walking
 *      east out of the corridor at plaza level — no teleport;
 *   C  drop onto the crown basin from above, V to walk — crown water must
 *      STILL claim a walker standing on it (regression guard for the cap);
 *   D  walk off the rim in each compass direction — float canaries only:
 *      no reach rect is near any rim, so these pass pre-fix by construction
 *      (E/W float at plateau height over the far shell per ADR 0016; the
 *      north edge is GROUNDED by the campus far-ground grid; south is a
 *      real terrain descent). Only a km-scale UPWARD cast fails.
 *
 * FIX-SENSITIVE checks (would FAIL on pre-fix code): A0, A3, B1, B3.
 * Regression guards / canaries (pass pre-fix too, on purpose): A1 (wade
 * floor not over-suppressed by the cap), C1/C2 (claim-from-above intact),
 * D-* (accepted float/descent behavior unchanged).
 *
 * Floor expectations come from the LIVE scene probe (__laas.groundProbe at
 * the seed position), never hand-derived constants — real terrain under the
 * corridor sits ~481 m (plazaTopY ~483.85), not the CPU sim's flat 470.
 * Every walk entry also asserts the eye snapped DOWN off the fly seed
 * (walk actually engaged) so a dropped V press cannot false-pass.
 *
 * Usage: dev server on :5173, then  npx tsx tools/probe-walkfling-live.ts
 * Optional `--only a,b` runs a scenario subset (one NJ boot is ~60-90 s;
 * run A+B then C+D to stay under the 600 s harness command cap — and run
 * FOREGROUND: harness background tasks are killed at ~2 min regardless of
 * the requested timeout).
 * Writes proof shots to shots/wip/flingfix-live-{a,c}.png.
 */

import type { Page } from 'playwright';
import { launchWebGPU, laasUrl } from './launch';

const W = 1280;
const H = 800;
const SAMPLE_MS = 150;
const JUMP_LIMIT_M = 50; // pre-fix signature was +322 m in one frame
const ENTRY_CEILING_M = 500; // plateau-level entries: lowest stacked pool is ~797 m
const EYE_HEIGHT = 1.7; // FlyCamera walk constants (assert-side mirrors)
const WADE_CLEAR = 0.45;
const failures: string[] = [];

const onlyArg = process.argv.find((a) => a.startsWith('--only'));
const only = new Set(
  (onlyArg ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : process.argv[process.argv.indexOf(onlyArg) + 1]) : 'a,b,c,d')
    .split(',')
    .map((s) => s.trim().toLowerCase()),
);

interface Pose {
  p: [number, number, number];
  yaw: number;
  pitch: number;
}

const pose = async (page: Page): Promise<Pose> =>
  (await page.evaluate('window.__laas.getPose()')) as Pose;

const setPose = async (
  page: Page,
  p: [number, number, number],
  yaw: number,
  pitch: number,
): Promise<void> => {
  await page.evaluate(`window.__laas.setPose({p:[${p[0]},${p[1]},${p[2]}],yaw:${yaw},pitch:${pitch}})`);
};

/** setPose leaves the rig in fly (by contract); a single V enters walk. */
const enterWalk = async (page: Page): Promise<void> => {
  await page.keyboard.press('KeyV');
  await page.waitForTimeout(250); // walk-entry snap happens on the press
};

/** The scene's REAL probe components at a spot — the ground truth the walk
 *  floor derives from (floor = max(ground + 1.7, water + 0.45)). */
const probeFloor = async (
  page: Page,
  tag: string,
  x: number,
  z: number,
  y: number,
): Promise<{ ground: number; water: number; floor: number }> => {
  const g = (await page.evaluate(`window.__laas.groundProbe(${x}, ${z}, ${y})`)) as {
    ground: number;
    water: number;
  };
  const floor = Math.max(g.ground + EYE_HEIGHT, g.water + WADE_CLEAR);
  console.log(
    `[probe] ${tag} groundProbe(${x}, ${z}, eye ${y}) -> ground ${g.ground.toFixed(2)} water ${g.water.toFixed(2)} floor ${floor.toFixed(2)}`,
  );
  return { ...g, floor };
};

/** Seed a fly pose, enter walk, and assert the entry snap ENGAGED (eye
 *  dropped off the seed) and landed on the live-probed floor under an
 *  absolute anti-fling ceiling. Returns the entry pose. */
async function walkEntry(
  page: Page,
  tag: string,
  p: [number, number, number],
  yaw: number,
  ceiling: number,
  preFixNote: string,
): Promise<Pose> {
  const f = await probeFloor(page, tag, p[0], p[2], p[1]);
  await setPose(page, p, yaw, 0);
  await enterWalk(page);
  const e = await pose(page);
  check(
    `${tag} walk-entry snap engaged and terrain-true`,
    e.p[1] < p[1] - 1.5 && e.p[1] < ceiling && Math.abs(e.p[1] - f.floor) < 1.0,
    `entry eye ${e.p[1].toFixed(2)} m (live floor ${f.floor.toFixed(2)}; ${preFixNote})`,
  );
  return e;
}

interface WalkResult {
  startY: number;
  maxY: number;
  maxUpJump: number;
  jumpAt: { y: number; z: number; x: number };
  moved: number;
  end: Pose;
}

/** Hold Shift+W for `ms`, sampling the logical pose; returns motion stats. */
async function walk(page: Page, ms: number, sprint = true): Promise<WalkResult> {
  const p0 = await pose(page);
  if (sprint) await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  let prevY = p0.p[1];
  let maxY = prevY;
  let maxUpJump = 0;
  const jumpAt = { y: prevY, z: p0.p[2], x: p0.p[0] };
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await page.waitForTimeout(SAMPLE_MS);
    const p = await pose(page);
    const up = p.p[1] - prevY; // upward only — falls are legitimate
    if (up > maxUpJump) {
      maxUpJump = up;
      jumpAt.y = p.p[1];
      jumpAt.z = p.p[2];
      jumpAt.x = p.p[0];
    }
    if (p.p[1] > maxY) maxY = p.p[1];
    prevY = p.p[1];
  }
  await page.keyboard.up('KeyW');
  if (sprint) await page.keyboard.up('ShiftLeft');
  const end = await pose(page);
  const moved = Math.hypot(end.p[0] - p0.p[0], end.p[2] - p0.p[2]);
  return { startY: p0.p[1], maxY, maxUpJump, jumpAt, moved, end };
}

const check = (name: string, ok: boolean, detail: string): void => {
  console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures.push(name);
};

const fmt = (r: WalkResult): string =>
  `start y ${r.startY.toFixed(1)}, max y ${r.maxY.toFixed(1)}, ` +
  `max up-jump ${r.maxUpJump.toFixed(1)} m (at x ${r.jumpAt.x.toFixed(0)} z ${r.jumpAt.z.toFixed(0)}), ` +
  `moved ${r.moved.toFixed(0)} m, end (${r.end.p[0].toFixed(0)}, ${r.end.p[1].toFixed(1)}, ${r.end.p[2].toFixed(0)})`;

async function shot(page: Page, name: string): Promise<void> {
  await page.evaluate('window.__laas.settle ? window.__laas.settle(16) : null');
  await page.screenshot({ path: `shots/wip/${name}.png` });
  console.log(`[probe] shot: shots/wip/${name}.png`);
}

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  browser.on('disconnected', () => console.log('[probe] BROWSER DISCONNECTED'));
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('crash', () => console.log('[probe] PAGE CRASHED'));
  page.on('console', (msg) => {
    const t = msg.text();
    if (msg.type() === 'error' || t.startsWith('[laas] camera mode')) console.log(`[page] ${t}`);
  });

  const url = laasUrl({ scene: 'newjerusalem', width: W, height: H, hud: false, freeze: false });
  console.log(`[probe] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    'window.__laas && (window.__laas.ready || window.__laas.error !== null)',
    undefined,
    { timeout: 300000, polling: 250 },
  );
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);
  const diag = (await page.evaluate('window.__laas.diag')) as {
    vendor?: string;
    architecture?: string;
    description?: string;
  } | null;
  console.log(
    `[probe] adapter: ${diag?.vendor ?? '?'} / ${diag?.architecture ?? '?'} ${diag?.description ?? ''}`,
  );

  if (only.has('a')) {
    // ---- A: the reported repro path -----------------------------------------
    // A0 (FIX-SENSITIVE): entry snap INSIDE pool0's plan rect (world z
    // 1696..2060) — pre-fix the pool owned this cell and the snap teleported
    // the eye to ~797 m.
    await walkEntry(page, 'A0 pool0-rect', [0, 490, 1900], 0, ENTRY_CEILING_M, 'pre-fix: ~797 m');

    // A1 (canary): entry on the approach channel 200 m south of the pool
    // rect — the channel claims this cell pre- AND post-fix (wade floor
    // ~486); guards the cap against over-firing and un-claiming the channel.
    // The pre-fix fling fired mid-walk at z ~2060 — A3 is the catcher.
    await walkEntry(page, 'A1 channel', [0, 490, 2260], 0, ENTRY_CEILING_M, 'pre-fix: same — fling fired at z ~2060, see A3');
    const a = await walk(page, 42000);
    check(
      'A2 crossed the pool-rect boundary and the wall line (coverage guard)',
      a.end.p[2] < 2000,
      `reached z ${a.end.p[2].toFixed(0)} (boundary z ~2060; needs ~260 m — slow adapters cut margin)`,
    );
    check(
      'A3 no fling on the approach corridor (FIX-SENSITIVE)',
      a.maxUpJump < JUMP_LIMIT_M && a.maxY < 520,
      fmt(a),
    );
    await shot(page, 'flingfix-live-a');
  }

  if (only.has('b')) {
    // ---- B: corridor-center entry under the crown basin ---------------------
    // B1 (FIX-SENSITIVE): local x 0, z 5 — the crown rect owns this plan cell;
    // pre-fix the walk-entry snap alone teleported the eye to ~3600 m.
    await walkEntry(page, 'B1 corridor-center', [0, 490, 100], -Math.PI / 2, ENTRY_CEILING_M, 'pre-fix: ~3600 m — crown overhead');
    const b = await walk(page, 25000);
    check(
      'B2 walked east out of the corridor at plaza level (coverage guard)',
      b.end.p[0] > 60,
      `reached x ${b.end.p[0].toFixed(0)} (corridor |x| <= 56)`,
    );
    check(
      'B3 no teleport under the stacked pools (FIX-SENSITIVE)',
      b.maxUpJump < JUMP_LIMIT_M && b.maxY < 520,
      fmt(b),
    );
  }

  if (only.has('c')) {
    // ---- C (canary): crown basin still claims a walker standing on it -------
    const cf = await probeFloor(page, 'C crown', 0, 100, 3650);
    check(
      'C0 crown water claims at altitude',
      cf.water > 3000,
      `probed water ${cf.water.toFixed(2)} m at eye 3650 (crown surface)`,
    );
    await setPose(page, [0, 3650, 100], Math.PI, -0.1);
    await enterWalk(page);
    await page.waitForTimeout(500);
    const c0 = await pose(page);
    check(
      'C1 walker stands ON the crown surface',
      Math.abs(c0.p[1] - cf.floor) < 1.0,
      `eye ${c0.p[1].toFixed(2)} m (live floor ${cf.floor.toFixed(2)})`,
    );
    await shot(page, 'flingfix-live-c'); // before the stroll — walking south can
    // step off the small crown rect and start a (legitimate) 3 km fall
    const c = await walk(page, 2500, false);
    check(
      'C2 standing/strolling on the crown is stable (no upward cast)',
      c.maxUpJump < 10,
      fmt(c),
    );
  }

  if (only.has('d')) {
    // ---- D (canaries): rim walk-offs, four compass directions ---------------
    // No reach rect is near any rim — these pass pre-fix by construction and
    // exist to confirm the ACCEPTED behaviors are unchanged: south descends
    // real terrain; E/W float at plateau height over the far shell (candidates
    // 2/3, ADR 0016); north is grounded by the campus far-ground grid. Each
    // asserts entry engagement + real displacement so a stalled walker can't
    // silently pass, and fails only on an upward cast.
    const rims: Array<{ tag: string; p: [number, number, number]; yaw: number }> = [
      { tag: 'D-S south rim', p: [300, 500, 4300], yaw: Math.PI },
      { tag: 'D-E east rim', p: [6000, 500, 0], yaw: -Math.PI / 2 },
      { tag: 'D-W west rim', p: [-6000, 500, 0], yaw: Math.PI / 2 },
      { tag: 'D-N north edge', p: [3000, 500, -6000], yaw: 0 },
    ];
    for (const rim of rims) {
      await walkEntry(page, rim.tag, rim.p, rim.yaw, ENTRY_CEILING_M, 'pre-fix: same — no reach here');
      const d = await walk(page, 25000);
      check(
        `${rim.tag} walk-off: moved, no upward fling (canary)`,
        d.moved > 60 && d.maxUpJump < JUMP_LIMIT_M && d.maxY < d.startY + 100,
        fmt(d),
      );
    }
  }

  const stats = (await page.evaluate('window.__laas.stats')) as { fps: number; frameMsP95: number } | null;
  console.log(`[probe] fps ${stats?.fps.toFixed(0) ?? '?'}  frameMsP95 ${stats?.frameMsP95.toFixed(1) ?? '?'}`);

  await browser.close();
  console.log(
    failures.length === 0
      ? '[probe] walk-fling live: ALL PASS'
      : `[probe] walk-fling live: ${failures.length} FAILURE(S): ${failures.join(', ')}`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
