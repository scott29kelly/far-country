"use client";

import { useMemo } from "react";
import { CanvasTexture, SRGBColorSpace } from "three";

import { CITY_HALF } from "../data/points-of-interest";

/**
 * A radial gold gradient baked to a canvas texture: near-white warm gold at the
 * city centre (the floor directly beneath the summit glory, Rev 21:23) easing
 * out to deep amber at the rim. Used as the colour map of the metallic floor,
 * so the polished gold reflects the warm Environment dome tinted by this
 * gradient — bright where the glory pours down, richer toward the walls. Built
 * once on the client (next/dynamic gates SSR, so `document` is safe here).
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
    g.addColorStop(0, "#f7d57a");
    g.addColorStop(0.32, "#e6bc54");
    g.addColorStop(0.66, "#cc9c3c");
    g.addColorStop(1, "#9c6e1c");
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
 * "Pure gold, like transparent glass" is rendered as a mirror-polished metal:
 * high metalness + low roughness so the gold takes its luminance from
 * *reflecting* the warm light environment (the glassy, see-into-it quality)
 * rather than from a flat painted colour. The radial gradient map tints those
 * metallic reflections from bright-at-centre to deep-amber-at-rim. The outer
 * ground beyond the walls is a dim warm stone so the gold street reads as the
 * brightest surface underfoot.
 */
export function Ground() {
  const goldMap = useGoldGradient();
  return (
    <group>
      {/* Outer ground — extends well beyond the walls. Dim warm stone, matte,
          so it frames (rather than competes with) the gold street. */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[CITY_HALF * 6, CITY_HALF * 6]} />
        <meshStandardMaterial color="#241a0d" roughness={0.92} metalness={0.1} />
      </mesh>
      {/* Inner city floor — pure gold, like transparent glass. */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[CITY_HALF * 2, CITY_HALF * 2]} />
        <meshStandardMaterial
          {...(goldMap ? { map: goldMap } : { color: "#e8b94a" })}
          roughness={0.4}
          metalness={0.95}
          envMapIntensity={0.6}
          emissive="#3a2a08"
          emissiveIntensity={0.05}
        />
      </mesh>
    </group>
  );
}
