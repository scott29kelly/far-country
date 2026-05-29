"use client";

/**
 * The twelve jewelled foundations of the wall. Rev 21:19–20 — "The foundations
 * of the wall of the city were adorned with every kind of jewel" — listing
 * jasper, sapphire, agate, emerald, onyx, carnelian, chrysolite, beryl, topaz,
 * chrysoprase, jacinth, amethyst (ESV order, preserved in FOUNDATION_GEMS).
 *
 * Willis reads the foundations as the pyramid's stepped courses; the MVP renders
 * them more modestly as a jewelled plinth course at the base of the wall, three
 * gems per side (N: 1–3, E: 4–6, S: 7–9, W: 10–12). Gem hues are stylised and
 * faintly self-luminous, not photoreal mineralogy (ADR 0009 rule 2).
 */
import {
  CITY_HALF,
  FOUNDATION_BAND_LENGTH,
  FOUNDATION_BANDS,
  FOUNDATION_GEMS,
  WALL_THICKNESS,
} from "../data/points-of-interest";

/** Height of the jewelled course, in metres. */
const BAND_HEIGHT = 3.5;
/** Slightly proud of the wall so the gems read from outside and inside. */
const BAND_DEPTH = WALL_THICKNESS + 0.8;

export function Foundations() {
  return (
    <group>
      {FOUNDATION_BANDS.map((band) => {
        const gem = FOUNDATION_GEMS[band.gem];
        const isHorizontal = band.side === "north" || band.side === "south";
        const size: [number, number, number] = isHorizontal
          ? [FOUNDATION_BAND_LENGTH, BAND_HEIGHT, BAND_DEPTH]
          : [BAND_DEPTH, BAND_HEIGHT, FOUNDATION_BAND_LENGTH];
        return (
          <mesh
            key={`${band.side}-${band.gem}`}
            position={[band.position[0], BAND_HEIGHT / 2, band.position[2]]}
            castShadow
          >
            <boxGeometry args={size} />
            <meshStandardMaterial
              color={gem.color}
              roughness={0.18}
              metalness={0.25}
              emissive={gem.color}
              emissiveIntensity={0.4}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// Re-export so callers that only need the city extent can stay decoupled.
export { CITY_HALF };
