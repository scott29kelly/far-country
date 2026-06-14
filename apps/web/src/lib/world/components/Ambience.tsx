"use client";

/**
 * Drives the procedural ambience mix from the camera position each frame
 * (throttled). Lives inside the Canvas so it can read the live camera; the
 * audio engine itself is a context-free singleton (see audio/ambience.ts) that
 * was started by the "Enter the city" gesture.
 */
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { ambience } from "../audio/ambience";

export function Ambience() {
  const acc = useRef(0);
  useFrame((state, delta) => {
    acc.current += delta;
    if (acc.current < 0.12) return;
    acc.current = 0;
    const p = state.camera.position;
    ambience.update(p.x, p.y, p.z);
  });
  return null;
}
