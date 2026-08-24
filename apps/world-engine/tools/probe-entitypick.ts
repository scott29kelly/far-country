/**
 * CPU contract probe for the entity pick registry (roadmap M3.4) — no
 * browser, no GPU, no dev server. Verifies:
 *
 *  A. the volume TABLE derives correctly from the shared owner tables
 *     (twelve gates in Ezekiel 48:30-34 order with compass labels, twelve
 *     foundation bands in ESV Rev 21:19-20 gem order, one volume per river
 *     reach, the temple at its measured 500-cubit precinct);
 *  B. the RESOLVER picks the right entity for authored rays (gate beats
 *     wall on the shared entry face, foundation course at base height,
 *     wall above the course, throne sphere, sea of glass from the side,
 *     river, tree station, street of gold, tier mass, temple), refuses
 *     sky rays, and honors terrain occlusion;
 *  C. the DATA MAPPING is real: every slug the registry references exists
 *     as a canonical per-entity export with >= 1 cited descriptor, valid
 *     tiers, and a symbolic_referent wherever tier === symbolic — the
 *     no-invented-descriptors guarantee;
 *  D. the citation display grammar matches the legacy DescriptorHud.
 *
 *   npx tsx tools/probe-entitypick.ts
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

const { buildEntityPicks, nearestEntityAt, pickEntityAt } = await import('../src/nj/entityPicks');
const { FOUNDATION_GEMS, GATES, SIDE_COMPASS, CITY_SUMMIT_Y, foundationCourseSpans } =
  await import('../src/nj/cityModel');
const { riverReaches } = await import('../src/nj/RiverOfLife');
const { formatCitation } = await import('../src/core/EntityHud');

const c = makeChecker();

/** Rev 21:19-20 (ESV), first through twelfth foundation: jasper, sapphire,
 *  agate, emerald, onyx, carnelian, chrysolite, beryl, topaz, chrysoprase,
 *  jacinth, amethyst. Transcribed from the TEXT, deliberately NOT imported
 *  from cityModel — FC-0022: the old A2 compared the scene labels against
 *  FOUNDATION_GEMS itself, so an engine-side gem rename moved both sides of
 *  the assertion and the check could not fail. This list is the independent
 *  anchor; capitalisation matches the engine's display style. */
const ESV_FOUNDATION_ORDER = [
  'Jasper', 'Sapphire', 'Agate', 'Emerald', 'Onyx', 'Carnelian',
  'Chrysolite', 'Beryl', 'Topaz', 'Chrysoprase', 'Jacinth', 'Amethyst',
] as const;

// ---- fixture: flat meadow below a plaza at 470 -----------------------------
const PLAZA_Y = 470;
const GROUND = 460;
const flat = (): number => GROUND;
const vols = buildEntityPicks(PLAZA_Y, flat);

// FC-0005 guard: an empty registry would make section C run zero checks and
// pass vacuously. Nothing to measure is UNMEASURED, never a pass.
if (vols.length === 0) {
  c.unmeasured('fixture', 'buildEntityPicks returned zero volumes — nothing to measure');
  c.finish();
}

// ---- A: table shape --------------------------------------------------------
const gateVols = vols.filter((v) => v.slug === 'gates-of-pearl');
c.check(
  'A1 twelve gates, Ezekiel 48:30-34 order with compass labels',
  gateVols.length === 12 &&
    gateVols.every(
      (v, i) => v.label === `${GATES[i].tribe} Gate · ${SIDE_COMPASS[GATES[i].side]}`,
    ),
  `first=${gateVols[0]?.label} last=${gateVols[11]?.label}`,
);

const gemVols = vols.filter((v) => v.slug === 'twelve-jeweled-foundations');
const gemLabelOrder = [...new Set(gemVols.map((v) => v.label))];
const spansPerSide = foundationCourseSpans().length;
c.check(
  'A2 foundation course: gate-notched spans, twelve gems in Rev 21:19-20 ESV order',
  gemVols.length === 4 * spansPerSide &&
    gemLabelOrder.length === 12 &&
    gemLabelOrder.every((l, i) => l === `Foundation · ${ESV_FOUNDATION_ORDER[i]}`),
  `${gemVols.length} spans (${spansPerSide}/side), first=${gemLabelOrder[0]} last=${gemLabelOrder[11]}`,
);
c.check(
  'A2b engine gem table matches the Rev 21:19-20 ESV order',
  FOUNDATION_GEMS.length === 12 &&
    FOUNDATION_GEMS.every((g, i) => g.name === ESV_FOUNDATION_ORDER[i]),
  `table: ${FOUNDATION_GEMS.map((g) => g.name).join(', ')}`,
);

