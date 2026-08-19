/**
 * RimFalls site audit — boots the New Jerusalem scene and replays the exact
 * findRimFallSites() scan (RimFalls.ts) against the live CPU hydrology
 * mirrors, printing every clustered candidate with its lip position, ribbon
 * top/foot heights, plunge-pool position and the terrain around the pool.
 * Exists because the scanner is automatic over an emergent field: after any
 * terrain change near the rim (e.g. the wild-ring south band) nobody can say
 * WHERE the falls landed without booting the engine and looking. This prints
 * the numbers; shoot.ts provides the eyes.
 *
 *   npx tsx tools/probe-rimfalls.ts [--wildring 2] [--seed 1] [--port 5173]
 *
 * Rim math (rimSdf / normals) is duplicated INTO the page via constants from
 * src/nj/rimModel — imported here Node-side so the numbers cannot drift.
 */

import { RIM, RIM_CLIFF } from '../src/nj/rimModel';
import { makeChecker } from './check';
import { launchWebGPU, laasUrl } from './launch';

/** DESIGN record — the canyonlands-default emergent site set. Provenance:
 *  the 2026-08-18 verify-branch review and an independent 2026-08-19 GA-3
 *  round-0 re-scan produced identical lips; these are emergent hydrology
 *  outcomes (like probe-wildwater's DESIGN), so they cannot be imported
 *  from an authored constant. Verdicts run only on the DEFAULT variant
 *  and default seed; any --wildring/--seed override is report-only.
 *  Pool water depth is deliberately NOT asserted (the CPU mirror reports
 *  the pools dry — depth ≈ -2..-3 m — a standing observation, not a bar).
 */
const DESIGN = {
  sites: [
    { x: -1305, z: 4400 },
    { x: 339, z: 4400 },
    { x: -3561, z: 4400 },
  ],
  posTolM: 50, // half a scan cluster cell
  dropMinM: 230, // recorded drops 244.1-252.3; ±~10 m of slack
  dropMaxM: 270,
};

