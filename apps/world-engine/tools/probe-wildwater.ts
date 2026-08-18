/**
 * Hydrology safety check for the ?wildring variants (wildRing.ts): boots the
 * New Jerusalem scene per variant and samples the CPU hydrology mirrors over
 * the regions that must stay dry (spawn meadow, processional approach, flat
 * core) and over the walkable south band (where the variant's river/lake
 * SHOULD hold water). Reports wet-cell counts, max depth, and the deepest
 * cell per region so a flooded plateau or a spilled lake is caught before
 * Scott reviews the stills.
 *
 *   npx tsx tools/probe-wildwater.ts [--wildring 1] [--seed 1]
 */

import { launchWebGPU, laasUrl } from './launch';

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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
