/**
 * CPU probe: the composed city review framings (src/nj/reviewFramings.ts).
 * Imports the REAL table and the REAL resolver — no mirrored copy.
 *
 * A framing is tooling, so it asserts nothing about the text; but a BROKEN
 * framing is worse than no framing, because a visual verdict then gets read
 * off a still that does not show what it claims to show. That is exactly how
 * the 2026-07-01 CITY-QUALITY-BAR poses rotted unnoticed. The checks below
 * pin the three ways a framing can lie: standing inside solid masonry (renders
 * as a black or beige plate), standing on nothing (falls through the world),
 * and aiming somewhere other than its subject.
 *
 *   npx tsx tools/probe-framings.ts
 */

import { cityBlockedLocal, wrapGroundProbeWithCityFloors } from '../src/nj/cityCollide';
import { CITY_HALF, CITY_SUMMIT_Y } from '../src/nj/cityModel';
import { NJ_SCALE } from '../src/nj/config';
import {
  CITY_FRAMINGS,
  CROWD_FRAMINGS,
  resolveCityFramings,
  resolveFraming,
} from '../src/nj/reviewFramings';
import { makeChecker } from './check';

/** every framing the resolver publishes: the digit-key core + the crowd
 *  annex (M3.6 / ADR 0019) — annex framings obey every core contract except
 *  digit-key reachability, which is A5's core-only claim */
const ALL_FRAMINGS = [...CITY_FRAMINGS, ...CROWD_FRAMINGS];

const c = makeChecker();

/** a representative built plaza line (STATUS: live plaza walk floor 483.85) */
const PLAZA_Y = 483.85;
/** the plateau the city stands on, ~2.8 m below the plaza slab it steps up to */
const PLATEAU_GROUND = PLAZA_Y - 2.8;

/**
 * A stand-in for the scene's composed probe: flat plateau terrain, no water,
 * wrapped with the REAL `wrapGroundProbeWithCityFloors`. Using the real
 * wrapper (rather than a mirrored floor lookup) is the point — it exercises
 * the same y-aware stacked-pavement claim the walker gets, so a framing whose
 * standing-level hint is wrong fails here instead of in a screenshot.
 */
const groundAt = wrapGroundProbeWithCityFloors(
  () => ({ ground: PLATEAU_GROUND, water: PLATEAU_GROUND - 50 }),
  PLAZA_Y,
  NJ_SCALE,
);

const resolved = resolveCityFramings(PLAZA_Y, groundAt);

// A — table shape
c.check('A1 nine CORE framings, mirroring the terrain bookmarks', CITY_FRAMINGS.length === 9);
c.check(
  'A2 ids are unique across core + annex',
  new Set(ALL_FRAMINGS.map((f) => f.id)).size === ALL_FRAMINGS.length,
);
c.check(
  'A3 ids are filename-safe slugs (they name the contact-sheet PNGs)',
  ALL_FRAMINGS.every((f) => /^[a-z0-9-]+$/.test(f.id)),
);
c.check(
  'A4 every framing declares what quality-bar clause it tests',
  ALL_FRAMINGS.every((f) => f.tests.trim().length > 12),
);
c.check(
  'A5 at most nine CORE framings, so the digit keys can reach them all',
  CITY_FRAMINGS.length <= 9,
);
c.check(
  'A6 the crowd annex resolves AFTER the core (?shot=1..9 semantics stable)',
  resolved.length === ALL_FRAMINGS.length &&
    resolved.slice(0, CITY_FRAMINGS.length).every((r, i) => r.id === CITY_FRAMINGS[i].id),
);

// B — resolution is total and finite
c.check('B1 all framings resolve', resolved.length === ALL_FRAMINGS.length);
c.check(
  'B2 every resolved pose is finite',
  resolved.every(
    (r) =>
      r.pose.p.every(Number.isFinite) &&
      Number.isFinite(r.pose.yaw) &&
      Number.isFinite(r.pose.pitch) &&
      Number.isFinite(r.pose.fov),
  ),
);
c.check(
  'B3 fov stays in a sane photographic band',
  resolved.every((r) => r.pose.fov >= 20 && r.pose.fov <= 90),
);
c.check(
  'B4 time of day is a real hour',
  resolved.every((r) => r.tod >= 0 && r.tod < 24),
);

