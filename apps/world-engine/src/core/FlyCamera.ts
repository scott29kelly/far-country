/**
 * Camera rig: WALK mode (grounded RPG exploration — gravity, jump, sprint,
 * head-bob/land-dip/sprint-FOV) + FLY mode (free flight). `V` toggles.
 *
 * Walk is the default for the fresh interactive spawn; ANY programmatic
 * pose (setPose — ?cam=, ?shot=N, bookmarks, flythrough, probes) switches
 * to fly so the entire tooling surface keeps free placement semantics.
 *
 * Camera-motion effects compose onto a separate base position every frame
 * and are stripped from getPose()/`P` — bookmarks and probes always see the
 * clean logical pose. `P` logs a `?cam=` string.
 *
 * Mouse look is "look where your mouse is", NOT pointer lock (matches the
 * legacy R3F scene's later navigation pass, commit e94c3c1 — pointer-lock
 * click-to-capture with a hidden cursor is disorienting for non-gamers). The
 * cursor stays visible; the view eases toward wherever it points — left of
 * centre turns left, right turns right, up/down tilts — with a central dead
 * zone so it holds still for aiming/clicking. Steering only runs while the
 * cursor is over the canvas, so moving the mouse to browser chrome (or a
 * future HUD overlay) doesn't spin the view.
 *
 * Gamepad: update() polls GamepadInput (the Gamepad API is poll-only) and
 * feeds the same movement/steer/mode paths the keyboard and mouse use —
 * FlyCamera stays the one movement owner. Layout in GamepadInput's header.
 */

import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';
import { easeInOutCubic } from './Easing';
import { GamepadInput, type GamepadFrame } from './GamepadInput';
import type { CamPose } from './Hooks';

const FORWARD = new Vector3();
const RIGHT = new Vector3();
const MOVE = new Vector3();

/**
 * terrain/water heights at (x, z) — installed by the world scene. `y` is the
 * querying eye's CURRENT height: probe wraps that guard authored water use it
 * to claim only surfaces at/near/below the eye, never one far overhead (the
 * NJ river reaches are vertically STACKED up the city tiers — a 2D lookup
 * alone hands a plaza-level walker the crown basin ~3.1 km up as a wade
 * floor and the hard ground snap catapults them there: the walker-fling bug).
 */
export type GroundProbe = (x: number, z: number, y?: number) => { ground: number; water: number };

/**
 * lateral wall/gate collision — installed by a scene with authored walls (the
 * NJ city; null everywhere else, so wild scenes never block). Resolves a
 * proposed horizontal move at body height `y` (the caller picks the height to
 * collide at: walk passes shin height, fly passes the camera eye) and returns
 * the allowed position — blocked motion slides along faces, gate gaps pass.
 */
export type MoveProbe = (
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  y: number,
) => { x: number; z: number };

export type CamMode = 'walk' | 'fly';

export interface NavigationState {
  mode: CamMode;
  cruise: boolean;
  flySpeed: number;
  walkScale: number;
  /** a gamepad is connected and exposed — NavigationUI shows a PAD hint */
  gamepad: boolean;
}

export type NavigationListener = (state: NavigationState) => void;

// ---- walk tuning (grounded-RPG feel) ---------------------------------------
const EYE_HEIGHT = 1.7;
const WALK_SPEED = 4.6; // m/s
const SPRINT_MULT = 2.0;
const WALK_SCALE_STEPS = [1, 2, 4, 8] as const;
const FLY_SPEED_STEPS = [4, 12, 24, 60, 150, 400, 1000, 2000] as const;
const GRAVITY = 22; // m/s² — game-feel gravity, not 9.81
const JUMP_V0 = 7.0; // → ~1.1 m apex
const STEP_DOWN = 0.55; // downhill ground-stick range (m)
const WALL_BODY_LIFT = 0.5; // walk collides at shin height — ground lips below this step over
const GROUND_ACCEL = 10; // exp-damp rate toward wish velocity
const AIR_ACCEL = 2.5; // reduced air control
// effects
const STRIDE_RATE = 1.7; // rad of stride phase per meter at walk speed
const BOB_Y_WALK = 0.026; // m
const BOB_Y_SPRINT_ADD = 0.018; // extra at full sprint
const BOB_LATERAL = 0.55; // fraction of vertical amp, applied on right axis
const BOB_ROLL = 0.0032; // rad
const SPRINT_FOV_ADD = 6; // deg
const DIP_K = 150; // landing-dip spring stiffness
const DIP_C = 18; // landing-dip spring damping
// fly-mode soft collision (legacy contract from TerrainScene)
const FLY_GROUND_CLEAR = 1.4;
const WADE_CLEAR = 0.45; // eye stays above water (no underwater rendering)