const riverVols = vols.filter((v) => v.slug === 'river-of-the-water-of-life');
c.check(
  'A3 one river volume per authored reach',
  riverVols.length === riverReaches().length,
  `${riverVols.length} vs ${riverReaches().length} reaches`,
);

const temple = vols.find((v) => v.slug === 'sanctuary-in-the-midst');
const templeHalf =
  temple && temple.shape.kind === 'aabb' ? (temple.shape.max[0] - temple.shape.min[0]) / 2 : 0;
c.check(
  'A4 temple precinct at the measured 500 long cubits per side',
  Math.abs(templeHalf - (500 * 0.525) / 2) < 1e-6,
  `half=${templeHalf} m`,
);

// ---- B: resolver -----------------------------------------------------------
type V3 = [number, number, number];
const pick = (o: V3, d: V3, terrain: (x: number, z: number) => number = flat) =>
  pickEntityAt(o, d, vols, terrain);

const south = (y: number): V3 => [0, PLAZA_Y + y, 3000];
const north: V3 = [0, 0, -1];

const b1 = pick(south(40), north);
c.check(
  'B1 gate opening beats the wall on the shared face',
  b1?.label === 'Issachar Gate · S',
  `got ${b1?.label ?? 'null'}`,
);

const b2 = pick([500, PLAZA_Y + 40, 3000], north);
c.check(
  'B2 foundation course at base height (south-centre band = Beryl)',
  b2?.label === 'Foundation · Beryl',
  `got ${b2?.label ?? 'null'}`,
);

const b3 = pick([500, PLAZA_Y + 150, 3000], north);
c.check(
  'B3 wall above the course top',
  b3?.slug === 'jasper-wall-and-gold-city' && b3.label === 'Jasper Wall · S',
  `got ${b3?.label ?? 'null'}`,
);

const gloryY = PLAZA_Y + (CITY_SUMMIT_Y + 10) * 20;
const b4 = pick([0, gloryY, 2000], north);
c.check('B4 summit glory picks the throne', b4?.slug === 'throne-of-god', `got ${b4?.slug}`);

const seaY = PLAZA_Y + CITY_SUMMIT_Y * 20;
const b5 = pick([2000, seaY + 10, 0], [-1, 0, 0]);
c.check('B5 sea of glass from the side', b5?.slug === 'sea-of-glass', `got ${b5?.slug}`);

const b6 = pick([0, PLAZA_Y + 500, 3000], [0, -1, 0]);
c.check(
  'B6 approach channel picks the river',
  b6?.slug === 'river-of-the-water-of-life',
  `got ${b6?.slug ?? 'null'}`,
);

const b7 = pick([150, PLAZA_Y + 300, 2450], [0, -1, 0]);
c.check('B7 tree station picks the tree of life', b7?.slug === 'tree-of-life', `got ${b7?.slug}`);

const b8 = pick([1900, PLAZA_Y + 2000, 0], [0, -1, 0]);
c.check(
  'B8 plaza inside the wall picks the street of gold',
  b8?.slug === 'street-of-gold',
  `got ${b8?.slug ?? 'null'}`,
);

const b9 = pick([3000, PLAZA_Y + 800, 0], [-1, 0, 0]);
c.check('B9 tier face picks the city', b9?.slug === 'new-jerusalem', `got ${b9?.slug ?? 'null'}`);

const b10 = pick([0, GROUND + 1000, -5600], [0, -1, 0]);
c.check(
  'B10 temple compound picks the sanctuary zone',
  b10?.slug === 'sanctuary-in-the-midst',
  `got ${b10?.slug ?? 'null'}`,
);

const ridge = (_x: number, z: number): number => (z > 2500 && z < 2600 ? 6000 : GROUND);
const b11 = pick([0, PLAZA_Y + 130, 3000], north, ridge);
c.check('B11 terrain occludes a pick behind a ridge', b11 === null, `got ${b11?.label ?? 'null'}`);

const b12 = pick([0, PLAZA_Y + 5, 4000], [0, 1, 0]);
c.check('B12 sky ray picks nothing', b12 === null, `got ${b12?.slug ?? 'null'}`);

const b13 = pick([1200, GROUND + 800, -5300], [0, -1, 0]);
c.check(
  'B13 east dwelling band picks the priests’ portion',
  b13?.slug === 'priests-portion',
  `got ${b13?.slug ?? 'null'}`,
);

const b14 = pick([0, GROUND + 800, -7000], [0, -1, 0]);
c.check(
  'B14 far dwelling band picks the Levites’ portion',
  b14?.slug === 'levites-portion',
  `got ${b14?.slug ?? 'null'}`,
);

