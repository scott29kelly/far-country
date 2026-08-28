/**
 * CPU walk-floors probe (the "plaza slab and terrace pavements are not walk
 * floors" debt) — no browser, no GPU, no dev server. Runs the REAL FlyCamera
 * physics against the REAL wrapGroundProbeWithCityFloors composed over the
 * REAL river wrap (the scene's exact order) on a mock flat core.
 *
 * The debt: a walker through a gate stayed on the meadow line and waded
 * chest-deep under the plaza slab; terraces and the crown had no standing
 * surface at all in walk mode.
 *
 *   npx tsx tools/probe-cityfloors.ts
 */

export {}; // top-level await needs module context

type KeyHandler = (e: KeyboardEvent) => void;
const keydownHandlers: KeyHandler[] = [];
const keyupHandlers: KeyHandler[] = [];
Object.defineProperty(globalThis, 'window', {
  value: {
    location: { search: '?scene=newjerusalem' },
    addEventListener(type: string, handler: KeyHandler): void {
      if (type === 'keydown') keydownHandlers.push(handler);
      else if (type === 'keyup') keyupHandlers.push(handler);
    },
  },
  configurable: true,
});

const { PerspectiveCamera } = await import('three');
const { FlyCamera } = await import('../src/core/FlyCamera');
const { wrapGroundProbeWithRiver } = await import('../src/nj/RiverOfLife');
const { wrapGroundProbeWithCityFloors, cityFloorLocalY } = await import('../src/nj/cityCollide');
const { CITY_SUMMIT_Y, CITY_TIERS, cityTierBottoms } = await import('../src/nj/cityModel');
const { NJ_SCALE, PLATEAU_Y } = await import('../src/nj/rimModel');
const { makeChecker } = await import('./check');

const press = (code: string): void => {
  for (const h of keydownHandlers) h({ code, repeat: false } as KeyboardEvent);
};
const release = (code: string): void => {
  for (const h of keyupHandlers) h({ code } as KeyboardEvent);
};

const c = makeChecker();

// ---- world stand-in: flat core + the real river + floors wraps -------------
// GROUND_Y is fixture plumbing — imported so the flat stand-in tracks the
// real plateau elevation (rimModel, ADR 0015).
const GROUND_Y = PLATEAU_Y;
const PLAZA_TOP_Y = GROUND_Y + 2.8; // the scene's coreY + 2.8
const base = (_x: number, _z: number): { ground: number; water: number } => ({
  ground: GROUND_Y,
  water: GROUND_Y - 2,
});
const withRiver = wrapGroundProbeWithRiver(base, PLAZA_TOP_Y, NJ_SCALE);
const probe = wrapGroundProbeWithCityFloors(withRiver, PLAZA_TOP_Y, NJ_SCALE);

const bottoms = cityTierBottoms();
const PLAZA_EYE = PLAZA_TOP_Y + 1.7;

const domShim = { addEventListener: () => {} } as unknown as HTMLElement;
const DT = 1 / 60;

function freshCam(pose: { x: number; y: number; z: number }): InstanceType<typeof FlyCamera> {
  keydownHandlers.length = 0;
  keyupHandlers.length = 0;
  const fly = new FlyCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 30000), domShim);
  fly.groundProbe = probe;
  fly.setPose({ p: [pose.x, pose.y, pose.z], yaw: 0, pitch: 0 });
  return fly;
}

function walkEntryEye(x: number, z: number, seedY = PLAZA_TOP_Y + 400): number {
  const fly = freshCam({ x, y: seedY, z });
  fly.setMode('walk');
  fly.update(DT);
  return fly.getPose().p[1];
}

// ---- F1: outside the slab the meadow line holds ----------------------------
const f1 = walkEntryEye(300, 2200);
c.check('F1 outside the slab margin the walker stays on the meadow', Math.abs(f1 - (GROUND_Y + 1.7)) < 0.05, `eye ${f1.toFixed(2)} (expect ${(GROUND_Y + 1.7).toFixed(2)})`);

// ---- F2: inside the wall, off the meridian: the street of gold is the floor
const f2 = walkEntryEye(300, 1900);
c.check('F2 plaza interior stands on the street of gold', Math.abs(f2 - PLAZA_EYE) < 0.05, `eye ${f2.toFixed(2)} (expect ${PLAZA_EYE.toFixed(2)})`);