interface SiteReport {
  x: number;
  z: number;
  score: number;
  topY: number;
  footY: number;
  poolX: number;
  poolZ: number;
  poolGroundY: number;
  poolWaterDepth: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const get = (k: string): string | undefined => {
    const i = args.indexOf(`--${k}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const wildring = get('wildring');
  const seed = Number(get('seed') ?? '1');
  const port = Number(get('port') ?? '5173');

  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 320, height: 200 } });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  const extra: Record<string, string> = {};
  if (wildring) extra['wildring'] = wildring;
  await page.goto(
    laasUrl(
      { scene: 'newjerusalem', seed, width: 320, height: 200, extra },
      `http://localhost:${port}/`,
    ),
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForFunction(
    () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
    undefined,
    { timeout: 240000, polling: 250 },
  );

  const result = await page.evaluate(
    ({ rim, cliff }) => {
      (globalThis as unknown as { __name?: unknown }).__name ??= (t: unknown): unknown => t;
      const dbg = (window as unknown as {
        __laasDbg?: { engine?: { heightfield?: unknown } };
      }).__laasDbg;
      const hf = dbg?.engine?.heightfield as {
        simRes: number;
        heightAtCpu(x: number, z: number): number;
        waterYAtCpu(x: number, z: number): number;
      };
      if (!hf) return null;

      // ---- exact mirrors of RimFalls.ts constants and rimModel math ----
      const WORLD_SIZE = 12288;
      const MAX_SITES = 4;
      const CLUSTER_M = 260;
      const SCAN_MARGIN = 6100;
      const sdf = (x: number, z: number): number => {
        const qx = Math.abs(x - rim.cx) - (rim.hx - rim.cornerR);
        const qz = Math.abs(z - rim.cz) - (rim.hz - rim.cornerR);
        const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
        return outside + Math.min(Math.max(qx, qz), 0) - rim.cornerR;
      };
      const normal = (x: number, z: number): [number, number] => {
        const e = 2;
        const nx = sdf(x + e, z) - sdf(x - e, z);
        const nz = sdf(x, z + e) - sdf(x, z - e);
        const l = Math.hypot(nx, nz) || 1;
        return [nx / l, nz / l];
      };
      const clampDomain = (v: number): number =>
        Math.max(-SCAN_MARGIN, Math.min(SCAN_MARGIN, v));

      // ---- exact replay of findRimFallSites ----
      const simRes = hf.simRes;
      const clusters = new Map<string, { x: number; z: number; score: number }>();
      for (let zi = 0; zi < simRes; zi++) {
        const z = ((zi + 0.5) / simRes - 0.5) * WORLD_SIZE;
        if (Math.abs(z) > SCAN_MARGIN) continue;
        for (let xi = 0; xi < simRes; xi++) {
          const x = ((xi + 0.5) / simRes - 0.5) * WORLD_SIZE;
          if (Math.abs(x) > SCAN_MARGIN) continue;
          const d = sdf(x, z);
          if (d < -400 || d > -60) continue;
          const depth = hf.waterYAtCpu(x, z) - hf.heightAtCpu(x, z);
          if (depth < 0.1) continue;
          const [nx, nz] = normal(x, z);
          const lx = x - nx * d;
          const lz = z - nz * d;
          const key = `${Math.round(lx / CLUSTER_M)}:${Math.round(lz / CLUSTER_M)}`;
          const c = clusters.get(key);
          if (c) c.score += depth;
          else clusters.set(key, { x: lx, z: lz, score: depth });
        }
      }
      const allClusters = [...clusters.values()].sort((a, b) => b.score - a.score);
      const ranked = allClusters.slice(0, MAX_SITES);

      const siteAt = (x: number, z: number, score: number) => {
        const [nx, nz] = normal(x, z);
        const topY = hf.heightAtCpu(x - nx * (cliff.lip + 50), z - nz * (cliff.lip + 50));
        const footX = clampDomain(x + nx * (cliff.face + 90));
        const footZ = clampDomain(z + nz * (cliff.face + 90));
        const footY = hf.heightAtCpu(footX, footZ);
        const poolX = x + nx * (cliff.face + 60);
        const poolZ = z + nz * (cliff.face + 60);
        const poolGroundY = hf.heightAtCpu(poolX, poolZ);
        const poolWaterDepth = hf.waterYAtCpu(poolX, poolZ) - poolGroundY;
        return { x, z, score, topY, footY, poolX, poolZ, poolGroundY, poolWaterDepth };
      };

      return {
        totalClusters: allClusters.length,
        sites: ranked.map((c) => siteAt(c.x, c.z, c.score)),
        dropped: allClusters.slice(MAX_SITES).map((c) => ({ x: c.x, z: c.z, score: c.score })),
      };
    },
    { rim: RIM, cliff: RIM_CLIFF },
  );

  const c = makeChecker();
  if (!result) {
    // three-verdict contract: a missing hook is UNMEASURED, not FAIL
    c.unmeasured('R0 heightfield debug handle', 'no __laasDbg heightfield — did the scene boot?');
    c.finish();
    return; // unreachable; narrows `result` for tsc
  }

  console.log(
    `[rimfalls] wildring=${wildring ?? 'default'} seed=${seed} — ` +
      `${result.sites.length} emergent site(s) from ${result.totalClusters} cluster(s)` +
      (result.sites.length === 0 ? ' (scene will use ANCHOR sites at x=900/1700)' : ''),
  );
  for (const s of result.sites as SiteReport[]) {
    const drop = s.topY - s.footY;
    console.log(
      `  lip (${s.x.toFixed(0)}, ${s.z.toFixed(0)}) score ${s.score.toFixed(1)} — ` +
        `top ${s.topY.toFixed(1)} foot ${s.footY.toFixed(1)} (drop ${drop.toFixed(1)} m)`,
    );
    console.log(
      `    pool at (${s.poolX.toFixed(0)}, ${s.poolZ.toFixed(0)}) ground ` +
        `${s.poolGroundY.toFixed(1)} water depth ${s.poolWaterDepth.toFixed(2)} m`,
    );
  }
  for (const d of result.dropped) {
    console.log(`  dropped cluster (${d.x.toFixed(0)}, ${d.z.toFixed(0)}) score ${d.score.toFixed(1)}`);
  }
  await browser.close();

  if (wildring === undefined && seed === 1) {
    const sites = result.sites as SiteReport[];
    c.check(
      'R1 canyonlands default yields exactly the three designed sites',
      sites.length === DESIGN.sites.length,
      `got ${sites.length}`,
    );
    for (const ds of DESIGN.sites) {
      const hit = sites.find(
        (s) => Math.abs(s.x - ds.x) <= DESIGN.posTolM && Math.abs(s.z - ds.z) <= DESIGN.posTolM,
      );
      c.check(
        `R2 site near (${ds.x}, ${ds.z})`,
        hit !== undefined,
        hit ? `lip (${hit.x.toFixed(0)}, ${hit.z.toFixed(0)})` : 'no cluster within tolerance',
      );
      if (hit) {
        const drop = hit.topY - hit.footY;
        c.check(
          `R3 drop at (${ds.x}, ${ds.z}) within the recorded band`,
          drop >= DESIGN.dropMinM && drop <= DESIGN.dropMaxM,
          `${drop.toFixed(1)} m (band ${DESIGN.dropMinM}-${DESIGN.dropMaxM})`,
        );
      }
    }
    c.finish({ minChecks: 4 }); // R1 + three R2 rows at minimum
  }
  console.log('[rimfalls] non-default variant/seed — report only, no verdicts');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
