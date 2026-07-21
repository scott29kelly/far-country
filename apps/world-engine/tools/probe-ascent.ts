/**
 * CPU contract probe for the processional ascent (city traversability) — no
 * browser, no GPU, no dev server. Verifies:
 *
 *  A. TABLE — two mirrored five-climb chains, each continuous from the plaza
 *     to the summit (every top is the next base, first base 0, last top =
 *     CITY_SUMMIT_Y), slopes bounded, every solid inside the wall ring,
 *     bands standing exactly one slab-overhang proud of their faces;
 *  B. CLEARANCES — the base climb stays out of every gate corridor, and no
 *     wedge or head pad stands within 0.5 local of a worship assembly on
 *     its own floor (no figure is entombed in masonry);
 *  C. STAIRWELL SLOTS — the tier-0 cornice holes cover exactly the stretch
 *     where the climbing eye crosses the slab plane, with margin;
 *  D. THE WALK — a simulated walker (y-aware floor claims + the real
 *     lateral resolver, the scene's exact contracts) enters the southeast
 *     gate and reaches the sea of glass with no unclaimed gap, no drop, no
 *     step over the walk limit, and no lateral block along the route;
 *  E. FLANKS — the wedge flank blocks a low walker, the surface rides free,
 *     and P10/P11-style crown-face behavior is unchanged off the ramps.
 *
 *   npx tsx tools/probe-ascent.ts
 */

export {}; // top-level await needs module context

Object.defineProperty(globalThis, 'window', {
  value: { location: { search: '?scene=newjerusalem' }, addEventListener() {} },
  configurable: true,
});

const { ascentRamps, baseCorniceHoles, rampSurfaceY, ASCENT_SUMMIT_Y, SLAB_PROUD } =
  await import('../src/nj/ascentModel');
const { cityBlockedLocal, cityFloorLocalY, resolveCityMoveLocal, FLOOR_STEP_UP_M } =
  await import('../src/nj/cityCollide');
const { CITY_TIERS, GATE_OFFSETS, GATE_WIDTH, PLINTH_HALF } = await import('../src/nj/cityModel');
const { assemblyVolumes } = await import('../src/nj/populationModel');
const { NJ_SCALE } = await import('../src/nj/rimModel');
const { makeChecker } = await import('./check');

const c = makeChecker();
const ramps = ascentRamps();

// ---- A: table --------------------------------------------------------------
const east = ramps.filter((r) => r.side === 'east').sort((a, b) => a.y0 - b.y0);
const west = ramps.filter((r) => r.side === 'west').sort((a, b) => a.y0 - b.y0);
c.check('A1 five climbs per side, two sides', east.length === 5 && west.length === 5);
const chainOk = (chain: typeof east): boolean =>
  chain[0].y0 === 0 &&
  chain[chain.length - 1].y1 === ASCENT_SUMMIT_Y &&
  chain.every((r, i) => i === 0 || chain[i - 1].y1 === r.y0);
c.check('A2 east chain continuous plaza → summit', chainOk(east));
c.check('A3 west chain continuous plaza → summit', chainOk(west));
c.check(
  'A4 west mirrors east in x only',
  east.every(
    (r, i) =>
      west[i].x0 === -r.x1 && west[i].x1 === -r.x0 && west[i].zA === r.zA && west[i].zB === r.zB,
  ),
);
const maxSlope = Math.max(...ramps.map((r) => (r.y1 - r.y0) / Math.abs(r.zB - r.zA)));
c.check('A5 slopes stay below 1.05 rise per run', maxSlope <= 1.05, `max=${maxSlope.toFixed(3)}`);
const inside = ramps.every((r) => {
  const zs = [r.zA, r.zB, r.pad?.z0 ?? r.zA, r.pad?.z1 ?? r.zA];
  return Math.max(Math.abs(r.x0), Math.abs(r.x1)) <= 95.5 && zs.every((z) => Math.abs(z) <= 95.5);
});
c.check('A6 every solid stays inside the wall ring', inside);
const faces = [PLINTH_HALF, ...CITY_TIERS.slice(1).map((t) => t.half)];
c.check(
  'A7 each band stands one slab-overhang proud of its face',
  east.every((r, i) => Math.abs(Math.abs(r.x0) - (faces[i] + SLAB_PROUD)) < 1e-9),
);

