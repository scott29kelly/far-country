/**
 * CPU dwelling-campus collision probe — no browser, no GPU, no dev server.
 * Runs the REAL solids-generic resolvers (templeCollide's
 * wrapMoveWithTempleCollision / wrapGroundProbeWithTempleFloors — the same
 * functions NewJerusalemScene installs for the campus) over the REAL AABBs
 * that `buildDwellings` records while it builds (headless: hf/renderer null
 * seats everything on flat PLATEAU_Y; the layout and seeded kit dims are
 * exactly the scene's). Nothing here mirrors block/house arithmetic — the
 * one house/podium/well the moves aim at is PICKED FROM the recorded set.
 *
 * What it proves (STATUS "still open: the DWELLINGS half of this debt"):
 *   D1 a walker walking into a priests'-band house STOPS at the face and a
 *      block-spanning move cannot tunnel it;
 *   D2 oblique motion into the same face SLIDES along it;
 *   D3 every garden-court block admits entry somewhere (the gate gaps are
 *      real openings) while the runs themselves block — swept as move
 *      attempts across all four faces of a known block;
 *   D4 a start inside a house is never trapped (exact-placement semantics);
 *   D5 a Levites'-band podium slab is a real FLOOR standing proud of the
 *      shell ground;
 *   D6 a house roof claims as a floor (a walker set down on a house stands
 *      on the ridge plane instead of sinking into the prism);
 *   D7 a court well is a step-over, not a wall (STEP_OVER semantics);
 *   D8 the recorded set is sane: thousands of solids, all inside the cited
 *      band rects, none degenerate.
 *
 *   npx tsx tools/probe-dwellingscollide.ts
 */

export {}; // top-level await needs module context

Object.defineProperty(globalThis, 'window', {
  value: { location: { search: '?scene=newjerusalem' }, addEventListener() {} },
  configurable: true,
});

const { buildDwellings } = await import('../src/nj/Dwellings');
const {
  templeBlockedWorld,
  wrapGroundProbeWithTempleFloors,
  wrapMoveWithTempleCollision,
} = await import('../src/nj/templeCollide');
const { BLOCK, NEAR_ROWS, PITCH, PRIESTS_RECT, LEVITES_RECT, FAR_SHELL_SINK } =
  await import('../src/nj/campusModel');
const { PLATEAU_Y } = await import('../src/nj/rimModel');
const { makeChecker } = await import('./check');

const c = makeChecker();

// ---- the real campus, seated on the probe's flat world ----------------------
// hf/renderer null: near band on PLATEAU_Y, far grid flat — same convention
// as probe-templecollide's flat meadow. The terrain stand-in mirrors the
// scene's far-ground wrap: beyond the tile seam the walking surface is the
// far shell (analytic ground − FAR_SHELL_SINK).
const dwellings = await buildDwellings({ hf: null, gi: null, renderer: null });
const solids = dwellings.solids;
const EYE = 1.7;
const shellGround = (z: number): number =>
  z < -6144 ? PLATEAU_Y - FAR_SHELL_SINK : PLATEAU_Y;
const terrainProbe = (_x: number, z: number): { ground: number; water: number } => ({
  ground: shellGround(z),
  water: shellGround(z) - 2,
});
const move = wrapMoveWithTempleCollision(null, solids);
const groundAt = wrapGroundProbeWithTempleFloors(
  (x, z) => terrainProbe(x, z),
  solids,
);

// ---- pick real targets FROM the recorded set --------------------------------
// a priests'-band row-house body: ground-seated, wall-height, run-width
const house = solids.find(
  (s) =>
    s.y0 < PLATEAU_Y &&
    s.y1 - s.y0 > 2.5 &&
    s.y1 - s.y0 < 8 &&
    s.x1 - s.x0 > 4 &&
    s.z1 - s.z0 > 4 &&
    s.z0 > PRIESTS_RECT.z0 &&
    s.z1 < PRIESTS_RECT.z1,
);
// a Levites'-band podium slab: deep skirt, wide, far band
const podium = solids.find(
  (s) => s.z1 < -6144 && s.y1 - s.y0 > 5 && s.x1 - s.x0 > 100,
);
// a court well: the 1.0 m stone ring (cylinder, 2.5 m across)
const well = solids.find(
  (s) =>
    Math.abs(s.y1 - s.y0 - 1.0) < 0.01 &&
    s.x1 - s.x0 > 2.3 &&
    s.x1 - s.x0 < 2.7,
);
// a roof: seated at a house top, above the ground line
const roof = solids.find(
  (s) => s.y0 > PLATEAU_Y + 2 && s.y0 < PLATEAU_Y + 7 && s.y1 - s.y0 < 3,
);
c.check(
  'D0 the recorded set contains every solid class the probe exercises',
  Boolean(house && podium && well && roof),
  `house ${house ? 'yes' : 'NO'}, podium ${podium ? 'yes' : 'NO'}, well ${well ? 'yes' : 'NO'}, roof ${roof ? 'yes' : 'NO'}`,
);
if (!house || !podium || !well || !roof) {
  c.finish();
  throw new Error('unreachable'); // finish() exits — narrows the picks below
}

