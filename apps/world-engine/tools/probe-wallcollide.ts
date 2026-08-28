/**
 * CPU wall/gate-collision probe — no browser, no GPU, no dev server. Runs
 * the REAL FlyCamera walk/fly physics against the REAL collision resolver
 * (cityCollide.wrapMoveWithCityCollision — the same function
 * NewJerusalemScene installs on hooks.moveProbe) composed with the REAL
 * river groundProbe wrap, under Node on a mock flat-plateau terrain. Same
 * shared-table discipline as probe-walkfling: no mirrored copy to desync.
 *
 * What it proves (STATUS "What's NOT built" → built):
 *   W1 a walker walking into a wall face STOPS (at the jewelled foundation
 *      course's outer face — the wall's real base profile);
 *   W2 a walker walking at a gate PASSES through the opening (Ezek 48:30-34
 *      gates are REAL gaps, RENDERING-DECISIONS #2) and stops at the solid
 *      inner plinth across the corridor;
 *   W3 oblique motion into a wall SLIDES along the face;
 *   W4 fly mode threads a gate the same way and stops at the plinth;
 *   W5 fly mode soft-collides a terrace tier at the glass plane;
 *   W6 above the summit the sky is free — no phantom column;
 *   W7 a start inside a solid is never trapped (programmatic poses keep
 *      exact-placement semantics; escape is free movement);
 *   W8 without hooks.moveProbe nothing blocks (wild scenes untouched);
 *   P* pure-function spot checks of the volume table (gate gaps, gem-course
 *      notches, course top, corners, tier faces, crown, summit).
 *
 *   npx tsx tools/probe-wallcollide.ts
 */

export {}; // top-level await needs module context

// ---- minimal DOM shims so FlyCamera (a browser module) loads under Node ----
type KeyHandler = (e: KeyboardEvent) => void;
const keydownHandlers: KeyHandler[] = [];
const keyupHandlers: KeyHandler[] = [];
const windowShim = {
  // WorldConst reads window.location.search when a window exists
  location: { search: '?scene=newjerusalem' },
  addEventListener(type: string, handler: KeyHandler): void {
    if (type === 'keydown') keydownHandlers.push(handler);
    else if (type === 'keyup') keyupHandlers.push(handler);
  },
};
Object.defineProperty(globalThis, 'window', { value: windowShim, configurable: true });

const { PerspectiveCamera } = await import('three');
const { FlyCamera } = await import('../src/core/FlyCamera');
const { wrapGroundProbeWithRiver } = await import('../src/nj/RiverOfLife');
const { cityBlockedLocal, resolveCityMoveLocal, wrapMoveWithCityCollision } = await import(
  '../src/nj/cityCollide'
);
const { NJ_SCALE, PLATEAU_Y } = await import('../src/nj/rimModel');
const { makeChecker } = await import('./check');

const press = (code: string): void => {
  for (const h of keydownHandlers) h({ code, repeat: false } as KeyboardEvent);
};
const release = (code: string): void => {
  for (const h of keyupHandlers) h({ code } as KeyboardEvent);
};

// ---- world stand-in: flat plateau top + the real wraps ---------------------
// GROUND_Y is fixture plumbing — imported so the flat stand-in tracks the
// real plateau elevation (rimModel, ADR 0015); plazaTopY = coreY + 2.8.
const GROUND_Y = PLATEAU_Y;
const PLAZA_TOP = GROUND_Y + 2.8;
const terrainProbe = (_x: number, _z: number): { ground: number; water: number } => ({
  ground: GROUND_Y,
  water: GROUND_Y - 2, // dry-cell convention off the authored river
});
// the REAL wraps, exactly as NewJerusalemScene installs them
const probe = wrapGroundProbeWithRiver(terrainProbe, PLAZA_TOP, NJ_SCALE);
const movePr = wrapMoveWithCityCollision(PLAZA_TOP, NJ_SCALE);

// world-space reference faces (local × NJ_SCALE): gem course outer 103.4,
// wall plane 100, plinth 88, tier-2 glass 60.5 — plus the 0.6 m skin.
// DELIBERATE CONTRACT PINS (FC-0007): hand-derived from cityModel.ts
// geometry — 103.4 = CITY_HALF 100 + FOUNDATION_COURSE.thick 4 − inset
// 0.6; 88 = PLINTH_HALF (tier-1 half 82 + 6); 60.5 = tier-2 half 60 +
// TIER_GLASS_PROUD 0.5 — and kept as independent literals ON PURPOSE:
// importing them would move both sides of the assertion together and the
// probe could not catch a face retune (the FC-0022 mirror-pin failure).
// If cityModel legitimately retunes a face, this probe SHOULD go red and
// be updated consciously.
const GEM_FACE = 103.4 * NJ_SCALE + 0.6; // 2068.6
const WALL_FACE = 100 * NJ_SCALE; // 2000
const PLINTH_FACE = 88 * NJ_SCALE + 0.6; // 1760.6
const TIER2_FACE = 60.5 * NJ_SCALE + 0.6; // 1210.6

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