// ---- mouse-steer look (no pointer lock — see class doc) --------------------
const MAX_YAW_RATE = 1.5; // rad/s at the screen edge
const MAX_PITCH_RATE = 1.1;
const STEER_DEAD_ZONE = 0.14; // fraction of half-canvas with no rotation
const PITCH_CLAMP = 1.3; // ~74° up/down — matches the validated legacy feel

// ---- gamepad steer (right stick) -------------------------------------------
// Gentler than the mouse-edge rates on purpose (non-gamer feel); the stick's
// expo curve (GamepadInput) makes small deflections turn slower still.
const PAD_YAW_RATE = 1.2; // rad/s at full deflection
const PAD_PITCH_RATE = 0.9;
/** while the pad is in use (and briefly after), mouse-steer is suppressed —
 *  otherwise a cursor parked off-centre keeps turning the view and the stick
 *  fights it (last-active-input-wins, the standard hybrid-input rule) */
const PAD_INPUT_HOLD_MS = 1500;

// ---- cinematic ease (flyTo — the arrival descent) ---------------------------
/** movement INTENT skips a cinematic; M stays the mute toggle and clicks keep
 *  their rite meaning (audio unlock) — neither is "take control" */
const CINE_SKIP_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'KeyV',
]);

interface Cinematic {
  start: CamPose;
  target: CamPose;
  t0: number;
  ms: number;
  skip: boolean;
  onDone: (() => void) | null;
}

/** Dead-zoned, eased steer response from a normalized cursor offset [-1, 1]. */
function steerResponse(n: number): number {
  const a = Math.abs(n);
  if (a <= STEER_DEAD_ZONE) return 0;
  const t = (a - STEER_DEAD_ZONE) / (1 - STEER_DEAD_ZONE);
  return Math.sign(n) * t * t;
}

export class FlyCamera {
  readonly camera: PerspectiveCamera;
  yaw = 0;
  pitch = 0;
  /** base FLY speed in m/s, scroll-scaled; walk pace uses stepped multipliers */
  speed = 24;
  enabled = true;
  /** terrain probe — walk mode is unavailable until the scene installs it */
  groundProbe: GroundProbe | null = null;
  /** lateral wall/gate collision — null when the scene has no authored walls */
  moveProbe: MoveProbe | null = null;
  /** browser gamepad — polled inside update(); CPU probes inject `.source` */
  readonly gamepad = new GamepadInput();

  private modeV: CamMode = 'fly';
  private padActiveV = false;
  /** wall-clock until which pad input owns steering (mouse-steer suppressed) */
  private padHoldUntil = 0;
  private walkScaleV = 1;
  private cruiseV = false;
  private navigationListeners = new Set<NavigationListener>();
  private keys = new Set<string>();
  private vel = new Vector3(); // fly velocity / walk horizontal velocity
  /** normalized cursor offset from canvas centre, [-1, 1] each axis; null when off-canvas */
  private mouse: { nx: number; ny: number } | null = null;
  // walk state — basePos is the LOGICAL eye position; camera.position gets
  // basePos + bob/dip offsets composed per frame
  private basePos = new Vector3();
  private velY = 0;
  private grounded = false;
  private stridePhase = 0;
  private bobK = 0; // smoothed 0..1+ speed factor driving bob amplitude
  private dipY = 0;
  private dipV = 0;
  private fovKick = 0;
  private baseFov: number;
  // jump input buffer: keydown-edge timestamp — a tap shorter than a frame
  // still jumps on the next grounded update (≤150 ms grace)
  private jumpAt = -1;
  /** active cinematic ease (flyTo) — null when the camera is interactive */
  private cine: Cinematic | null = null;

