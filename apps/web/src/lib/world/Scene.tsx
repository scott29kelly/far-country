"use client";

import { Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  GodRays,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useRef, useState } from "react";
import { type Mesh, Vector3 } from "three";

import { CityShell } from "./components/CityShell";
import { Foundations } from "./components/Foundations";
import { Gates } from "./components/Gate";
import { GloryMotes } from "./components/GloryMotes";
import { Ground } from "./components/Ground";
import { Pyramid } from "./components/Pyramid";
import { River } from "./components/River";
import { Skybox } from "./components/Skybox";
import { Throne } from "./components/Throne";
import { TreesOfLife } from "./components/TreeOfLife";
import { FirstPersonControls } from "./controls/FirstPersonControls";
import { EntryTween, IntroCamera, INTRO_START_POSITION } from "./controls/IntroRig";
import { POIS } from "./data/points-of-interest";
import { SUMMIT_Y } from "./data/world-geometry";
import { useWorldStore } from "./state/worldStore";

/**
 * Top-level scene wrapper. Held by the /world page via next/dynamic so it
 * never tries to SSR.
 *
 * Camera starts just inside the south gate, facing north toward the throne.
 */
export function Scene() {
  const phase = useWorldStore((s) => s.phase);
  // The glory core is a small, very bright sphere at the summit. It is both the
  // bloom seed and the god-rays source — the light shafts radiate from the
  // throne's glory (Rev 21:23), occluded by the crystal terraces in front of it.
  const [gloryCore, setGloryCore] = useState<Mesh | null>(null);
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
      <hemisphereLight args={["#fff1c8", "#3a2c14", 0.7]} />
      <ambientLight intensity={0.28} color="#fff4d6" />
      {/* Fog pushed back so the whole ~84m mountain reads; warm haze. */}
      <fog attach="fog" args={["#f0d9a0", 140, 820]} />

      {/* Baked light environment: gives the crystal terraces and gold something
          to reflect (metalness needs an envMap to read as material, not matte).
          Built from Lightformers so it needs no network HDRI — a warm dome plus
          a brighter source toward the summit. background={false}: our own
          Skybox owns the sky. */}
      <Environment resolution={256} frames={1} background={false}>
        <Lightformer
          intensity={1.4}
          color="#fff0cc"
          position={[0, 6, 0]}
          scale={[12, 12, 1]}
          form="circle"
        />
        <Lightformer
          intensity={2.2}
          color="#ffe6b0"
          position={[0, 3, -8]}
          scale={[8, 8, 1]}
          form="circle"
        />
        <Lightformer
          intensity={0.6}
          color="#bcd6e6"
          position={[0, -4, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[20, 20, 1]}
        />
      </Environment>

      <Skybox />
      <Ground />
      <Pyramid />
      <Foundations />
      <CityShell />
      <Gates />
      <River />
      <TreesOfLife />
      <Throne />

      {/* Glory core — bloom seed + god-rays source at the summit. toneMapped
          off so it stays at full intensity through ACES and reads as the
          unapproachable light (1 Tim 6:16) the shafts pour from. */}
      <mesh ref={setGloryCore} position={[0, SUMMIT_Y + 14, 0]}>
        <sphereGeometry args={[3.2, 24, 24]} />
        <meshBasicMaterial color="#fff6da" toneMapped={false} />
      </mesh>
      <GloryMotes />

      <ProximityWatcher />
      {phase === "intro" && <IntroCamera />}
      {phase === "entering" && <EntryTween />}
      {phase === "active" && <FirstPersonControls />}

      {/* Post: bloom makes the throne-glory, the glow column, and the emissive
          crystal actually emit light rather than read as pale plastic; ACES
          tone-mapping tames the warm wash into filmic contrast. */}
      {gloryCore && (
        <EffectComposer enableNormalPass={false}>
          <GodRays
            sun={gloryCore}
            samples={60}
            density={0.95}
            decay={0.92}
            weight={0.45}
            exposure={0.5}
            clampMax={1}
            blur
          />
          <Bloom
            intensity={0.7}
            luminanceThreshold={0.62}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.6}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <Vignette offset={0.32} darkness={0.55} />
        </EffectComposer>
      )}
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
