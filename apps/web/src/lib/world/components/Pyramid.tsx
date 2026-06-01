"use client";

/**
 * The step-pyramid city body. Janet Willis reads the New Jerusalem as a
 * terraced mountain / ziggurat (the twelve foundations as "great step-backs"),
 * with the throne at the apex — see docs/sources/willis-new-jerusalem-model.md
 * and RENDERING-DECISIONS.md entry #1.
 *
 * Materials follow Rev 21:11 ("brilliance... like crystal-clear jasper") and
 * 21:18 (gold "like clear glass"): a clear, jewel-like, self-luminous mass.
 * Rendered as translucent, faintly emissive crystalline terraces rather than
 * opaque masonry, consistent with ADR 0009 rule 2 (symbolic materials shown as
 * the figure of the vision, visibly unphysical, not photoreal mineralogy).
 *
 * Geometry: TERRACES are centred cubes nested by half-width (tall+narrow at the
 * centre, short+wide at the rim). The walkable terrace tops come from
 * groundHeightAt() in world-geometry.ts; this component only draws them.
 */
import { TERRACES } from "../data/world-geometry";

export function Pyramid() {
  return (
    <group>
      {TERRACES.map((t) => (
        <mesh key={t.level} position={[0, t.topY / 2, 0]}>
          <boxGeometry args={[t.half * 2, t.topY, t.half * 2]} />
          {/* Physical crystal: real refraction (ior) and light transmission so
              the terraces read as a thick jewel mass (Rev 21:11 "clear as
              crystal", 21:18 gold "like clear glass"), with a faint blue
              absorption tint via attenuation. A low emissive keeps it self-lit
              in shadowed faces without tripping the bloom threshold (that glow
              belongs to the throne). */}
          <meshPhysicalMaterial
            color="#dcefff"
            transmission={0.95}
            thickness={Math.max(8, t.half * 0.6)}
            ior={1.45}
            roughness={0.03}
            metalness={0}
            attenuationColor="#bfe6f5"
            attenuationDistance={90}
            emissive="#7fbfe0"
            emissiveIntensity={0.1}
            clearcoat={0.25}
            clearcoatRoughness={0.08}
          />
        </mesh>
      ))}
    </group>
  );
}
