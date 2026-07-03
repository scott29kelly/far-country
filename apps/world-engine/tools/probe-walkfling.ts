/**
 * CPU walk-physics probe for the plateau-edge walker-fling bug (STATUS
 * 2026-07-02 late-5) — no browser, no GPU, no dev server. Runs the REAL
 * FlyCamera walk/fly physics and the REAL RiverOfLife reach table under
 * Node against a mock flat-plateau terrain probe, composing the river
 * groundProbe wrap exactly as NewJerusalemScene does (keep the wrap copy
 * below in sync with NewJerusalemScene.ts if that wrap changes).
 *
 * The bug: riverSurfaceLocalY is a 2D plan lookup over VERTICALLY STACKED
 * reaches (ledge pools + crown basin, up to ~3.1 km world over the plaza).
 * Un-capped, a walker at plaza level under an elevated reach inherited its
 * surface as a hard wade floor — and FlyCamera's snap teleported them
 * kilometres upward. The lowest ledge pool overlaps 60 m past the wall
 * line in plan (it meets the wall cascade), so wading the river up to the
 * wall — the normal approach path — triggered it.
 *
 *   npx tsx tools/probe-walkfling.ts
 *
 * Exits 0 with all scenarios PASS on fixed code; on pre-fix code (no
 * maxSurfaceY cap in riverSurfaceLocalY) scenarios A/D/E FAIL with the
 * fling reproduced.
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
const { riverSurfaceLocalY } = await import('../src/nj/RiverOfLife');
const { NJ_SCALE } = await import('../src/nj/rimModel');

const press = (code: string): void => {
  for (const h of keydownHandlers) h({ code, repeat: false } as KeyboardEvent);
};
const release = (code: string): void => {
  for (const h of keyupHandlers) h({ code } as KeyboardEvent);
};

// ---- world stand-in: flat plateau top + the real river wrap ---------------
// (values match the NJ scene: plateau meadow ~470, plazaTopY = coreY + 2.8)
const GROUND_Y = 470;
const PLAZA_TOP = GROUND_Y + 2.8;
const terrainProbe = (_x: number, _z: number): { ground: number; water: number } => ({
  ground: GROUND_Y,
  water: GROUND_Y - 2, // dry-cell convention: no terrain water on the corridor
});
// mirror of NewJerusalemScene.ts's river-surface groundProbe wrap
const WATER_CLAIM_M = 6;
const probe = (x: number, z: number, y?: number): { ground: number; water: number } => {
  const g = terrainProbe(x, z);
  const maxSurf = y === undefined ? undefined : (y + WATER_CLAIM_M - PLAZA_TOP) / NJ_SCALE;
  const local = riverSurfaceLocalY(x / NJ_SCALE, z / NJ_SCALE, maxSurf);
  if (local <= -1e5) return g;
  return { ground: g.ground, water: Math.max(g.water, local * NJ_SCALE + PLAZA_TOP) };
};

const domShim = { addEventListener: () => {} } as unknown as HTMLElement;
const DT = 1 / 60;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures.push(name);
};
const freshCam = (): InstanceType<typeof FlyCamera> => {
  keydownHandlers.length = 0;
  keyupHandlers.length = 0;
  const cam = new FlyCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 30000), domShim);
  cam.groundProbe = probe;
  return cam;
};

// ---- A: wade the river north to the wall cascade (the reported repro) -----
// The channel reach ends and the lowest ledge pool's plan rect begins 60 m
// outside the wall line — pre-fix, crossing world z 2060 on the meridian
// snapped the eye from ~475 m to ~797 m (then higher pools → up to 3.6 km).
{
  const cam = freshCam();
  cam.setPose({ p: [0, GROUND_Y + 1.7, 2400], yaw: 0, pitch: 0 });
  cam.setMode('walk');
  const wadeEye = cam.getPose().p[1];
  press('KeyW');
  let maxJump = 0;
  let maxY = wadeEye;
  let prevY = wadeEye;
  let atJump = 0;
  for (let i = 0; i < 12000 && cam.getPose().p[2] > 1600; i++) {
    cam.update(DT);
    const p = cam.getPose().p;
    const dy = Math.abs(p[1] - prevY);
    if (dy > maxJump) {
      maxJump = dy;
      atJump = p[2];
    }
    prevY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  release('KeyW');
  check(
    'A1 wade floor holds at the channel',
    Math.abs(wadeEye - (PLAZA_TOP + 0.1 * NJ_SCALE + 0.45)) < 0.3,
    `entry eye ${wadeEye.toFixed(2)} (expect ≈ ${(PLAZA_TOP + 2 + 0.45).toFixed(2)})`,
  );
  check(
    'A2 no fling on the approach corridor',
    maxJump < 5 && maxY < GROUND_Y + 12,
    `max per-frame |Δy| ${maxJump.toFixed(2)} m at z ${atJump.toFixed(0)}; max eye ${maxY.toFixed(1)} m`,
  );
}

// ---- D: plaza-level walker directly under the crown basin -----------------
// (reachable through the city interior — no wall collision exists). Pre-fix
// the walk-mode entry snap alone teleported the eye to ~3600 m.
{
  const cam = freshCam();
  cam.setPose({ p: [0, GROUND_Y + 1.7, 100], yaw: 0, pitch: 0 });
  cam.setMode('walk');
  for (let i = 0; i < 120; i++) cam.update(DT);
  const y = cam.getPose().p[1];
  check(
    'D  under-crown immunity at plaza level',
    Math.abs(y - (GROUND_Y + 1.7)) < 0.05,
    `eye ${y.toFixed(2)} (expect ${(GROUND_Y + 1.7).toFixed(2)}; crown surface is ~3600)`,
  );
}

// ---- C: the crown basin still claims a walker actually standing on it -----
{
  const crownSurf = riverSurfaceLocalY(0, 5) * NJ_SCALE + PLAZA_TOP;
  const cam = freshCam();
  cam.setPose({ p: [0, crownSurf + 10, 100], yaw: 0, pitch: 0 });
  cam.setMode('walk');
  for (let i = 0; i < 120; i++) cam.update(DT);
  const y = cam.getPose().p[1];
  check(
    'C  crown-top water still claims from above',
    Math.abs(y - (crownSurf + 0.45)) < 0.05,
    `eye ${y.toFixed(2)} (expect ${(crownSurf + 0.45).toFixed(2)})`,
  );
}

// ---- E: fly-mode soft collision under an elevated pool ---------------------
{
  const cam = freshCam();
  cam.setPose({ p: [30, GROUND_Y + 10, 1900], yaw: 0, pitch: 0 }); // under the 796 m pool
  for (let i = 0; i < 60; i++) cam.update(DT);
  const y = cam.getPose().p[1];
  check(
    'E  fly mode not shoved up under an elevated pool',
    Math.abs(y - (GROUND_Y + 10)) < 0.05,
    `cam y ${y.toFixed(2)} (expect ${(GROUND_Y + 10).toFixed(2)})`,
  );
}

console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAILURE(S): ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
