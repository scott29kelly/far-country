/** LAAS entry point — boot sequence with fail-loud diagnostics. */

import { Ambience } from './audio/Ambience';
import { BootUI } from './core/BootUI';
import { browserGate } from './core/BrowserGate';
import {
  describeDiagnostics,
  failLoud,
  installGlobalErrorHooks,
  probeWebGPU,
} from './core/Diagnostics';
import { ControlsUI } from './core/ControlsUI';
import { Engine } from './core/Engine';
import { FlyCamera } from './core/FlyCamera';
import { installEntityHud } from './core/EntityHud';
import { initHooks, type CamPose } from './core/Hooks';
import { NavigationUI } from './core/NavigationUI';
import { parseCamString, parseParams } from './core/Params';
import { WorldSeed } from './core/Seed';
import { Hud } from './debug/HUD';
import { buildGalleryScene } from './debug/GalleryScene';
import { buildSanityScene } from './debug/SanityScene';
import { buildShadowTestScene } from './debug/ShadowTestScene';
import { buildTerrainScene } from './debug/TerrainScene';
import { buildScene, registerScene, type WorldContext } from './debug/Scenes';
import { buildNewJerusalemScene } from './nj/NewJerusalemScene';

// hoisted so boot().catch can tear the audio graph down on a failed boot
let ambience: Ambience | null = null;

