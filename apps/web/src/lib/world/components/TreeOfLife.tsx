"use client";

/**
 * Tree of Life. Rev 22:2 — "on either side of the river, the tree of life
 * with its twelve kinds of fruit, yielding its fruit each month."
 *
 * Dataset tier: symbolic. Symbolic referent: "the restored access to eternal
 * life granted to the redeemed in God's presence." Per ADR 0009 rule 2, the
 * tree is rendered AS the symbol but with luminous emissive foliage and a
 * stylised silhouette so it does not read as photoreal botany.
 *
 * Geometry: trunk + canopy + a few fruit "specks" (small emissive spheres).
 * Two trees flank the river (TREE_POSITIONS in world-geometry.ts). The
 * monthly-fruit-rotation aspect of the text is not animated; it is
 * unrenderable in geometry alone and is preserved by the descriptor card.
 */
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
        <SingleTree key={i} position={[x, 0, z]} />
      ))}
    </group>
  );
}

function SingleTree({
  position,
}: {
  position: [number, number, number];
}) {
  const trunkY = TREE_TRUNK_HEIGHT / 2;
  const canopyY = TREE_TRUNK_HEIGHT + TREE_CANOPY_RADIUS * 0.6;

  return (
    <group position={position}>
      {/* Trunk — warm dark wood, gently luminous. */}
      <mesh position={[0, trunkY, 0]} castShadow>
        <cylinderGeometry
          args={[TREE_TRUNK_RADIUS, TREE_TRUNK_RADIUS * 1.2, TREE_TRUNK_HEIGHT, 12]}
        />
        <meshStandardMaterial
          color="#3a2a14"
          roughness={0.7}
          metalness={0.0}
          emissive="#1a1208"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* Canopy — stylised emissive sphere with a slightly flattened look.
          Greenish-gold to suggest growth + the rotating-fruit imagery. */}
      <mesh position={[0, canopyY, 0]} castShadow>
        <sphereGeometry args={[TREE_CANOPY_RADIUS, 24, 16]} />
        <meshStandardMaterial
          color="#7fa66a"
          roughness={0.4}
          metalness={0.0}
          emissive="#3a5226"
          emissiveIntensity={0.55}
        />
      </mesh>

      {/* Secondary canopy clusters — break up the perfect sphere. */}
      <mesh position={[TREE_CANOPY_RADIUS * 0.55, canopyY + 0.4, 0]}>
        <sphereGeometry args={[TREE_CANOPY_RADIUS * 0.65, 16, 12]} />
        <meshStandardMaterial
          color="#8db678"
          roughness={0.45}
          emissive="#3a5226"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[-TREE_CANOPY_RADIUS * 0.5, canopyY - 0.3, 0.6]}>
        <sphereGeometry args={[TREE_CANOPY_RADIUS * 0.6, 16, 12]} />
        <meshStandardMaterial
          color="#719264"
          roughness={0.45}
          emissive="#2c3f1d"
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Fruit specks — small emissive warm-gold spheres scattered on the
          canopy. Twelve kinds of fruit is preserved by count (not by
          colour-coding each variety, which would invent details the text
          doesn't give). */}
      {FRUIT_OFFSETS.map(([fx, fy, fz], i) => (
        <mesh key={i} position={[fx, canopyY + fy, fz]}>
          <sphereGeometry args={[0.32, 10, 8]} />
          <meshStandardMaterial
            color="#ffd76a"
            emissive="#ffb24a"
            emissiveIntensity={1.2}
            roughness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Twelve fruit positions scattered around the canopy radius. */
const FRUIT_OFFSETS: Array<[number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i < 12; i++) {
    const theta = (i / 12) * Math.PI * 2;
    const phi = ((i % 3) - 1) * 0.35; // small vertical scatter
    const r = TREE_CANOPY_RADIUS * 0.95;
    out.push([
      Math.cos(theta) * r,
      Math.sin(phi) * r * 0.4,
      Math.sin(theta) * r,
    ]);
  }
  return out;
})();