// ---- D1: a house blocks, and a spanning move cannot tunnel -------------------
// The picked house sits mid-run: adjacent houses share faces along the run
// and their depths vary (stepped facades), so the fixture must (a) approach
// from a start that is actually open air — a start inside a neighbor moves
// freely by the exact-placement semantics — and (b) assert "stopped before
// entering, not inside anything", not a specific face coordinate.
const hcx = (house.x0 + house.x1) / 2;
const hcz = (house.z0 + house.z1) / 2;
const yFeet = PLATEAU_Y; // feet at the meadow line (body y, matching FlyCamera)
type Approach = { fx: number; fz: number; axis: 'x' | 'z' };
const approaches: Approach[] = [
  { fx: hcx, fz: house.z1 + 30, axis: 'z' },
  { fx: hcx, fz: house.z0 - 30, axis: 'z' },
  { fx: house.x1 + 30, fz: hcz, axis: 'x' },
  { fx: house.x0 - 30, fz: hcz, axis: 'x' },
];
const open = approaches.find((a) => !templeBlockedWorld(solids, a.fx, a.fz, yFeet));
{
  let ok = false;
  let detail = 'no open-air approach found around the picked house';
  if (open) {
    const r = move(open.fx, open.fz, hcx, hcz, yFeet);
    const inside =
      r.x > house.x0 && r.x < house.x1 && r.z > house.z0 && r.z < house.z1;
    ok = !inside && !templeBlockedWorld(solids, r.x, r.z, yFeet);
    detail = `from (${open.fx.toFixed(1)}, ${open.fz.toFixed(1)}) stopped at (${r.x.toFixed(2)}, ${r.z.toFixed(2)})`;
  }
  c.check('D1 a walker stops before entering a house; a spanning move cannot tunnel', ok, detail);
}

// ---- D2: oblique motion slides along the face --------------------------------
// Slide within THIS house's own face span — the neighbor's stepped facade
// legitimately blocks a longer slide.
{
  let ok = false;
  let detail = 'no open-air approach found';
  if (open) {
    const along = open.axis === 'z' ? 'x' : 'z';
    const sgn = open.axis === 'z' ? Math.sign(open.fz - hcz) : Math.sign(open.fx - hcx);
    const face = open.axis === 'z' ? (sgn > 0 ? house.z1 : house.z0) : sgn > 0 ? house.x1 : house.x0;
    const a0 = along === 'x' ? house.x0 + 0.6 : house.z0 + 0.6;
    const a1 = along === 'x' ? house.x1 - 0.6 : house.z1 - 0.6;
    const fx = along === 'x' ? a0 : face + sgn * 1.5;
    const fz = along === 'x' ? face + sgn * 1.5 : a0;
    const tx = along === 'x' ? a1 : face - sgn * 4;
    const tz = along === 'x' ? face - sgn * 4 : a1;
    const r = move(fx, fz, tx, tz, yFeet);
    const tangential = along === 'x' ? r.x : r.z;
    const normal = along === 'x' ? r.z : r.x;
    ok = tangential >= a1 - 0.01 && sgn * (normal - face) > 0;
    detail = `slid to ${tangential.toFixed(2)} (target ${a1.toFixed(2)}), held off the face`;
  }
  c.check('D2 oblique motion into the face slides along it', ok, detail);
}

