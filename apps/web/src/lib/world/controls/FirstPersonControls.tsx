"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";

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
  // plaza spawn facing north (the fly-in already places it here; this also
  // covers any path into `active` that skipped the tween).
  useEffect(() => {
    camera.position.set(0, 2, CITY_HALF - 6);
    camera.rotation.set(0, 0, 0);
  }, [camera]);

  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const move = useRef(new Vector3());

  useFrame((_, delta) => {
    // Consume a pending teleport request before anything else.
    const { teleportTo, clearTeleport } = useWorldStore.getState();
    if (teleportTo) {
      camera.position.set(teleportTo.x, teleportTo.y, teleportTo.z);
      clearTeleport();
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
