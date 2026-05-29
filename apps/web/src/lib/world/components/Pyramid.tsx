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
          <meshStandardMaterial
            color="#cfe6f2"
            transparent
            opacity={0.42}
            roughness={0.08}
            metalness={0.1}
            emissive="#9fd0e6"
            emissiveIntensity={0.28}
            depthWrite
          />
        </mesh>
      ))}
    </group>
  );
}
