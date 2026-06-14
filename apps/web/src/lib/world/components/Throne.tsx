"use client";

/* -----------------------------------------------------------------------------
 * ANICONIC POLICY — see docs/adr/0010-aniconic-policy.md
 *
 * The throne is rendered as ABSTRACT GEOMETRY ONLY. No humanoid form, face,
 * eyes, hair, hands, gender cue, crown, beard, Lamb figure, or any other
 * iconographic marker of a divine person. Reversing this is an ADR-level
 * decision (a new ADR superseding 0010), not a code-level override.
 *
 * The throne now sits at the SUMMIT of the step pyramid (y = SUMMIT_Y), per
 * Willis's mountain model — "the throne / glory at the summit (apex)". A
 * cloud-and-fire glory canopy crowns it (Isa 4:5–6; cf. Sinai, Ex 19:18),
 * rendered as luminous volume, not figure.
 * --------------------------------------------------------------------------- */

import { MeshReflectorMaterial } from "@react-three/drei";
import { useMemo } from "react";
import { AdditiveBlending, DoubleSide, ShaderMaterial } from "three";

import { SUMMIT_Y } from "../data/world-geometry";

export function Throne() {
  return (
    <group position={[0, SUMMIT_Y, 0]}>
      {/* Sea of glass, like crystal, before the throne (Rev 4:6: "and before
          the throne there was as it were a sea of glass, like crystal"). A
          reflective crystalline floor over the summit that throws back the glory
          and the hosts of light. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <circleGeometry args={[17, 72]} />
        <MeshReflectorMaterial
          resolution={512}
          mirror={0.7}
          mixStrength={1.3}
          mixBlur={1.2}
          blur={[220, 90]}
          metalness={0.2}
          roughness={0.07}
          color="#cfeaff"
          envMapIntensity={0.6}
        />
      </mesh>

      {/* Rainbow around the throne (Rev 4:3: "and around the throne was a
          rainbow that had the appearance of an emerald"). Rendered as luminous
          spectral halos with emerald prominence — see RENDERING-DECISIONS #4. */}
      <RainbowHalo />

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
          emissive="#f7eab8"
          emissiveIntensity={1.1}
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

      {/* Cloud-and-fire glory canopy over the summit (Isa 4:5–6: "a cloud by
          day, and smoke and the shining of a flaming fire by night... a canopy").
          Rendered as luminous volume only — no figure. A broad soft cloud cap
          with a warmer fire-tinted underglow. */}
      <mesh position={[0, 40, 0]}>
        <sphereGeometry args={[26, 24, 16]} />
        <meshBasicMaterial
          color="#fbe6bf"
          transparent
          opacity={0.1}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 33, 0]}>
        <sphereGeometry args={[16, 24, 16]} />
        <meshBasicMaterial
          color="#ffca7a"
          transparent
          opacity={0.14}
          depthWrite={false}
        />
      </mesh>

      {/* A point light at the throne to actually illuminate the surrounding
          city — the throne is the light source of the New Jerusalem
          (Rev 21:23). Reach extended to wash the whole pyramid (summit is
          ~84m up). */}
      <pointLight
        position={[0, 12, 0]}
        intensity={2600}
        distance={420}
        decay={1.4}
        color="#fff1c8"
        castShadow={false}
      />
    </group>
  );
}

/**
 * The rainbow around the throne (Rev 4:3). Two luminous spectral halos ringing
 * the throne column, additively blended so they glow and bloom. Full spectrum
 * with an emerald bias — a harmonisation of "a rainbow" with "the appearance of
 * an emerald" (RENDERING-DECISIONS.md entry #4).
 */
function RainbowHalo() {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          vec3 hue2rgb(float h) {
            h = fract(h);
            vec3 p = abs(fract(h + vec3(1.0, 2.0, 3.0) / 3.0) * 6.0 - 3.0);
            return clamp(p - 1.0, 0.0, 1.0);
          }
          void main() {
            vec3 c = hue2rgb(vUv.x);
            c = mix(c, vec3(0.12, 0.92, 0.5), 0.4); // emerald prominence (Rev 4:3)
            float edge = smoothstep(0.0, 0.32, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
            gl_FragColor = vec4(c * 1.4, 0.5 * edge);
          }
        `,
      }),
    [],
  );
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 7, 0]} material={mat}>
        <torusGeometry args={[12, 0.7, 16, 120]} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 11, 0]} material={mat}>
        <torusGeometry args={[8.5, 0.5, 16, 120]} />
      </mesh>
    </group>
  );
}
