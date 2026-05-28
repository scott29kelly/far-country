"use client";

/**
 * River of the Water of Life. Rev 22:1 — "the river of the water of life,
 * bright as crystal, flowing from the throne of God and of the Lamb."
 *
 * Dataset tier: symbolic. Symbolic referent: "the life-giving presence and
 * Spirit that proceed from God and the Lamb to sustain the redeemed."
 *
 * Per ADR 0009 rule 2, the river is rendered AS the symbol used in the
 * vision (a flowing channel of water) but in a visibly unphysical way —
 * luminous, translucent, faintly self-emitting — so the viewer reads it
 * as "the figure of the vision" not "a body of water in heaven".
 *
 * Geometry choice: a single straight channel from just south of the throne
 * base to just inside the south gate, lying flush with the gold street at
 * a tiny vertical offset to avoid z-fighting. The Rev 22:1 phrase "through
 * the middle of the street of the city" is honoured by running the river
 * down the city's south meridian. North/east/west branches are a possible
 * future addition; this MVP slice shows the south channel only.
 */

import { RIVER } from "../data/world-geometry";

export function River() {
  const length = RIVER.endZ - RIVER.startZ;
  const centerZ = (RIVER.startZ + RIVER.endZ) / 2;
  return (
    <group>
      {/* Translucent luminous surface — the visible water. */}
      <mesh
        position={[0, RIVER.surfaceY, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[RIVER.width, length]} />
        <meshStandardMaterial
          color="#dff4ff"
          transparent
          opacity={0.55}
          roughness={0.1}
          metalness={0.0}
          emissive="#b9e2ff"
          emissiveIntensity={0.55}
        />
      </mesh>
      {/* A second, slightly narrower, brighter core stripe — gives the
          river a perceptible centreline glow without animating shader. */}
      <mesh
        position={[0, RIVER.surfaceY + 0.005, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[RIVER.width * 0.45, length]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
