"use client";

import { useMemo } from "react";
import type { Texture } from "three";

import {
  CITY_HALF,
  GATE_HEIGHT,
  GATE_WIDTH,
  GATES,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "../data/points-of-interest";
import { jasperNormalMap } from "../materials/detail";

/**
 * The jasper city wall. Rev 21:18 — "the wall was built of jasper" — read with
 * Rev 21:11, where the city's radiance is "like a jasper, clear as crystal."
 *
 * Implementation: each side is built from segments between gate cutouts.
 * Three gates per side at offsets [-50, 0, 50] from the side's midpoint,
 * each cutout is GATE_WIDTH metres wide. Segments are simple boxes sharing a
 * translucent jasper-crystal material (see JasperMaterial) carrying a mineral
 * veining normal map so the wall reads as a real crystalline mass rather than a
 * flat slab, consistent with ADR 0009 rule 2 (crystal shown as the figure of
 * the vision, not photoreal masonry). All transmissive meshes in the scene
 * share three's single transmission render pass, so the clear walls add no
 * extra full-scene render.
 *
 * Geometry note: corner segments overlap slightly (by WALL_THICKNESS) where
 * the four walls meet. This is fine for the MVP — it looks like a solid corner.
 */
export function CityShell() {
  const horizontalSegments = computeSegments(CITY_HALF * 2, [-50, 0, 50], GATE_WIDTH);
  const verticalSegments = computeSegments(CITY_HALF * 2, [-50, 0, 50], GATE_WIDTH);

  // One veining normal map, shared by every wall segment and lintel.
  const veinMap = useMemo(() => jasperNormalMap(2), []);

  return (
    <group>
      {/* North wall (Z = -CITY_HALF), east-west segments. */}
      {horizontalSegments.map((seg, i) => (
        <WallSegment
          key={`n-${i}`}
          position={[seg.center, WALL_HEIGHT / 2, -CITY_HALF]}
          size={[seg.length, WALL_HEIGHT, WALL_THICKNESS]}
          veinMap={veinMap}
        />
      ))}
      {/* South wall (Z = +CITY_HALF). */}
      {horizontalSegments.map((seg, i) => (
        <WallSegment
          key={`s-${i}`}
          position={[seg.center, WALL_HEIGHT / 2, CITY_HALF]}
          size={[seg.length, WALL_HEIGHT, WALL_THICKNESS]}
          veinMap={veinMap}
        />
      ))}
      {/* East wall (X = +CITY_HALF). */}
      {verticalSegments.map((seg, i) => (
        <WallSegment
          key={`e-${i}`}
          position={[CITY_HALF, WALL_HEIGHT / 2, seg.center]}
          size={[WALL_THICKNESS, WALL_HEIGHT, seg.length]}
          veinMap={veinMap}
        />
      ))}
      {/* West wall (X = -CITY_HALF). */}
      {verticalSegments.map((seg, i) => (
        <WallSegment
          key={`w-${i}`}
          position={[-CITY_HALF, WALL_HEIGHT / 2, seg.center]}
          size={[WALL_THICKNESS, WALL_HEIGHT, seg.length]}
          veinMap={veinMap}
        />
      ))}
      {/* Lintels: a thin bar above each gate so the wall reads as continuous. */}
      {GATES.map((gate) => (
        <Lintel key={`lintel-${gate.tribe}`} gate={gate} veinMap={veinMap} />
      ))}
    </group>
  );
}

function WallSegment({
  position,
  size,
  veinMap,
}: {
  position: [number, number, number];
  size: [number, number, number];
  veinMap: Texture;
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <JasperMaterial veinMap={veinMap} />
    </mesh>
  );
}

function Lintel({
  gate,
  veinMap,
}: {
  gate: (typeof GATES)[number];
  veinMap: Texture;
}) {
  const lintelHeight = WALL_HEIGHT - GATE_HEIGHT;
  const lintelY = GATE_HEIGHT + lintelHeight / 2;
  const size: [number, number, number] =
    gate.side === "north" || gate.side === "south"
      ? [GATE_WIDTH, lintelHeight, WALL_THICKNESS]
      : [WALL_THICKNESS, lintelHeight, GATE_WIDTH];
  return (
    <mesh position={[gate.position[0], lintelY, gate.position[2]]}>
      <boxGeometry args={size} />
      <JasperMaterial veinMap={veinMap} />
    </mesh>
  );
}

/**
 * Translucent jasper crystal (Rev 21:18 + 21:11 "clear as crystal"): a clear,
 * faintly blue-green mass that lets the summit glory glow through. Thin optical
 * thickness keeps it clear (not milky); the mineral-veining normal map gives the
 * surface crystalline relief; iridescence and a glossy clearcoat give the wall
 * the shifting lustre of a gem; a gentle internal glow keeps shadowed faces
 * self-lit.
 */
function JasperMaterial({ veinMap }: { veinMap: Texture }) {
  return (
    <meshPhysicalMaterial
      color="#bfe0ee"
      transmission={0.45}
      thickness={4}
      ior={1.5}
      roughness={0.1}
      metalness={0}
      attenuationColor="#6fa8c4"
      attenuationDistance={30}
      emissive="#26506a"
      emissiveIntensity={0.18}
      iridescence={0.5}
      iridescenceIOR={1.35}
      clearcoat={0.7}
      clearcoatRoughness={0.12}
      specularIntensity={1}
      normalMap={veinMap}
      normalScale={[0.5, 0.5]}
    />
  );
}

type Segment = { center: number; length: number };

/**
 * Given a total side length, gate centers (offsets from the side midpoint),
 * and gate width, return the wall segments between gate cutouts as
 * {center, length} pairs in side-local coordinates centered on 0.
 */
function computeSegments(
  totalLength: number,
  gateOffsets: number[],
  gateWidth: number,
): Segment[] {
  const half = totalLength / 2;
  const halfGate = gateWidth / 2;
  const cutouts = [...gateOffsets]
    .sort((a, b) => a - b)
    .map((o) => ({ start: o - halfGate, end: o + halfGate }));
  const segments: Segment[] = [];
  let cursor = -half;
  for (const c of cutouts) {
    if (c.start > cursor) {
      segments.push({ center: (cursor + c.start) / 2, length: c.start - cursor });
    }
    cursor = c.end;
  }
  if (cursor < half) {
    segments.push({ center: (cursor + half) / 2, length: half - cursor });
  }
  return segments;
}
