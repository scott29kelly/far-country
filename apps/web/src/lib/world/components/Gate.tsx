"use client";

import { Html } from "@react-three/drei";

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
 * Implementation: each gate is a rounded pearl archway — two nacre jambs
 * rising into a semicircular arch, crowned by a single luminous pearl orb.
 * The pearl material uses thin-film iridescence + clearcoat + sheen so it
 * reads as living nacre (the shifting lustre of a pearl) rather than white
 * plastic. The crown orb is the "single pearl" of Rev 21:21 made literal at
 * the keystone, and stays bright so it doubles as the from-a-distance
 * wayfinding marker inside the city. Tribe names are NOT inscribed as 3D text
 * (font loading / WebGL context cost); the name shows in the HUD and on a
 * floating label above the arch.
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

/** Jamb / arch tube radius, metres. */
const PEARL_R = 0.9;
/** Half-width of the walkable opening (matches GATE_WIDTH). */
const INNER_HALF = GATE_WIDTH / 2;
/** Major radius of the arch — springs from the jamb centres. */
const ARCH_R = INNER_HALF + PEARL_R;
/** Y of the arch crown / keystone pearl. */
const CROWN_Y = GATE_HEIGHT + ARCH_R;

function SingleGate({ gate }: { gate: (typeof GATES)[number] }) {
  const isHorizontalSide = gate.side === "north" || gate.side === "south";
  const [x, , z] = gate.position;

  // The portal is built in the X-Y plane (arch sweeps through +Y). N/S gates
  // already face along Z; E/W gates rotate 90deg about Y so the same geometry
  // faces along X. drei's <Html> auto-billboards, so the rotated group does not
  // affect label readability.
  const labelY = CROWN_Y + 4;

  return (
    <group
      position={[x, 0, z]}
      rotation={[0, isHorizontalSide ? 0 : Math.PI / 2, 0]}
    >
      <PearlPortal />
      <TribeLabel tribe={gate.tribe} position={[0, labelY, 0]} />
    </group>
  );
}

/**
 * A single pearl archway in the local X-Y plane: two vertical jambs and a
 * semicircular arch joining their tops, crowned by a luminous pearl orb.
 */
function PearlPortal() {
  return (
    <group>
      {/* Left jamb */}
      <mesh position={[-ARCH_R, GATE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[PEARL_R, PEARL_R, GATE_HEIGHT, 16]} />
        <PearlMaterial />
      </mesh>
      {/* Right jamb */}
      <mesh position={[ARCH_R, GATE_HEIGHT / 2, 0]} castShadow>
        <cylinderGeometry args={[PEARL_R, PEARL_R, GATE_HEIGHT, 16]} />
        <PearlMaterial />
      </mesh>
      {/* Semicircular arch (half-torus, arc = PI sweeps the top). */}
      <mesh position={[0, GATE_HEIGHT, 0]} castShadow>
        <torusGeometry args={[ARCH_R, PEARL_R, 16, 48, Math.PI]} />
        <PearlMaterial />
      </mesh>
      {/* Keystone pearl — the "single pearl" made literal, and the bright
          wayfinding marker visible from across the city. */}
      <mesh position={[0, CROWN_Y, 0]}>
        <sphereGeometry args={[1.6, 28, 28]} />
        <PearlMaterial emissiveIntensity={1.1} />
      </mesh>
    </group>
  );
}

/**
 * Living-nacre pearl: warm off-white with thin-film iridescence (the colour
 * shift across a pearl's surface), a high-clearcoat gloss, and soft sheen for
 * the velvety lustre. A low emissive keeps it self-lit in shadow without
 * tripping the bloom threshold (that glow belongs to the throne); the crown
 * orb raises it so the keystone reads as a beacon.
 */
function PearlMaterial({
  emissiveIntensity = 0.35,
}: {
  emissiveIntensity?: number;
}) {
  return (
    <meshPhysicalMaterial
      color="#fdf6f0"
      roughness={0.25}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.1}
      iridescence={1}
      iridescenceIOR={1.3}
      iridescenceThicknessRange={[120, 420]}
      sheen={1}
      sheenColor="#ffe9f2"
      sheenRoughness={0.4}
      emissive="#fff0e6"
      emissiveIntensity={emissiveIntensity}
    />
  );
}

/**
 * Pearl-tinted floating tribe label. Uses drei's <Html> so the label is
 * a DOM div positioned at a 3D point and auto-billboards toward the camera —
 * far lighter on the GPU than SDF text, and avoids the headless-Chromium
 * WebGL context loss that troika-three-text triggers with 12+ instances.
 */
function TribeLabel({
  tribe,
  position,
}: {
  tribe: string;
  position: [number, number, number];
}) {
  return (
    <Html
      position={position}
      center
      distanceFactor={28}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div className="whitespace-nowrap rounded-sm border border-[#fff4d0]/40 bg-[#1c1208]/60 px-2 py-0.5 font-semibold text-[#fff4d0] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {tribe}
      </div>
    </Html>
  );
}

// Re-export CITY_HALF so other components don't have to import the constants
// file directly when they only need to know city extent.
export { CITY_HALF };
