/**
 * CPU contract probe for the reading-key marker model (roadmap M3.5) — no
 * browser, no GPU, no dev server. Verifies:
 *
 *  A. COVERAGE — the marker slug set EQUALS the pick registry's slug set
 *     (one marker per cited slug: nothing unpickable gets a marker, nothing
 *     pickable is missing from the key), markers are unique per slug and
 *     finite;
 *  B. PLACEMENT — every marker anchors on/near a pick volume of its OWN
 *     slug (within a tight tolerance), the gate marker sits over the middle
 *     south gate on the wall line, and the throne marker is inside the glory
 *     sphere;
 *  C. DATA MAPPING — every marked slug's canonical export exists with >= 1
 *     descriptor whose tiers are valid (the key can only ever display real
 *     dataset tiers).
 *
 *   npx tsx tools/probe-visualkey.ts
 */

export {}; // top-level await needs module context

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeChecker } from './check';

// minimal window shim: WorldConst/others read location.search when defined
Object.defineProperty(globalThis, 'window', {
  value: { location: { search: '?scene=newjerusalem' }, addEventListener() {} },
  configurable: true,
});

const { keyMarkers } = await import('../src/nj/keyModel');
const { buildEntityPicks } = await import('../src/nj/entityPicks');
const { CITY_HALF, GATES } = await import('../src/nj/cityModel');
const { NJ_SCALE } = await import('../src/nj/rimModel');
type PickShape = import('../src/nj/entityPicks').PickShape;

const c = makeChecker();

// ---- fixture: flat meadow below a plaza at 470 (probe-entitypick's) --------
const PLAZA_Y = 470;
const GROUND = 460;
const flat = (): number => GROUND;
const markers = keyMarkers(PLAZA_Y, flat);
const vols = buildEntityPicks(PLAZA_Y, flat);

// ---- A: coverage -----------------------------------------------------------
const markerSlugs = new Set(markers.map((m) => m.slug));
const pickSlugs = new Set(vols.map((v) => v.slug));
c.check(
  'A1 one marker per slug, unique',
  markers.length === markerSlugs.size,
  `${markers.length} markers, ${markerSlugs.size} slugs`,
);
const missing = [...pickSlugs].filter((s) => !markerSlugs.has(s));
const extra = [...markerSlugs].filter((s) => !pickSlugs.has(s));
c.check(
  'A2 marker slug set equals the pick registry slug set',
  missing.length === 0 && extra.length === 0,
  `missing=[${missing.join(',')}] extra=[${extra.join(',')}]`,
);
c.check(
  'A3 all anchors finite',
  markers.every((m) => m.p.every((v) => Number.isFinite(v))),
);
c.check(
  'A4 every marker has a nonempty fallback label',
  markers.every((m) => m.label.length > 0),
);

// ---- B: placement ----------------------------------------------------------
function distToShape(p: [number, number, number], s: PickShape): number {
  if (s.kind === 'aabb') {
    const dx = Math.max(s.min[0] - p[0], 0, p[0] - s.max[0]);
    const dy = Math.max(s.min[1] - p[1], 0, p[1] - s.max[1]);
    const dz = Math.max(s.min[2] - p[2], 0, p[2] - s.max[2]);
    return Math.hypot(dx, dy, dz);
  }
  if (s.kind === 'sphere') {
    return Math.max(0, Math.hypot(p[0] - s.c[0], p[1] - s.c[1], p[2] - s.c[2]) - s.r);
  }
  const dr = Math.max(0, Math.hypot(p[0] - s.x, p[2] - s.z) - s.r);
  const dy = Math.max(s.y0 - p[1], 0, p[1] - s.y1);
  return Math.hypot(dr, dy);
}

/** a marker may float a little above its volume so it reads over geometry */
const PLACE_TOL_M = 120;
let worst = { slug: '', d: 0 };
for (const m of markers) {
  const d = Math.min(
    ...vols.filter((v) => v.slug === m.slug).map((v) => distToShape(m.p, v.shape)),
  );
  if (d > worst.d) worst = { slug: m.slug, d };
}
c.check(
  `B1 every marker within ${PLACE_TOL_M} m of its own slug's volume`,
  worst.d <= PLACE_TOL_M,
  `worst=${worst.slug} at ${worst.d.toFixed(1)} m`,
);

const gateMarker = markers.find((m) => m.slug === 'gates-of-pearl');
const southMid = [...GATES]
  .filter((g) => g.side === 'south')
  .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0];
c.check(
  'B2 gate marker over the middle south gate on the wall line',
  gateMarker !== undefined &&
    gateMarker.p[0] === southMid.offset * NJ_SCALE &&
    gateMarker.p[2] === CITY_HALF * NJ_SCALE,
  `p=${gateMarker?.p.join(',')}`,
);

const throneMarker = markers.find((m) => m.slug === 'throne-of-god');
const throneVol = vols.find((v) => v.slug === 'throne-of-god');
c.check(
  'B3 throne marker inside the glory sphere',
  throneMarker !== undefined &&
    throneVol !== undefined &&
    distToShape(throneMarker.p, throneVol.shape) === 0,
);

// ---- C: data mapping -------------------------------------------------------
const dataDir = join(import.meta.dirname, '..', '..', 'web', 'public', 'data', 'entities');
const VALID_TIERS = new Set(['clear', 'fuzzy', 'debated', 'symbolic']);
let dataOk = true;
let dataMsg = '';
for (const slug of markerSlugs) {
  try {
    const entity = JSON.parse(readFileSync(join(dataDir, `${slug}.json`), 'utf8')) as {
      name?: string;
      descriptors?: { tier?: string }[];
    };
    const ds = entity.descriptors ?? [];
    if (!entity.name || ds.length === 0 || ds.some((d) => !VALID_TIERS.has(d.tier ?? ''))) {
      dataOk = false;
      dataMsg = `${slug}: name/descriptors/tiers invalid`;
      break;
    }
  } catch {
    dataOk = false;
    dataMsg = `${slug}: export missing`;
    break;
  }
}
c.check('C1 every marked slug has a named export with valid-tier descriptors', dataOk, dataMsg);

c.finish();
