/**
 * CPU probe for user-facing large-world travel controls. No browser, GPU, or
 * dev server: synthetic keys drive the real FlyCamera against a flat probe.
 *
 *   npx tsx tools/probe-navigation.ts
 */

export {};

type KeyHandler = (event: KeyboardEvent) => void;
const keydownHandlers: KeyHandler[] = [];
const keyupHandlers: KeyHandler[] = [];
const windowShim = {
  addEventListener(type: string, handler: KeyHandler): void {
    if (type === 'keydown') keydownHandlers.push(handler);
    else if (type === 'keyup') keyupHandlers.push(handler);
  },
};
Object.defineProperty(globalThis, 'window', { value: windowShim, configurable: true });

const { PerspectiveCamera } = await import('three');
const { FlyCamera } = await import('../src/core/FlyCamera');
const { makeChecker } = await import('./check');

const DT = 1 / 60;
const domShim = { addEventListener: () => {} } as unknown as HTMLElement;
const { check, finish } = makeChecker();

const press = (code: string): void => {
  const event = { code, repeat: false, preventDefault: () => {} } as unknown as KeyboardEvent;
  for (const handler of keydownHandlers) handler(event);
};
const release = (code: string): void => {
  const event = { code } as KeyboardEvent;
  for (const handler of keyupHandlers) handler(event);
};
const run = (cam: InstanceType<typeof FlyCamera>, frames: number): void => {
  for (let i = 0; i < frames; i++) cam.update(DT);
};
const fresh = (): InstanceType<typeof FlyCamera> => {
  keydownHandlers.length = 0;
  keyupHandlers.length = 0;
  const cam = new FlyCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 30000), domShim);
  cam.groundProbe = () => ({ ground: 0, water: -2 });
  cam.setPose({ p: [0, 100, 0], yaw: 0, pitch: 0 });
  return cam;
};

// A: speed steps are mode-aware and remain inside the public safety bounds.
// The expected values (walk scales 4/2, fly speed 60, clamp 0.5..2000) are
// DELIBERATE CONTRACT PINS (FC-0007): independent copies of the FlyCamera
// speed table, kept as literals ON PURPOSE so a retune fails here and gets
// acknowledged consciously — importing them would move both sides of the
// assertion together (the FC-0022 mirror-pin failure).
{
  const cam = fresh();
  cam.setMode('walk');
  press('BracketRight');
  press('BracketRight');
  check('A1 walk pace steps independently', cam.walkScale === 4, `walk scale ${cam.walkScale}x`);
  press('BracketLeft');
  check('A2 walk pace steps down', cam.walkScale === 2, `walk scale ${cam.walkScale}x`);
  press('KeyV');
  release('KeyV');
  press('BracketRight');
  check('A3 V enters flight and ] steps fly speed', cam.mode === 'fly' && cam.speed === 60, `mode=${cam.mode} speed=${cam.speed}`);
  cam.setFlySpeed(99_999);
  const high = cam.speed;
  cam.setFlySpeed(0);
  check('A4 fly speed clamps to 0.5..2000 m/s', high === 2000 && cam.speed === 0.5, `high=${high} low=${cam.speed}`);
}

// B: cruise moves without a held key, and Escape cancels it cleanly.
{
  const cam = fresh();
  cam.setFlySpeed(60);
  press('KeyC');
  release('KeyC');
  run(cam, 60);
  const cruisingZ = cam.getPose().p[2];
  check('B1 C enables auto-cruise', cam.cruise && cruisingZ < -45, `cruise=${String(cam.cruise)} z=${cruisingZ.toFixed(1)}`);
  press('Escape');
  release('Escape');
  run(cam, 60);
  const stoppedZ = cam.getPose().p[2];
  check('B2 Escape cancels cruise', !cam.cruise && stoppedZ - cruisingZ > -8, `coast ${(cruisingZ - stoppedZ).toFixed(1)} m`);
}

// C: flight has familiar vertical controls in addition to E/Q.
{
  const cam = fresh();
  cam.setFlySpeed(24);
  press('Space');
  run(cam, 45);
  release('Space');
  const raised = cam.getPose().p[1];
  press('ControlLeft');
  run(cam, 60);
  release('ControlLeft');
  const lowered = cam.getPose().p[1];
  check('C1 Space climbs in flight', raised > 112, `y=${raised.toFixed(1)}`);
  check('C2 Ctrl descends in flight', lowered < raised - 12, `y=${lowered.toFixed(1)}`);
}

// D: rapid grounded travel still uses the real ground clamp.
{
  const cam = fresh();
  cam.setMode('walk');
  cam.setWalkScale(8);
  press('KeyW');
  run(cam, 60);
  release('KeyW');
  const pose = cam.getPose();
  check('D1 8x ground travel covers large distances', pose.p[2] < -30, `z=${pose.p[2].toFixed(1)}`);
  check('D2 rapid travel remains ground-clamped', Math.abs(pose.p[1] - 1.7) < 1e-6, `y=${pose.p[1].toFixed(2)}`);
}

// E: quick travel/setPose must never leave cruise carrying the user onward.
{
  const cam = fresh();
  cam.setCruise(true);
  cam.setPose({ p: [900, 500, -1200], yaw: 1, pitch: -0.2 });
  const pose = cam.getPose();
  check('E setPose cancels cruise at the exact destination', !cam.cruise && pose.p[0] === 900 && pose.p[2] === -1200, `cruise=${String(cam.cruise)} pose=${pose.p[0]},${pose.p[2]}`);
}

finish();
