"use client";

/**
 * The step-pyramid city body. Janet Willis reads the New Jerusalem as a
 * terraced mountain / ziggurat (the twelve foundations as "great step-backs"),
 * with the throne at the apex — see docs/sources/willis-new-jerusalem-model.md
 * and RENDERING-DECISIONS.md entry #1.
 *
 * Materials follow Rev 21:11 ("brilliance... like a most rare jewel, like a
 * jasper, clear as crystal") and 21:18 (gold "like clear glass"): a clear,
 * jewel-like, self-luminous mass. Rendered as translucent crystalline terraces
 * — NOT photoreal mineralogy — consistent with ADR 0009 rule 2 (symbolic
 * materials shown as the figure of the vision, visibly unphysical).
 *
 * The earlier MVP read as frosted milk-glass: very high transmission through a
 * huge solid volume scatters to white. This pass dials transmission back and
 * leans into a GLOWING JEWEL: a saturated internal emissive that is graded by
 * height — a deep jewel-blue at the foot rising to a bright near-white at the
 * summit where the glory pours down (Rev 21:23) — plus iridescence and a glossy
 * clearcoat so the terraces catch crisp highlights and read as a luminous gem
 * mountain rather than fog.
 *
 * Geometry: TERRACES are centred cubes nested by half-width (tall+narrow at the
 * centre, short+wide at the rim). The walkable terrace tops come from
 * groundHeightAt() in world-geometry.ts; this component only draws them.
 */
import { Color } from "three";

import { PYRAMID } from "../data/points-of-interest";
import { TERRACES } from "../data/world-geometry";

/** Internal-glow gradient: deep jewel-blue foot → bright crystal summit. */
const BASE_GLOW = new Color("#2c6c9e");
const SUMMIT_GLOW = new Color("#d4ecff");

export function Pyramid() {
  return (
    <group>
      {TERRACES.map((t) => {
        // 0 at the foot, 1 at the summit terrace.
        const f = t.level / PYRAMID.steps;
        const glow = BASE_GLOW.clone().lerp(SUMMIT_GLOW, f);
        return (
          <mesh key={t.level} position={[0, t.topY / 2, 0]}>
            <boxGeometry args={[t.half * 2, t.topY, t.half * 2]} />
            {/* Luminous jewel crystal: moderate transmission + a thin optical
                thickness keep it clear rather than milky; the height-graded
                emissive supplies the colour and the "glory brightening toward
                the throne" read; iridescence + clearcoat give the gem its
                shifting surface sparkle. */}
            <meshPhysicalMaterial
              color="#bfe2f7"
              transmission={0.2}
              thickness={8}
              ior={1.5}
              roughness={0.08}
              metalness={0}
              attenuationColor="#6fb3da"
              attenuationDistance={40}
              emissive={glow}
              emissiveIntensity={0.2 + f * 0.34}
              iridescence={0.4}
              iridescenceIOR={1.4}
              clearcoat={0.7}
              clearcoatRoughness={0.06}
              specularIntensity={1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
