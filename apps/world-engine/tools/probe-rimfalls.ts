/**
 * RimFalls site audit — boots the New Jerusalem scene and reads the fall
 * site set the scene ACTUALLY built (`__laasDbg.rimFalls`, exposed by
 * NewJerusalemScene at the buildRimFalls call), printing every site's lip
 * position, ribbon top/foot heights, plunge-pool position and water depth.
 * Exists because the scanner is automatic over an emergent field: after any
 * terrain change near the rim (e.g. the wild-ring south band) nobody can say
 * WHERE the falls landed without booting the engine and looking. This prints
 * the numbers; shoot.ts provides the eyes.
 *
 * FC-0023: this probe used to REPLAY its own copy of findRimFallSites()
 * inside page.evaluate ("exact mirrors of RimFalls.ts constants"), so it
 * never executed the shipped scanner — the 2026-08-24 mutation battery
 * gutted findRimFallSites to `return []` and the probe stayed green. It now
 * reads the built outcome, so a scanner break, a constant drift, or the
 * scene silently falling back to anchor sites all fail here. The cost: the
 * dropped-cluster report is gone (the scene does not retain non-winning
 * clusters). The only remaining mirror is the +60 m pool offset from
 * buildRimFalls' ribbon-foot placement — report-only, no verdict reads it.
 *
 *   npx tsx tools/probe-rimfalls.ts [--wildring 2] [--seed 1] [--port 5173]
 */

import { RIM_CLIFF } from '../src/nj/rimModel';
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
    ({ cliff }) => {
      (globalThis as unknown as { __name?: unknown }).__name ??= (t: unknown): unknown => t;
      const dbg = (window as unknown as {
        __laasDbg?: {
          engine?: { heightfield?: unknown };
          rimFalls?: {
            emergent: boolean;
            sites: Array<{
              x: number;
              z: number;
              topY: number;
              footY: number;
              nx: number;
              nz: number;
              score: number;
            }>;
          };
        };
      }).__laasDbg;
      const hf = dbg?.engine?.heightfield as {
        heightAtCpu(x: number, z: number): number;
        waterYAtCpu(x: number, z: number): number;
      };
      if (!hf) return { missing: 'heightfield' as const };
      const rf = dbg?.rimFalls;
      if (!rf) return { missing: 'rimFalls' as const };

      // pool report: sample the live field around each REAL site. The +60 m
      // outward offset mirrors buildRimFalls' ribbon-foot placement —
      // report-only, no verdict reads it.
      const sites = rf.sites.map((s) => {
        const poolX = s.x + s.nx * (cliff.face + 60);
        const poolZ = s.z + s.nz * (cliff.face + 60);
        const poolGroundY = hf.heightAtCpu(poolX, poolZ);
        return {
          x: s.x,
          z: s.z,
          score: s.score,
          topY: s.topY,
          footY: s.footY,
          poolX,
          poolZ,
          poolGroundY,
          poolWaterDepth: hf.waterYAtCpu(poolX, poolZ) - poolGroundY,
        };
      });
      return { missing: null, emergent: rf.emergent, sites };
    },
    { cliff: RIM_CLIFF },
  );

  const c = makeChecker();
  if (result.missing) {
    // three-verdict contract: a missing hook is UNMEASURED, not FAIL
    c.unmeasured(
      'R0 built-site debug handle',
      result.missing === 'heightfield'
        ? 'no __laasDbg heightfield — did the scene boot?'
        : 'no __laasDbg.rimFalls — falls stage off, or a pre-FC-0023 build',
    );
    c.finish();
    return; // unreachable; narrows `result` for tsc
  }

  console.log(
    `[rimfalls] wildring=${wildring ?? 'default'} seed=${seed} — ` +
      `${result.sites.length} built site(s), ` +
      (result.emergent ? 'emergent scan' : 'ANCHOR FALLBACK (scan found nothing)'),
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
  await browser.close();

  if (wildring === undefined && seed === 1) {
    const sites = result.sites as SiteReport[];
    c.check(
      'R0 sites come from the emergent scan, not the anchor fallback',
      result.emergent === true,
      result.emergent ? 'emergent' : 'anchor fallback engaged',
    );
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
        hit ? `lip (${hit.x.toFixed(0)}, ${hit.z.toFixed(0)})` : 'no site within tolerance',
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
    c.finish({ minChecks: 5 }); // R0 + R1 + three R2 rows at minimum
  }
  console.log('[rimfalls] non-default variant/seed — report only, no verdicts');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
