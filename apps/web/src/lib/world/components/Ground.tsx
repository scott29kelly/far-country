"use client";

import { MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

import { CITY_HALF } from "../data/points-of-interest";
import { goldDetailMaps } from "../materials/detail";

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
    g.addColorStop(0, "#e8c170");
    g.addColorStop(0.32, "#cfa24a");
    g.addColorStop(0.66, "#a87e2e");
    g.addColorStop(1, "#6e4d14");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * Ground plane. Rev 21:21 — "the street of the city was pure gold, like
 * transparent glass." The whole inner-city floor is treated as the street for
 * the MVP placeholder.
 *
 * Rendered as a polished gold floor via drei's MeshReflectorMaterial (renders a
 * real reflection each frame, so the glowing mountain and gates pour back off
 * the street — the "like transparent glass" see-into-it quality). The radial
 * gold gradient tints it; a hammered + brushed NORMAL map plus its matching
 * roughness map give the metal believable micro-relief so the reflection breaks
 * up like real worked gold rather than a sterile CGI mirror. The outer ground
 * beyond the walls is a dim warm stone framing the gold street.
 */
export function Ground() {
  const goldMap = useGoldGradient();
  const detail = useMemo(() => goldDetailMaps(7), []);
  return (
    <group>
      {/* Outer ground — extends well beyond the walls. Dim warm stone, matte,
          so it frames (rather than competes with) the gold street. */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[CITY_HALF * 6, CITY_HALF * 6]} />
        <meshStandardMaterial color="#1f1709" roughness={0.94} metalness={0.1} />
      </mesh>
      {/* Inner city floor — pure gold, like transparent glass. */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CITY_HALF * 2, CITY_HALF * 2]} />
        <MeshReflectorMaterial
          resolution={1024}
          mirror={0.22}
          mixStrength={0.5}
          mixBlur={1.5}
          blur={[450, 160]}
          minDepthThreshold={0.3}
          maxDepthThreshold={1.4}
          depthScale={1.1}
          metalness={0.78}
          roughness={0.5}
          {...(goldMap ? { map: goldMap } : { color: "#cfa24a" })}
          normalMap={detail.normalMap}
          normalScale={[0.35, 0.35]}
          roughnessMap={detail.roughnessMap}
          envMapIntensity={0.4}
          emissive="#2a1d06"
          emissiveIntensity={0.025}
        />
      </mesh>
    </group>
  );
}