// C — the camera is never inside solid geometry, and a standing framing
//     resolves to the surface it MEANT to stand on. Both are checked in LOCAL
//     units against the same owner tables the massing and collision consume.
for (const f of ALL_FRAMINGS) {
  const r = resolveFraming(f, PLAZA_Y, groundAt);
  const lx = r.pose.p[0] / NJ_SCALE;
  const lz = r.pose.p[2] / NJ_SCALE;
  const ly = (r.pose.p[1] - PLAZA_Y) / NJ_SCALE;
  c.check(
    `C1 ${f.id}: camera is not inside solid massing`,
    !cityBlockedLocal(lx, lz, ly),
    `local (${lx.toFixed(1)}, ${ly.toFixed(1)}, ${lz.toFixed(1)})`,
  );
  if (f.anchor === 'ground') {
    // The framing's y is a hint, not a height. It is honoured when the probe
    // agrees; the failure this catches is a hint that lands the camera on a
    // DIFFERENT pavement than intended — e.g. terrace-pavement silently
    // dropping 1,160 m to the plaza slab if tier heights are retuned.
    const eyeAbove = (ly - f.p[1]) * NJ_SCALE;
    c.check(
      `C2 ${f.id}: stands within a step of its intended level`,
      Math.abs(eyeAbove) <= 3.5 + 1.7,
      `resolved ${eyeAbove.toFixed(2)} m from the hint`,
    );
    c.check(
      `C3 ${f.id}: eye is above whatever it stands on, never inside it`,
      r.pose.p[1] > groundAt(r.pose.p[0], r.pose.p[2], r.pose.p[1]).ground,
    );
  }
}

// D — aim. Yaw/pitch are derived, so what is worth pinning is that the
//     derivation is right and that no framing aims at the point it occupies.
c.check(
  'D1 no framing is degenerate (camera coincident with its aim point)',
  ALL_FRAMINGS.every((f) => {
    const r = resolveFraming(f, PLAZA_Y);
    const d = Math.hypot(
      f.lookAt[0] * NJ_SCALE - r.pose.p[0],
      f.lookAt[2] * NJ_SCALE - r.pose.p[2],
    );
    return d > 1;
  }),
);
{
  // FlyCamera's convention: forward = (-sin yaw, -cos yaw). A camera due south
  // of the city aiming at the axis must therefore read yaw 0 (looking north).
  const south = resolveFraming(
    {
      id: 'probe-south',
      name: 'probe',
      tests: 'probe fixture',
      anchor: 'air',
      p: [0, 50, 300],
      lookAt: [0, 50, 0],
      fov: 55,
    },
    PLAZA_Y,
  );
  c.check('D2 due-south framing derives yaw 0 (looking north)', Math.abs(south.pose.yaw) < 1e-9);
  c.check('D3 level aim derives pitch 0', Math.abs(south.pose.pitch) < 1e-9);

  // Positive yaw swings toward -X (west): a camera due EAST of the axis aiming
  // back at it looks west, which is +PI/2 under this convention.
  const east = resolveFraming(
    {
      id: 'probe-east',
      name: 'probe',
      tests: 'probe fixture',
      anchor: 'air',
      p: [300, 50, 0],
      lookAt: [0, 50, 0],
      fov: 55,
    },
    PLAZA_Y,
  );
  c.check(
    'D4 due-east framing derives yaw +PI/2 (looking west)',
    Math.abs(east.pose.yaw - Math.PI / 2) < 1e-9,
    `got ${east.pose.yaw.toFixed(6)}`,
  );

  // Aiming above the camera must give POSITIVE pitch (the scene's own
  // arrival-meadow target uses pitch +0.22 to tilt up at the summit).
  const up = resolveFraming(
    {
      id: 'probe-up',
      name: 'probe',
      tests: 'probe fixture',
      anchor: 'air',
      p: [0, 10, 300],
      lookAt: [0, 160, 0],
      fov: 55,
    },
    PLAZA_Y,
  );
  c.check('D5 aiming upward derives positive pitch', up.pose.pitch > 0);
}

// E — every framing actually points at the city. A framing that has drifted
//     off the subject is the specific failure this file exists to prevent.
for (const f of ALL_FRAMINGS) {
  c.check(
    `E1 ${f.id}: aims within the city footprint and below the crown`,
    Math.max(Math.abs(f.lookAt[0]), Math.abs(f.lookAt[2])) <= CITY_HALF + 8 &&
      f.lookAt[1] >= -8 &&
      f.lookAt[1] <= CITY_SUMMIT_Y + 8,
    `lookAt ${f.lookAt.join(',')}`,
  );
}

// F — the set covers the bar rather than nine views of one thing.
{
  const anchors = new Set(CITY_FRAMINGS.map((f) => f.anchor));
  c.check('F1 the set mixes aerial and walk-level framings', anchors.size === 2);
  const maxRange = Math.max(
    ...CITY_FRAMINGS.map((f) => Math.hypot(f.p[0], f.p[2]) * NJ_SCALE),
  );
  const minRange = Math.min(
    ...CITY_FRAMINGS.map((f) => Math.hypot(f.p[0], f.p[2]) * NJ_SCALE),
  );
  c.check('F2 the set spans a far read (>= 8 km out)', maxRange >= 8000, `${maxRange.toFixed(0)} m`);
  c.check(
    'F3 the set includes an interior read (inside the wall line)',
    minRange < CITY_HALF * NJ_SCALE,
    `${minRange.toFixed(0)} m`,
  );
}

c.finish();
