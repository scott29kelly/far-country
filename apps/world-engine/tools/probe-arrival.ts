/**
 * CPU probe for the camera arrival ease (FlyCamera.flyTo) — no browser, no
 * GPU, no dev server. Runs the REAL FlyCamera under Node (walkfling idiom:
 * DOM shims + synthetic key events) on a controllable fake clock, so the
 * 5 s descent runs in milliseconds and every assertion is deterministic.
 *
 * Asserts the arrival contract:
 *   A  monotonic descent, exact landing pose, walk handoff on completion
 *   B  a movement-intent key (KeyW) skips straight to the landing
 *   C  KeyM (mute) does NOT skip
 *   D  the eased path clamps to groundProbe + eye height over a rise
 *   E  a programmatic setPose cancels the cinematic (tooling semantics)
 *
 *   npx tsx tools/probe-arrival.ts
 */

export {}; // top-level await needs module context

// ---- fake wall clock (flyTo paces on performance.now) ----------------------
let fakeT = 10_000;
Object.defineProperty(globalThis, 'performance', {
  value: { now: (): number => fakeT },
  configurable: true,
});

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
const { easeInOutCubic } = await import('../src/core/Easing');
const { PLATEAU_Y } = await import('../src/nj/rimModel');

const press = (code: string): void => {
  for (const h of keydownHandlers) h({ code, repeat: false } as KeyboardEvent);
};
const release = (code: string): void => {
  for (const h of keyupHandlers) h({ code } as KeyboardEvent);
};

const { makeChecker } = await import('./check');

const domShim = { addEventListener: () => {} } as unknown as HTMLElement;
const DT = 1 / 60;
const STEP_MS = 1000 / 60;
const { check, finish } = makeChecker();

// the NJ arrival geometry: aloft +120 y / +260 z behind the walk spawn.
// GROUND_Y is fixture plumbing — imported so the flat stand-in tracks the
// real plateau elevation (rimModel, ADR 0015). The TARGET/ALOFT offsets are
// DELIBERATE CONTRACT PINS (FC-0007) mirroring main.ts's arrival constants:
// kept independent so an arrival retune fails here and is acknowledged.
const GROUND_Y = PLATEAU_Y;
const TARGET = { p: [350, GROUND_Y + 1.7, 4150] as [number, number, number], yaw: 0, pitch: 0.22 };
const ALOFT = { p: [350, TARGET.p[1] + 120, 4150 + 260] as [number, number, number], yaw: 0, pitch: -0.1 };
const DUR_MS = 5000;

type Ground = (x: number, z: number) => number;
const flat: Ground = () => GROUND_Y;

const freshCam = (ground: Ground): InstanceType<typeof FlyCamera> => {
  keydownHandlers.length = 0;
  keyupHandlers.length = 0;
  const cam = new FlyCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 30000), domShim);
  cam.groundProbe = (x, z) => ({ ground: ground(x, z), water: ground(x, z) - 2 });
  cam.setPose(ALOFT);
  cam.enabled = false; // as main.ts arms it: input off until the landing
  return cam;
};

const armed = (ground: Ground): { cam: InstanceType<typeof FlyCamera>; done: () => boolean } => {
  const cam = freshCam(ground);
  let landed = false;
  cam.flyTo(TARGET, DUR_MS, () => {
    cam.setMode('walk');
    cam.enabled = true;
    landed = true;
  });
  return { cam, done: () => landed };
};

const step = (cam: InstanceType<typeof FlyCamera>): void => {
  fakeT += STEP_MS;
  cam.update(DT);
};

// ---- A: full descent — monotonic, exact landing, walk handoff ---------------
{
  const { cam, done } = armed(flat);
  let monotonic = true;
  let prev = cam.getPose();
  let frames = 0;
  while (!done() && frames < 400) {
    step(cam);
    frames++;
    const p = cam.getPose();
    if (p.p[1] > prev.p[1] + 1e-9 || p.p[2] > prev.p[2] + 1e-9) monotonic = false;
    prev = p;
  }
  const p = cam.getPose();
  const exact =
    p.p[0] === TARGET.p[0] && p.p[1] === TARGET.p[1] && p.p[2] === TARGET.p[2] &&
    p.yaw === TARGET.yaw && p.pitch === TARGET.pitch;
  check('A1 descent completes on schedule', done() && frames <= 302, `landed after ${frames} frames (expect ≈301)`);
  check('A2 descent is monotonic in y and z', monotonic, 'no frame rose or backed up');
  check('A3 landing pose is exact', exact, `pose [${p.p.map((v) => v.toFixed(2)).join(', ')}] yaw ${p.yaw} pitch ${p.pitch}`);
  check('A4 walk handoff + input re-enabled', cam.mode === 'walk' && cam.enabled, `mode=${cam.mode} enabled=${String(cam.enabled)}`);
}

