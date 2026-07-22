/**
 * probe-mousesteer.ts — live interactive check of the mouse-steer navigation
 * (2026-07-01 rework: visible cursor, view eases toward it, dead-zoned;
 * replaced pointer-lock). shoot.ts can't exercise input; Playwright's
 * page.mouse emits REAL trusted CDP input events, so this probe can.
 *
 * Boots ?scene=newjerusalem un-frozen at the walk spawn, then:
 *   1. parks the cursor dead-center (dead zone) — yaw/pitch must hold still;
 *   2. holds the cursor at the right edge — yaw must ease one way;
 *   3. holds it at the left edge — yaw must ease the other way;
 *   4. holds it near the top — pitch must ease upward (opposite sign of a
 *      bottom hold).
 * Prints deltas and PASS/FAIL per check.
 *
 * Usage: npx tsx tools/probe-mousesteer.ts
 */

import { launchWebGPU, laasUrl } from './launch';

const W = 1280;
const H = 800;
const HOLD_MS = 1800;

async function main(): Promise<void> {
  // --port targets a non-default dev server (worktree sessions)
  const portArg = process.argv.indexOf('--port');
  const base = portArg >= 0 ? `http://localhost:${process.argv[portArg + 1]}/` : 'http://localhost:5173/';
  const { browser } = await launchWebGPU(base.replace(/\/$/, ''));
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[page:error] ${msg.text()}`);
  });

  const url = laasUrl({ scene: 'newjerusalem', width: W, height: H, hud: false, freeze: false }, base);
  console.log(`[probe] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    'window.__laas && (window.__laas.ready || window.__laas.error !== null)',
    undefined,
    { timeout: 240000, polling: 250 },
  );
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);

  const pose = async (): Promise<{ yaw: number; pitch: number }> =>
    (await page.evaluate('window.__laas.getPose ? window.__laas.getPose() : null')) as {
      yaw: number;
      pitch: number;
    };

  const results: Array<{ check: string; pass: boolean; detail: string }> = [];

  // 1. dead zone: park at center, expect no drift
  await page.mouse.move(W / 2, H / 2, { steps: 10 });
  await page.waitForTimeout(600); // let any transient ease out
  const c0 = await pose();
  await page.waitForTimeout(HOLD_MS);
  const c1 = await pose();
  const driftYaw = Math.abs(c1.yaw - c0.yaw);
  const driftPitch = Math.abs(c1.pitch - c0.pitch);
  results.push({
    check: 'dead-zone hold',
    pass: driftYaw < 0.01 && driftPitch < 0.01,
    detail: `driftYaw=${driftYaw.toFixed(4)} driftPitch=${driftPitch.toFixed(4)}`,
  });

  // 2. right-edge hold: yaw eases
  const r0 = await pose();
  await page.mouse.move(W - 90, H / 2, { steps: 15 });
  await page.waitForTimeout(HOLD_MS);
  const r1 = await pose();
  const dYawR = r1.yaw - r0.yaw;
  results.push({
    check: 'right-edge steer',
    pass: Math.abs(dYawR) > 0.05,
    detail: `dYaw=${dYawR.toFixed(4)}`,
  });

  // 3. left-edge hold: yaw eases the other way
  const l0 = await pose();
  await page.mouse.move(90, H / 2, { steps: 15 });
  await page.waitForTimeout(HOLD_MS + 600);
  const l1 = await pose();
  const dYawL = l1.yaw - l0.yaw;
  results.push({
    check: 'left-edge steer (opposite)',
    pass: Math.abs(dYawL) > 0.05 && Math.sign(dYawL) === -Math.sign(dYawR),
    detail: `dYaw=${dYawL.toFixed(4)} (right pass was ${dYawR.toFixed(4)})`,
  });

  // 4. top hold vs bottom hold: pitch signs oppose
  await page.mouse.move(W / 2, 80, { steps: 15 });
  const t0 = await pose();
  await page.waitForTimeout(HOLD_MS);
  const t1 = await pose();
  const dPitchT = t1.pitch - t0.pitch;
  await page.mouse.move(W / 2, H - 80, { steps: 15 });
  const b0 = await pose();
  await page.waitForTimeout(HOLD_MS);
  const b1 = await pose();
  const dPitchB = b1.pitch - b0.pitch;
  results.push({
    check: 'top/bottom pitch steer',
    pass:
      Math.abs(dPitchT) > 0.03 &&
      Math.abs(dPitchB) > 0.03 &&
      Math.sign(dPitchT) === -Math.sign(dPitchB),
    detail: `dPitchTop=${dPitchT.toFixed(4)} dPitchBottom=${dPitchB.toFixed(4)}`,
  });

  let allPass = true;
  for (const r of results) {
    console.log(`[probe] ${r.pass ? 'PASS' : 'FAIL'}  ${r.check}: ${r.detail}`);
    if (!r.pass) allPass = false;
  }
  await browser.close();
  console.log(`[probe] mouse-steer: ${allPass ? 'ALL PASS' : 'FAILURES PRESENT'}`);
  process.exit(allPass ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
