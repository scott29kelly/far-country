/**
 * Collision geometry for the placeholder city.
 *
 * Modeled as 2D axis-aligned rectangles in the X-Z plane (Y is ignored —
 * the city is short enough that we don't need vertical layers for the MVP).
 *
 * Resolution strategy: when the player moves from a position they were
 * already in to a candidate position, we resolve each axis independently —
 * if the X step lands inside a blocker, we revert X; same for Z. This
 * gives smooth wall-sliding without needing real physics, and matches the
 * feel of classic first-person walkers.
 *
 * Why not derive blockers from the wall segments in CityShell.tsx? The
 * wall segments are 3D box meshes; replicating their X-Z footprints here
 * keeps collision deterministic and decoupled from any future visual
 * refactor (e.g., when we replace the boxes with proper extruded geometry).
 */
import {
  CITY_HALF,
  GATE_WIDTH,
  WALL_THICKNESS,
} from "./points-of-interest";

export type Rect = {
  /** Inclusive min on X. */
  minX: number;
  /** Inclusive max on X. */
  maxX: number;
  /** Inclusive min on Z. */
  minZ: number;
  /** Inclusive max on Z. */
  maxZ: number;
};

/** Player radius in metres — keeps the camera from clipping the inside of walls. */
export const PLAYER_RADIUS = 0.6;

/** Throne footprint. Slightly larger than the base so you don't bump into it. */
const THRONE_HALF = 9.5;

const GATE_OFFSETS: number[] = [-50, 0, 50];

/**
 * For a side of length 2 * CITY_HALF with gates at GATE_OFFSETS, return
 * the spans (start, end) of solid wall segments along that side.
 */
function wallSpans(): Array<[number, number]> {
  const half = CITY_HALF;
  const halfGate = GATE_WIDTH / 2;
  const cutouts = [...GATE_OFFSETS]
    .sort((a, b) => a - b)
    .map((o) => [o - halfGate, o + halfGate] as const);
  const spans: Array<[number, number]> = [];
  let cursor = -half;
  for (const [s, e] of cutouts) {
    if (s > cursor) spans.push([cursor, s]);
    cursor = e;
  }
  if (cursor < half) spans.push([cursor, half]);
  return spans;
}

/**
 * All solid wall+throne rectangles in the X-Z plane. Each wall span on each
 * side becomes one rectangle, plus the throne footprint.
 *
 * Wall thickness is grown by PLAYER_RADIUS on every face so we never clip
 * inside a wall in the first place.
 */
export function buildBlockers(): Rect[] {
  const spans = wallSpans();
  const r = PLAYER_RADIUS;
  const t = WALL_THICKNESS / 2 + r;
  const rects: Rect[] = [];

  // North wall (Z = -CITY_HALF), spans are X intervals.
  for (const [a, b] of spans) {
    rects.push({
      minX: a - r,
      maxX: b + r,
      minZ: -CITY_HALF - t,
      maxZ: -CITY_HALF + t,
    });
  }
  // South wall (Z = +CITY_HALF).
  for (const [a, b] of spans) {
    rects.push({
      minX: a - r,
      maxX: b + r,
      minZ: CITY_HALF - t,
      maxZ: CITY_HALF + t,
    });
  }
  // East wall (X = +CITY_HALF), spans are Z intervals.
  for (const [a, b] of spans) {
    rects.push({
      minX: CITY_HALF - t,
      maxX: CITY_HALF + t,
      minZ: a - r,
      maxZ: b + r,
    });
  }
  // West wall (X = -CITY_HALF).
  for (const [a, b] of spans) {
    rects.push({
      minX: -CITY_HALF - t,
      maxX: -CITY_HALF + t,
      minZ: a - r,
      maxZ: b + r,
    });
  }
  // Throne (axis-aligned square at origin).
  rects.push({
    minX: -THRONE_HALF - r,
    maxX: THRONE_HALF + r,
    minZ: -THRONE_HALF - r,
    maxZ: THRONE_HALF + r,
  });

  return rects;
}

export const BLOCKERS: Rect[] = buildBlockers();

export function inside(rect: Rect, x: number, z: number): boolean {
  return x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
}

export function anyBlockerContains(
  rects: Rect[],
  x: number,
  z: number,
): boolean {
  for (const r of rects) if (inside(r, x, z)) return true;
  return false;
}
