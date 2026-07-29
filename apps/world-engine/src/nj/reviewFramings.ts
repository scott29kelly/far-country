/**
 * Composed REVIEW framings for the city — the city's counterpart to the
 * terrain's nine `debug/Bookmarks.ts` viewpoints.
 *
 * These are not navigation destinations. `NewJerusalemScene`'s
 * `navigationTargets` are user-facing places to go, labelled with their
 * citations; these are agent/reviewer camera setups, each composed to
 * exercise a named clause of `docs/CITY-QUALITY-BAR.md` so a visual verdict
 * is repeatable across builds instead of re-derived by hand every session.
 *
 * WHY THIS FILE EXISTS AT ALL. The delta-list framings written into
 * CITY-QUALITY-BAR.md on 2026-07-01 were absolute world coordinates, and by
 * 2026-07-29 not one of them still framed the city — the massing had outgrown
 * them and nothing flagged it, so the ranked delta list was being read against
 * poses that no longer showed what they claimed to show. Every framing here is
 * therefore authored in LOCAL city units and resolved through the same owner
 * tables the geometry, collision and picks consume (`cityModel`, `cityCollide`,
 * `config`). If the city is rescaled or a tier moves, these follow it. A
 * framing that can go stale silently is worse than no framing.
 *
 * Framings assert NOTHING about the text. They are tooling: no citation, no
 * pick volume, no reading-key marker (RENDERING-DECISIONS #10's posture for
 * anything uncited).
 */

import {
  CITY_HALF,
  CITY_SUMMIT_Y,
  CITY_TIERS,
  GATE_OFFSETS,
  PLINTH_HALF,
  WALL_INNER,
  cityTierBottoms,
} from './cityModel';
import { NJ_CONFIG, NJ_SCALE } from './config';

/** Eye height above a resolved floor, world meters (FlyCamera's EYE_HEIGHT). */
const EYE_M = 1.7;

/**
 * How a framing's height is established.
 *
 * - `air` — `p[1]` is local units above the plaza line. Composed aerials.
 * - `ground` — the camera STANDS: `p[1]` is not a height but a HINT, the local
 *   level the framing means to stand on, and the composed ground probe is
 *   queried at that eye height to resolve what is actually underfoot. That
 *   indirection is required because the probe is deliberately y-aware — the
 *   city's pavements are stacked, so an 840 m terrace overhang must not claim
 *   a walker down on the plaza. It also means one anchor covers standing on a
 *   city floor AND standing on the meadow outside the wall, which is what
 *   `gate-approach` and `foundation-course` actually do.
 */
export type FramingAnchor = 'air' | 'ground';

/** The scene's composed ground probe (terrain + river + city floors). */
export type GroundAt = (x: number, z: number, y?: number) => { ground: number; water: number };

export interface CityFraming {
  /** stable slug — also the contact-sheet filename */
  id: string;
  name: string;
  /** which CITY-QUALITY-BAR clause this framing is composed to judge */
  tests: string;
  anchor: FramingAnchor;
  /**
   * Camera position, LOCAL city units. For `air`, y is height above the plaza
   * line; for `ground`, y is the standing-level hint described above.
   */
  p: [number, number, number];
  /** aim point, LOCAL units — yaw/pitch derive from it (never hand-typed) */
  lookAt: [number, number, number];
  fov: number;
  /** authored light; omit to inherit `NJ_CONFIG.look.timeOfDay` */
  tod?: number;
}

const TIER_BOTTOMS = cityTierBottoms();
/** Top-face Y (local) of tier `i` — the ivory cornice pavement of that tier. */
const tierTop = (i: number): number => (TIER_BOTTOMS[i] ?? 0) + (CITY_TIERS[i]?.h ?? 0);

/** Zebulun's gate: south side, +50 offset (cityModel.GATES index 8). */
const ZEBULUN_X = GATE_OFFSETS[2];

/**
 * Radius of the covered street-of-gold gallery — the open band between the
 * plinth face and the jasper wall slab, where populationModel stations the
 * sixteen plaza-ring assemblies. Derived, not typed: the band is
 * PLINTH_HALF..WALL_INNER and the assemblies sit at its centre.
 */
const PLAZA_RING_R = (WALL_INNER + PLINTH_HALF) / 2;

/**
 * Nine composed framings, mirroring the terrain's nine so `?shot=1..9` and the
 * digit keys mean the same thing in both scenes.
 *
 * Ordered outside-in: the two distance reads, the approach, the wall and its
 * foundation at walking range, then inside the gallery, up onto a pavement,
 * close on the repeated bay, and finally the crown.
 */
