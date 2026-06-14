"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Object3D, Quaternion, Vector3 } from "three";

import { groundHeightAt, horizontalBlocked } from "../data/collision";
import { CITY_HALF } from "../data/points-of-interest";
import { useWorldStore } from "../state/worldStore";

/**
 * WASD first-person controls with drei's PointerLockControls, now terrain-aware
 * for the step pyramid.
 *
 * - Click canvas → pointer lock (camera follows mouse)
 * - ESC → release pointer lock
 * - W/A/S/D → move (forward/left/back/right relative to camera yaw)
 * - Shift → sprint
 * - Space / Q → fly up (ascend terraces); C / Z → descend (clamped to ground)
 *
 * Terrain follow: when not flying, the camera settles to groundHeightAt + eye
 * height — walking up the pyramid means flying onto the next terrace, then
 * settling onto it. Horizontal moves into a riser higher than MAX_STEP_UP are
 * blocked while grounded (handled in collision.horizontalBlocked); walking off
 * an edge is always allowed and the camera falls to the lower terrace.
 */
const WALK_SPEED = 14; // metres / second
const SPRINT_SPEED = 32;
const VERTICAL_SPEED = 16;
const FALL_SPEED = 40;
const EYE_HEIGHT = 1.6;
/** Above this clearance over the local ground, the player counts as airborne. */
const AIRBORNE_CLEARANCE = 0.4;
/** Cinematic fly-to: smooth glide to a landmark instead of an instant snap. */
const FLY_DURATION = 1.4;

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          keys.current.forward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          keys.current.back = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          keys.current.left = true;
          break;
        case "KeyD":
        case "ArrowRight":
          keys.current.right = true;
          break;
        case "Space":
        case "KeyQ":
          keys.current.up = true;
          break;
        case "KeyC":
        case "KeyZ":
          keys.current.down = true;
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
        case "KeyQ":
          keys.current.up = false;
          break;
        case "KeyC":
        case "KeyZ":
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

  // Controls only mount once the intro fly-in completes. Land the camera at the
  // plaza spawn just inside the south gate, looking UP the mountain (its
  // mid-height) so the first thing you see is the glowing crystal ziggurat
  // rising ahead — not the floor at eye level. (The fly-in already places it
  // here; this also covers any path into `active` that skipped the tween.)
  useEffect(() => {
    camera.position.set(0, 3, CITY_HALF - 4);
    camera.lookAt(0, 34, 0);
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
    // Cinematic fly-to: a landmark click (mini-map) requests a teleport; instead
    // of snapping, glide there over FLY_DURATION and arrive framed toward the
    // throne axis. Input and terrain-settle are paused mid-flight.
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
      if (flyT.current >= 1) flying.current = false;
      return;
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
      // Per-axis resolution so the player slides along walls / riser faces.
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
        // Settle / fall toward the terrace below.
        camera.position.y = Math.max(desiredY, camera.position.y - FALL_SPEED * delta);
      } else if (camera.position.y < desiredY) {
        // Never sink below the terrain (e.g. after landing on a higher step).
        camera.position.y = desiredY;
      }
    } else if (camera.position.y < desiredY) {
      camera.position.y = desiredY;
    }
  });

  return (
    <PointerLockControls
      onLock={() => setPointerLocked(true)}
      onUnlock={() => setPointerLocked(false)}
    />
  );
}