// ---- W1: walk east into the west wall face between gates ------------------
// z 500 (local u 25) sits inside a gem-course span — the wall's real base
// profile out here is the course's outer face, not the wall plane.
{
  const cam = freshCam(true);
  cam.setPose({ p: [-2200, GROUND_Y + 1.7, 500], yaw: -Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 3000);
  release('KeyW');
  const p = cam.getPose().p;
  c.check(
    'W1 walk into a wall face stops at the foundation course',
    p[0] > -GEM_FACE - 6 && p[0] < -GEM_FACE + 0.3 && Math.abs(p[2] - 500) < 1,
    `x ${p[0].toFixed(2)} (face -${GEM_FACE.toFixed(1)}), z ${p[2].toFixed(1)}, eye ${p[1].toFixed(2)}`,
  );
}

// ---- W2: walk east through the west centre gate (Asher) --------------------
// The gem course is NOTCHED at the gate and the wall ring is genuinely open:
// the walker passes the wall plane and stops at the plinth across the corridor.
{
  const cam = freshCam(true);
  cam.setPose({ p: [-2200, GROUND_Y + 1.7, 0], yaw: -Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('ShiftLeft');
  press('KeyW');
  run(cam, 4000);
  release('KeyW');
  release('ShiftLeft');
  const p = cam.getPose().p;
  c.check(
    'W2 walk through a gate gap passes the wall, stops at the plinth',
    p[0] > -WALL_FACE && p[0] > -PLINTH_FACE - 6 && p[0] < -PLINTH_FACE + 0.3,
    `x ${p[0].toFixed(2)} (wall -${WALL_FACE}, plinth face -${PLINTH_FACE.toFixed(1)})`,
  );
}

// ---- W3: oblique walk into the wall slides along the face ------------------
{
  const cam = freshCam(true);
  cam.setPose({ p: [-2075, GROUND_Y + 1.7, 350], yaw: -Math.PI / 4, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 1200);
  release('KeyW');
  const p = cam.getPose().p;
  c.check(
    'W3 oblique motion slides along the wall (x pinned, z advances)',
    p[0] > -GEM_FACE - 6 && p[0] < -GEM_FACE + 0.3 && p[2] < 300,
    `x ${p[0].toFixed(2)} (face -${GEM_FACE.toFixed(1)}), z ${p[2].toFixed(1)} (from 350)`,
  );
}

// ---- W4: fly mode threads the gate, stops at the plinth --------------------
{
  const cam = freshCam(true);
  cam.setPose({ p: [-2400, 600, 0], yaw: -Math.PI / 2, pitch: 0 });
  cam.speed = 100;
  press('KeyW');
  run(cam, 1200);
  release('KeyW');
  const p = cam.getPose().p;
  c.check(
    'W4 fly threads the gate opening, stops at the plinth',
    p[0] > -WALL_FACE && p[0] > -PLINTH_FACE - 6 && p[0] < -PLINTH_FACE + 0.3,
    `x ${p[0].toFixed(2)} (wall -${WALL_FACE}, plinth face -${PLINTH_FACE.toFixed(1)}), y ${p[1].toFixed(1)}`,
  );
}

// ---- W5: fly mode soft-collides a terrace tier at the glass plane ----------
// y 2000 world is inside tier 2's band (local 58..96) — face at half 60 + 0.5.
{
  const cam = freshCam(true);
  cam.setPose({ p: [-3000, 2000, 500], yaw: -Math.PI / 2, pitch: 0 });
  cam.speed = 100;
  press('KeyW');
  run(cam, 1500);
  release('KeyW');
  const p = cam.getPose().p;
  c.check(
    'W5 fly stops at a terrace tier face',
    p[0] > -TIER2_FACE - 6 && p[0] < -TIER2_FACE + 0.3,
    `x ${p[0].toFixed(2)} (tier-2 glass face -${TIER2_FACE.toFixed(1)}), y ${p[1].toFixed(1)}`,
  );
}

// ---- W6: above the summit the sky is free — no phantom column --------------
{
  const cam = freshCam(true);
  cam.setPose({ p: [-3000, 3700, 0], yaw: -Math.PI / 2, pitch: 0 });
  cam.speed = 200;
  press('KeyW');
  run(cam, 1800);
  release('KeyW');
  const p = cam.getPose().p;
  c.check(
    'W6 flight above the summit crosses the whole city freely',
    p[0] > WALL_FACE,
    `x ${p[0].toFixed(0)} (started -3000, summit top ~${(PLAZA_TOP + 156 * NJ_SCALE).toFixed(0)} m)`,
  );
}

// ---- W7: a start inside a solid is never trapped ---------------------------
// (programmatic poses can place the camera anywhere — exact-placement
// semantics; V then engages walk INSIDE the plinth at meadow level)
{
  const cam = freshCam(true);
  cam.setPose({ p: [0, 480, 0], yaw: -Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('KeyW');
  run(cam, 600);
  release('KeyW');
  const p = cam.getPose().p;
  c.check(
    'W7 escape from inside a solid is free movement',
    p[0] > 30,
    `x ${p[0].toFixed(1)} after 10 s east from the plinth centre`,
  );
}

// ---- W8: no moveProbe installed → nothing blocks (wild scenes) -------------
{
  const cam = freshCam(false);
  cam.setPose({ p: [-2200, GROUND_Y + 1.7, 500], yaw: -Math.PI / 2, pitch: 0 });
  cam.setMode('walk');
  press('ShiftLeft');
  press('KeyW');
  run(cam, 3000);
  release('KeyW');
  release('ShiftLeft');
  const p = cam.getPose().p;
  c.check(
    'W8 without hooks.moveProbe the walker phases through (opt-in hook)',
    p[0] > -1800,
    `x ${p[0].toFixed(1)} (gem face -${GEM_FACE.toFixed(1)} did not block)`,
  );
}

// ---- P: pure volume-table spot checks (LOCAL units) ------------------------
{
  c.check('P1 wall between gates blocks', cityBlockedLocal(-99, 25, 1), 'a 99, u 25');
  c.check('P2 gate gap is open through the wall ring', !cityBlockedLocal(-99, 0, 1), 'a 99, u 0');
  c.check('P3 gem course blocks outside the wall plane', cityBlockedLocal(-102, 25, 1), 'a 102, u 25');
  c.check('P4 gem course is notched at the gate', !cityBlockedLocal(-102, 50, 1), 'a 102, u 50');
  c.check('P5 above the course top the wall profile steps back', !cityBlockedLocal(-102, 25, 5), 'a 102, y 5');
  c.check('P6 corners never open (no gate near a corner)', cityBlockedLocal(-99, 99, 1), 'a 99, u 99');
  c.check('P7 plinth is solid across a gate corridor', cityBlockedLocal(-87, 0, 1), 'a 87 < plinth 88');
  c.check('P8 tier-2 glass plane blocks', cityBlockedLocal(-60.4, 0, 70), 'a 60.4, y 70');
  c.check('P9 just off the tier-2 face is free', !cityBlockedLocal(-61, 0, 70), 'a 61, y 70');
  c.check('P10 crown face blocks', cityBlockedLocal(-22.01, 0, 140), 'a 22.01, y 140');
  c.check('P11 above the summit is free', !cityBlockedLocal(0, 0, 156.01), 'y 156.01');
}

// ---- T: no frame-spanning tunnel (LOCAL units) -----------------------------
// The old absolute-interpolant substeps let one move long enough to span a
// whole solid band (a dt-spike frame at fly speed) land free beyond it and
// tunnel. The incremental sweep stops at the first face regardless of move
// length; the gate lane stays passable end to end at any length.
{
  const hit = resolveCityMoveLocal(25, 105, 25, 95, 1); // spans course + wall
  c.check(
    'T1 a band-spanning move stops at the course face',
    hit.z > 103.3,
    `105→95 at u 25 stopped at z ${hit.z.toFixed(2)} (course outer ~103.43)`,
  );
  const lane = resolveCityMoveLocal(0, 105, 0, 95, 1); // gate lane end to end
  c.check(
    'T2 the same-length move passes through the gate lane',
    Math.abs(lane.z - 95) < 0.01,
    `105→95 at u 0 arrived at z ${lane.z.toFixed(2)}`,
  );
  const oblique = resolveCityMoveLocal(25, 105, 20, 95, 1); // into the course, obliquely
  c.check(
    'T3 an oblique band-spanning move still slides in x',
    oblique.z > 103.3 && Math.abs(oblique.x - 20) < 0.01,
    `x ${oblique.x.toFixed(2)} (target 20), z ${oblique.z.toFixed(2)}`,
  );
}

c.finish();
