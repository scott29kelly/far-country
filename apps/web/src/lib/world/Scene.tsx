"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";

import { CityShell } from "./components/CityShell";
import { Foundations } from "./components/Foundations";
import { Gates } from "./components/Gate";
import { Ground } from "./components/Ground";
import { Pyramid } from "./components/Pyramid";
import { River } from "./components/River";
import { Skybox } from "./components/Skybox";
import { Throne } from "./components/Throne";
import { TreesOfLife } from "./components/TreeOfLife";
import { FirstPersonControls } from "./controls/FirstPersonControls";
import { EntryTween, IntroCamera, INTRO_START_POSITION } from "./controls/IntroRig";
import { POIS } from "./data/points-of-interest";
import { useWorldStore } from "./state/worldStore";

/**
 * Top-level scene wrapper. Held by the /world page via next/dynamic so it
 * never tries to SSR.
 *
 * Camera starts just inside the south gate, facing north toward the throne.
 */
export function Scene() {
  const phase = useWorldStore((s) => s.phase);
  return (
    <Canvas
      camera={{
        // First paint is the elevated establishing orbit; IntroCamera drives it
        // from there. The fly-in then drops to the plaza spawn.
        position: INTRO_START_POSITION,
        fov: 70,
        near: 0.1,
        far: 2000,
      }}
      shadows={false}
      style={{ position: "absolute", inset: 0, background: "#15110a" }}
    >
      {/* Light: warm hemisphere + an ambient. The summit throne emits its own
          point light (the city's true light source — Rev 21:23). No
          directional sun. */}
      <hemisphereLight args={["#fff1c8", "#2a200f", 0.6]} />
      <ambientLight intensity={0.22} color="#fff4d6" />
      {/* Fog pushed back so the whole ~84m mountain reads; warm haze. */}
      <fog attach="fog" args={["#e9cf98", 110, 760]} />

      <Skybox />
      <Ground />
      <Pyramid />
      <Foundations />
      <CityShell />
      <Gates />
      <River />
      <TreesOfLife />
      <Throne />

      <ProximityWatcher />
      {phase === "intro" && <IntroCamera />}
      {phase === "entering" && <EntryTween />}
      {phase === "active" && <FirstPersonControls />}
    </Canvas>
  );
}

/**
 * Each frame, check the camera against each POI's radius and update the
 * zustand store when the nearest match changes. Anchored POIs are checked
 * in declaration order; the first one whose radius contains the camera
 * wins. If none match, the first `global: true` POI is used as the fallback.
 *
 * Throttled to ~10Hz so we're not spamming setState 60 times a second.
 */
function ProximityWatcher() {
  const setNearbyEntity = useWorldStore((s) => s.setNearbyEntity);
  const setCompass = useWorldStore((s) => s.setCompass);
  const setCameraPos = useWorldStore((s) => s.setCameraPos);
  const lastCheck = useRef(0);
  const cameraXZ = useRef(new Vector3());
  const camDir = useRef(new Vector3());

  useFrame((state, delta) => {
    lastCheck.current += delta;
    if (lastCheck.current < 0.1) return;
    lastCheck.current = 0;

    const camera = state.camera;

    // Compass: camera yaw and bearing to the throne (origin), both
    // measured the same way — 0 = facing -Z (north), positive = counter-
    // clockwise viewed from above. atan2(x, -z) gives that convention.
    camera.getWorldDirection(camDir.current);
    const yaw = Math.atan2(camDir.current.x, -camDir.current.z);
    const throneBearing = Math.atan2(-camera.position.x, camera.position.z);
    setCompass(yaw, throneBearing);

    // Publish coarse camera position for the mini-map marker.
    setCameraPos(camera.position.x, camera.position.z);

    // Nearest POI.
    let match: string | null = null;
    for (const poi of POIS) {
      if (poi.global === true) {
        if (!match) match = poi.slug;
        continue;
      }
      cameraXZ.current.set(
        poi.position[0] - camera.position.x,
        poi.position[1] - camera.position.y,
        poi.position[2] - camera.position.z,
      );
      if (cameraXZ.current.lengthSq() <= poi.radius * poi.radius) {
        match = poi.slug;
        break;
      }
    }
    setNearbyEntity(match);
  });

  return null;
}
