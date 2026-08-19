/**
 * Hydrology safety check for the ?wildring variants (wildRing.ts): boots the
 * New Jerusalem scene per variant and samples the CPU hydrology mirrors over
 * the regions that must stay dry (spawn meadow, processional approach, flat
 * core) and over the walkable south band (where the variant's river/lake
 * SHOULD hold water). Reports wet-cell counts, max depth, and the deepest
 * cell per region so a flooded plateau or a spilled lake is caught before
 * Scott reviews the stills.
 *
 * Verdicts (added per DEFECTS.md FC-0002 — this probe previously had no
 * failure path at all): generic safety invariants run on EVERY variant/seed;
 * the designed-end-state checks run only on the shipped default (no
 * --wildring, seed 1), whose expected values are the canyonlands design
 * record. A missing hydrology hook is UNMEASURED (exit 2), never a pass.
 *
 *   npx tsx tools/probe-wildwater.ts [--wildring 1] [--seed 1]
 */

import { makeChecker } from './check';
import { launchWebGPU, laasUrl } from './launch';

/**
 * Designed end state of the DEFAULT wild ring (canyonlands), verified against
 * the live scene 2026-08-18 (13-probe battery; STATUS 2026-08-17 wild-ring
 * entry). Positions are the authored macro anchors in src/nj/wildRing.ts
 * (applyWildRing, default variant); depths/levels are the EMERGENT hydrology
 * outcomes of those anchors under the drain law, so they cannot be imported
 * from source — they are the recorded design outcome (provenance: control-
 * derived, not measured-from-whatever-the-scene-currently-does: a change that
 * moves them is a real hydrology change and MUST fail here until this record
 * is deliberately updated alongside it).
 *
 * Tolerances: +-150..300 m position (sampling grids are 24-80 m; pocket
 * buckets 256 m), +-1.5 m depth and +-2.5 m waterY (erosion/level jitter
 * across boots stays well inside this; a refilled cenote-class trap is
 * 3-6 m outside it).
 */
const DESIGN = {
  spawnPond: { x: 1100, z: 3725, depth: 8.75 },
  westLake: { x: -1870, z: 5550, depth: 9.36, waterY: 138.5 },
  dolines: [
    { x: 1316, z: 6042, depth: 9.0 },
    { x: 1772, z: 5874, depth: 9.0 },
    { x: 2804, z: 5898, depth: 7.9 },
  ],
  tol: { pos: 300, depth: 1.5, waterY: 2.5, pocketPos: 200 },
  /** nothing anywhere may be deeper than this — the deepest authored water is
   *  the west lake at 9.36 m; a karst trap refilled to cenote depth reads
   *  12 m+ (the failure class the drain law exists to prevent) */
  depthCeiling: 11,
  /** lake lobes spill across several 256 m buckets; anything inside this
   *  radius of the lake anchor at lake-level waterY is the lake itself */
  lakeRadius: 900,
} as const;

const dist = (x: number, z: number, p: { x: number; z: number }): number =>
  Math.hypot(x - p.x, z - p.z);

