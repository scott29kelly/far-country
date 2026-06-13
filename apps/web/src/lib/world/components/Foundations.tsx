"use client";

/**
 * The twelve jewelled foundations of the wall. Rev 21:19–20 — "The foundations
 * of the wall of the city were adorned with every kind of jewel" — listing
 * jasper, sapphire, agate, emerald, onyx, carnelian, chrysolite, beryl, topaz,
 * chrysoprase, jacinth, amethyst (ESV order, preserved in FOUNDATION_GEMS).
 *
 * Willis reads the foundations as the pyramid's stepped courses; the MVP renders
 * them as a jewelled plinth course at the base of the wall, three stones per
 * side (N: 1–3, E: 4–6, S: 7–9, W: 10–12). Each foundation is a row of faceted
 * cut gems (flat-shaded octahedra — the classic bipyramid gem silhouette) set on
 * a low self-luminous bezel, in the named stone's stylised hue. The facets catch
 * the light environment so the course sparkles rather than reading as a flat
 * painted strip. Hues are stylised, faintly self-luminous, NOT photoreal
 * mineralogy (ADR 0009 rule 2).
 */
import { useMemo } from "react";
import { Color, MeshPhysicalMaterial } from "three";

import {
  CITY_HALF,
  FOUNDATION_BAND_LENGTH,
  FOUNDATION_BANDS,
  FOUNDATION_GEMS,
  WALL_THICKNESS,
} from "../data/points-of-interest";

/** Faceted gems set along each foundation course. */
const GEMS_PER_BAND = 7;
/** Octahedron radius (vertex distance), metres. */
const GEM_R = 2.4;
/** Height of the bezel course the gems sit on. */
const COURSE_H = 1.3;
/** Gem centre height — bottom vertex rests just into the bezel. */
const GEM_Y = COURSE_H + GEM_R * 0.55;
/** Inset from each band end so gems don't collide at the corners. */
const EDGE_MARGIN = 6;
/** Bezel is slightly proud of the wall so it reads from inside and outside. */
const COURSE_DEPTH = WALL_THICKNESS + 0.8;

/**
 * One faceted-gem material per stone (12 total), reused across every gem in
 * that foundation's row — far cheaper than a physical material per octahedron.
 * flatShading keeps the eight facets crisp; clearcoat + envMapIntensity give the
 * polished, light-catching cut-gem surface.
 */
function useGemMaterials() {
  return useMemo(() => {
    const mats = FOUNDATION_GEMS.map(
      (g) =>
        new MeshPhysicalMaterial({
          color: new Color(g.color),
          metalness: 0,
          roughness: 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.03,
          // High env intensity makes the cut facets blaze with the light
          // environment so the course sparkles like set jewels; a touch of
          // iridescence adds fire to the edges.
          envMapIntensity: 2.6,
          emissive: new Color(g.color),
          emissiveIntensity: 0.45,
          iridescence: 0.35,
          iridescenceIOR: 1.4,
          specularIntensity: 1,
          flatShading: true,
        }),
    );
    return mats;
  }, []);
}

export function Foundations() {
  const gemMats = useGemMaterials();

  return (
    <group>
      {FOUNDATION_BANDS.map((band) => {
        const gem = FOUNDATION_GEMS[band.gem];
        const isHorizontal = band.side === "north" || band.side === "south";
        const courseSize: [number, number, number] = isHorizontal
          ? [FOUNDATION_BAND_LENGTH, COURSE_H, COURSE_DEPTH]
          : [COURSE_DEPTH, COURSE_H, FOUNDATION_BAND_LENGTH];

        // Gem centres spread evenly along the band's axis.
        const span = FOUNDATION_BAND_LENGTH - 2 * EDGE_MARGIN;
        const step = GEMS_PER_BAND > 1 ? span / (GEMS_PER_BAND - 1) : 0;
        const [bx, , bz] = band.position;

        return (
          <group key={`${band.side}-${band.gem}`}>
            {/* Bezel course — keeps the foundation reading as a continuous
                jewelled line at a distance, and glows so the gems sit on light. */}
            <mesh position={[bx, COURSE_H / 2, bz]} castShadow>
              <boxGeometry args={courseSize} />
              <meshStandardMaterial
                color={gem.color}
                roughness={0.35}
                metalness={0.2}
                emissive={gem.color}
                emissiveIntensity={0.55}
              />
            </mesh>
            {/* Row of faceted cut gems. */}
            {Array.from({ length: GEMS_PER_BAND }, (_, i) => {
              const along = -span / 2 + i * step;
              const x = isHorizontal ? bx + along : bx;
              const z = isHorizontal ? bz : bz + along;
              return (
                <mesh
                  key={i}
                  position={[x, GEM_Y, z]}
                  rotation={[0, i * 0.6, (i % 2 ? 1 : 0) * 0.3]}
                  material={gemMats[band.gem]}
                  castShadow
                >
                  <octahedronGeometry args={[GEM_R, 0]} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// Re-export so callers that only need the city extent can stay decoupled.
export { CITY_HALF };