// the meridian lane is clear of campus volumes: a walker-height ray down the
// city -> temple axis reaches the temple compound, not a campus face
const b15 = pick([0, GROUND + 8, -4600], north);
c.check(
  'B15 meridian lane ray reaches the temple through the campus',
  b15?.slug === 'sanctuary-in-the-midst',
  `got ${b15?.slug ?? 'null'}`,
);

// ---- N: proximity resolver (the walk-mode auto-card) -----------------------
const n1 = nearestEntityAt([1000, PLAZA_Y + 30, 2000], vols);
c.check('N1 gate corridor: the gate beats street and wall', n1?.label === 'Zebulun Gate · S', `got ${n1?.label ?? 'null'}`);

const n2 = nearestEntityAt([300, PLAZA_Y + 2, 1000], vols); // walker eye height
c.check('N2 plaza interior: the street of gold', n2?.slug === 'street-of-gold', `got ${n2?.slug ?? 'null'}`);

const n3 = nearestEntityAt([150, GROUND + 2, 2450], vols);
c.check('N3 tree trunk: the tree of life', n3?.slug === 'tree-of-life', `got ${n3?.slug ?? 'null'}`);

const n4 = nearestEntityAt([300, GROUND + 2, 2300], vols);
c.check('N4 open meadow: nothing near', n4 === null, `got ${n4?.slug ?? 'null'}`);

const n5 = nearestEntityAt([0, PLAZA_Y + 3, 3000], vols);
c.check('N5 wading the channel: the river', n5?.slug === 'river-of-the-water-of-life', `got ${n5?.slug ?? 'null'}`);

const n6 = nearestEntityAt([800, GROUND + 2, -5500], vols);
c.check(
  'N6 walking the east band: the priests’ portion',
  n6?.slug === 'priests-portion',
  `got ${n6?.slug ?? 'null'}`,
);

// ---- C: every registry slug is a real, cited canonical entity --------------
// Grounding = at least one cited DESCRIPTOR or one cited MEASUREMENT (ADR
// 0017: the campus zone entities carry measurements before any descriptor).
const slugs = [...new Set(vols.map((v) => v.slug))];
const dataDir = join(import.meta.dirname, '..', '..', 'web', 'public', 'data', 'entities');
const TIERS = new Set(['clear', 'fuzzy', 'debated', 'symbolic']);
for (const slug of slugs) {
  let ok = false;
  let detail = '';
  try {
    const entity = JSON.parse(readFileSync(join(dataDir, `${slug}.json`), 'utf8')) as {
      id: string;
      name: string;
      descriptors: {
        tier: string;
        statement: string;
        symbolic_referent?: string | null;
        citations: unknown[];
      }[];
      measurements?: { tier: string; subject: string; citations: unknown[] }[];
    };
    const ds = entity.descriptors;
    const ms = entity.measurements ?? [];
    ok =
      entity.id === slug &&
      ds.length + ms.length >= 1 &&
      ds.every(
        (d) =>
          d.citations.length >= 1 &&
          TIERS.has(d.tier) &&
          (d.tier !== 'symbolic' || Boolean(d.symbolic_referent)),
      ) &&
      ms.every((m) => m.citations.length >= 1 && TIERS.has(m.tier));
    detail = `${entity.name}: ${ds.length} descriptor(s), ${ms.length} measurement(s)`;
  } catch (e) {
    detail = String(e);
  }
  c.check(`C  ${slug} exists with cited claims`, ok, detail);
}

// ---- D: citation display grammar (legacy DescriptorHud parity) -------------
c.check(
  'D1 scripture verse range',
  formatCitation({ source_type: 'scripture', book: 'Revelation', chapter: 21, verse_start: 19, verse_end: 20 }) === 'Revelation 21:19-20',
);
c.check(
  'D2 scripture single verse collapses',
  formatCitation({ source_type: 'scripture', book: 'Revelation', chapter: 22, verse_start: 1, verse_end: 1 }) === 'Revelation 22:1',
);
c.check(
  'D3 scripture chapter only',
  formatCitation({ source_type: 'scripture', book: 'Ezekiel', chapter: 48 }) === 'Ezekiel 48',
);
c.check(
  'D4 willis pages',
  formatCitation({ source_type: 'willis', willis_chapter: '7', willis_page_start: 88, willis_page_end: 91 }) === 'Willis 7 p.88-91',
);
c.check(
  'D5 secondary falls back to the work',
  formatCitation({ source_type: 'secondary', secondary_work: '4Q554' }) === '4Q554',
);

// 31 = A(4) + B(15) + N(6) + D(5) fixed checks + at least one C slug row
c.finish({ minChecks: 31 });
