"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";

import { CITY_HALF } from "../data/points-of-interest";

/**
 * A radial gold gradient baked to a canvas texture: near-white warm gold at the
 * city centre (the floor directly beneath the summit glory, Rev 21:23) easing
 * out to deep amber at the rim. Used as the colour map of the polished floor, so
 * the gold is bright where the glory pours down and richer toward the walls.
 * Built once on the client (next/dynamic gates SSR, so `document` is safe here).
 */
function useGoldGradient() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const g = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.04,
      size / 2,
      size / 2,
      size * 0.62,
    );
    g.addColorStop(0, "#fbe29a");
    g.addColorStop(0.32, "#e9c25c");
    g.addColorStop(0.66, "#cc9c3c");
    g.addColorStop(1, "#8f6418");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * A subtle roughness map: faint concentric polish marks + fine grain so the
 * mirror floor has believable micro-variation (a perfectly uniform mirror reads
 * as CGI; broken-up roughness reads as real polished metal). Greyscale; brighter
 * = rougher. Kept low-contrast so the street stays glassy.
 */
function usePolishRoughness() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, 0, size, size);
    // Concentric polish rings.
    ctx.strokeStyle = "rgba(110,110,110,0.5)";
    ctx.lineWidth = 1;
    for (let r = 8; r < size * 0.72; r += 6) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Fine grain speckle.
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 26;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    return tex;
  }, []);
}

/**
 * Ground plane. Rev 21:21 — "the street of the city was pure gold, like
 * transparent glass." The whole inner-city floor is treated as the street for
 * the MVP placeholder.
 *
 * "Pure gold, like transparent glass" is rendered as a MIRROR-POLISHED gold
 * floor via drei's MeshReflectorMaterial: it renders a real reflection of the
 * scene each frame, so the glowing crystal mountain, the gates and the glory
 * pour back off the street — the "like transparent glass" see-into-it quality
 * made literal as a reflection rather than a flat painted colour. The radial
 * gold gradient tints it bright-at-centre to deep-amber-at-rim; a faint polish
 * roughness map keeps the mirror from reading as sterile CGI. The outer ground
 * beyond the walls is a dim warm stone so the gold street is the brightest
 * surface underfoot.
 */
export function Ground() {
  const goldMap = useGoldGradient();
  const roughnessMap = usePolishRoughness();
  return (
    <group>
      {/* Outer ground — extends well beyond the walls. Dim warm stone, matte,
          so it frames (rather than competes with) the gold street. */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CITY_HALF * 6, CITY_HALF * 6]} />
        <meshStandardMaterial color="#1f1709" roughness={0.94} metalness={0.1} />
      </mesh>
      {/* Inner city floor — pure gold, like transparent glass. Polished mirror
          via reflector material so the mountain reflects in the street. */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CITY_HALF * 2, CITY_HALF * 2]} />
        <MeshReflectorMaterial
          resolution={1024}
          mirror={0.42}
          mixStrength={1.0}
          mixBlur={1.0}
          blur={[300, 110]}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          depthScale={1.0}
          metalness={0.92}
          roughness={0.38}
          {...(goldMap ? { map: goldMap } : { color: "#e8b94a" })}
          {...(roughnessMap ? { roughnessMap } : {})}
          envMapIntensity={0.55}
          emissive="#3a2a08"
          emissiveIntensity={0.03}
        />
      </mesh>
    </group>
  );
}
