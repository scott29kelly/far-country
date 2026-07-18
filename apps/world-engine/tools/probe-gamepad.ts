/**
 * CPU gamepad-navigation probe — no browser, no GPU, no dev server (the
 * walkfling idiom): runs the REAL FlyCamera physics and the REAL
 * GamepadInput shaping under Node, with injected fake Gamepad objects,
 * verifying the controller contract end to end:
 *
 *   deadzone (drift-immune exact placement), expo steer rates, analog
 *   left-stick move in fly and walk, trigger climb/descend, RB/LB speed
 *   steps as rising edges, Start/Y walk-fly toggle, B cruise-cancel
 *   (Escape replay is guarded under Node — must not crash), A jump,
 *   stick-back cruise cancel, cinematic skip parity, disabled-input
 *   stale-edge discipline, nonstandard-mapping fallback, and the
 *   NavigationState gamepad flag.
 *
 *   npx tsx tools/probe-gamepad.ts
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

// ---- fake pad (Chrome standard-mapping shape) ------------------------------
type FakeButton = { pressed: boolean; touched: boolean; value: number };
interface FakePad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  axes: number[];
  buttons: FakeButton[];
  timestamp: number;
}
const makePad = (mapping = 'standard'): FakePad => ({
  id: 'Fake Xbox 360 Controller (probe)',
  index: 0,
  connected: true,
  mapping,
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  timestamp: 0,
});
const press = (pad: FakePad, i: number, value = 1): void => {
  pad.buttons[i] = { pressed: true, touched: true, value };
};
const release = (pad: FakePad, i: number): void => {
  pad.buttons[i] = { pressed: false, touched: false, value: 0 };
};
// standard-mapping indices (mirrors GamepadInput's constants)
const A = 0, B = 1, Y = 3, LB = 4, RB = 5, LT = 6, RT = 7, START = 9;

// ---- world stand-in: flat ground -------------------------------------------
const GROUND_Y = 200;
const probe = (_x: number, _z: number): { ground: number; water: number } => ({
  ground: GROUND_Y,
  water: GROUND_Y - 2, // dry convention
});

const domShim = { addEventListener: () => {} } as unknown as HTMLElement;
const DT = 1 / 60;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures.push(name);
};
const freshCam = (pad: FakePad | null): InstanceType<typeof FlyCamera> => {
  keydownHandlers.length = 0;
  keyupHandlers.length = 0;
  const cam = new FlyCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 30000), domShim);
  cam.groundProbe = probe;
  cam.gamepad.source = () => [pad as unknown as Gamepad | null];
  return cam;
};
const step = (cam: InstanceType<typeof FlyCamera>, frames: number): void => {
  for (let i = 0; i < frames; i++) cam.update(DT);
};

// ---- A: radial deadzone — drift-immune exact placement ---------------------
// A pad resting on the desk drifts a little on every axis; hypot(0.1, 0.1)
// = 0.14 sits under the 0.15 radial deadzone, so a programmatic pose must
// hold EXACTLY while the pad is live.
{
  const pad = makePad();
  pad.axes = [0.1, 0.1, 0.1, 0.1];
  const cam = freshCam(pad);
  cam.setPose({ p: [100, 300, 100], yaw: 0.5, pitch: -0.2 });
  step(cam, 120);
  const p = cam.getPose();
  check(
    'A  deadzone: drifting pad never disturbs a programmatic pose',
    p.p[0] === 100 && p.p[1] === 300 && p.p[2] === 100 && p.yaw === 0.5 && p.pitch === -0.2,
    `pose [${p.p.map((v) => v.toFixed(4)).join(', ')}] yaw ${p.yaw.toFixed(4)} pitch ${p.pitch.toFixed(4)}`,
  );
}

// ---- B: right-stick steer — gentle rates, expo curve -----------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  pad.axes[2] = 1; // full right
  step(cam, 60); // 1 s
  const fullYaw = -cam.getPose().yaw; // yaw -= rate·dt → positive deflection
  check(
    'B1 full-deflection yaw rate ≈ 1.2 rad/s (gentler than mouse edge 1.5)',
    Math.abs(fullYaw - 1.2) < 0.03,
    `Δyaw ${fullYaw.toFixed(3)} rad over 1 s`,
  );
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  pad.axes[2] = 0.5;
  step(cam, 60);
  const halfYaw = -cam.getPose().yaw;
  check(
    'B2 expo: half deflection turns at well under half the full rate',
    halfYaw > 0.05 && halfYaw < 0.5 * fullYaw * 0.6,
    `half-stick Δyaw ${halfYaw.toFixed(3)} vs full ${fullYaw.toFixed(3)} (linear would be ${(fullYaw / 2).toFixed(3)})`,
  );
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  pad.axes[2] = 0;
  pad.axes[3] = 1; // stick down = look down
  step(cam, 60);
  const pitch = cam.getPose().pitch;
  check(
    'B3 pitch: stick down looks down at ≈ 0.9 rad/s',
    Math.abs(pitch + 0.9) < 0.03,
    `pitch ${pitch.toFixed(3)} after 1 s`,
  );
}

// ---- C: left-stick fly move — analog magnitude scales speed ----------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 }); // facing -z, speed 24
  pad.axes[1] = -1; // stick up = forward
  step(cam, 120); // 2 s
  const full = cam.getPose();
  const fullDist = -full.p[2];
  check(
    'C1 full stick flies forward at fly speed',
    fullDist > 35 && Math.abs(full.p[0]) < 1e-6 && Math.abs(full.p[1] - 300) < 1e-6,
    `moved ${fullDist.toFixed(1)} m in 2 s at speed 24 (x ${full.p[0].toFixed(4)}, y ${full.p[1].toFixed(2)})`,
  );
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  pad.axes[1] = -0.5;
  step(cam, 120);
  const halfDist = -cam.getPose().p[2];
  const ratio = halfDist / fullDist;
  check(
    'C2 half stick flies at roughly the deadzone-scaled fraction (analog)',
    ratio > 0.3 && ratio < 0.55,
    `half/full distance ratio ${ratio.toFixed(3)} (linear curve t = 0.41 expected)`,
  );
}

// ---- D: triggers — RT climbs, LT descends, idle values stay dead -----------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  press(pad, RT, 1);
  step(cam, 60);
  const up = cam.getPose().p[1] - 300;
  check('D1 RT climbs in fly mode', up > 10, `Δy +${up.toFixed(1)} m in 1 s`);
  release(pad, RT);
  const yAfterClimb = cam.getPose().p[1];
  press(pad, LT, 1);
  step(cam, 60);
  const down = cam.getPose().p[1] - yAfterClimb;
  check('D2 LT descends in fly mode', down < -10, `Δy ${down.toFixed(1)} m in 1 s`);
  release(pad, LT);
  // fresh camera: fly velocity persists across setPose (existing semantics),
  // so D2's descent would otherwise coast into this stillness check
  const cam2 = freshCam(pad);
  cam2.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  press(pad, RT, 0.05); // under the 0.08 trigger threshold — worn-pad idle
  step(cam2, 60);
  const drift = cam2.getPose().p[1] - 300;
  check('D3 trigger idle values under threshold do nothing', drift === 0, `Δy ${drift.toFixed(4)} m`);
  release(pad, RT);
}

// ---- E: bumpers step the [ ] speeds as rising edges ------------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  press(pad, RB);
  step(cam, 30); // held half a second
  const held = cam.navigationState.flySpeed;
  check('E1 RB steps fly speed 24 → 60 once (edge, not autorepeat)', held === 60, `speed ${held} after 30 held frames`);
  release(pad, RB);
  step(cam, 1);
  press(pad, RB);
  step(cam, 1);
  check('E2 second RB press steps 60 → 150', cam.navigationState.flySpeed === 150, `speed ${cam.navigationState.flySpeed}`);
  release(pad, RB);
  step(cam, 1);
  press(pad, LB);
  step(cam, 1);
  check('E3 LB steps back 150 → 60', cam.navigationState.flySpeed === 60, `speed ${cam.navigationState.flySpeed}`);
  release(pad, LB);
}

// ---- F: Start / Y toggle walk-fly (the V key) ------------------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 260, 0], yaw: 0, pitch: 0 });
  press(pad, START);
  step(cam, 1);
  const walked = cam.mode === 'walk';
  const eye = cam.getPose().p[1];
  check(
    'F1 Start enters walk and snaps the eye onto the ground',
    walked && Math.abs(eye - (GROUND_Y + 1.7)) < 0.05,
    `mode ${cam.mode}, eye ${eye.toFixed(2)} (expect ${(GROUND_Y + 1.7).toFixed(2)})`,
  );
  release(pad, START);
  step(cam, 1);
  press(pad, Y);
  step(cam, 1);
  check('F2 Y toggles back to fly', cam.mode === 'fly', `mode ${cam.mode}`);
  release(pad, Y);
}

// ---- G: B cancels cruise (Escape replay guarded under Node) ----------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  cam.setCruise(true);
  press(pad, B);
  step(cam, 1); // would throw here if the KeyboardEvent replay were unguarded
  check('G  B cancels cruise without crashing under Node', !cam.cruise, `cruise ${cam.cruise}`);
  release(pad, B);
}

// ---- H: stick pulled back cancels cruise like S ----------------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  cam.setCruise(true);
  pad.axes[1] = 1; // stick down = backward
  step(cam, 1);
  check('H  stick-back cancels cruise (S parity)', !cam.cruise, `cruise ${cam.cruise}`);
}

// ---- I: A jumps in walk mode -----------------------------------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 260, 0], yaw: 0, pitch: 0 });
  cam.setMode('walk');
  step(cam, 10); // settle grounded
  press(pad, A);
  step(cam, 8);
  const rise = cam.getPose().p[1] - (GROUND_Y + 1.7);
  check('I  A jumps from grounded walk', rise > 0.2, `eye +${rise.toFixed(2)} m above stand height`);
  release(pad, A);
}

// ---- J: left-stick walk — analog pace --------------------------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 260, 0], yaw: 0, pitch: 0 });
  cam.setMode('walk');
  pad.axes[1] = -1;
  step(cam, 300); // 5 s at 4.6 m/s
  const fullDist = -cam.getPose().p[2];
  check('J1 full stick walks at walk speed', fullDist > 18 && fullDist < 24, `${fullDist.toFixed(1)} m in 5 s`);
  const cam2 = freshCam(pad);
  cam2.setPose({ p: [0, 260, 0], yaw: 0, pitch: 0 });
  cam2.setMode('walk');
  pad.axes[1] = -0.5;
  step(cam2, 300);
  const halfDist = -cam2.getPose().p[2];
  const ratio = halfDist / fullDist;
  check('J2 half stick strolls (analog pace)', ratio > 0.3 && ratio < 0.55, `half/full ratio ${ratio.toFixed(3)}`);
}

// ---- K: disabled input — pad ignored, edges consumed, none fire stale ------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  cam.enabled = false;
  pad.axes[1] = -1;
  press(pad, START);
  step(cam, 60);
  const held = cam.getPose();
  check(
    'K1 disabled: stick and Start do nothing',
    held.p[2] === 0 && cam.mode === 'fly',
    `z ${held.p[2].toFixed(3)}, mode ${cam.mode}`,
  );
  cam.enabled = true;
  pad.axes[1] = 0;
  step(cam, 5); // Start is STILL held — its edge was consumed while disabled
  check('K2 re-enable: the held Start edge never fires stale', cam.mode === 'fly', `mode ${cam.mode}`);
  release(pad, START);
  step(cam, 1);
  press(pad, START);
  step(cam, 1);
  check('K3 a fresh Start press after re-enable toggles walk', cam.mode === 'walk', `mode ${cam.mode}`);
  release(pad, START);
}

// ---- L: cinematic skip parity (stick = movement intent) --------------------
{
  const pad = makePad();
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  const target = { p: [500, 400, -500] as [number, number, number], yaw: 1, pitch: -0.1 };
  cam.flyTo(target, 60000);
  pad.axes[1] = -1; // movement intent
  // ONE frame: skip flags before updateCine, which lands the target the same
  // update; a second frame would let the still-held stick fly off the landing
  step(cam, 1);
  const p = cam.getPose();
  check(
    'L  stick input skips a cinematic to its landing pose',
    Math.abs(p.p[0] - 500) < 1e-6 && Math.abs(p.yaw - 1) < 1e-6,
    `pose [${p.p.map((v) => v.toFixed(1)).join(', ')}] yaw ${p.yaw.toFixed(3)}`,
  );
  pad.axes[1] = 0;
}

// ---- M: nonstandard mapping — best-effort, no crash ------------------------
{
  const pad = makePad(''); // Switch-over-Bluetooth shape: mapping ""
  pad.axes = [0, -1]; // only two axes — index guards must hold
  pad.buttons = pad.buttons.slice(0, 10);
  const cam = freshCam(pad);
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  step(cam, 60);
  const dist = -cam.getPose().p[2];
  check('M1 nonstandard pad still moves (axes 0-1 best-effort)', dist > 10, `${dist.toFixed(1)} m in 1 s`);
  press(pad, START);
  step(cam, 1);
  check('M2 nonstandard Start still toggles walk', cam.mode === 'walk', `mode ${cam.mode}`);
  release(pad, START);
}

// ---- N: NavigationState gamepad flag tracks pad exposure -------------------
{
  let slot: FakePad | null = null;
  const cam = freshCam(null);
  cam.gamepad.source = () => [slot as unknown as Gamepad | null];
  cam.setPose({ p: [0, 300, 0], yaw: 0, pitch: 0 });
  let last = cam.navigationState;
  cam.subscribeNavigation((s) => {
    last = s;
  });
  step(cam, 2);
  const before = last.gamepad;
  slot = makePad();
  step(cam, 1);
  const during = last.gamepad;
  slot = null;
  step(cam, 1);
  const after = last.gamepad;
  check(
    'N  gamepad flag: false → true on exposure → false on disconnect',
    !before && during && !after,
    `before ${before}, connected ${during}, after ${after}`,
  );
}

console.log(failures.length === 0 ? '\nALL PASS' : `\n${failures.length} FAILURE(S): ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
