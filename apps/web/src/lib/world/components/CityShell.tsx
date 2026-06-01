"use client";

import {
  CITY_HALF,
  GATE_HEIGHT,
  GATE_WIDTH,
  GATES,
  WALL_HEIGHT,
  WALL_THICKNESS,
} from "../data/points-of-interest";

/**
 * The jasper city wall. Rev 21:18 — "the wall was built of jasper" — read with
 * Rev 21:11, where the city's radiance is "like a jasper, clear as crystal."
 *
 * Implementation: each side is built from segments between gate cutouts.
 * Three gates per side at offsets [-50, 0, 50] from the side's midpoint,
 * each cutout is GATE_WIDTH metres wide. Segments are simple boxes sharing a
 * translucent jasper-crystal material (see JasperMaterial) so the glowing
 * crystal mountain reads *through* the walls, consistent with the Pyramid
 * terraces and ADR 0009 rule 2 (crystal shown as the figure of the vision, not
 * photoreal masonry). All transmissive meshes in the scene share three's single
 * transmission render pass, so the clear walls add no extra full-scene render.
 *
 * Geometry note: corner segments overlap slightly (by WALL_THICKNESS) where
 * the four walls meet. This is fine for the MVP — it looks like a solid
 * corner.
 */
export function CityShell() {
  // The X positions of segment centers and their widths along the
  // north/south walls (which run east-west, along X).
  // Side length = CITY_HALF * 2 = 200m. Gates at X = -50, 0, +50, each 8m wide.
  // So segment breaks at X = ±54, ±46, ±4, ±-4 → segment ranges:
  //   [-100, -54], [-46, -4], [4, 46], [54, 100]
  // 4 segments per east-west wall.
  const horizontalSegments = computeSegments(CITY_HALF * 2, [-50, 0, 50], GATE_WIDTH);

  // Same logic for east/west walls (along Z).
  const verticalSegments = computeSegments(CITY_HALF * 2, [-50, 0, 50], GATE_WIDTH);

  return (
    <group>
      {/* North wall (Z = -CITY_HALF), east-west segments. */}
      {horizontalSegments.map((seg, i) => (
        <WallSegment
          key={`n-${i}`}
          position={[seg.center, WALL_HEIGHT / 2, -CITY_HALF]}
          size={[seg.length, WALL_HEIGHT, WALL_THICKNESS]}
        />
      ))}
      {/* South wall (Z = +CITY_HALF). */}
      {horizontalSegments.map((seg, i) => (
        <WallSegment
          key={`s-${i}`}
          position={[seg.center, WALL_HEIGHT / 2, CITY_HALF]}
          size={[seg.length, WALL_HEIGHT, WALL_THICKNESS]}
        />
      ))}
      {/* East wall (X = +CITY_HALF). */}
      {verticalSegments.map((seg, i) => (
        <WallSegment
          key={`e-${i}`}
          position={[CITY_HALF, WALL_HEIGHT / 2, seg.center]}
          size={[WALL_THICKNESS, WALL_HEIGHT, seg.length]}
        />
      ))}
      {/* West wall (X = -CITY_HALF). */}
      {verticalSegments.map((seg, i) => (
        <WallSegment
          key={`w-${i}`}
          position={[-CITY_HALF, WALL_HEIGHT / 2, seg.center]}
          size={[WALL_THICKNESS, WALL_HEIGHT, seg.length]}
        />
      ))}
      {/* Lintels: a thin bar above each gate so the wall reads as continuous. */}
      {GATES.map((gate) => (
        <Lintel key={`lintel-${gate.tribe}`} gate={gate} />
      ))}
    </group>
  );
}

function WallSegment({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <JasperMaterial />
    </mesh>
  );
}

function Lintel({
  gate,
}: {
  gate: (typeof GATES)[number];
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
      <JasperMaterial />
    </mesh>
  );
}

/**
 * Translucent jasper crystal (Rev 21:18 + 21:11 "clear as crystal"): a clear,
 * faintly blue-green mass that lets the summit glory glow through, with a body
 * tint from light attenuation so the wall still reads as a wall rather than
 * vanishing. A low emissive keeps shadowed faces self-lit without tripping the
 * bloom threshold (that glow belongs to the throne).
 */
function JasperMaterial() {
  return (
    <meshPhysicalMaterial
      color="#cfe0ea"
      transmission={0.6}
      thickness={4}
      ior={1.4}
      roughness={0.14}
      metalness={0}
      attenuationColor="#8fb3c9"
      attenuationDistance={45}
      emissive="#2a3a4a"
      emissiveIntensity={0.12}
      clearcoat={0.4}
      clearcoatRoughness={0.2}
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
  // Sorted list of cutout intervals.
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
