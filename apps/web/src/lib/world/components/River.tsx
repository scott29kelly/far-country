"use client";

/**
 * River of the Water of Life. Rev 22:1 — "the river of the water of life,
 * bright as crystal, flowing from the throne of God and of the Lamb."
 *
 * SINGLE river (not branched): Rev 22:1 describes one river; the four-headed
 * river is Eden's (Gen 2:10), dividing downstream. See world-geometry.ts and
 * roadmap.md Phase 3 rendering note.
 *
 * Dataset tier: symbolic. Symbolic referent: "the life-giving presence and
 * Spirit that proceed from God and the Lamb to sustain the redeemed." Per ADR
 * 0009 rule 2 the river is rendered AS the symbol (flowing water) but visibly
 * unphysical — luminous, translucent, faintly self-emitting.
 *
 * In the pyramid the river is a CASCADE down the south meridian (x=0, +Z face):
 * a flat channel on each terrace top, a vertical fall ribbon down each riser,
 * then a base-plaza reach out to the south gate. Geometry comes from
 * cascadeSegments(); this component only draws the planes.
 */

import { DoubleSide } from "three";

import { cascadeSegments, RIVER } from "../data/world-geometry";

const WATER_COLOR = "#dff4ff";
const WATER_EMISSIVE = "#b9e2ff";

export function River() {
  const { channels, falls } = cascadeSegments();

  return (
    <group>
      {/* Flat channel reaches — horizontal planes lying on each terrace top. */}
      {channels.map((c, i) => {
        const length = c.z1 - c.z0;
        const centerZ = (c.z0 + c.z1) / 2;
        return (
          <mesh
            key={`chan-${i}`}
            position={[0, c.y + RIVER.surfaceY, centerZ]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[RIVER.width, length]} />
            <meshStandardMaterial
              color={WATER_COLOR}
              transparent
              opacity={0.6}
              roughness={0.1}
              metalness={0}
              emissive={WATER_EMISSIVE}
              emissiveIntensity={0.55}
            />
          </mesh>
        );
      })}

      {/* Vertical fall ribbons — planes facing south down each riser face. */}
      {falls.map((f, i) => {
        const height = f.y0 - f.y1;
        const centerY = (f.y0 + f.y1) / 2;
        return (
          <mesh
            key={`fall-${i}`}
            position={[0, centerY, f.z + 0.1]}
          >
            <planeGeometry args={[RIVER.width, height]} />
            <meshStandardMaterial
              color={WATER_COLOR}
              transparent
              opacity={0.5}
              roughness={0.1}
              metalness={0}
              emissive={WATER_EMISSIVE}
              emissiveIntensity={0.7}
              side={DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
}
