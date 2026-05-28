"use client";

import {
  CITY_HALF,
  GATE_HEIGHT,
  GATE_WIDTH,
  GATES,
} from "../data/points-of-interest";

/**
 * Twelve gates of pearl — three on each cardinal side.
 *
 * Rev 21:21: "the twelve gates were twelve pearls, each of the gates made
 * of a single pearl." Rev 21:12: "and at the gates twelve angels, and on
 * the gates the names of the twelve tribes of the sons of Israel were
 * inscribed."
 *
 * Implementation: each gate is rendered as a thin pearl-white frame around
 * the opening (so the wall cutout reads as a *named gate* rather than just
 * a hole), with a soft glow. Tribe names are NOT rendered as inscribed
 * text — that would require font loading; in the MVP the tribe name only
 * shows up in the HUD as a label.
 */
export function Gates() {
  return (
    <group>
      {GATES.map((gate) => (
        <SingleGate key={gate.tribe} gate={gate} />
      ))}
    </group>
  );
}

function SingleGate({ gate }: { gate: (typeof GATES)[number] }) {
  // Frame thickness (extends beyond the wall on both sides).
  const frame = 0.6;
  const isHorizontalSide = gate.side === "north" || gate.side === "south";

  // Frame dimensions in world space:
  //   - on N/S sides, the gate face is in the X-Y plane; frame depth runs along Z
  //   - on E/W sides, the gate face is in the Z-Y plane; frame depth runs along X
  const depth = 3; // how far the frame extends through the wall

  const [x, , z] = gate.position;
  const yMid = GATE_HEIGHT / 2;

  if (isHorizontalSide) {
    return (
      <group position={[x, 0, z]}>
        {/* Left jamb */}
        <PearlBox
          position={[-(GATE_WIDTH / 2) - frame / 2, yMid, 0]}
          size={[frame, GATE_HEIGHT, depth]}
        />
        {/* Right jamb */}
        <PearlBox
          position={[GATE_WIDTH / 2 + frame / 2, yMid, 0]}
          size={[frame, GATE_HEIGHT, depth]}
        />
        {/* Lintel */}
        <PearlBox
          position={[0, GATE_HEIGHT + frame / 2, 0]}
          size={[GATE_WIDTH + frame * 2, frame, depth]}
        />
        {/* Indicator marker — small luminous sphere above the gate to
            make it visible from a distance inside the city. */}
        <Indicator
          position={[
            0,
            GATE_HEIGHT + frame + 1.5,
            z > 0 ? -0.5 : 0.5,
          ]}
        />
      </group>
    );
  }
  return (
    <group position={[x, 0, z]}>
      {/* Front jamb (toward +Z when on east wall, etc.) */}
      <PearlBox
        position={[0, yMid, -(GATE_WIDTH / 2) - frame / 2]}
        size={[depth, GATE_HEIGHT, frame]}
      />
      <PearlBox
        position={[0, yMid, GATE_WIDTH / 2 + frame / 2]}
        size={[depth, GATE_HEIGHT, frame]}
      />
      <PearlBox
        position={[0, GATE_HEIGHT + frame / 2, 0]}
        size={[depth, frame, GATE_WIDTH + frame * 2]}
      />
      <Indicator
        position={[
          x > 0 ? -0.5 : 0.5,
          GATE_HEIGHT + frame + 1.5,
          0,
        ]}
      />
    </group>
  );
}

function PearlBox({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#fff8f0"
        roughness={0.15}
        metalness={0.25}
        emissive="#fff1d6"
        emissiveIntensity={0.4}
      />
    </mesh>
  );
}

function Indicator({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[1.2, 16, 16]} />
      <meshStandardMaterial
        color="#fff8f0"
        emissive="#ffe8b0"
        emissiveIntensity={1.6}
        roughness={0.2}
      />
    </mesh>
  );
}

// Re-export CITY_HALF so other components don't have to import the constants
// file directly when they only need to know city extent.
export { CITY_HALF };
