/**
 * Dev-only live tuning panel — plan doc §1 Phase A, answers recorded in §4:
 * Tweakpane, gated behind `?edit=1`, NEVER in the public build (the dynamic
 * import in main.ts sits inside a literal `import.meta.env.DEV` branch, so
 * `vite build` dead-code-eliminates both the import and this whole module —
 * verified by grepping dist for 'tweakpane').
 *
 * Phase A binds only handles that are already live-mutable (no refactor):
 * time of day (through hooks.setTimeOfDay — the ONE entry point that re-bakes
 * sky LUT + IBL + cloud shadow + probe GI + grade together; calling
 * sunSky.setTimeOfDay directly desyncs those, see TerrainScene), the aerial
 * fog/clarity uniforms, the summit glory intensity (njLive registry), the
 * exposure lock, pose bookmarks, and a copy-values-to-clipboard round trip
 * (paste back into source — the Phase B NewJerusalemConfig supersedes this).
 */

import { Pane } from 'tweakpane';
import type { Engine } from '../core/Engine';
import type { CamPose, LaasHooks } from '../core/Hooks';
import type { LaasParams } from '../core/Params';
import type { PostStack } from '../render/PostStack';
import type { SunSky } from '../sky/SunSky';
import { njLive } from '../nj/CityMassing';

/** The session's established judging framings (world coords, NJ scene). */
const FRAMINGS: Array<{ title: string; pose: CamPose }> = [
  { title: 'spawn meadow', pose: { p: [350, 482, 4150], yaw: 0, pitch: 0.12, fov: 60 } },
  { title: 'south establishing', pose: { p: [0, 1000, 5200], yaw: 0, pitch: -0.12, fov: 55 } },
  { title: 'gate level', pose: { p: [0, 510, 2650], yaw: 0, pitch: 0.05, fov: 65 } },
  { title: 'summit glory', pose: { p: [500, 3950, 1500], yaw: 0.32, pitch: -0.09, fov: 55 } },
];

function camString(pose: CamPose): string {
  const p = pose.p.map((n) => n.toFixed(1)).join(',');
  const base = `${p},${pose.yaw.toFixed(3)},${pose.pitch.toFixed(3)}`;
  return pose.fov !== undefined ? `${base},${pose.fov.toFixed(0)}` : base;
}

export function initEditPanel(engine: Engine, params: LaasParams, hooks: LaasHooks): void {
  const sunSky = (engine as unknown as { sunSky?: SunSky }).sunSky ?? null;
  const post = engine.post as PostStack | null;

  const state = {
    timeOfDay: sunSky ? sunSky.timeOfDay : params.timeOfDay,
    aerialFogK: sunSky ? sunSky.atmosphere.aerialFogK.value : 0.22,
    aerialClarity: sunSky ? sunSky.atmosphere.aerialClarity.value : 0,
    gloryIntensity: njLive.glory?.emissiveIntensity ?? 12,
    lockExposure: new URLSearchParams(window.location.search).get('lockexp') === '1',
    pose: '',
  };

  const pane = new Pane({ title: 'laas edit' });
  pane.element.style.zIndex = '20'; // above the canvas, above #boot leftovers

  // panel input must not drive the fly camera / bookmarks / ToD hotkeys —
  // every global keydown listener in the engine ignores event.target
  for (const type of ['keydown', 'keyup'] as const) {
    pane.element.addEventListener(type, (e) => e.stopPropagation());
  }

  // --- light & air -----------------------------------------------------------
  const sky = pane.addFolder({ title: 'light & air' });
  // trailing debounce: hooks.setTimeOfDay kicks a fire-and-forget re-bake
  // chain (LUT compute + IBL cube + cloud shadow + GI invalidate) — dragging
  // the slider must not overlap those chains per tick
  let todTimer: number | null = null;
  sky.addBinding(state, 'timeOfDay', { min: 0, max: 24, step: 0.1, label: 'time of day' }).on(
    'change',
    (ev) => {
      if (todTimer !== null) window.clearTimeout(todTimer);
      todTimer = window.setTimeout(() => {
        todTimer = null;
        hooks.setTimeOfDay?.(ev.value);
      }, 250);
    },
  );
  if (sunSky) {
    sky
      .addBinding(state, 'aerialFogK', { min: 0, max: 1, step: 0.005, label: 'aerial fog' })
      .on('change', (ev) => {
        sunSky.atmosphere.aerialFogK.value = ev.value;
      });
    sky
      .addBinding(state, 'aerialClarity', { min: 0, max: 1, step: 0.005, label: 'aerial clarity' })
      .on('change', (ev) => {
        sunSky.atmosphere.aerialClarity.value = ev.value;
      });
  }
  if (post) {
    sky.addBinding(state, 'lockExposure', { label: 'lock exposure' }).on('change', (ev) => {
      post.setExposureLocked(ev.value);
    });
  }

  // --- city ------------------------------------------------------------------
  if (njLive.glory) {
    const cityF = pane.addFolder({ title: 'city' });
    cityF
      .addBinding(state, 'gloryIntensity', { min: 0, max: 30, step: 0.25, label: 'glory' })
      .on('change', (ev) => {
        if (njLive.glory) njLive.glory.emissiveIntensity = ev.value;
      });
  }

  // --- camera ----------------------------------------------------------------
  const camF = pane.addFolder({ title: 'camera' });
  const poseBinding = camF.addBinding(state, 'pose', { readonly: true, label: 'pose' });
  let acc = 0;
  engine.onUpdate((dt) => {
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    const p = hooks.getPose?.();
    if (p) {
      state.pose = camString(p);
      poseBinding.refresh();
    }
  });
  camF.addButton({ title: 'copy pose (?cam=)' }).on('click', () => {
    const p = hooks.getPose?.();
    if (p) void navigator.clipboard.writeText(camString(p)).catch(() => undefined);
  });
  for (const f of FRAMINGS) {
    camF.addButton({ title: f.title }).on('click', () => hooks.setPose?.(f.pose));
  }

  // --- round trip --------------------------------------------------------------
  const copyBtn = pane.addButton({ title: 'copy values (JSON)' });
  copyBtn.on('click', () => {
    const p = hooks.getPose?.();
    const json = JSON.stringify(
      {
        timeOfDay: state.timeOfDay,
        aerialFogK: state.aerialFogK,
        aerialClarity: state.aerialClarity,
        gloryIntensity: state.gloryIntensity,
        lockExposure: state.lockExposure,
        cam: p ? camString(p) : null,
      },
      null,
      2,
    );
    void navigator.clipboard
      .writeText(json)
      .then(() => {
        copyBtn.title = 'copied';
        window.setTimeout(() => {
          copyBtn.title = 'copy values (JSON)';
        }, 1200);
      })
      .catch(() => undefined);
  });
}