interface RegionReport {
  name: string;
  cells: number;
  wet: number;
  maxDepth: number;
  at: [number, number];
  maxWaterY: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const wildring = get('wildring');
  const seed = Number(get('seed') ?? '1');

  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  const extra: Record<string, string> = {};
  if (wildring) extra['wildring'] = wildring;
  await page.goto(laasUrl({ scene: 'newjerusalem', seed, width: 320, height: 200, extra }), {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForFunction(
    () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );

  const reports = await page.evaluate(() => {
    (globalThis as unknown as { __name?: unknown }).__name ??= (t: unknown): unknown => t;
    const dbg = (window as unknown as {
      __laasDbg?: { engine?: { heightfield?: unknown } };
    }).__laasDbg;
    const hf = dbg?.engine?.heightfield as {
      heightAtCpu(x: number, z: number): number;
      waterYAtCpu(x: number, z: number): number;
    };
    if (!hf) return [] as RegionReport[];
    // regions: [name, x0, x1, z0, z1, step]
    const regions: [string, number, number, number, number, number][] = [
      ['flat-core (city+forecourt)', -2750, 2750, -2700, 3000, 40],
      ['approach lawn (spawn->gate)', -450, 450, 2380, 3300, 20],
      ['spawn meadow', -1200, 1200, 3000, 4200, 25],
      ['plateau top (rest)', -6000, 6000, -6000, 4200, 80],
      ['wild band (below rim)', -6100, 6100, 4650, 6100, 30],
    ];
    const out: RegionReport[] = [];
    for (const [name, x0, x1, z0, z1, step] of regions) {
      let cells = 0;
      let wet = 0;
      let maxDepth = 0;
      let at: [number, number] = [0, 0];
      let maxWaterY = -1;
      for (let z = z0; z <= z1; z += step) {
        for (let x = x0; x <= x1; x += step) {
          cells++;
          const d = hf.waterYAtCpu(x, z) - hf.heightAtCpu(x, z);
          if (d > 0.15) {
            wet++;
            if (d > maxDepth) {
              maxDepth = d;
              at = [x, z];
              maxWaterY = hf.waterYAtCpu(x, z);
            }
          }
        }
      }
      out.push({ name, cells, wet, maxDepth, at, maxWaterY });
    }
    return out;
  });

  // distinct pockets in the wild band: bucket wet cells on a 256 m grid and
  // report each bucket's deepest cell, deepest bucket first — one trapped
  // lake can otherwise hide every other one behind the single region max
  const pockets = await page.evaluate(() => {
    (globalThis as unknown as { __name?: unknown }).__name ??= (t: unknown): unknown => t;
    const dbg = (window as unknown as {
      __laasDbg?: { engine?: { heightfield?: unknown } };
    }).__laasDbg;
    const hf = dbg?.engine?.heightfield as {
      heightAtCpu(x: number, z: number): number;
      waterYAtCpu(x: number, z: number): number;
    };
    if (!hf) return [] as { x: number; z: number; depth: number; waterY: number; cells: number }[];
    const buckets = new Map<string, { x: number; z: number; depth: number; waterY: number; cells: number }>();
    for (let z = 4650; z <= 6100; z += 24) {
      for (let x = -6100; x <= 6100; x += 24) {
        const w = hf.waterYAtCpu(x, z);
        const d = w - hf.heightAtCpu(x, z);
        if (d <= 0.5) continue;
        const key = `${Math.round(x / 256)},${Math.round(z / 256)}`;
        const b = buckets.get(key);
        if (!b) buckets.set(key, { x, z, depth: d, waterY: w, cells: 1 });
        else {
          b.cells++;
          if (d > b.depth) {
            b.depth = d;
            b.x = x;
            b.z = z;
            b.waterY = w;
          }
        }
      }
    }
    return [...buckets.values()].sort((a, b) => b.depth - a.depth).slice(0, 10);
  });

  console.log(`[wildwater] wildring=${wildring ?? 'off'} seed=${seed}`);
  for (const r of reports) {
    const pct = ((100 * r.wet) / r.cells).toFixed(1);
    console.log(
      `  ${r.name}: wet ${r.wet}/${r.cells} (${pct}%) maxDepth ${r.maxDepth.toFixed(2)} m` +
        (r.wet ? ` at (${r.at[0]}, ${r.at[1]}) waterY ${r.maxWaterY.toFixed(1)}` : ''),
    );
  }
  console.log('  band pockets (256 m buckets, deepest cell each):');
  for (const p of pockets) {
    console.log(
      `    (${p.x}, ${p.z}) depth ${p.depth.toFixed(1)} m waterY ${p.waterY.toFixed(1)} cells ${p.cells}`,
    );
  }
  await browser.close();

  // ---- verdicts -----------------------------------------------------------
  const c = makeChecker();
  if (reports.length === 0) {
    c.unmeasured(
      'hydrology hook',
      '__laasDbg.engine.heightfield missing — hydrology cannot be sampled; a broken probe must not read as a dry world',
    );
    c.finish();
  }
  const region = (name: string): RegionReport | undefined =>
    reports.find((r) => r.name.startsWith(name));
  const flat = region('flat-core');
  const lawn = region('approach lawn');
  const meadow = region('spawn meadow');
  const plateau = region('plateau top');
  const band = region('wild band');

  // generic safety invariants — every variant, every seed
  c.check('W1 flat core dry', !!flat && flat.wet === 0, flat ? `wet ${flat.wet}` : 'region missing');
  c.check('W2 approach lawn dry', !!lawn && lawn.wet === 0, lawn ? `wet ${lawn.wet}` : 'region missing');
  c.check(
    'W3 no cenote-class water anywhere',
    reports.every((r) => r.maxDepth <= DESIGN.depthCeiling) &&
      pockets.every((p) => p.depth <= DESIGN.depthCeiling),
    `deepest region ${Math.max(...reports.map((r) => r.maxDepth)).toFixed(1)} m, ceiling ${DESIGN.depthCeiling} m`,
  );

  const isDefault = wildring === undefined && seed === 1;
  if (!isDefault) {
    console.log('[wildwater] non-default variant/seed — designed-end-state checks skipped');
    c.finish({ minChecks: 3 });
  }

  // designed end state — shipped canyonlands only (see DESIGN provenance)
  const { spawnPond, westLake, dolines, tol } = DESIGN;
  c.check(
    'W4 spawn pond authored',
    !!meadow &&
      Math.abs(meadow.maxDepth - spawnPond.depth) <= tol.depth &&
      dist(meadow.at[0], meadow.at[1], spawnPond) <= tol.pos,
    meadow ? `deepest ${meadow.maxDepth.toFixed(2)} m at (${meadow.at[0]}, ${meadow.at[1]})` : 'region missing',
  );
  c.check(
    'W5 plateau water is the spawn pond only',
    !!plateau && (plateau.wet === 0 || dist(plateau.at[0], plateau.at[1], spawnPond) <= tol.pos),
    plateau ? `deepest at (${plateau.at[0]}, ${plateau.at[1]})` : 'region missing',
  );
  c.check(
    'W6 west lake holds designed level',
    !!band &&
      Math.abs(band.maxDepth - westLake.depth) <= tol.depth &&
      dist(band.at[0], band.at[1], westLake) <= tol.pos &&
      Math.abs(band.maxWaterY - westLake.waterY) <= tol.waterY,
    band
      ? `deepest ${band.maxDepth.toFixed(2)} m at (${band.at[0]}, ${band.at[1]}) waterY ${band.maxWaterY.toFixed(1)}`
      : 'region missing',
  );
  for (const [i, d] of dolines.entries()) {
    const hit = pockets.find(
      (p) => dist(p.x, p.z, d) <= tol.pocketPos && Math.abs(p.depth - d.depth) <= tol.depth,
    );
    c.check(
      `W7.${i + 1} doline pond at (${d.x}, ${d.z})`,
      !!hit,
      hit ? `found ${hit.depth.toFixed(1)} m at (${hit.x}, ${hit.z})` : 'no matching pocket',
    );
  }
  const unexplained = pockets.filter((p) => {
    const isLake =
      dist(p.x, p.z, westLake) <= DESIGN.lakeRadius &&
      Math.abs(p.waterY - westLake.waterY) <= tol.waterY;
    const isDoline = dolines.some((d) => dist(p.x, p.z, d) <= tol.pocketPos);
    return !isLake && !isDoline;
  });
  c.check(
    'W8 every band pocket is designed water',
    unexplained.length === 0,
    unexplained.length
      ? `unexplained: ${unexplained.map((p) => `(${p.x}, ${p.z}) ${p.depth.toFixed(1)} m`).join('; ')}`
      : `${pockets.length} pockets, all attributed`,
  );
  c.finish({ minChecks: 8 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