  constructor(camera: PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.baseFov = camera.fov;

    // ---- mouse-steer look, no pointer lock (see class doc) --------------
    // Cursor position drives a per-frame yaw/pitch RATE (applied in update()),
    // not a raw delta — this is "look where your mouse is", not FPS mouse-look.
    dom.addEventListener('mousemove', (e) => {
      const r = dom.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) {
        this.mouse = null;
        return;
      }
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.mouse = { nx: Math.max(-1, Math.min(1, nx)), ny: Math.max(-1, Math.min(1, ny)) };
    });
    dom.addEventListener('mouseleave', () => {
      this.mouse = null;
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyP') {
        // eslint-disable-next-line no-console
        console.log(`[pose] cam=${this.toCamString()}`);
      }
      if (this.cine && CINE_SKIP_CODES.has(e.code)) this.cine.skip = true;
      if (e.code === 'KeyV' && this.enabled && !this.cine) {
        this.setMode(this.modeV === 'walk' ? 'fly' : 'walk');
      }
      if (e.code === 'KeyC' && this.enabled && !this.cine && !e.repeat) {
        this.setCruise(!this.cruiseV);
      }
      if (e.code === 'Escape' && this.cruiseV) this.setCruise(false);
      if (e.code === 'KeyS' && this.cruiseV) this.setCruise(false);
      if (e.code === 'BracketLeft' && this.enabled && !e.repeat) {
        e.preventDefault();
        this.adjustTravelSpeed(-1);
      }
      if (e.code === 'BracketRight' && this.enabled && !e.repeat) {
        e.preventDefault();
        this.adjustTravelSpeed(1);
      }
      if (e.code === 'Space' && !e.repeat) this.jumpAt = performance.now();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    dom.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.modeV !== 'fly') return;
        this.speed *= Math.pow(1.15, -Math.sign(e.deltaY));
        this.speed = Math.min(2000, Math.max(0.5, this.speed));
        this.emitNavigation();
      },
      { passive: false },
    );
  }

  get mode(): CamMode {
    return this.modeV;
  }

  get cruise(): boolean {
    return this.cruiseV;
  }

  get walkScale(): number {
    return this.walkScaleV;
  }

  get navigationState(): NavigationState {
    return {
      mode: this.modeV,
      cruise: this.cruiseV,
      flySpeed: this.speed,
      walkScale: this.walkScaleV,
      gamepad: this.padActiveV,
    };
  }

  subscribeNavigation(listener: NavigationListener): () => void {
    this.navigationListeners.add(listener);
    listener(this.navigationState);
    return () => {
      this.navigationListeners.delete(listener);
    };
  }

  setCruise(on: boolean): void {
    if (this.cruiseV === on) return;
    this.cruiseV = on;
    this.emitNavigation();
  }

  setFlySpeed(metersPerSecond: number): void {
    const next = Math.min(2000, Math.max(0.5, metersPerSecond));
    if (next === this.speed) return;
    this.speed = next;
    this.emitNavigation();
  }

  setWalkScale(scale: number): void {
    let next: number = WALK_SCALE_STEPS[0];
    for (const step of WALK_SCALE_STEPS) {
      if (Math.abs(step - scale) < Math.abs(next - scale)) next = step;
    }
    if (next === this.walkScaleV) return;
    this.walkScaleV = next;
    this.emitNavigation();
  }

  adjustTravelSpeed(direction: -1 | 1): void {
    if (this.modeV === 'walk') {
      this.setWalkScale(this.stepValue(WALK_SCALE_STEPS, this.walkScaleV, direction));
    } else {
      this.setFlySpeed(this.stepValue(FLY_SPEED_STEPS, this.speed, direction));
    }
  }

  private stepValue(steps: readonly number[], current: number, direction: -1 | 1): number {
    let nearest = 0;
    for (let i = 1; i < steps.length; i++) {
      const value = steps[i];
      const best = steps[nearest];
      if (value !== undefined && best !== undefined && Math.abs(value - current) < Math.abs(best - current)) {
        nearest = i;
      }
    }
    const index = Math.min(steps.length - 1, Math.max(0, nearest + direction));
    return steps[index] ?? current;
  }

  private emitNavigation(): void {
    const state = this.navigationState;
    for (const listener of this.navigationListeners) listener(state);
  }

  /**
   * Switch walk/fly. Walking needs a ground probe; entering walk snaps the
   * eye onto the terrain below the current position. Leaving walk strips
   * the effect offsets so the camera holds the logical pose.
   */
  setMode(mode: CamMode): void {
    if (mode === this.modeV) return;
    if (mode === 'walk') {
      if (!this.groundProbe) {
        // eslint-disable-next-line no-console
        console.warn('[laas] walk mode unavailable — no terrain in this scene');
        return;
      }
      this.basePos.copy(this.camera.position);
      const g = this.groundProbe(this.basePos.x, this.basePos.z, this.basePos.y);
      this.basePos.y = Math.max(g.ground + EYE_HEIGHT, g.water + WADE_CLEAR);
      this.velY = 0;
      this.vel.set(0, 0, 0);
      this.grounded = true;
    } else {
      // strip effect offsets; keep the logical pose
      this.camera.position.copy(this.basePos);
      this.resetEffects();
    }
    this.cruiseV = false;
    this.modeV = mode;
    this.applyRotation(0);
    this.camera.updateMatrixWorld();
    // eslint-disable-next-line no-console
    console.log(`[laas] camera mode: ${mode} (V toggles)`);
    this.emitNavigation();
  }

  /**
   * Programmatic poses imply free placement (bookmarks, ?cam=, flythrough,
   * probes) — they always switch to fly so nothing falls out of the sky or
   * snaps to terrain, and they CANCEL an active cinematic (exact-placement
   * semantics win). Interactive walking resumes via V.
   */
  setPose(pose: CamPose): void {
    this.cine = null;
    const navigationChanged = this.cruiseV || this.modeV === 'walk';
    this.cruiseV = false;
    this.applyPose(pose);
    // Flythrough/probes can set a pose every frame; notify the UI only when
    // the navigation state actually changed, not for pure camera motion.
    if (navigationChanged) this.emitNavigation();
  }

  /** setPose body without the cinematic cancel — flyTo writes through this. */
  private applyPose(pose: CamPose): void {
    if (this.modeV === 'walk') {
      this.modeV = 'fly';
      this.resetEffects();
    }
    this.camera.position.set(pose.p[0], pose.p[1], pose.p[2]);
    this.basePos.copy(this.camera.position);
    this.yaw = pose.yaw;
    this.pitch = pose.pitch;
    if (pose.fov !== undefined) {
      this.baseFov = pose.fov;
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
    this.applyRotation(0);
    // recompose matrixWorld/matrixWorldInverse NOW: subsystems copy camera
    // state in their own updateFns and must never read a stale matrix
    this.camera.updateMatrixWorld();
  }

  /**
   * Cinematic wall-clock ease to a pose (the arrival descent). Advances
   * inside update() — FlyCamera registers first, so every subsystem that
   * copies camera state in its own updateFn sees the fresh pose the SAME
   * frame (the update-order contract; the old main.ts closure registered
   * last and lagged the clouds/aerial one frame). Interactive input is
   * ignored while active; movement-intent keys skip to the landing; a
   * programmatic setPose cancels. `onDone` runs once on landing or skip.
   */
  flyTo(target: CamPose, ms: number, onDone?: () => void): void {
    this.cine = {
      start: this.getPose(),
      target,
      t0: performance.now(),
      ms,
      skip: false,
      onDone: onDone ?? null,
    };
  }

  private updateCine(): void {
    const c = this.cine;
    if (!c) return;
    const k = Math.min(1, (performance.now() - c.t0) / c.ms);
    if (k >= 1 || c.skip) {
      this.cine = null;
      this.applyPose(c.target);
      c.onDone?.();
      return;
    }
    const e = easeInOutCubic(k);
    const px = c.start.p[0] + (c.target.p[0] - c.start.p[0]) * e;
    let py = c.start.p[1] + (c.target.p[1] - c.start.p[1]) * e;
    const pz = c.start.p[2] + (c.target.p[2] - c.start.p[2]) * e;
    // collision is off while the cinematic drives — never let the eased path
    // sink into terrain even if the straight line to the target grazes a rise
    if (this.groundProbe) {
      py = Math.max(py, this.groundProbe(px, pz, py).ground + EYE_HEIGHT);
    }
    this.applyPose({
      p: [px, py, pz],
      yaw: c.start.yaw + (c.target.yaw - c.start.yaw) * e,
      pitch: c.start.pitch + (c.target.pitch - c.start.pitch) * e,
    });
  }

  getPose(): CamPose {
    // walk mode reports the LOGICAL pose — bob/dip offsets stripped
    const p = this.modeV === 'walk' ? this.basePos : this.camera.position;
    return {
      p: [p.x, p.y, p.z],
      yaw: this.yaw,
      pitch: this.pitch,
      fov: this.baseFov,
    };
  }

  toCamString(): string {
    const p = this.modeV === 'walk' ? this.basePos : this.camera.position;
    const f = (v: number): string => v.toFixed(2);
    return `${f(p.x)},${f(p.y)},${f(p.z)},${this.yaw.toFixed(4)},${this.pitch.toFixed(4)},${this.baseFov.toFixed(0)}`;
  }

  private resetEffects(): void {
    this.stridePhase = 0;
    this.bobK = 0;
    this.dipY = 0;
    this.dipV = 0;
    this.fovKick = 0;
    if (this.camera.fov !== this.baseFov) {
      this.camera.fov = this.baseFov;
      this.camera.updateProjectionMatrix();
    }
  }

  private applyRotation(roll: number): void {
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    if (roll !== 0) this.camera.rotateZ(roll);
  }

  update(dt: number): void {
    // gamepad polls every frame (the API is poll-only) — edges are consumed
    // even when they cannot apply, so a press during a cinematic or while
    // input is disabled never fires later as a stale edge
    const pad = this.gamepad.poll();
    if (pad.active !== this.padActiveV) {
      this.padActiveV = pad.active;
      this.emitNavigation();
    }
    // a cinematic owns the pose outright — it advances even while input is
    // disabled (the arrival arms with enabled=false until the landing)
    if (this.cine) {
      // stick / A / Start = movement intent — skips like the keyboard set
      if (pad.moveX !== 0 || pad.moveY !== 0 || pad.jump || pad.toggleMode) this.cine.skip = true;
      this.updateCine();
      return;
    }
    if (!this.enabled) return;
    // pad edges mirror their key bindings (V, ], [, Escape, Space, S-cancel)
    if (pad.toggleMode) this.setMode(this.modeV === 'walk' ? 'fly' : 'walk');
    if (pad.speedUp) this.adjustTravelSpeed(1);
    if (pad.speedDown) this.adjustTravelSpeed(-1);
    if (pad.dismiss) this.escapeEquivalent();
    if (pad.jump) this.jumpAt = performance.now();
    if (pad.help && typeof CustomEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('laas-pad-help'));
    }
    if (this.cruiseV && pad.moveY < -0.5) this.setCruise(false); // stick back = S
    // last-active-input-wins: any pad motion claims steering and holds it
    // briefly, so a cursor parked off-centre can't drag the view mid-stick
    if (
      pad.moveX !== 0 || pad.moveY !== 0 || pad.lookX !== 0 || pad.lookY !== 0 ||
      pad.flyUp > 0 || pad.flyDown > 0
    ) {
      this.padHoldUntil = performance.now() + PAD_INPUT_HOLD_MS;
    }
    if (this.mouse && performance.now() >= this.padHoldUntil) {
      this.yaw -= steerResponse(this.mouse.nx) * MAX_YAW_RATE * dt;
      this.pitch -= steerResponse(this.mouse.ny) * MAX_PITCH_RATE * dt;
    }
    // right stick composes with mouse-steer — both are per-frame rates
    this.yaw -= pad.lookX * PAD_YAW_RATE * dt;
    this.pitch -= pad.lookY * PAD_PITCH_RATE * dt;
    this.pitch = Math.max(-PITCH_CLAMP, Math.min(PITCH_CLAMP, this.pitch));
    if (this.modeV === 'walk') {
      this.updateWalk(dt, pad);
    } else {
      this.updateFly(dt, pad);
    }
  }

  /**
   * B button = the Escape key: cancel cruise directly, then replay a real
   * Escape keydown/keyup so window-level listeners (EntityHud card
   * dismissal, the navigation panel) react without FlyCamera knowing them.
   * Guarded — CPU probes run under Node, which has no KeyboardEvent.
   */
  private escapeEquivalent(): void {
    if (this.cruiseV) this.setCruise(false);
    if (typeof KeyboardEvent === 'function' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape' }));
    }
  }

  private updateFly(dt: number, pad: GamepadFrame): void {
    this.applyRotation(0);

    FORWARD.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    RIGHT.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
    MOVE.set(0, 0, 0);
    if (this.cruiseV || this.keys.has('KeyW')) MOVE.add(FORWARD);
    if (this.keys.has('KeyS')) MOVE.sub(FORWARD);
    if (this.keys.has('KeyD')) MOVE.add(RIGHT);
    if (this.keys.has('KeyA')) MOVE.sub(RIGHT);
    if (this.keys.has('KeyE') || this.keys.has('Space')) MOVE.y += 1;
    if (this.keys.has('KeyQ') || this.keys.has('ControlLeft') || this.keys.has('ControlRight')) {
      MOVE.y -= 1;
    }
    // left stick + triggers compose with the keys; stick magnitude carries
    // through as analog speed (keyboard directions stay unit-length, so the
    // min(1, mag) below reduces to the old normalize() for keys alone)
    MOVE.addScaledVector(FORWARD, pad.moveY).addScaledVector(RIGHT, pad.moveX);
    MOVE.y += pad.flyUp - pad.flyDown;
    let target = 0;
    const mag = MOVE.length();
    if (mag > 1e-4) {
      MOVE.divideScalar(mag);
      target = this.speed * Math.min(1, mag);
      if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) target *= 6;
      if (this.keys.has('AltLeft')) target *= 0.15;
    }
    const damp = 1 - Math.exp(-dt * 9);
    this.vel.lerp(MOVE.multiplyScalar(target), damp);
    const prevX = this.camera.position.x;
    const prevZ = this.camera.position.z;
    this.camera.position.addScaledVector(this.vel, dt);

    // lateral wall/gate collision, consistent with walk: the camera stops at
    // wall segments and tier masses, threads the gate gaps (swept resolve —
    // shift-boosted speed cannot tunnel a wall between frames)
    if (this.moveProbe) {
      const c = this.camera.position;
      const m = this.moveProbe(prevX, prevZ, c.x, c.z, c.y);
      c.x = m.x;
      c.z = m.z;
    }

    // soft ground collision + underwater guard (no underwater rendering:
    // the refraction texture is garbage from below — hold above the water)
    if (this.groundProbe) {
      const c = this.camera.position;
      const g = this.groundProbe(c.x, c.z, c.y);
      const floor = Math.max(g.ground + FLY_GROUND_CLEAR, g.water + WADE_CLEAR);
      if (c.y < floor) c.y = floor;
    }
    this.basePos.copy(this.camera.position);
    // matrices fresh for every subsystem updateFn that runs after this one
    this.camera.updateMatrixWorld();
  }

  private updateWalk(dt: number, pad: GamepadFrame): void {
    const probe = this.groundProbe;
    if (!probe) {
      this.setMode('fly');
      return;
    }

    // ---- horizontal wish velocity (yaw-plane only — pitch never tilts gait)
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    FORWARD.set(-sinY, 0, -cosY);
    RIGHT.set(cosY, 0, -sinY);
    MOVE.set(0, 0, 0);
    if (this.cruiseV || this.keys.has('KeyW')) MOVE.add(FORWARD);
    if (this.keys.has('KeyS')) MOVE.sub(FORWARD);
    if (this.keys.has('KeyD')) MOVE.add(RIGHT);
    if (this.keys.has('KeyA')) MOVE.sub(RIGHT);
    // left stick composes with the keys — magnitude walks slower than full
    // pace (FORWARD/RIGHT are yaw-plane, so MOVE.y stays 0 here)
    MOVE.addScaledVector(FORWARD, pad.moveY).addScaledVector(RIGHT, pad.moveX);
    const sprinting =
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && MOVE.lengthSq() > 0;
    let target = 0;
    const mag = MOVE.length();
    if (mag > 1e-4) {
      MOVE.divideScalar(mag);
      target = WALK_SPEED * this.walkScaleV * Math.min(1, mag) * (sprinting ? SPRINT_MULT : 1);
      if (this.keys.has('AltLeft')) target *= 0.35;
    }
    const accel = this.grounded ? GROUND_ACCEL : AIR_ACCEL;
    const damp = 1 - Math.exp(-dt * accel);
    MOVE.multiplyScalar(target);
    this.vel.x += (MOVE.x - this.vel.x) * damp;
    this.vel.z += (MOVE.z - this.vel.z) * damp;
    const prevX = this.basePos.x;
    const prevZ = this.basePos.z;
    this.basePos.x += this.vel.x * dt;
    this.basePos.z += this.vel.z * dt;

    // lateral wall/gate collision at shin height: the walker stops at wall
    // segments and tier masses, passes through the gate gaps; the probe
    // slides blocked motion along the face (velocity stays — game feel)
    if (this.moveProbe) {
      const m = this.moveProbe(
        prevX,
        prevZ,
        this.basePos.x,
        this.basePos.z,
        this.basePos.y - EYE_HEIGHT + WALL_BODY_LIFT,
      );
      this.basePos.x = m.x;
      this.basePos.z = m.z;
    }

    // ---- vertical: gravity, jump (held OR buffered tap), ground clamp
    const jumpBuffered = this.jumpAt >= 0 && performance.now() - this.jumpAt < 150;
    if (this.grounded && (this.keys.has('Space') || jumpBuffered)) {
      this.velY = JUMP_V0;
      this.grounded = false;
      this.jumpAt = -1;
    }
    // velocity-Verlet half-step: the arc is EXACTLY ballistic at any dt
    // (plain semi-implicit Euler biases the jump apex by −v0·dt/2 —
    // frame-rate-dependent jump height)
    this.basePos.y += (this.velY - GRAVITY * dt * 0.5) * dt;
    this.velY -= GRAVITY * dt;

    const g = probe(this.basePos.x, this.basePos.z, this.basePos.y);
    const eyeFloor = g.ground + EYE_HEIGHT;
    if (this.basePos.y <= eyeFloor) {
      // landing dip ∝ impact speed (skip the trivial walk-downhill touches)
      if (!this.grounded && this.velY < -3) {
        this.dipV -= Math.min(Math.abs(this.velY) * 0.035, 0.2) * 9;
      }
      this.basePos.y = eyeFloor;
      this.velY = 0;
      this.grounded = true;
    } else if (this.grounded && this.velY <= 0 && this.basePos.y - eyeFloor < STEP_DOWN) {
      // stick to ground walking downhill (no micro-airborne flicker)
      this.basePos.y = eyeFloor;
      this.velY = 0;
    } else if (this.basePos.y - eyeFloor > 0.02) {
      this.grounded = false;
    }
    // wade: eye stays above the water surface
    const wadeFloor = g.water + WADE_CLEAR;
    if (this.basePos.y < wadeFloor) {
      this.basePos.y = wadeFloor;
      if (this.velY < 0) this.velY = 0;
      this.grounded = true;
    }

    // ---- camera-motion effects ------------------------------------------------
    const speedH = Math.hypot(this.vel.x, this.vel.z);
    const scaledWalkSpeed = WALK_SPEED * this.walkScaleV;
    const speedK = Math.min(speedH / scaledWalkSpeed, SPRINT_MULT);
    // bob amplitude factor: fades in/out, zero while airborne
    const bobTarget = this.grounded ? Math.min(speedK, 1.3) : 0;
    this.bobK += (bobTarget - this.bobK) * (1 - Math.exp(-dt * 8));
    // stride cadence rises SUB-linearly with speed (sprint = longer strides,
    // not double-time steps); frozen while airborne — no steps in the air
    if (this.grounded && speedH > 0.3) {
      const rate = STRIDE_RATE * WALK_SPEED * Math.sqrt(this.walkScaleV) *
        (0.55 + 0.45 * Math.min(speedK, 2));
      this.stridePhase += rate * dt;
    }
    const ampY = (BOB_Y_WALK + BOB_Y_SPRINT_ADD * Math.max(Math.min(speedK - 1, 1), 0)) * this.bobK;
    const bobY = Math.sin(this.stridePhase * 2) * ampY;
    const bobX = Math.sin(this.stridePhase) * ampY * BOB_LATERAL;
    const roll = Math.sin(this.stridePhase) * BOB_ROLL * this.bobK;
    // landing-dip spring (semi-implicit Euler — stable at the engine dt cap)
    this.dipV += (-DIP_K * this.dipY - DIP_C * this.dipV) * dt;
    this.dipY += this.dipV * dt;
    // sprint FOV kick
    const fovTarget = sprinting && this.grounded && speedH > scaledWalkSpeed * 1.15
      ? SPRINT_FOV_ADD
      : 0;
    this.fovKick += (fovTarget - this.fovKick) * (1 - Math.exp(-dt * 6));
    const fov = this.baseFov + this.fovKick;
    if (Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    // compose: camera = logical pose + effect offsets (getPose strips these)
    this.applyRotation(roll);
    RIGHT.set(cosY, 0, -sinY);
    this.camera.position
      .copy(this.basePos)
      .addScaledVector(RIGHT, bobX)
      .add(MOVE.set(0, bobY + this.dipY, 0));
    this.camera.updateMatrixWorld();
  }
}