// ---- B: clearances ---------------------------------------------------------
const base = east[0];
const corridorHit = GATE_OFFSETS.some((o) => {
  const g0 = o - GATE_WIDTH / 2 - 1;
  const g1 = o + GATE_WIDTH / 2 + 1;
  return Math.min(base.zA, base.zB) < g1 && Math.max(base.zA, base.zB) > g0;
});
c.check('B1 base climb clear of every gate corridor band', !corridorHit);

const MARGIN = 0.5;
let worstClear = Infinity;
let worstWho = '';
for (const r of ramps) {
  const rects = [
    { x0: r.x0, x1: r.x1, z0: Math.min(r.zA, r.zB), z1: Math.max(r.zA, r.zB) },
    ...(r.pad ? [{ x0: r.x0, x1: r.x1, z0: r.pad.z0, z1: r.pad.z1 }] : []),
  ];
  for (const a of assemblyVolumes()) {
    if (a.floor !== r.y0) continue; // solids stand on the ramp's base floor
    for (const rect of rects) {
      const dx = Math.max(rect.x0 - a.x, 0, a.x - rect.x1);
      const dz = Math.max(rect.z0 - a.z, 0, a.z - rect.z1);
      const clear = Math.hypot(dx, dz) - a.r;
      if (clear < worstClear) {
        worstClear = clear;
        worstWho = `floor ${a.floor} assembly (${a.x.toFixed(0)},${a.z.toFixed(0)})`;
      }
    }
  }
}
c.check(
  `B2 no assembly within ${MARGIN} of any ascent solid on its floor`,
  worstClear >= MARGIN,
  `worst=${worstClear.toFixed(2)} at ${worstWho}`,
);

// ---- C: stairwell slots ----------------------------------------------------
const holes = baseCorniceHoles();
c.check('C1 one slot per base climb', holes.length === 2);
const EYE_L = 1.7 / NJ_SCALE;
const slabBot = CITY_TIERS[0].h - 2.4; // cornice underside (CORNICE_T)
const slotOk = ramps
  .filter((r) => r.pad === null)
  .every((r) => {
    // z-range where the climbing eye sits inside the slab plane
    const yAt = (z: number): number => rampSurfaceY(r, z) + EYE_L;
    const dir = Math.sign(r.zA - r.zB); // head is at zB
    let zEnter = r.zB;
    while (yAt(zEnter) > CITY_TIERS[0].h && Math.abs(zEnter - r.zA) > 0.01) zEnter += dir * 0.01;
    let zExit = zEnter;
    while (yAt(zExit) > slabBot && Math.abs(zExit - r.zA) > 0.01) zExit += dir * 0.01;
    const hole = holes.find((h) => r.x0 >= h.x0 && r.x1 <= h.x1);
    if (!hole) return false;
    const lo = Math.min(zEnter, zExit);
    const hi = Math.max(zEnter, zExit);
    return hole.z0 <= lo + 0.05 && hole.z1 >= hi + 0.3;
  });
c.check('C2 slots cover the eye-crossing stretch with margin', slotOk);

// ---- D: the walk -----------------------------------------------------------
// Waypoints: in the SE gate, round the base wedge, up all five east climbs
// (landing walks between them), onto the sea of glass.
const PATH: Array<[number, number]> = [
  [96.8, 50], // inside the southeast gate mouth
  [95, 50],
  [95, 95.4], // south along the ring, past the wedge's base end
  [92.3, 95.4], // round onto the ramp axis
  [92.3, 79.6], // climb 1 (plaza → plinth top)
  [92.3, 79.3], // onto the slab-top landing
  [86.3, 77.5], // wall-top walk to climb 2's base
  [86.3, 16.5], // climb 2 (→ tier-1 top), onto the head pad
  [83, 15.8], // across the cornice lip
  [78, 15.8], // tier-1 ring
  [64.3, 15.8], // to climb 3's base
  [64.3, -39], // climb 3 (→ tier-2 top), onto the pad
  [61, -38], // lip
  [50, -36], // tier-2 ring
  [44.8, -35.2], // climb 4's base
  [44.8, 15], // climb 4 (→ tier-3 top), onto the pad
  [41, 14.5], // lip
  [32, 16], // tier-3 ring
  [32, 19.6], // past climb 5's base end
  [26.3, 19.6], // round onto the ramp axis
  [26.3, -20], // climb 5 (→ crown), onto the pad
  [21.5, -18], // across onto the sea of glass
  [0, 0], // the summit centre
];

/** substep (1 m world — a real frame stride; the 46-deg base climb rises
 *  ~1 m per stride, well under the 3.5 m walk step limit) */
