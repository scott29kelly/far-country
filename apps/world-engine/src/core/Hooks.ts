/**
 * Global hooks contract between the running app and external tooling
 * (Playwright verification harness reads/writes `window.__laas`).
 */

export interface CamPose {
  /** world position */
  p: [number, number, number];
  /** yaw (rad, around +Y), pitch (rad) */
  yaw: number;
  pitch: number;
  /** optional fov override (deg) */
  fov?: number;
}

export interface NavigationTarget {
  /** stable id used by the navigation UI and probes */
  id: string;
  name: string;
  /** short orientation note; factual world claims include a citation below */
  detail: string;
  /** Scripture / source pointer displayed with the target when applicable */
  citation?: string;
  pose: CamPose;
  mode: 'walk' | 'fly';
  /** optional authored light for composed landscape viewpoints */
  timeOfDay?: number;
}

export interface NavigationMap {
  title: string;
  citation?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Safe fly height for a click-to-travel destination. */
  safeFlyY: (x: number, z: number) => number;
}

export interface EngineStats {
  fps: number;
  frameMs: number;
  frameMsP95: number;
  drawCalls: number;
  triangles: number;
  frame: number;
  /** named counters merged in by subsystems (instances per category, cull stats, vram…) */
  counters: Record<string, number>;
  /** per-pass GPU timings in ms when timestamp-query is available */
  gpuPasses: Record<string, number>;
}

export interface GpuDiagnostics {
  ok: boolean;
  reason?: string;
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
  features: string[];
  limits: Record<string, number>;
}

export interface LaasHooks {
  /** true once the first frames have rendered and the GPU pipeline is verified */
  ready: boolean;
  /** set on fatal error (also rendered as a fail-loud overlay) */
  error: string | null;
  stats: EngineStats | null;
  diag: GpuDiagnostics | null;
  /** world-gen / scene progress 0..1 (boot UI + tooling wait on this) */
  progress: number;
  progressMsg: string;
  /** tooling control surface */
  setPose: ((pose: CamPose) => void) | null;
  getPose: (() => CamPose) | null;
  /** scene-requested spawn pose (?alt/x/z/yaw/pitch) — main applies it once
   *  the fly camera exists (scenes build BEFORE the camera rig) */
  initialPose: CamPose | null;
  /** 'walk' only for the default interactive spawn (no explicit pose
   *  params) — every explicit/programmatic pose keeps fly semantics */
  initialPoseMode: 'walk' | 'fly' | null;
  /** terrain/water heights at (x, z) — walk mode + fly soft collision.
   *  `y` = querying eye height; wraps guarding STACKED authored water use it
   *  to claim only surfaces near/below the eye (see FlyCamera.GroundProbe) */
  groundProbe: ((x: number, z: number, y?: number) => { ground: number; water: number }) | null;
  /** lateral wall/gate collision: resolves a proposed horizontal move at body
   *  height `y` — walk/fly stop at wall segments and tier masses, pass the
   *  gate gaps. Null when the scene has no authored walls (wild scenes) */
  moveProbe:
    | ((fromX: number, fromZ: number, toX: number, toZ: number, y: number) => { x: number; z: number })
    | null;
  setTimeOfDay: ((t: number) => void) | null;
  /** settle frames (TAA/temporal effects) then resolve — call before screenshots */
  settle: ((frames?: number) => Promise<void>) | null;
  /** enable/disable fly-camera input (flythrough takes the wheel) */
  flyCamEnabled: ((on: boolean) => void) | null;
  /** user-facing quick-travel destinations and click-to-fly map contract */
  navigationTargets: NavigationTarget[];
  navigationMap: NavigationMap | null;
  /** resolve a click (NDC -1..1) to a canonical dataset entity — installed by
   *  scenes with cited content (EntityHud consumes; probes may call it) */
  entityPick: ((ndcX: number, ndcY: number) => EntityPickResult | null) | null;
  /** the most specific entity near a world position (walk-mode proximity
   *  auto-card) — same registry as entityPick, distance flavor */
  entityNear: ((x: number, y: number, z: number) => EntityPickResult | null) | null;
}

/** a picked structure: canonical entity slug + in-world label + hit distance */
export type EntityPickResult = { slug: string; label: string; t: number };

declare global {
  interface Window {
    __laas: LaasHooks;
  }
}

export function initHooks(): LaasHooks {
  const hooks: LaasHooks = {
    ready: false,
    error: null,
    stats: null,
    diag: null,
    progress: 0,
    progressMsg: 'boot',
    setPose: null,
    getPose: null,
    initialPose: null,
    initialPoseMode: null,
    groundProbe: null,
    moveProbe: null,
    setTimeOfDay: null,
    settle: null,
    flyCamEnabled: null,
    navigationTargets: [],
    navigationMap: null,
    entityPick: null,
    entityNear: null,
  };
  window.__laas = hooks;
  return hooks;
}