// ---- D3: gate gaps admit entry; the runs block --------------------------------
{
  // a known standing block: first column east of the meridian lane, on the
  // southmost row (clear of the temple close and the processional by the
  // owner tables' own geometry)
  const cx = PITCH / 2;
  const cz = NEAR_ROWS[0] ?? 0;
  const half = BLOCK / 2;
  const y = PLATEAU_Y;
  let crossings = 0;
  let attempts = 0;
  let blocked = 0;
  for (let side = 0; side < 4; side++) {
    const horizontal = side === 0 || side === 2;
    const edge = side === 0 ? -1 : side === 2 ? 1 : side === 1 ? 1 : -1;
    for (let u = -half + 12; u <= half - 12; u += 1) {
      const fx = horizontal ? cx + u : cx + edge * (half + 12);
      const fz = horizontal ? cz + edge * (half + 12) : cz + u;
      const tx = horizontal ? cx + u : cx + edge * (half - 24);
      const tz = horizontal ? cz + edge * (half - 24) : cz + u;
      const r = move(fx, fz, tx, tz, y);
      attempts++;
      const gotIn = horizontal
        ? Math.abs(r.z - cz) < half - 20
        : Math.abs(r.x - cx) < half - 20;
      if (gotIn) crossings++;
      else blocked++;
    }
  }
  c.check(
    'D3 the block admits entry through its gate gap(s) while the runs block',
    crossings >= 3 && crossings <= 30 && blocked > attempts * 0.7,
    `${crossings} crossings, ${blocked}/${attempts} blocked`,
  );
}

// ---- D4: a start inside a solid is never trapped ------------------------------
{
  const hx = (house.x0 + house.x1) / 2;
  const hz = (house.z0 + house.z1) / 2;
  const r = move(hx, hz, hx, house.z1 + 10, PLATEAU_Y);
  c.check(
    'D4 a pose inside a house is never trapped (exact-placement semantics)',
    Math.abs(r.z - (house.z1 + 10)) < 1e-6,
    `exited to z=${r.z.toFixed(2)}`,
  );
}

// ---- D5: a podium slab is a real floor above the shell ground -----------------
{
  const px = (podium.x0 + podium.x1) / 2;
  const pz = (podium.z0 + podium.z1) / 2;
  const g = groundAt(px, pz, podium.y1 + EYE);
  c.check(
    'D5 a Levites-band podium top claims as a floor proud of the shell',
    Math.abs(g.ground - podium.y1) < 1e-6 && g.ground > shellGround(pz),
    `floor ${g.ground.toFixed(2)} vs slab top ${podium.y1.toFixed(2)}, shell ${shellGround(pz).toFixed(2)}`,
  );
}

// ---- D6: a roof claims as a floor (walker set down on a house) ----------------
{
  const rx = (roof.x0 + roof.x1) / 2;
  const rz = (roof.z0 + roof.z1) / 2;
  const g = groundAt(rx, rz, roof.y1 + EYE);
  c.check(
    'D6 a house roof claims as a floor for a walker set down on it',
    Math.abs(g.ground - roof.y1) < 1e-6,
    `floor ${g.ground.toFixed(2)} vs ridge ${roof.y1.toFixed(2)}`,
  );
}

// ---- D7: a court well is a step-over, not a wall ------------------------------
{
  const wx = (well.x0 + well.x1) / 2;
  const wz = (well.z0 + well.z1) / 2;
  c.check(
    'D7 a court well steps over rather than blocking (STEP_OVER semantics)',
    !templeBlockedWorld(solids, wx, wz, PLATEAU_Y),
    `well top ${(well.y1 - PLATEAU_Y).toFixed(2)} m above the meadow line`,
  );
}

// ---- D8: the recorded set is sane ---------------------------------------------
{
  const xMin = Math.min(PRIESTS_RECT.x0, LEVITES_RECT.x0) - 10;
  const xMax = Math.max(PRIESTS_RECT.x1, LEVITES_RECT.x1) + 10;
  const zMin = LEVITES_RECT.z0 - 10;
  const zMax = PRIESTS_RECT.z1 + 10;
  let outOfBand = 0;
  let degenerate = 0;
  for (const s of solids) {
    if (s.x0 < xMin || s.x1 > xMax || s.z0 < zMin || s.z1 > zMax) outOfBand++;
    if (!(s.x1 > s.x0 && s.y1 > s.y0 && s.z1 > s.z0)) degenerate++;
  }
  c.check(
    'D8 solids are numerous, in-band, and non-degenerate',
    solids.length > 3000 && outOfBand === 0 && degenerate === 0,
    `${solids.length} solids, ${outOfBand} out of band, ${degenerate} degenerate`,
  );
}

c.finish();
