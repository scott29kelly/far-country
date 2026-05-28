"use client";

/* -----------------------------------------------------------------------------
 * ANICONIC POLICY — DO NOT VIOLATE
 *
 * The throne is rendered as ABSTRACT GEOMETRY ONLY. Never as a humanoid form,
 * face, eyes, hair, hands, gender cue, crown, beard, Lamb figure, or any other
 * iconographic marker of a divine person.
 *
 * Rationale: Scripture itself is careful here — Ezek 1:26 describes "a likeness
 * with a human appearance" rather than naming a person; Rev 4:2 says "one
 * seated on the throne" with no description of who; Ex 33:20 — "you cannot see
 * my face." Geometry forces commitments that text and citations do not. If we
 * put a figure on the throne, we have answered theological questions the
 * dataset deliberately leaves open.
 *
 * This component is the load-bearing aniconic choice in the Phase 3 MVP. If a
 * future ADR (planned: ADR 0010) reverses this policy, it must be a deliberate,
 * documented decision — not a drift in a follow-up commit.
 * --------------------------------------------------------------------------- */

export function Throne() {
  return (
    <group position={[0, 0, 0]}>
      {/* Stepped base — three concentric platforms. Pure abstract geometry. */}
      <mesh position={[0, 0.5, 0]} receiveShadow castShadow>
        <boxGeometry args={[18, 1, 18]} />
        <meshStandardMaterial
          color="#e6e8eb"
          roughness={0.3}
          metalness={0.6}
          emissive="#c4c0a8"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, 1.6, 0]} receiveShadow castShadow>
        <boxGeometry args={[14, 1.2, 14]} />
        <meshStandardMaterial
          color="#ede8df"
          roughness={0.25}
          metalness={0.55}
          emissive="#d4c896"
          emissiveIntensity={0.2}
        />
      </mesh>
      <mesh position={[0, 2.7, 0]} receiveShadow castShadow>
        <boxGeometry args={[10, 1, 10]} />
        <meshStandardMaterial
          color="#f4eee0"
          roughness={0.2}
          metalness={0.5}
          emissive="#e0d29c"
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* The throne itself — a tall rectangular prism. No figure on it.
          Slightly luminous, with a subtle internal glow column above. */}
      <mesh position={[0, 8, 0]} castShadow>
        <boxGeometry args={[4.5, 10, 4.5]} />
        <meshStandardMaterial
          color="#fbf6e8"
          roughness={0.18}
          metalness={0.4}
          emissive="#f1e4b2"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* Internal glow column — extends upward, suggesting the unapproachable
          light of 1 Tim 6:16 without depicting anything. */}
      <mesh position={[0, 22, 0]}>
        <cylinderGeometry args={[1.6, 2.4, 22, 16, 1, true]} />
        <meshBasicMaterial
          color="#fff4c8"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>

      {/* A wider, fainter halo of light. */}
      <mesh position={[0, 26, 0]}>
        <cylinderGeometry args={[4, 8, 18, 16, 1, true]} />
        <meshBasicMaterial
          color="#fff0b4"
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </mesh>

      {/* A point light at the throne to actually illuminate the surrounding
          city — the throne is the light source of the New Jerusalem
          (Rev 21:23). */}
      <pointLight
        position={[0, 12, 0]}
        intensity={1500}
        distance={250}
        decay={1.6}
        color="#fff1c8"
        castShadow={false}
      />
    </group>
  );
}
