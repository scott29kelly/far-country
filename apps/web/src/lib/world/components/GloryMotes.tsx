"use client";

/**
 * Drifting glory-motes — fine luminous particles rising slowly through and
 * above the city. Not a textual claim (no descriptor asserts "motes"); this is
 * atmospheric life, the visible shimmer of a place full of glory, rendered as
 * abstract light only (consistent with the aniconic / no-invented-entities
 * posture — these carry no iconographic meaning and map to no entity).
 *
 * Cheap: one Points cloud, additive-blended, drifting upward on the CPU and
 * wrapping at the top. Bloom catches the brighter ones faintly.
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, type BufferAttribute, type Points } from "three";

import { SUMMIT_Y } from "../data/world-geometry";

const COUNT = 180;
const SPREAD = 150; // planar half-extent (metres) around the city centre
const TOP = SUMMIT_Y + 70; // motes wrap back to the ground above this height

export function GloryMotes() {
  const ref = useRef<Points>(null!);

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3);
    const speeds = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() * 2 - 1) * SPREAD;
      positions[i * 3 + 1] = Math.random() * TOP;
      positions[i * 3 + 2] = (Math.random() * 2 - 1) * SPREAD;
      speeds[i] = 2 + Math.random() * 4.5;
    }
    return { positions, speeds };
  }, []);

  useFrame((_, delta) => {
    const attr = ref.current.geometry.attributes.position as BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < COUNT; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      if (arr[i * 3 + 1] > TOP) arr[i * 3 + 1] = 0;
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={1.3}
        sizeAttenuation
        transparent
        opacity={0.4}
        color="#ffe9bd"
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </points>
  );
}
