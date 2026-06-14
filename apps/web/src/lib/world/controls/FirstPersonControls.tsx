"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Object3D, Quaternion, Vector3 } from "three";

import { groundHeightAt, horizontalBlocked } from "../data/collision";
import { CITY_HALF } from "../data/points-of-interest";
import { useWorldStore } from "../state/worldStore";

/**
 * Approachable, mouse-centric exploration controls — NO pointer lock.
 *
 * The previous scheme used PointerLockControls (click to capture the mouse,
 * cursor hidden, raw mouse-look). That is the FPS standard but disorienting for
 * anyone who doesn't play games. This replaces it with "look where your mouse
 * is": the cursor stays visible, and the view eases toward wherever the cursor
 * points — cursor left of centre turns you left, right turns right, up/down
 * tilts — with a generous central DEAD ZONE so it holds still for normal aiming
 * and clicking. Steering pauses whenever the cursor is over the HUD, so the
 * mini-map and cards stay clickable.
 *
 * - Mouse → look (rate proportional to distance from centre)
 * - W/A/S/D or arrow keys → move; Shift → sprint
 * - Space → rise (ascend terraces); C → descend
 * - Mini-map landmarks → cinematic fly-to (see the teleport handling below)
 *
 * Terrain follow, collision, and the fly-to tween are unchanged from before.
 */
const WALK_SPEED = 13;
const SPRINT_SPEED = 30;
const VERTICAL_SPEED = 16;
const FALL_SPEED = 40;
const EYE_HEIGHT = 1.6;
const AIRBORNE_CLEARANCE = 0.4;

const FLY_DURATION = 1.4;

// Mouse-look feel.
const MAX_YAW_RATE = 1.5; // rad/s at the screen edge
const MAX_PITCH_RATE = 1.1;
const DEAD_ZONE = 0.14; // fraction of half-screen with no rotation
const PITCH_CLAMP = 1.3; // ~74° up/down

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Dead-zoned, eased steer response from a normalized cursor offset [-1, 1]. */
function steerResponse(n: number): number {
  const a = Math.abs(n);
  if (a <= DEAD_ZONE) return 0;
  const t = (a - DEAD_ZONE) / (1 - DEAD_ZONE);
  return Math.sign(n) * t * t;
}

type KeyState = {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  sprint: boolean;
};

