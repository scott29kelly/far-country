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
import { Engine } from './core/Engine';
import { FlyCamera } from './core/FlyCamera';
import { initHooks, type CamPose } from './core/Hooks';
import { parseCamString, parseParams } from './core/Params';
import { WorldSeed } from './core/Seed';
import { Hud } from './debug/HUD';
import { buildGalleryScene } from './debug/GalleryScene';
import { buildSanityScene } from './debug/SanityScene';
import { buildShadowTestScene } from './debug/ShadowTestScene';
import { buildTerrainScene } from './debug/TerrainScene';
import { buildScene, registerScene, type WorldContext } from './debug/Scenes';
import { buildNewJerusalemScene } from './nj/NewJerusalemScene';

async function boot(): Promise<void> {
  const hooks = initHooks();
  installGlobalErrorHooks();
  // environment gate BEFORE any loading: mobile / non-Chromium / missing
  // WebGPU each get a clear notice instead of a broken boot (?nogate=1 skips)
  if (!browserGate()) return;
  const params = parseParams();
  const bootUI = new BootUI(hooks);

  // arrival-experience switches (tooling contract: launch.ts passes rite=0)
  const q = new URLSearchParams(window.location.search);
  const riteOn = q.get('rite') !== '0';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // procedural arrival audio (New Jerusalem only — wild scenes stay silent).
  // Constructed before world-gen so the first user gesture during the rite
  // unlocks the AudioContext and the preparation drone plays under the wait.
  const ambience =
    params.scene === 'newjerusalem' && riteOn && q.get('audio') !== '0'
      ? new Ambience(hooks)
      : null;

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
  // arrival ease (the cinematic hide's camera movement): only for the default
  // interactive walk spawn — every explicit pose (?cam=, ?walk=0, tooling's
  // rite=0) keeps exact placement semantics, and reduced motion opts out
  let arrivalTarget: CamPose | null = null;
  if (params.cam !== null) {
    const pose = parseCamString(params.cam);
    if (pose) fly.setPose(pose); // explicit pose ⇒ fly semantics
  } else if (hooks.initialPose) {
    const wantWalk = hooks.initialPoseMode === 'walk' && q.get('walk') !== '0';
    if (wantWalk && riteOn && !reducedMotion) {
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

  new Hud(engine, params);

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
  if (ambience) {
    ambience.arrive();
    engine.onUpdate(() => ambience.update(engine.camera.position.x, engine.camera.position.z));
  }
  if (arrivalTarget) {
    const target = arrivalTarget;
    const start = fly.getPose();
    const t0 = performance.now();
    const DUR_MS = 5000;
    let landed = false;
    let skip = false;
    const onSkip = (): void => {
      skip = true;
    };
    window.addEventListener('keydown', onSkip, { once: true });
    window.addEventListener('mousedown', onSkip, { once: true });
    engine.onUpdate(() => {
      if (landed) return;
      const k = Math.min(1, (performance.now() - t0) / DUR_MS);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      if (k >= 1 || skip) {
        landed = true;
        fly.setPose(target);
        fly.setMode('walk');
        fly.enabled = true;
        window.removeEventListener('keydown', onSkip);
        window.removeEventListener('mousedown', onSkip);
        return;
      }
      fly.setPose({
        p: [
          start.p[0] + (target.p[0] - start.p[0]) * e,
          start.p[1] + (target.p[1] - start.p[1]) * e,
          start.p[2] + (target.p[2] - start.p[2]) * e,
        ],
        yaw: start.yaw + (target.yaw - start.yaw) * e,
        pitch: start.pitch + (target.pitch - start.pitch) * e,
      });
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
  const msg = e instanceof Error ? `${e.message}\n\n${e.stack ?? ''}` : String(e);
  failLoud('Boot failed', [msg]);
});
