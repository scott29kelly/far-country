"use client";

/**
 * Tree of Life. Rev 22:2 — "on either side of the river, the tree of life
 * with its twelve kinds of fruit, yielding its fruit each month."
 *
 * Dataset tier: symbolic. Symbolic referent: "the restored access to eternal
 * life granted to the redeemed in God's presence." Per ADR 0009 rule 2, the
 * tree is rendered AS the symbol but luminous and stylised so it does not read
 * as photoreal botany.
 *
 * Form: a tapering, faintly glowing trunk; a layered canopy built from several
 * overlapping emissive spheres (jewel-green shot with gold) so the silhouette
 * reads organic rather than as one ball; twelve glowing gold fruits (Rev 22:2's
 * "twelve kinds of fruit" preserved by count); and a soft warm light at the
 * heart of each canopy so the tree casts its own life-light. A gentle sway
 * keeps the trees alive without animating the monthly-fruit detail (which is
 * carried by the descriptor card, not the geometry). Two trees flank the river
 * (TREE_POSITIONS in world-geometry.ts).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";

import {
  TREE_CANOPY_RADIUS,
  TREE_POSITIONS,
  TREE_TRUNK_HEIGHT,
  TREE_TRUNK_RADIUS,
} from "../data/world-geometry";

export function TreesOfLife() {
  return (
    <group>
      {TREE_POSITIONS.map(([x, z], i) => (
        <SingleTree key={i} position={[x, 0, z]} phase={i * 1.7} />
      ))}
    </group>
  );
}

/** Overlapping canopy lobes: [x, y, z, radius, color, emissive, intensity]. */
const CANOPY_LOBES: Array<
  [number, number, number, number, string, string, number]
> = [
  [0, 0, 0, 1.0, "#74ad5e", "#2f5a24", 0.5],
  [0.58, 0.32, 0.1, 0.66, "#8cc473", "#3c6a2c", 0.55],
  [-0.52, 0.18, 0.34, 0.62, "#69a058", "#2a5020", 0.5],
  [0.14, 0.5, -0.46, 0.56, "#9ad07f", "#406e2e", 0.6],
  [-0.3, 0.46, -0.2, 0.5, "#7eb968", "#345e26", 0.55],
  [0.36, -0.12, -0.44, 0.48, "#5f9450", "#26491d", 0.45],
];

function SingleTree({
  position,
  phase,
}: {
  position: [number, number, number];
  phase: number;
}) {
  const trunkY = TREE_TRUNK_HEIGHT / 2;
  const canopyY = TREE_TRUNK_HEIGHT + TREE_CANOPY_RADIUS * 0.55;
  const canopy = useRef<Group>(null!);

  // Gentle sway — a slow lean keyed to a per-tree phase so the pair don't move
  // in lockstep.
  useFrame((state) => {
    if (!canopy.current) return;
    const t = state.clock.elapsedTime + phase;
    canopy.current.rotation.z = Math.sin(t * 0.5) * 0.03;
    canopy.current.rotation.x = Math.cos(t * 0.4) * 0.025;
  });

  return (
    <group position={position}>
      {/* Trunk — tapering warm wood with a faint inner life-glow. */}
      <mesh position={[0, trunkY, 0]} castShadow>
        <cylinderGeometry
          args={[TREE_TRUNK_RADIUS * 0.7, TREE_TRUNK_RADIUS * 1.3, TREE_TRUNK_HEIGHT, 14]}
        />
        <meshStandardMaterial
          color="#46301a"
          roughness={0.65}
          metalness={0.0}
          emissive="#1a0f06"
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Canopy group (sways). */}
      <group ref={canopy} position={[0, canopyY, 0]}>
        {CANOPY_LOBES.map(([lx, ly, lz, r, color, emissive, ei], i) => (
          <mesh
            key={i}
            position={[
              lx * TREE_CANOPY_RADIUS,
              ly * TREE_CANOPY_RADIUS,
              lz * TREE_CANOPY_RADIUS,
            ]}
            castShadow
          >
            <sphereGeometry args={[r * TREE_CANOPY_RADIUS, 20, 16]} />
            <meshStandardMaterial
              color={color}
              roughness={0.5}
              metalness={0}
              emissive={emissive}
              emissiveIntensity={ei}
            />
          </mesh>
        ))}

        {/* Twelve gold fruits scattered on the canopy surface. */}
        {FRUIT_OFFSETS.map(([fx, fy, fz], i) => (
          <mesh key={i} position={[fx, fy, fz]}>
            <sphereGeometry args={[0.38, 12, 10]} />
            <meshStandardMaterial
              color="#ffd86a"
              emissive="#ffaf3c"
              emissiveIntensity={1.6}
              roughness={0.2}
              metalness={0.1}
            />
          </mesh>
        ))}
      </group>

      {/* The tree's own life-light. */}
      <pointLight
        position={[0, canopyY, 0]}
        intensity={40}
        distance={36}
        decay={1.6}
        color="#cfe6a0"
      />
    </group>
  );
}

/** Twelve fruit positions scattered over the canopy surface. */
const FRUIT_OFFSETS: Array<[number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < 12; i++) {
    const theta = (i / 12) * Math.PI * 2 + (i % 2) * 0.5;
    const phi = ((i % 4) - 1.5) * 0.4;
    const r = TREE_CANOPY_RADIUS * (0.85 + (i % 3) * 0.06);
    out.push([
      Math.cos(theta) * r,
      Math.sin(phi) * r * 0.7 + 0.4,
      Math.sin(theta) * r,
    ]);
  }
  return out;
})();