// ---- F3: terrace-top ring is a standing surface (tier-1 cornice) -----------
const t1Top = PLAZA_TOP_Y + (bottoms[1] + CITY_TIERS[1].h) * NJ_SCALE;
const t1Ring = ((CITY_TIERS[1].half + CITY_TIERS[2].half) / 2) * NJ_SCALE;
const f3 = walkEntryEye(t1Ring, 0, t1Top + 40); // seed ABOVE the pavement — the y-cap must see feet near it
c.check('F3 tier-1 cornice ring is walkable', Math.abs(f3 - (t1Top + 1.7)) < 0.05, `eye ${f3.toFixed(2)} (expect ${(t1Top + 1.7).toFixed(2)})`);

// ---- F4: the y-cap — an elevated pavement never claims a low eye -----------
const plinthRing = 85 * NJ_SCALE; // between tier-1 half (82) and plinth (88)
const low = probe(plinthRing, 0, PLAZA_EYE);
c.check('F4 plinth-top pavement does not claim a plaza-level eye', Math.abs(low.ground - PLAZA_TOP_Y) < 0.01, `ground ${low.ground.toFixed(2)} (expect ${PLAZA_TOP_Y.toFixed(2)})`);
const high = probe(plinthRing, 0, PLAZA_TOP_Y + bottoms[1] * NJ_SCALE + 5);
c.check('F4b …but claims a walker standing at its height', Math.abs(high.ground - (PLAZA_TOP_Y + bottoms[1] * NJ_SCALE)) < 0.01, `ground ${high.ground.toFixed(2)}`);

// ---- F5: crown top — sea-of-glass floor under the basin's water claim ------
const crownEye = PLAZA_TOP_Y + CITY_SUMMIT_Y * NJ_SCALE + 8;
const crown = probe(300, 300, crownEye);
const crownFloor = PLAZA_TOP_Y + CITY_SUMMIT_Y * NJ_SCALE;
c.check('F5 crown top is a standing surface', Math.abs(crown.ground - crownFloor) < 0.01, `ground ${crown.ground.toFixed(2)} (expect ${crownFloor.toFixed(2)})`);

// ---- F6: legacy no-y callers claim the slab only ---------------------------
const noY1 = probe(300, 1900);
const noY2 = probe(t1Ring, 0);
c.check('F6 without y only the slab claims', Math.abs(noY1.ground - PLAZA_TOP_Y) < 0.01 && Math.abs(noY2.ground - PLAZA_TOP_Y) < 0.01, `plaza ${noY1.ground.toFixed(2)}, ring ${noY2.ground.toFixed(2)}`);

// ---- F7: walking a gate corridor steps up 2.8 m, never flings --------------
{
  const fly = freshCam({ x: 1000, y: GROUND_Y + 1.7, z: 2150 });
  fly.setMode('walk');
  fly.update(DT);
  press('KeyW'); // yaw 0 faces -z: north through the Zebulun gate corridor
  let maxStep = 0;
  let prevY = fly.getPose().p[1];
  for (let i = 0; i < 1500; i++) {
    fly.update(DT);
    const y = fly.getPose().p[1];
    const dy = Math.abs(y - prevY);
    if (dy > maxStep) maxStep = dy;
    prevY = y;
  }
  release('KeyW');
  const [, endY, endZ] = fly.getPose().p;
  c.check('F7 gate corridor walk steps onto the plaza without a fling', endZ < 2080 && Math.abs(endY - PLAZA_EYE) < 0.1 && maxStep < 3.2, `z ${endZ.toFixed(0)}, eye ${endY.toFixed(2)}, max step ${maxStep.toFixed(2)}`);
}

// ---- F8: pure-table checks -------------------------------------------------
c.check('F8 floor table: outside footprint unclaimed', cityFloorLocalY(120, 0, 1e9) === -1e6);
c.check('F8b floor table: crown beats terraces from above', cityFloorLocalY(10, 10, 1e9) === CITY_SUMMIT_Y);
c.check('F8c floor table: cap excludes higher floors', cityFloorLocalY(85, 0, 1) === 0);

c.finish();