export const CITY_FRAMINGS: readonly CityFraming[] = [
  {
    id: 'distant-silhouette',
    name: 'Distant silhouette',
    tests: 'Pillar D — stepped silhouette reads as a mountain, and holds its value against the sky, from ~10 km',
    anchor: 'air',
    p: [0, 110, 600],
    lookAt: [0, CITY_SUMMIT_Y * 0.55, 0],
    fov: 55,
  },
  {
    id: 'south-approach',
    name: 'South approach (hero)',
    tests: 'Pillar E — the composed establishing view up the river meridian; the whole mountain in frame',
    anchor: 'air',
    p: [0, 62, 350],
    lookAt: [0, CITY_SUMMIT_Y * 0.5, 0],
    fov: 55,
  },
  {
    id: 'three-quarter-aerial',
    name: 'Three-quarter aerial',
    tests: 'Pillars D/E — the massing read: terrace stacking, cornice pavements, module repetition across two faces',
    anchor: 'air',
    p: [130, 196, 210],
    lookAt: [0, CITY_SUMMIT_Y * 0.62, 0],
    fov: 55,
  },
  {
    id: 'gate-approach',
    name: 'Zebulun gate approach',
    tests: 'Pillar A — gate portal reads as a real recessed volume; wall face and foundation course at approach range',
    anchor: 'ground',
    p: [ZEBULUN_X, 0, CITY_HALF + 26],
    lookAt: [ZEBULUN_X, 12, CITY_HALF],
    fov: 60,
  },
  {
    id: 'foundation-course',
    name: 'Foundation course',
    tests: 'Floor — twelve distinct faceted gem volumes, not flat colour swatches; the top-ranked open optics delta',
    anchor: 'ground',
    p: [ZEBULUN_X - 22, 0, CITY_HALF + 9],
    lookAt: [ZEBULUN_X - 30, 2.2, CITY_HALF],
    fov: 55,
  },
  {
    id: 'plaza-gallery',
    name: 'Plaza gallery interior',
    tests: 'Pillars A/B/C — the covered street-of-gold gallery at walking range, and the multitude at close read',
    anchor: 'ground',
    // Look ALONG the gallery, not across it. Aimed at the plinth face this
    // framing is two unbroken planes filling the frame — which is a true
    // Pillar A reading but shows neither the gallery nor the multitude. The
    // tangential run down the south band passes the Issachar and Zebulun gate
    // corridors, so it also reads whether daylight reaches the interior at
    // all (Pillar B) and how the plaza assemblies stack in depth.
    p: [-20, 0, PLAZA_RING_R],
    lookAt: [60, 1.5, PLAZA_RING_R],
    fov: 60,
  },
  {
    id: 'terrace-pavement',
    name: 'Terrace pavement',
    tests: 'Pillar A on the HORIZONTAL — the cornice pavements are the largest surfaces in most framings',
    anchor: 'ground',
    // hint: tier 1's cornice ring, so the y-aware probe claims that pavement
    // and not the plaza slab 1,160 m below it. OFF the meridian for the same
    // reason populationModel stations its assemblies off it — the river
    // channel runs down x=0, and a framing centred there stands in the water
    // and shoots caustics instead of pavement.
    // Standing near the outer edge of the ring and tilting DOWN across it:
    // the pavement has to occupy the lower frame for this framing to test
    // what it claims to, with the next tier's riser closing the top.
    p: [40, tierTop(1), 76],
    lookAt: [40, tierTop(1) - 3, CITY_TIERS[2].half],
    fov: 60,
  },
  {
    id: 'arcade-bay',
    name: 'Arcade bay',
    tests: 'Pillar A — relief depth on one repeated module: fascia, gold arch, glow pane, dentil course',
    anchor: 'air',
    p: [0, tierTop(1) + 16, CITY_TIERS[1].half + 22],
    lookAt: [0, tierTop(1) + 16, CITY_TIERS[2].half],
    fov: 45,
  },
  {
    id: 'crown-sea-of-glass',
    name: 'Crown and sea of glass',
    tests: 'Pillars B/F — the aniconic summit light, the sea of glass, and the host ring; nothing built above the crown',
    anchor: 'air',
    p: [0, CITY_SUMMIT_Y + 34, 96],
    lookAt: [0, CITY_SUMMIT_Y - 4, 0],
    fov: 55,
  },
];

export interface ResolvedFraming {
  id: string;
  name: string;
  tests: string;
  /** world-space pose, ready for `__laas.setPose` */
  pose: { p: [number, number, number]; yaw: number; pitch: number; fov: number };
  tod: number;
}

/**
 * Local -> world pose. Yaw/pitch are DERIVED from the aim point, never
 * authored, so a framing cannot drift out of alignment with the thing it is
 * supposed to be looking at.
 *
 * Yaw convention (verified against FlyCamera): forward = (-sin yaw, -cos yaw),
 * so yaw 0 looks -Z (north) and positive yaw swings toward -X (west).
 *
 * `groundAt` is the scene's COMPOSED probe (terrain + river claim + city
 * floors). `ground`-anchored framings need it; without one they fall back to
 * their hint level, which is right for a CPU context that has no terrain but
 * would be wrong in the scene — so the scene always passes it.
 */
export function resolveFraming(
  f: CityFraming,
  plazaTopY: number,
  groundAt?: GroundAt,
): ResolvedFraming {
  const [lx, ly, lz] = f.p;

  const px = lx * NJ_SCALE;
  const pz = lz * NJ_SCALE;
  let py: number;
  if (f.anchor === 'air') {
    py = plazaTopY + ly * NJ_SCALE;
  } else {
    const hintY = plazaTopY + ly * NJ_SCALE + EYE_M;
    const s = groundAt?.(px, pz, hintY);
    // water guard mirrors NewJerusalemScene's own groundPose: the river
    // crosses the plaza meridian, and a framing must not stand under it
    py = s ? Math.max(s.ground + EYE_M, s.water + 0.45) : hintY;
  }

  const tx = f.lookAt[0] * NJ_SCALE;
  const ty = plazaTopY + f.lookAt[1] * NJ_SCALE;
  const tz = f.lookAt[2] * NJ_SCALE;

  const dx = tx - px;
  const dy = ty - py;
  const dz = tz - pz;
  const horiz = Math.hypot(dx, dz);

  return {
    id: f.id,
    name: f.name,
    tests: f.tests,
    pose: {
      p: [px, py, pz],
      yaw: Math.atan2(-dx, -dz),
      pitch: Math.atan2(dy, horiz),
      fov: f.fov,
    },
    tod: f.tod ?? NJ_CONFIG.look.timeOfDay,
  };
}

/** The whole set, resolved against a built scene's plaza line and probe. */
export function resolveCityFramings(plazaTopY: number, groundAt?: GroundAt): ResolvedFraming[] {
  return CITY_FRAMINGS.map((f) => resolveFraming(f, plazaTopY, groundAt));
}
