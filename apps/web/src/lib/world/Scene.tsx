"use client";

import { Environment, Lightformer, Sparkles } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  GodRays,
  HueSaturation,
  N8AO,
  SMAA,
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
import { Inhabitants } from "./components/Inhabitants";
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
 * Camera starts on the elevated establishing orbit, facing the glowing crystal
 * mountain; IntroCamera drives the drift, then the fly-in drops to the plaza.
 *
 * Lighting philosophy (cinematic-epic, max fidelity): the New Jerusalem has no
 * sun or moon — "the glory of God gives it light, and its lamp is the Lamb"
 * (Rev 21:23). So the scene is lit for DRAMA, not daylight: a low warm ambient
 * fill, a bright blooming glory core at the summit that is the true key light
 * and the god-ray source, and a baked light environment that gives the gold and
 * crystal something luminous to reflect. High contrast + volumetric shafts +
 * color grading do the cinematic work the flat MVP lighting could not.
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
      // Max-fidelity desktop target: render at up to 2× device pixels and ask
      // for the discrete GPU. Tone mapping is owned by the post ToneMapping
      // effect (the composer disables the renderer's own), so we don't set it
      // on the GL here.
      dpr={[1, 2]}
      gl={{ antialias: false, powerPreference: "high-performance", alpha: false }}
      shadows={false}
      style={{ position: "absolute", inset: 0, background: "#0e0b06" }}
    >
      {/* Light: a LOW warm ambient fill plus a cool hemisphere bounce — just
          enough to keep shadowed faces from going black. The real key light is
          the summit glory (its point light, below) so the mountain reads with
          strong directional falloff rather than flat daylight. */}
      <hemisphereLight args={["#ffe9c0", "#1c140a", 0.4]} />
      <ambientLight intensity={0.12} color="#fff4d6" />
      {/* A soft high fill from above the summit gives the terraces gentle
          top-modelling (no harsh shadow — shadows are off scene-wide). */}
      <directionalLight position={[30, 180, 40]} intensity={0.45} color="#fff0d0" />

      {/* Atmospheric haze — denser and warmer than the MVP so distance reads as
          luminous depth and the god-rays have something to pour through. Pushed
          back enough that the whole ~84 m mountain stays clear. */}
      <fog attach="fog" args={["#e3c489", 175, 860]} />

      {/* Baked light environment: gives the crystal terraces, gold street and
          gems something to reflect (PBR metalness/transmission need an envMap to
          read as material, not matte). Built from Lightformers so it needs no
          network HDRI — a warm overhead dome, a brighter source toward the
          summit, a cool ground bounce, and two cool rim accents that rake the
          crystal so its edges catch light. background={false}: our Skybox owns
          the sky. */}
      <Environment resolution={512} frames={1} background={false}>
        <Lightformer
          intensity={2.0}
          color="#fff2d4"
          position={[0, 9, 0]}
          scale={[14, 14, 1]}
          form="circle"
        />
        <Lightformer
          intensity={3.4}
          color="#ffe2a8"
          position={[0, 6, -11]}
          scale={[11, 11, 1]}
          form="circle"
        />
        <Lightformer
          intensity={0.9}
          color="#bcd6e6"
          position={[0, -6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[30, 30, 1]}
        />
        {/* Cool rim accents — vertical strips left and right that give the
            translucent crystal a cold edge highlight against the warm body. */}
        <Lightformer
          intensity={1.6}
          color="#cfe6ff"
          position={[-20, 11, 8]}
          scale={[3, 12, 1]}
        />
        <Lightformer
          intensity={1.6}
          color="#dff0ff"
          position={[20, 11, 8]}
          scale={[3, 12, 1]}
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
      <Inhabitants />
      <Throne />

      {/* Glory core — bloom seed + god-rays source at the summit. toneMapped
          off so it stays at full intensity through ACES and reads as the
          unapproachable light (1 Tim 6:16) the shafts pour from. */}
      <mesh ref={setGloryCore} position={[0, SUMMIT_Y + 14, 0]}>
        <sphereGeometry args={[2.8, 32, 32]} />
        <meshBasicMaterial color="#fff7e0" toneMapped={false} />
      </mesh>
      <GloryMotes />
      {/* Fine GPU glory-dust at two scales — a broad drift over the whole city
          and a denser, brighter shimmer concentrated around the summit glory.
          Bloom catches the bright ones, so the air itself reads as full of
          light. Abstract light only (no iconographic meaning). */}
      <Sparkles
        count={220}
        scale={[CITY_WIDTH, SUMMIT_Y + 80, CITY_WIDTH]}
        position={[0, (SUMMIT_Y + 80) / 2, 0]}
        size={5}
        speed={0.25}
        opacity={0.5}
        color="#ffe9bd"
        noise={1.5}
      />
      <Sparkles
        count={120}
        scale={[70, 70, 70]}
        position={[0, SUMMIT_Y + 6, 0]}
        size={7}
        speed={0.4}
        opacity={0.7}
        color="#fff3cf"
      />

      <ProximityWatcher />
      {phase === "intro" && <IntroCamera />}
      {phase === "entering" && <EntryTween />}
      {phase === "active" && <FirstPersonControls />}

      {/* Post: a cinematic stack. N8AO grounds the geometry with contact
          shadowing; depth-of-field softens only during the establishing orbit;
          god-rays pour from the glory; bloom makes the glory, gems and emissive
          crystal genuinely emit; a hint of chromatic aberration adds lens
          realism; ACES tone-maps the HDR wash to filmic contrast; a gentle
          saturation + contrast grade and a vignette finish the frame; SMAA
          cleans the edges (MSAA is off because post needs a single sample). */}
      {gloryCore && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <N8AO aoRadius={6} intensity={1.8} distanceFalloff={1} quality="high" />
          {/* Cinematic depth of field — active only during the establishing
              orbit (bokehScale 0 elsewhere, so gameplay stays fully sharp).
              Focus is pinned to the mountain mid-height; worldFocusRange is wide
              enough to keep the whole city crisp, so only the near foreground
              ground and the far sky soften — depth without miniaturising. */}
          <DepthOfField
            target={[0, 38, 0]}
            worldFocusRange={220}
            bokehScale={phase === "intro" ? 3 : 0}
          />
          <GodRays
            sun={gloryCore}
            samples={70}
            density={0.92}
            decay={0.93}
            weight={0.42}
            exposure={0.38}
            clampMax={1}
            blur
          />
          <Bloom
            intensity={0.7}
            luminanceThreshold={0.68}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.62}
          />
          <ChromaticAberration
            offset={[0.0006, 0.0009]}
            radialModulation
            modulationOffset={0.6}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <HueSaturation saturation={0.16} />
          <BrightnessContrast brightness={-0.03} contrast={0.18} />
          <Vignette offset={0.3} darkness={0.6} />
          <SMAA />
        </EffectComposer>
      )}
    </Canvas>
  );
}

/** Planar extent of the broad glory-dust volume (covers the full base plaza). */
const CITY_WIDTH = 320;

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