// ---- B: a movement-intent key skips straight to the landing -----------------
{
  const { cam, done } = armed(flat);
  for (let i = 0; i < 30; i++) step(cam);
  check('B1 still descending before the skip', !done(), `done=${String(done())} at 0.5 s`);
  press('KeyW');
  step(cam);
  const p = cam.getPose();
  check(
    'B2 KeyW skips to the exact landing',
    done() && cam.mode === 'walk' && p.p[1] === TARGET.p[1] && p.p[2] === TARGET.p[2],
    `done=${String(done())} mode=${cam.mode} pose y ${p.p[1].toFixed(2)} z ${p.p[2].toFixed(2)}`,
  );
  release('KeyW');
}

// ---- C: KeyM (mute) must NOT skip -------------------------------------------
{
  const { cam, done } = armed(flat);
  for (let i = 0; i < 30; i++) step(cam);
  press('KeyM');
  release('KeyM');
  for (let i = 0; i < 60; i++) step(cam);
  const p = cam.getPose();
  check(
    'C  KeyM does not skip the descent',
    !done() && p.p[2] > TARGET.p[2] + 50,
    `done=${String(done())} z ${p.p[2].toFixed(1)} (still ${(p.p[2] - TARGET.p[2]).toFixed(0)} m out)`,
  );
}

// ---- D: the eased path clamps to ground + eye over a rise -------------------
// A 100 m triangular rise under the flight line: the straight aloft→spawn
// chord passes ~31 m BELOW its crest+eye, so the clamp must engage.
{
  const rise: Ground = (_x, z) => GROUND_Y + 100 * Math.max(0, 1 - Math.abs(z - 4300) / 60);
  const { cam, done } = armed(rise);
  let minClearance = Infinity;
  let maxLift = 0;
  let frames = 0;
  while (!done() && frames < 400) {
    step(cam);
    frames++;
    const p = cam.getPose();
    minClearance = Math.min(minClearance, p.p[1] - (rise(p.p[0], p.p[2]) + 1.7));
    const k = Math.min(1, (frames * STEP_MS) / DUR_MS);
    const easedY = ALOFT.p[1] + (TARGET.p[1] - ALOFT.p[1]) * easeInOutCubic(k);
    maxLift = Math.max(maxLift, p.p[1] - easedY);
  }
  check('D1 eased path never sinks under ground + eye', minClearance > -1e-6, `min clearance ${minClearance.toFixed(3)} m`);
  check('D2 the clamp actually engaged over the rise', maxLift > 5, `max lift over the pure ease ${maxLift.toFixed(1)} m`);
  check('D3 still lands exactly after the rise', done() && cam.getPose().p[1] === TARGET.p[1], `y ${cam.getPose().p[1].toFixed(2)}`);
}

// ---- E: a programmatic setPose cancels the cinematic ------------------------
{
  const { cam, done } = armed(flat);
  for (let i = 0; i < 30; i++) step(cam);
  const elsewhere = { p: [0, 900, 2000] as [number, number, number], yaw: 1, pitch: 0 };
  cam.setPose(elsewhere);
  cam.enabled = true; // tooling re-enables after placing
  for (let i = 0; i < 60; i++) step(cam);
  const p = cam.getPose();
  const held = Math.abs(p.p[0] - 0) < 1e-6 && Math.abs(p.p[1] - 900) < 1e-6 && Math.abs(p.p[2] - 2000) < 1e-6;
  check(
    'E  setPose cancels the descent (exact-placement semantics)',
    !done() && held,
    `done=${String(done())} pose [${p.p.map((v) => v.toFixed(1)).join(', ')}]`,
  );
}

finish();
