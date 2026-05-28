"use client";

import { CITY_HALF } from "../data/points-of-interest";

/**
 * Ground plane in warm gold tone. Rev 21:21 — "the street of the city was
 * pure gold, like transparent glass." The whole inner-city floor is treated
 * as the street for the MVP placeholder.
 *
 * Extends beyond the city walls so there is somewhere visible to stand
 * before walking through a gate. The outer ground is dimmer; the inner
 * city floor is warm gold.
 */
export function Ground() {
  return (
    <group>
      {/* Outer ground — extends well beyond the walls. */}
      <mesh
        position={[0, -0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[CITY_HALF * 6, CITY_HALF * 6]} />
        <meshStandardMaterial color="#3a2f1f" roughness={0.95} />
      </mesh>
      {/* Inner city floor — gold. Slightly raised so it z-fights with nothing. */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[CITY_HALF * 2, CITY_HALF * 2]} />
        <meshStandardMaterial
          color="#d4a544"
          roughness={0.35}
          metalness={0.55}
          emissive="#3a2a08"
          emissiveIntensity={0.15}
        />
      </mesh>
    </group>
  );
}
