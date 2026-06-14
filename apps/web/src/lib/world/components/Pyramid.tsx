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
 * — NOT photoreal mineralogy — consistent with ADR 0009 rule 2.
 *
 * Photorealism pass: the flat hard-edged boxes became (a) beveled via
 * RoundedBox so edges catch a highlight instead of reading as a CGI cube, (b)
 * surfaced with a faceted crystal NORMAL map so each face sparkles with cut
 * relief, (c) given chromatic dispersion so the transmitted glory splits into
 * faint fire, and (d) finely stepped (12 courses) for a more refined ziggurat
 * silhouette. A height-graded internal emissive (deep jewel-blue foot → bright
 * crystal summit, Rev 21:23) carries the colour and the "glory brightening
 * toward the throne" read.
 *
 * Geometry: TERRACES are centred cubes nested by half-width (tall+narrow at the
 * centre, short+wide at the rim). The walkable terrace tops come from
 * groundHeightAt() in world-geometry.ts; this component only draws them.
 */
import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";
import { Color } from "three";

import { crystalNormalMap } from "../materials/detail";
import { PYRAMID } from "../data/points-of-interest";
import { TERRACES } from "../data/world-geometry";

/** Internal-glow gradient: deep jewel-blue foot → bright crystal summit. */
const BASE_GLOW = new Color("#2c6c9e");
const SUMMIT_GLOW = new Color("#d4ecff");

export function Pyramid() {
  const normalMap = useMemo(() => crystalNormalMap(3), []);

  return (
    <group>
      {TERRACES.map((t) => {
        // 0 at the foot, 1 at the summit terrace.
        const f = t.level / PYRAMID.steps;
        const glow = BASE_GLOW.clone().lerp(SUMMIT_GLOW, f);
        return (
          <RoundedBox
            key={t.level}
            args={[t.half * 2, t.topY, t.half * 2]}
            radius={1.3}
            smoothness={4}
            position={[0, t.topY / 2, 0]}
          >
            {/* Luminous faceted jewel crystal. Low transmission so the mass
                occludes; the normal map gives cut-facet relief; dispersion
                splits the transmitted light into fire; iridescence + clearcoat
                give the shifting gem surface; the graded emissive supplies the
                colour and the glory-toward-the-summit read. */}
            <meshPhysicalMaterial
              color="#bfe2f7"
              transmission={0.22}
              thickness={8}
              ior={1.5}
              dispersion={3}
              roughness={0.09}
              metalness={0}
              attenuationColor="#6fb3da"
              attenuationDistance={40}
              emissive={glow}
              emissiveIntensity={0.2 + f * 0.34}
              iridescence={0.5}
              iridescenceIOR={1.4}
              clearcoat={0.85}
              clearcoatRoughness={0.06}
              specularIntensity={1}
              normalMap={normalMap}
              normalScale={[0.55, 0.55]}
              clearcoatNormalMap={normalMap}
            />
          </RoundedBox>
        );
      })}
    </group>
  );
}
