/**
 * Live browser check for `?stages=` (src/nj/stages.ts — plan doc Phase C):
 * a stage owns its geometry AND its derived probe hooks, so disabling a
 * stage must remove the hooks too, not leave stale invisible physics.
 *
 * Boot A (default, all stages): wall collision installed and blocking at a
 * solid wall point; the river wrap claims wade water on the approach
 * channel; the city floors wrap claims the plaza slab.
 *
 * Boot B (?stages=-city,-river): moveProbe is null; the channel point is
 * dry; the plaza point falls through to bare terrain (≈2.8 m lower).
 *
 *   npm run dev   (port 5173)
 *   npx tsx tools/probe-stages-live.ts
 */

import type { Page } from 'playwright';
import { launchWebGPU, laasUrl } from './launch';
import { makeChecker } from './check';

const c = makeChecker();

// world-space test points (yaw 0 = -Z north; walls at ±2000 world):
// - collision point: x 500 (local 25 — between the south gates at local
//   0/50, gate half-width 4), one FRAME-SCALE move from the open meadow
//   (z 2090, outside the foundation course's outer face at ~2068.6) into
//   the course band (z 2060). The start matters: a start at z ≤ 2068 is
//   INSIDE the course volume, and exact-placement semantics let a body
//   already inside a solid move freely (band-spanning moves themselves
//   cannot tunnel — probe-wallcollide T1-T3 pin the incremental sweep)
// - channel point: (0, 2400) on the meridian approach reach (the
//   probe-walkfling corridor); wade eye ≈ ground + 5.5 sits just above the
//   channel surface (plazaTop + 2), inside the water-claim cap
// - plaza point: (1860, 0) in the east wall gallery band / gate corridor —
//   a real walk floor at plazaTopY, outside the solid plinth footprint

interface HookSample {
  moveProbeType: string;
  blockedZ: number | null;
  channel: { ground: number; water: number } | null;
  plazaGround: number | null;
}

async function sampleHooks(page: Page): Promise<HookSample> {
  return page.evaluate(() => {
    const gp = window.__laas.groundProbe;
    const mp = window.__laas.moveProbe;
    const out = {
      moveProbeType: typeof mp,
      blockedZ: null as number | null,
      channel: null as { ground: number; water: number } | null,
      plazaGround: null as number | null,
    };
    if (gp) {
      const meadow = gp(500, 2090);
      if (mp) out.blockedZ = mp(500, 2090, 500, 2060, meadow.ground + 1.7).z;
      const base = gp(0, 2400);
      const wade = gp(0, 2400, base.ground + 5.5);
      out.channel = { ground: wade.ground, water: wade.water };
      const gallery = gp(1860, 0);
      out.plazaGround = gp(1860, 0, gallery.ground + 1.7).ground;
    }
    return out;
  });
}

async function bootAndSample(
  page: Page,
  extra: Record<string, string>,
): Promise<HookSample> {
  await page.goto(laasUrl({ scene: 'newjerusalem', extra }), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
    undefined,
    { timeout: 240000, polling: 100 },
  );
  const err = await page.evaluate(() => window.__laas.error);
  if (err) throw new Error(`engine error: ${err}`);
  await page.evaluate(async () => window.__laas.settle && (await window.__laas.settle(4)));
  return sampleHooks(page);
}

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => {
    console.log(`[page:error] ${e.message}`);
    c.fail('pageerror');
  });

  let a: HookSample;
  let b: HookSample;
  try {
    a = await bootAndSample(page, {});
    b = await bootAndSample(page, { stages: '-city,-river' });
  } finally {
    await browser.close();
  }

  // ---- A: default boot — every hook installed and claiming ----------------
  c.check('A1 wall collision installed', a.moveProbeType === 'function');
  c.check(
    'A2 the foundation course blocks the approach frame',
    a.blockedZ !== null && a.blockedZ > 2065,
    `move 2090→2060 stopped at z ${a.blockedZ?.toFixed(1) ?? 'null'}`,
  );
  c.check(
    'A3 the river wrap claims wade water on the channel',
    a.channel !== null && a.channel.water > a.channel.ground,
    `ground ${a.channel?.ground.toFixed(2)} water ${a.channel?.water.toFixed(2)}`,
  );

  // ---- B: -city,-river boot — the hooks left with their geometry ----------
  c.check(
    'B1 city off drops wall collision entirely',
    b.moveProbeType === 'object', // typeof null
    `moveProbe typeof ${b.moveProbeType}`,
  );
  c.check(
    'B2 river off leaves the channel dry',
    b.channel !== null && b.channel.water < b.channel.ground,
    `ground ${b.channel?.ground.toFixed(2)} water ${b.channel?.water.toFixed(2)}`,
  );
  c.check(
    'B3 city off drops the plaza walk floor to bare terrain',
    a.plazaGround !== null && b.plazaGround !== null && a.plazaGround - b.plazaGround > 2,
    `plaza ground ${a.plazaGround?.toFixed(2)} (on) vs ${b.plazaGround?.toFixed(2)} (off)`,
  );

  c.finish();
}

void main();
