"use client";

/**
 * Tree of Life. Rev 22:2 — "on either side of the river, the tree of life
 * with its twelve kinds of fruit, yielding its fruit each month."
 *
 * Dataset tier: symbolic. Symbolic referent: "the restored access to eternal
 * life granted to the redeemed in God's presence." Per ADR 0009 rule 2, the
 * tree is rendered AS the symbol but luminous and stylised — not photoreal
 * botany.
 *
 * Photorealism pass: the smooth cartoon blob became an organic canopy built
 * from many jittered leaf-clumps in a teardrop volume, surfaced with a foliage
 * normal map (so the leaves catch broken light, not plastic shading) and shaded
 * green at the base → gold-lit toward the top where the glory falls. A tapering
 * trunk, twelve gold fruits (Rev 22:2), a soft life-light, and a gentle sway
 * complete it. Two trees flank the river (TREE_POSITIONS in world-geometry.ts).
 */
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Group, MeshStandardMaterial, Vector2 } from "three";

import { foliageNormalMap } from "../materials/detail";
import {
  TREE_CANOPY_RADIUS,
  TREE_POSITIONS,
  TREE_TRUNK_HEIGHT,
  TREE_TRUNK_RADIUS,
} from "../data/world-geometry";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CANOPY_HEIGHT = TREE_CANOPY_RADIUS * 2.4;

type Clump = { x: number; y: number; z: number; r: number; mat: number };

export function TreesOfLife() {
  // Shared across both trees: one foliage normal map and three green→gold
  // canopy materials (base, mid, gold-lit crown).
  const foliageNormal = useMemo(() => foliageNormalMap(2), []);
  const foliageMats = useMemo(() => {
    const greens = ["#4f8f49", "#73b85c", "#a6cf72"];
    const ems = ["#1f3c18", "#315824", "#5a6a2a"];
    return greens.map(
      (c, i) =>
        new MeshStandardMaterial({
          color: new Color(c),
          roughness: 0.62,
          metalness: 0,
          emissive: new Color(ems[i]),
          emissiveIntensity: 0.3 + i * 0.12,
          normalMap: foliageNormal,
          normalScale: new Vector2(0.9, 0.9),
        }),
    );
  }, [foliageNormal]);
  const fruitMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#ffd86a"),
        emissive: new Color("#ffaf3c"),
        emissiveIntensity: 1.7,
        roughness: 0.2,
        metalness: 0.1,
      }),
    [],
  );
  const trunkMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#46301a"),
        roughness: 0.78,
        metalness: 0,
        emissive: new Color("#1a0f06"),
        emissiveIntensity: 0.18,
        normalMap: foliageNormal,
        normalScale: new Vector2(0.4, 0.4),
      }),
    [foliageNormal],
  );

  return (
    <group>
      {TREE_POSITIONS.map(([x, z], i) => (
        <SingleTree
          key={i}
          position={[x, 0, z]}
          seed={Math.round(x * 131 + z * 17) + 1}
          phase={i * 1.7}
          foliageMats={foliageMats}
          fruitMat={fruitMat}
          trunkMat={trunkMat}
        />
      ))}
    </group>
  );
}

function SingleTree({
  position,
  seed,
  phase,
  foliageMats,
  fruitMat,
  trunkMat,
}: {
  position: [number, number, number];
  seed: number;
  phase: number;
  foliageMats: MeshStandardMaterial[];
  fruitMat: MeshStandardMaterial;
  trunkMat: MeshStandardMaterial;
}) {
  const trunkY = TREE_TRUNK_HEIGHT / 2;
  const canopy = useRef<Group>(null!);

  const { clumps, fruits } = useMemo(() => {
    const r = mulberry32(seed);
    const clumps: Clump[] = [];
    const N = 20;
    for (let i = 0; i < N; i++) {
      const yFrac = r() ** 0.8; // bias toward lower-mid for a full base
      const y = yFrac * CANOPY_HEIGHT;
      // Teardrop taper: widest just below mid, narrowing to the crown.
      const ring = TREE_CANOPY_RADIUS * (0.5 + 0.85 * Math.sin(yFrac * Math.PI * 0.9));
      const ang = r() * Math.PI * 2;
      const rad = ring * (0.35 + r() * 0.6);
      clumps.push({
        x: Math.cos(ang) * rad,
        y,
        z: Math.sin(ang) * rad,
        r: TREE_CANOPY_RADIUS * (0.4 + r() * 0.32),
        mat: yFrac > 0.66 ? 2 : yFrac > 0.33 ? 1 : 0,
      });
    }
    const fruits: Array<[number, number, number]> = [];
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + r() * 0.6;
      const rad = TREE_CANOPY_RADIUS * (0.8 + r() * 0.35);
      fruits.push([
        Math.cos(ang) * rad,
        CANOPY_HEIGHT * (0.35 + r() * 0.5),
        Math.sin(ang) * rad,
      ]);
    }
    return { clumps, fruits };
  }, [seed]);

  useFrame((state) => {
    if (!canopy.current) return;
    const t = state.clock.elapsedTime + phase;
    canopy.current.rotation.z = Math.sin(t * 0.5) * 0.03;
    canopy.current.rotation.x = Math.cos(t * 0.4) * 0.025;
  });

  return (
    <group position={position}>
      {/* Trunk — tapering warm wood. */}
      <mesh position={[0, trunkY, 0]} castShadow material={trunkMat}>
        <cylinderGeometry
          args={[TREE_TRUNK_RADIUS * 0.7, TREE_TRUNK_RADIUS * 1.35, TREE_TRUNK_HEIGHT, 14]}
        />
      </mesh>

      {/* Canopy (sways). */}
      <group ref={canopy} position={[0, TREE_TRUNK_HEIGHT, 0]}>
        {clumps.map((c, i) => (
          <mesh key={i} position={[c.x, c.y, c.z]} material={foliageMats[c.mat]} castShadow>
            <sphereGeometry args={[c.r, 16, 12]} />
          </mesh>
        ))}
        {fruits.map((f, i) => (
          <mesh key={`f-${i}`} position={f} material={fruitMat}>
            <sphereGeometry args={[0.34, 10, 8]} />
          </mesh>
        ))}
      </group>

      {/* The tree's own life-light. */}
      <pointLight
        position={[0, TREE_TRUNK_HEIGHT + TREE_CANOPY_RADIUS, 0]}
        intensity={38}
        distance={34}
        decay={1.6}
        color="#d2e6a0"
      />
    </group>
  );
}
