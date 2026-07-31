/**
 * CPU temple-collision probe — no browser, no GPU, no dev server. Runs the
 * REAL FlyCamera walk/fly physics against the REAL temple resolver
 * (templeCollide.wrapMoveWithTempleCollision + wrapGroundProbeWithTempleFloors,
 * the same functions NewJerusalemScene installs) over the REAL solids that
 * `buildTemple` records while it builds the compound. Same shared-table
 * discipline as probe-wallcollide: the probe composes production code, and
 * the volumes come from the geometry calls themselves — nothing here mirrors
 * the compound's layout arithmetic.
 *
 * What it proves (STATUS "still open: dwellings/temple collision and floors"
 * → temple half built):
 *   T1 a walker walking into the perimeter wall STOPS;
 *   T2 a walker walking at the EAST gate PASSES through the portal
 *      (Ezek 40:6-16 — a real opening, not a painted one);
 *   T3 the WEST wall has no gate and blocks across its whole run
 *      (Ezek 42:15-20 lists no west gate);
 *   T4 oblique motion into a wall SLIDES along the face;
 *   T5 the outer court is a real FLOOR — a walker inside the compound
 *      stands on the plinth top, not at meadow height;
 *   T6 the inner terrace claims as a higher floor than the outer court;
 *   T7 the sanctuary core BLOCKS rather than admitting a walker;
 *   T8 a start inside a solid is never trapped (exact-placement semantics);
 *   T9 without the wraps nothing blocks (the compound is opt-in per stage);
 *   T10 a band-spanning move cannot tunnel the wall;
 *   P*  pure-function spot checks of the recorded volume set.
 *
 *   npx tsx tools/probe-templecollide.ts
 */

export {}; // top-level await needs module context

// ---- minimal DOM shims so FlyCamera (a browser module) loads under Node ----
type KeyHandler = (e: KeyboardEvent) => void;
const keydownHandlers: KeyHandler[] = [];
const keyupHandlers: KeyHandler[] = [];
const windowShim = {
  location: { search: '?scene=newjerusalem' },
  addEventListener(type: string, handler: KeyHandler): void {
    if (type === 'keydown') keydownHandlers.push(handler);
    else if (type === 'keyup') keyupHandlers.push(handler);
  },
};
Object.defineProperty(globalThis, 'window', { value: windowShim, configurable: true });

const { PerspectiveCamera } = await import('three');
const { FlyCamera } = await import('../src/core/FlyCamera');
const { buildTemple } = await import('../src/nj/Temple');
const {
  templeBlockedWorld,
  templeBounds,
  templeFloorWorldY,
  wrapGroundProbeWithTempleFloors,
  wrapMoveWithTempleCollision,
} = await import('../src/nj/templeCollide');
const { TEMPLE_SITE } = await import('../src/nj/templeModel');
const { makeChecker } = await import('./check');

const press = (code: string): void => {
  for (const h of keydownHandlers) h({ code, repeat: false } as KeyboardEvent);
};
const release = (code: string): void => {
  for (const h of keyupHandlers) h({ code } as KeyboardEvent);
};

// ---- world stand-in: flat meadow + the REAL compound -----------------------
// hf: null makes buildTemple seat the plinth on PLATEAU_Y, so the probe's
// flat terrain and the compound agree without a heightfield.
const { PLATEAU_Y } = await import('../src/nj/rimModel');
const GROUND_Y = PLATEAU_Y;
const terrainProbe = (): { ground: number; water: number } => ({
  ground: GROUND_Y,
  water: GROUND_Y - 2,
});

const temple = buildTemple({ hf: null, gi: null });
const solids = temple.solids;
const bounds = templeBounds(solids);
const probe = wrapGroundProbeWithTempleFloors(terrainProbe, solids);
const movePr = wrapMoveWithTempleCollision(null, solids);

const C = TEMPLE_SITE;
/** plinth top — the outer-court pavement (buildTemple: gMax + 0.8) */
const PLINTH_TOP = GROUND_Y + 0.8;

const domShim = { addEventListener: () => {} } as unknown as HTMLElement;
const DT = 1 / 60;
const c = makeChecker();
const freshCam = (withMove: boolean): InstanceType<typeof FlyCamera> => {
  keydownHandlers.length = 0;
  keyupHandlers.length = 0;
  const cam = new FlyCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 30000), domShim);
  cam.groundProbe = probe;
  if (withMove) cam.moveProbe = movePr;
  return cam;
};
const run = (cam: InstanceType<typeof FlyCamera>, frames: number): void => {
  for (let i = 0; i < frames; i++) cam.update(DT);
};

