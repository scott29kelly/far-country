/**
 * Close-up camera finder for the worship-curve fit: picks a kneel-mode and
 * a bow-mode figure standing near each other by the multitude-near framing
 * (?shot=10), reads that framing's resolved eye height from the running
 * engine, and prints a ?cam= string that looks at the pair from the front.
 *
 *   npx tsx tools/kimodo-closeup.ts [--dist 3] [--eye 1.3] [--front]
 *   --front stands on the far side of the pair (the figures face the summit,
 *   away from the shot-10 spot, so the default view sees their backs)
 * then feed the printed string to tools/shoot.ts --cam "...".
 */
import { launchWebGPU, laasUrl } from './launch';

const { multitudePlacements } = await import('../src/nj/populationModel');
const { NJ_SCALE } = await import('../src/nj/rimModel');
const { WORSHIP } = await import('../src/nj/figureModel');

/** CPU mirror of VegInstance.slotHash (pcg-style uint32 hash) */
function slotHash(slot: number, salt: number): number {
  const a = (Math.imul(slot + salt, 747796405) + 2891336453) >>> 0;
  const b = Math.imul((a >>> ((a >>> 28) + 4)) ^ a, 277803737) >>> 0;
  const c = ((b >>> 22) ^ b) >>> 0;
  return (c & 0xffffff) / 16777216;
}

const argv = process.argv.slice(2);
let dist = 3;
let eye = 1.3;
let front = false;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dist') dist = Number(argv[++i]);
  else if (argv[i] === '--eye') eye = Number(argv[++i]);
  else if (argv[i] === '--front') front = true;
}

// 1. the engine's resolved shot-10 pose (plaza eye height + where it stands)
const { browser } = await launchWebGPU();
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
await page.goto(laasUrl({ scene: 'newjerusalem', extra: { shot: '10' } }), { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__laas && (window.__laas.ready || window.__laas.error !== null), undefined, {
  timeout: 180000,
  polling: 250,
});
const pose = await page.evaluate(() => window.__laas.getPose?.());
await browser.close();
if (!pose) throw new Error('no getPose hook');
const [sx, sy, sz] = pose.p;
console.log(`shot-10 pose: p=${sx.toFixed(2)},${sy.toFixed(2)},${sz.toFixed(2)} yaw=${pose.yaw.toFixed(3)}`);

// 2. worship modes per slot, figures near the shot-10 spot
const pl = multitudePlacements();
const near = pl
  .map((p, i) => ({ i, x: p.x * NJ_SCALE, z: p.z * NJ_SCALE, h: slotHash(i, 71) }))
  .filter((f) => Math.hypot(f.x - sx, f.z - sz) < 25);
const kneel = near.filter((f) => f.h < WORSHIP.modeKneel);
const bow = near.filter((f) => f.h >= WORSHIP.modeKneel && f.h < WORSHIP.modeKneel + WORSHIP.modeBow);
let best: { k: (typeof near)[0]; b: (typeof near)[0]; d: number } | null = null;
for (const k of kneel)
  for (const b of bow) {
    const d = Math.hypot(k.x - b.x, k.z - b.z);
    if (d > 1.2 && d < 2.6 && (!best || d < best.d)) best = { k, b, d };
  }
if (!best) throw new Error(`no pair: ${kneel.length} kneelers, ${bow.length} bowers within 25 m`);
console.log(`kneeler slot ${best.k.i} @ ${best.k.x.toFixed(2)},${best.k.z.toFixed(2)} | bower slot ${best.b.i} @ ${best.b.x.toFixed(2)},${best.b.z.toFixed(2)} | ${best.d.toFixed(2)} m apart`);

// 3. camera on the shot-10 (face) side of the pair: same direction the
//    framing looks, backed off `dist` metres from the pair's midpoint
const mx = (best.k.x + best.b.x) / 2;
const mz = (best.k.z + best.b.z) / 2;
const fx = -Math.sin(pose.yaw); // forward for the engine's yaw convention (yaw = atan2(-dx,-dz))
const fz = -Math.cos(pose.yaw);
const side = front ? 1 : -1;
const cx = mx + side * fx * dist;
const cz = mz + side * fz * dist;
const plazaEye = sy; // shot-10 stands at eye height on the plaza
const cy = plazaEye - 1.7 + eye;
const ty = plazaEye - 1.7 + 0.8; // aim at waist height
const dx = mx - cx;
const dz = mz - cz;
const yaw = Math.atan2(-dx, -dz);
const pitch = Math.atan2(ty - cy, Math.hypot(dx, dz));
console.log(`CAM ${cx.toFixed(2)},${cy.toFixed(2)},${cz.toFixed(2)},${yaw.toFixed(3)},${pitch.toFixed(3)},50`);