async function boot(): Promise<void> {
  const hooks = initHooks();
  installGlobalErrorHooks();
  // environment gate BEFORE any loading: mobile / non-Chromium / missing
  // WebGPU each get a clear notice instead of a broken boot (?nogate=1 skips)
  if (!browserGate()) return;
  const params = parseParams();
  const bootUI = new BootUI(hooks, params.rite);

  // arrival-experience switches live in LaasParams (rite/audio/walk — the
  // tooling contract stays launch.ts's literal rite=0). ?fly=1 is Bookmarks'
  // own switch, read here only to gate the ease off the flythrough.
  const q = new URLSearchParams(window.location.search);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  bootUI.set(0.02, 'probing WebGPU');
  const diag = await probeWebGPU();
  hooks.diag = diag;
  if (!diag.ok) {
    failLoud('WebGPU unavailable — LAAS has no fallback by design', [
      diag.reason ?? 'unknown reason',
      '',
      'Chrome exposes WebGPU here, but no usable GPU adapter came up. Check:',
      '  • chrome://gpu — WebGPU should read “Hardware accelerated”',
      '  • Settings → System → hardware acceleration ON, then relaunch',
      '  • update Chrome and the GPU driver',
    ]);
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[laas] webgpu ok\n' + describeDiagnostics(diag).join('\n'));

  // procedural arrival audio (New Jerusalem only — wild scenes stay silent).
  // Constructed only after the GPU gate passes (a boot that fails the gate
  // must not leave gesture listeners or an AudioContext behind) but still
  // before world-gen, so the first user gesture during the rite unlocks the
  // AudioContext and the preparation drone plays under the wait.
  if (params.scene === 'newjerusalem' && params.rite && params.audio) {
    ambience = new Ambience(hooks);
  }

  bootUI.set(0.08, 'creating renderer');
  const engine = await Engine.create(params, hooks);

  // FlyCamera's update MUST register before any scene system: updateFns run
  // in registration order, and subsystems copy camera state in their own
  // updates — the mover has to run first or every copy is one frame stale
  // during interactive motion (clouds/aerial visibly lagged the camera).
  const fly = new FlyCamera(engine.camera, engine.renderer.domElement);
  engine.onUpdate((dt) => fly.update(dt));

  const seed = new WorldSeed(params.seed);
  registerScene('sanity', buildSanityScene);
  registerScene('terrain', buildTerrainScene);
  registerScene('gallery', buildGalleryScene);
  registerScene('shadowtest', buildShadowTestScene);
  // 'world' becomes the streamed open world once terrain tiles land.
  registerScene('world', buildTerrainScene);
  // Far Country: the New Jerusalem on the new-earth terrain (Phase 3, Stage 3).
  registerScene('newjerusalem', buildNewJerusalemScene);

  const ctx: WorldContext = {
    engine,
    params,
    seed,
    hooks,
    progress: (p, msg) => bootUI.set(0.1 + p * 0.85, msg),
  };
  await buildScene(params.scene, ctx);

  // terrain probe first — walk mode + fly soft-collision depend on it
  if (hooks.groundProbe) fly.groundProbe = hooks.groundProbe;
  // lateral wall/gate collision (NJ city) — null in wild scenes, no blocking
  if (hooks.moveProbe) fly.moveProbe = hooks.moveProbe;
  // arrival ease (the cinematic hide's camera movement): only for the default
  // interactive walk spawn — every explicit pose (?cam=, ?walk=0, tooling's
  // rite=0) keeps exact placement semantics, and reduced motion opts out.
  // Gated to the New Jerusalem arrival narrative, and ?fly=1 hands the camera
  // to the Bookmarks flythrough — it must not fight the ease for the pose.
  let arrivalTarget: CamPose | null = null;
  if (params.cam !== null) {
    const pose = parseCamString(params.cam);
    if (pose) fly.setPose(pose); // explicit pose ⇒ fly semantics
  } else if (hooks.initialPose) {
    const wantWalk = hooks.initialPoseMode === 'walk' && params.walk;
    const wantArrival =
      wantWalk &&
      params.rite &&
      !reducedMotion &&
      params.scene === 'newjerusalem' &&
      q.get('fly') !== '1';
    if (wantArrival) {
      // start held aloft behind the spawn; the descent runs after hide()
      const t = hooks.initialPose;
      arrivalTarget = t;
      fly.setPose({ p: [t.p[0], t.p[1] + 120, t.p[2] + 260], yaw: t.yaw, pitch: -0.1 });
      fly.enabled = false; // no input (and no walk snap) until the ease lands
    } else {
      fly.setPose(hooks.initialPose);
      // grounded RPG exploration is the interactive default (V toggles fly);
      // ?walk=0 keeps tooling/legacy behavior
      if (wantWalk) fly.setMode('walk');
    }
  }

  new NavigationUI(engine, fly, hooks);
  new ControlsUI(ambience);
  new Hud(engine, params);
  // citation card for scenes with cited content (no-ops without the hook)
  if (hooks.entityPick) installEntityHud(engine, hooks, fly);

  hooks.setPose = (p) => fly.setPose(p);
  hooks.getPose = () => fly.getPose();
  hooks.settle = (frames?: number) => engine.settle(frames ?? 8);
  hooks.flyCamEnabled = (on) => {
    fly.enabled = on;
  };

  engine.start();
  await engine.settle(6);
  bootUI.hide();
  hooks.ready = true;
  // eslint-disable-next-line no-console
  console.log('[laas] ready');

  // the arrival: audio resolves into the meadow bed; the camera alights onto
  // the spawn while the boot overlay's staged dissolve reveals the world.
  // Wall-clock pacing (never dt); any input skips straight to the ground.
  const amb = ambience;
  if (amb) {
    amb.arrive();
    engine.onUpdate(() => amb.update(engine.camera.position.x, engine.camera.position.z));
  }
  if (arrivalTarget) {
    // the descent runs inside FlyCamera.update() (first in registration
    // order): no one-frame cloud/aerial lag, no immortal onUpdate closure.
    // Movement-intent keys skip; M/mouse keep their rite meanings; the
    // eased path clamps to the ground probe (all inside flyTo).
    fly.flyTo(arrivalTarget, 5000, () => {
      fly.setMode('walk');
      fly.enabled = true;
    });
  }

  // dev-only live tuning panel (?edit=1 — plan doc §1 Phase A). The literal
  // import.meta.env.DEV guard lets `vite build` dead-code-eliminate the
  // dynamic import, so neither the panel nor tweakpane ever reaches the
  // public bundle (verified by grepping dist for 'tweakpane').
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('edit') === '1') {
    const { initEditPanel } = await import('./debug/EditPanel');
    initEditPanel(engine, params, hooks);
  }
}

boot().catch((e: unknown) => {
  ambience?.dispose();
  ambience = null;
  const msg = e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e);
  failLoud('Boot failed', [msg]);
});
