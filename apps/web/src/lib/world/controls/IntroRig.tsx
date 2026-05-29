"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import { Quaternion, Vector3 } from "three";

import { CITY_HALF } from "../data/points-of-interest";
import { useWorldStore } from "../state/worldStore";

/**
 * Intro camera rig — two phase-scoped controllers.
 *
 * The base footprint nearly fills the walls, so from the plaza you stand at the
 * foot of the mountain and the step silhouette only reads on ascent. To give a
 * legible first impression, the `intro` phase orbits the camera high and back
 * around the whole glowing crystal mountain; on Enter, the `entering` phase
 * swoops down into the plaza before first-person controls take over.
 */

// --- Establishing orbit -----------------------------------------------------

const ORBIT_RADIUS = 235;
const ORBIT_HEIGHT = 92;
/** Radians/second of slow cinematic drift. */
const ORBIT_DRIFT = 0.045;
/** Start angle (radians) — a 3/4 view from the south-south-east. */
const ORBIT_START = -0.35;
/** Look target: partway up the mountain, so base and summit both frame in. */
const ORBIT_LOOK = new Vector3(0, 38, 0);

/** Initial Canvas camera position so the very first paint is the orbit view. */
export const INTRO_START_POSITION: [number, number, number] = [
  Math.sin(ORBIT_START) * ORBIT_RADIUS,
  ORBIT_HEIGHT,
  Math.cos(ORBIT_START) * ORBIT_RADIUS,
];

export function IntroCamera() {
  const camera = useThree((s) => s.camera);
  useFrame((state) => {
    const a = ORBIT_START + state.clock.elapsedTime * ORBIT_DRIFT;
    camera.position.set(
      Math.sin(a) * ORBIT_RADIUS,
      ORBIT_HEIGHT,
      Math.cos(a) * ORBIT_RADIUS,
    );
    camera.lookAt(ORBIT_LOOK);
  });
  return null;
}

// --- Fly-in tween -----------------------------------------------------------

/** Gameplay spawn: plaza just inside the south gate, eye height. */
const SPAWN = new Vector3(0, 2, CITY_HALF - 6);
/** Identity quaternion = a level camera facing -Z (north) at the spawn. */
const SPAWN_QUAT = new Quaternion();
const FLY_IN_DURATION = 1.6; // seconds

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

export function EntryTween() {
  const camera = useThree((s) => s.camera);
  const activate = useWorldStore((s) => s.activate);
  const start = useRef<Vector3 | null>(null);
  const startQuat = useRef<Quaternion | null>(null);
  const t = useRef(0);

  useFrame((_, delta) => {
    if (!start.current) {
      start.current = camera.position.clone();
      startQuat.current = camera.quaternion.clone();
    }
    t.current = Math.min(1, t.current + delta / FLY_IN_DURATION);
    const s = smoothstep(t.current);
    camera.position.lerpVectors(start.current, SPAWN, s);
    camera.quaternion.slerpQuaternions(startQuat.current!, SPAWN_QUAT, s);
    if (t.current >= 1) activate();
  });

  return null;
}