const STEP = 0.05;
const stepUpLocal = FLOOR_STEP_UP_M / NJ_SCALE;
let feet = 0;
let maxStep = 0;
let minDrop = 0;
let gapAt = '';
let blockAt = '';
for (let w = 1; w < PATH.length && gapAt === '' && blockAt === ''; w++) {
  const [ax, az] = PATH[w - 1];
  const [bx, bz] = PATH[w];
  const segLen = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(segLen / STEP));
  let px = ax;
  let pz = az;
  for (let i = 1; i <= n; i++) {
    const nx = ax + ((bx - ax) * i) / n;
    const nz = az + ((bz - az) * i) / n;
    const eyeY = feet + 1.7 / NJ_SCALE;
    const res = resolveCityMoveLocal(px, pz, nx, nz, eyeY);
    if (Math.hypot(res.x - nx, res.z - nz) > 0.01) {
      blockAt = `waypoint ${w} at (${nx.toFixed(1)},${nz.toFixed(1)})`;
      break;
    }
    const floor = cityFloorLocalY(nx, nz, feet + stepUpLocal);
    if (floor === -1e6) {
      gapAt = `waypoint ${w} at (${nx.toFixed(1)},${nz.toFixed(1)}) feet=${feet.toFixed(2)}`;
      break;
    }
    maxStep = Math.max(maxStep, floor - feet);
    minDrop = Math.min(minDrop, floor - feet);
    feet = floor;
    px = nx;
    pz = nz;
  }
}
c.check('D1 no unclaimed gap along the ascent', gapAt === '', gapAt);
c.check('D2 no lateral block along the route', blockAt === '', blockAt);
c.check(
  'D3 every step within the walk limit',
  maxStep * NJ_SCALE <= FLOOR_STEP_UP_M,
  `max step ${(maxStep * NJ_SCALE).toFixed(2)} m`,
);
c.check('D4 the path never drops', minDrop * NJ_SCALE >= -0.5, `min ${(minDrop * NJ_SCALE).toFixed(2)} m`);
c.check(
  'D5 the walker tops out on the sea of glass',
  feet === ASCENT_SUMMIT_Y,
  `feet=${feet.toFixed(2)} (summit ${ASCENT_SUMMIT_Y})`,
);

// ---- E: flanks -------------------------------------------------------------
const mid = east[1]; // the tall tier-1 climb
const midZ = (mid.zA + mid.zB) / 2;
c.check(
  'E1 a low walker is blocked at the wedge flank',
  cityBlockedLocal((mid.x0 + mid.x1) / 2, midZ, mid.y0 + 0.5),
);
c.check(
  'E2 the surface itself rides free',
  !cityBlockedLocal(
    (mid.x0 + mid.x1) / 2,
    midZ,
    rampSurfaceY(mid, midZ) + 1.7 / NJ_SCALE,
  ),
);
c.check(
  'E3 crown face still blocks off the ramps',
  cityBlockedLocal(0.5, CITY_TIERS[CITY_TIERS.length - 1].half + 0.01, 140),
);
c.check('E4 above the summit stays free', !cityBlockedLocal(0.5, 22.01, ASCENT_SUMMIT_Y + 0.01));

// ---- F: the street-of-gold gallery (the M3.6 entombment fix) ---------------
// The band between the plinth face and the wall slab is open space: the
// sixteen plaza-ring assemblies stand IN it (not inside masonry), and the
// wall slab + plinth still block on either side of it.
c.check('F1 the gallery between plinth and wall slab is open', !cityBlockedLocal(92, 25, 1));
const plazaAsms = assemblyVolumes().filter((a) => a.floor === 0);
c.check('F2 sixteen plaza-ring assemblies', plazaAsms.length === 16, `got ${plazaAsms.length}`);
c.check(
  'F3 every plaza assembly centre stands in open space',
  plazaAsms.every((a) => !cityBlockedLocal(a.x, a.z, 1)),
);
c.check(
  'F4 every plaza assembly clears the wall slab and the plinth by its spread',
  plazaAsms.every((a) => {
    const aC = Math.max(Math.abs(a.x), Math.abs(a.z));
    return aC + a.r < 96 && aC - a.r > 88;
  }),
);
c.check('F5 the wall slab still blocks between gates', cityBlockedLocal(99, 25, 1));
c.check('F6 the plinth face still blocks', cityBlockedLocal(87, 25, 1));

c.finish();
