"use client";

import { PointerLockControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";

import { useWorldStore } from "../state/worldStore";

/**
 * WASD first-person controls with drei's PointerLockControls.
 *
 * - Click canvas → pointer lock (camera follows mouse)
 * - ESC → release pointer lock
 * - W/A/S/D → move (forward/left/back/right relative to camera yaw)
 * - Shift → sprint
 * - Space / Q → up, C / Z → down (so the user can still navigate even
 *   though there's no collision detection or gravity)
 *
 * No collisions. The user can walk through walls; this is a known MVP
 * limitation, called out in the on-screen help overlay.
 */
const WALK_SPEED = 14; // metres / second
const SPRINT_SPEED = 32;
const VERTICAL_SPEED = 10;

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

  const forward = useRef(new Vector3());
  const right = useRef(new Vector3());
  const move = useRef(new Vector3());

  useFrame((_, delta) => {
    const k = keys.current;
    // Compute horizontal forward (zero out Y so flying is decoupled).
    camera.getWorldDirection(forward.current);
    forward.current.y = 0;
    if (forward.current.lengthSq() > 0) forward.current.normalize();
    // Right vector = forward × up.
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
      camera.position.add(move.current);
    }
    if (k.up) camera.position.y += VERTICAL_SPEED * delta;
    if (k.down) camera.position.y -= VERTICAL_SPEED * delta;
    // Keep the camera above the ground.
    if (camera.position.y < 1.6) camera.position.y = 1.6;
  });

  return (
    <PointerLockControls
      onLock={() => setPointerLocked(true)}
      onUnlock={() => setPointerLocked(false)}
    />
  );
}