export function FirstPersonControls() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const setPointerLocked = useWorldStore((s) => s.setPointerLocked);
  const keys = useRef<KeyState>({
    forward: false,
    back: false,
    left: false,
    right: false,
    up: false,
    down: false,
    sprint: false,
  });
  const yaw = useRef(0);
  const pitch = useRef(0);
  const mouse = useRef({ nx: 0, ny: 0, active: false });
  const started = useRef(false);

  const markStarted = () => {
    if (!started.current) {
      started.current = true;
      setPointerLocked(true); // hides the intro help card
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = true;
          markStarted();
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.back = true;
          markStarted();
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = true;
          markStarted();
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = true;
          markStarted();
          break;
        case "Space":
          keys.current.up = true;
          markStarted();
          break;
        case "KeyC":
          keys.current.down = true;
          markStarted();
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.sprint = true;
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.back = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = false;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = false;
          break;
        case "Space":
          keys.current.up = false;
          break;
        case "KeyC":
          keys.current.down = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keys.current.sprint = false;
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  // Mouse-steer: track the cursor offset from canvas centre. Steering is active
  // only while the cursor is over the canvas (so HUD elements stay clickable).
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      if (e.target !== el) {
        mouse.current.active = false;
        return;
      }
      const r = el.getBoundingClientRect();
      mouse.current.nx = clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1);
      mouse.current.ny = clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1);
      mouse.current.active = true;
      markStarted();
    };
    const onLeave = () => {
      mouse.current.active = false;
    };
    window.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [gl]);

  // Land at the plaza spawn looking up the mountain; seed yaw/pitch from it.
  useEffect(() => {
    camera.position.set(0, 3, CITY_HALF - 4);
    camera.lookAt(0, 34, 0);
    camera.rotation.reorder("YXZ");
    yaw.current = camera.rotation.y;
    pitch.current = camera.rotation.x;
  }, [camera]);

  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const move = useRef(new Vector3());

  // Cinematic fly-to tween state.
  const flying = useRef(false);
  const flyT = useRef(0);
  const flyFrom = useRef(new Vector3());
  const flyTo = useRef(new Vector3());
  const flyFromQ = useRef(new Quaternion());
  const flyToQ = useRef(new Quaternion());
  const flyTmp = useRef(new Object3D());

  useFrame((_, delta) => {
    // Cinematic fly-to: a landmark click (mini-map) requests a teleport; glide
    // there over FLY_DURATION and arrive framed toward the throne axis. Input
    // and terrain-settle pause mid-flight; afterwards, resync yaw/pitch so
    // mouse-look continues smoothly from the new orientation.
    const { teleportTo, clearTeleport } = useWorldStore.getState();
    if (teleportTo && !flying.current) {
      flying.current = true;
      flyT.current = 0;
      flyFrom.current.copy(camera.position);
      flyFromQ.current.copy(camera.quaternion);
      flyTo.current.set(teleportTo.x, teleportTo.y, teleportTo.z);
      const dist = Math.hypot(teleportTo.x, teleportTo.z);
      flyTmp.current.position.copy(flyTo.current);
      flyTmp.current.lookAt(0, teleportTo.y + dist * 0.16, 0);
      flyToQ.current.copy(flyTmp.current.quaternion);
      clearTeleport();
    }
    if (flying.current) {
      flyT.current = Math.min(1, flyT.current + delta / FLY_DURATION);
      const s = smoothstep(flyT.current);
      camera.position.lerpVectors(flyFrom.current, flyTo.current, s);
      camera.quaternion.slerpQuaternions(flyFromQ.current, flyToQ.current, s);
      if (flyT.current >= 1) {
        flying.current = false;
        camera.rotation.reorder("YXZ");
        yaw.current = camera.rotation.y;
        pitch.current = camera.rotation.x;
      }
      return;
    }

    // Mouse-look.
    if (mouse.current.active) {
      const ex = steerResponse(mouse.current.nx);
      const ey = steerResponse(mouse.current.ny);
      if (ex !== 0 || ey !== 0) {
        yaw.current -= ex * MAX_YAW_RATE * delta;
        pitch.current -= ey * MAX_PITCH_RATE * delta;
        pitch.current = clamp(pitch.current, -PITCH_CLAMP, PITCH_CLAMP);
        camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
      }
    }

    const k = keys.current;
    const feetY = camera.position.y - EYE_HEIGHT;
    const groundHere = groundHeightAt(camera.position.x, camera.position.z);
    const airborne = camera.position.y - (groundHere + EYE_HEIGHT) > AIRBORNE_CLEARANCE;

    // Horizontal movement, decoupled from look pitch.
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() > 0) forward.current.normalize();
    right.current.set(forward.current.z, 0, -forward.current.x);

    move.current.set(0, 0, 0);
    if (k.forward) move.current.add(forward.current);
    if (k.back) move.current.sub(forward.current);
    if (k.right) move.current.add(right.current);
    if (k.left) move.current.sub(right.current);
    if (move.current.lengthSq() > 0) {
      move.current.normalize();
      const speed = k.sprint ? SPRINT_SPEED : WALK_SPEED;
      move.current.multiplyScalar(speed * delta);
      const startX = camera.position.x;
      const startZ = camera.position.z;
      const wantX = startX + move.current.x;
      const wantZ = startZ + move.current.z;
      if (!horizontalBlocked(feetY, wantX, startZ, airborne)) {
        camera.position.x = wantX;
      }
      if (!horizontalBlocked(feetY, startX, wantZ, airborne)) {
        camera.position.z = wantZ;
      }
    }

    // Vertical: explicit fly up / down, plus terrain settle.
    if (k.up) camera.position.y += VERTICAL_SPEED * delta;
    if (k.down) camera.position.y -= VERTICAL_SPEED * delta;

    const desiredY = groundHeightAt(camera.position.x, camera.position.z) + EYE_HEIGHT;
    if (!k.up) {
      if (camera.position.y > desiredY) {
        camera.position.y = Math.max(desiredY, camera.position.y - FALL_SPEED * delta);
      } else if (camera.position.y < desiredY) {
        camera.position.y = desiredY;
      }
    } else if (camera.position.y < desiredY) {
      camera.position.y = desiredY;
    }
  });

  return null;
}
