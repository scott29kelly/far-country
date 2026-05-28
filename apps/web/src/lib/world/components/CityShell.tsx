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
 * The jasper city wall. Rev 21:18 — "the wall was built of jasper."
 *
 * Implementation: each side is built from segments between gate cutouts.
 * Three gates per side at offsets [-50, 0, 50] from the side's midpoint,
 * each cutout is GATE_WIDTH metres wide. Segments are simple boxes.
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
      <meshStandardMaterial
        color="#c8d8e8"
        roughness={0.4}
        metalness={0.15}
        emissive="#1c2838"
        emissiveIntensity={0.2}
      />
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
  if (gate.side === "north" || gate.side === "south") {
    return (
      <mesh position={[gate.position[0], lintelY, gate.position[2]]}>
        <boxGeometry args={[GATE_WIDTH, lintelHeight, WALL_THICKNESS]} />
        <meshStandardMaterial
          color="#c8d8e8"
          roughness={0.4}
          metalness={0.15}
          emissive="#1c2838"
          emissiveIntensity={0.2}
        />
      </mesh>
    );
  }
  return (
    <mesh position={[gate.position[0], lintelY, gate.position[2]]}>
      <boxGeometry args={[WALL_THICKNESS, lintelHeight, GATE_WIDTH]} />
      <meshStandardMaterial
        color="#c8d8e8"
        roughness={0.4}
        metalness={0.15}
        emissive="#1c2838"
        emissiveIntensity={0.2}
      />
    </mesh>
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