c.check(
  'S0 buildTemple recorded a plausible solid set',
  solids.length > 30 && solids.length < 200,
  `${solids.length} solids, bounds x ${bounds.x0.toFixed(1)}..${bounds.x1.toFixed(1)}, y ${bounds.y0.toFixed(1)}..${bounds.y1.toFixed(1)}`,
);

// ---- T1: walk west into the EAST perimeter wall, off the gate row ---------
// The east wall stands at x = C.x + half - wallT/2; approach on a z well
// clear of the 25-cubit gate gap.
{
  const cam = freshCam(true);
  const zOff = 60; // clear of the gate gap (gateW/2 = 6.56)
  cam.setPose({ p: [C.x + 200, PLINTH_TOP + 1.7, C.z + zOff], yaw: Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 2000);
  release('KeyW');
  const x = cam.camera.position.x;
  c.check(
    'T1 a walker stops at the east perimeter wall',
    x > C.x + 120 && x < C.x + 140,
    `stopped at x ${x.toFixed(2)} (east wall outer face ~${bounds.x1.toFixed(1)})`,
  );
}

// ---- T2: walk west through the EAST gate (z = C.z, the gate row) ----------
{
  const cam = freshCam(true);
  cam.setPose({ p: [C.x + 200, PLINTH_TOP + 1.7, C.z], yaw: Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 2000);
  release('KeyW');
  const x = cam.camera.position.x;
  c.check(
    'T2 a walker passes through the east gate portal',
    x < C.x + 120,
    `reached x ${x.toFixed(2)} (gate row z ${C.z}); wall face is ~${bounds.x1.toFixed(1)}`,
  );
}

// ---- T3: the WEST wall has no gate — blocked on the same centre row -------
{
  const cam = freshCam(true);
  cam.setPose({ p: [C.x - 200, PLINTH_TOP + 1.7, C.z], yaw: -Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 2000);
  release('KeyW');
  const x = cam.camera.position.x;
  c.check(
    'T3 the west wall blocks (no west gate, Ezek 42:15-20)',
    x < C.x - 100,
    `stopped at x ${x.toFixed(2)} (compound west face ~${bounds.x0.toFixed(1)})`,
  );
}

// ---- T4: oblique motion into the east wall slides along the face ----------
{
  const zStart = C.z + 60;
  const from = { x: C.x + 400, z: zStart };
  const to = { x: C.x + 50, z: zStart + 40 };
  const r = movePr(from.x, from.z, to.x, to.z, PLINTH_TOP + 1.7);
  c.check(
    'T4 oblique motion into the wall slides in z',
    r.x > C.x + 120 && Math.abs(r.z - to.z) < 1.0,
    `x ${r.x.toFixed(2)} (blocked short of ${to.x}), z ${r.z.toFixed(2)} (target ${to.z})`,
  );
}

// ---- T5: the outer court is a real floor ----------------------------------
{
  // a point inside the perimeter but outside the inner terrace / house band:
  // north-east quadrant of the outer court
  const px = C.x + 90;
  const pz = C.z - 90;
  const g = probe(px, pz, PLINTH_TOP + 1.7);
  c.check(
    'T5 the outer court stands on the plinth top, not the meadow',
    g.ground > GROUND_Y + 0.5,
    `ground ${g.ground.toFixed(2)} (meadow ${GROUND_Y.toFixed(2)}, plinth top ~${PLINTH_TOP.toFixed(2)})`,
  );
}

// ---- T6: the inner terrace claims higher than the outer court -------------
{
  const outer = probe(C.x + 90, C.z - 90, PLINTH_TOP + 1.7);
  // inner terrace spans x -half..+innerSide around the centre row; sample
  // just west of the altar, clear of the altar stack itself
  const inner = probe(C.x - 12, C.z + 40, PLINTH_TOP + 1.7);
  c.check(
    'T6 the inner terrace is a higher floor than the outer court',
    inner.ground > outer.ground,
    `inner ${inner.ground.toFixed(2)} vs outer ${outer.ground.toFixed(2)}`,
  );
}

// ---- T7: the sanctuary core blocks ----------------------------------------
{
  const cam = freshCam(true);
  // approach the house band from the east along the centre row, starting
  // inside the compound on the inner terrace
  // start between the altar (x ±4.2) and the house band, heading WEST
  // (yaw +PI/2 is -x, as T1/T2 exercise) so the house platform is the only
  // thing ahead — otherwise the walker merely backs into the altar stack.
  const start = probe(C.x - 14, C.z, PLINTH_TOP + 1.7).ground;
  cam.setPose({ p: [C.x - 14, start + 1.7, C.z], yaw: Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 2000);
  release('KeyW');
  const x = cam.camera.position.x;
  c.check(
    'T7 the house platform blocks a walker short of the sanctuary',
    x < C.x - 20 && x > C.x - 26.25,
    `stopped at x ${x.toFixed(2)} (platform east face -23.25, house envelope -26.25)`,
  );
}

// ---- T8: a start inside a solid is never trapped --------------------------
{
  const inside = { x: C.x - 50, z: C.z }; // inside the house envelope
  const y = PLINTH_TOP + 4;
  c.check(
    'T8 a pose inside a solid escapes freely',
    templeBlockedWorld(solids, inside.x, inside.z, y) &&
      Math.abs(movePr(inside.x, inside.z, inside.x + 30, inside.z, y).x - (inside.x + 30)) < 0.01,
    'blocked at the start, yet the move resolves to its full target',
  );
}

// ---- T9: without the wrap nothing blocks ----------------------------------
{
  const cam = freshCam(false);
  cam.setPose({ p: [C.x + 200, PLINTH_TOP + 1.7, C.z + 60], yaw: Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 2000);
  release('KeyW');
  c.check(
    'T9 without moveProbe the compound does not block',
    cam.camera.position.x < C.x + 100,
    `walked to x ${cam.camera.position.x.toFixed(2)} unobstructed`,
  );
}

// ---- T10: a band-spanning move cannot tunnel the wall ---------------------
{
  const y = PLINTH_TOP + 1.7;
  const zOff = C.z + 60; // solid wall row
  const hit = movePr(C.x + 300, zOff, C.x - 300, zOff, y); // spans the whole compound
  c.check(
    'T10 a compound-spanning move stops at the east wall',
    hit.x > C.x + 100,
    `300→-300 at z ${zOff} stopped at x ${hit.x.toFixed(2)}`,
  );
  const lane = movePr(C.x + 300, C.z, C.x - 300, C.z, y); // gate row
  c.check(
    'T10b the same move on the gate row is not stopped by the east wall',
    lane.x < C.x + 120,
    `arrived at x ${lane.x.toFixed(2)} on the gate row`,
  );
}

// ---- P*: pure spot checks over the recorded volume set --------------------
{
  const y = PLINTH_TOP + 1.7;
  c.check(
    'P1 the east wall blocks off the gate row',
    templeBlockedWorld(solids, C.x + 129, C.z + 60, y),
    `x ${(C.x + 129).toFixed(1)}, z ${(C.z + 60).toFixed(1)}`,
  );
  c.check(
    'P2 the east gate row is open at the portal centre',
    !templeBlockedWorld(solids, C.x + 129, C.z, y),
    'the 10-cubit opening (Ezek 40:11) is a real gap',
  );
  c.check(
    'P3 far outside the compound is free',
    !templeBlockedWorld(solids, C.x + 600, C.z, y),
    '600 m east of centre',
  );
  c.check(
    'P4 above the tallest mass is free',
    !templeBlockedWorld(solids, C.x, C.z, bounds.y1 + 1),
    `y ${(bounds.y1 + 1).toFixed(1)} clears the compound`,
  );
  c.check(
    'P5 a floor is claimed inside the compound',
    templeFloorWorldY(solids, C.x + 90, C.z - 90, PLINTH_TOP + 5, GROUND_Y - 60) > GROUND_Y,
    `floor ${templeFloorWorldY(solids, C.x + 90, C.z - 90, PLINTH_TOP + 5, GROUND_Y - 60).toFixed(2)}`,
  );
  c.check(
    'P6 no floor is claimed outside the compound',
    templeFloorWorldY(solids, C.x + 600, C.z, PLINTH_TOP + 5, GROUND_Y - 60) === -1e6,
    'the wrap early-outs on its bound anyway',
  );
  c.check(
    'P7 the sanctuary roof does not claim a court-level walker',
    templeFloorWorldY(solids, C.x - 50, C.z, PLINTH_TOP + 3.5, GROUND_Y - 60) <
      PLINTH_TOP + 3.5,
    'y-aware cap keeps the roof out of reach from the pavement',
  );
}

c.finish();
