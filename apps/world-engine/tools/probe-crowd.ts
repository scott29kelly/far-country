/**
 * CPU contract probe for the ADR 0019 multitude rebuild (M3.6 attack plan
 * steps 1-2) — no browser, no GPU, no dev server. The GPU can only be judged
 * on hardware; everything ANALYTIC about the crowd is guarded here:
 *
 *  A. the FIGURE PARAMETER MODEL: deterministic per-figure params, every
 *     archetype actually present at near its authored weight, the diversity
 *     axes (skin/hair) spanning their full ranges — ADR 0019 rule 2 as a
 *     testable property, not a hope;
 *  B. the GENERATOR: both LOD meshes build headless for every archetype,
 *     stay under their triangle ceilings, keep feet at the origin, carry
 *     all four material regions (robe/skin/hair/frond), and LOD1 keeps the
 *     same identity envelope as LOD0 (height within a few %);
 *  C. the BUDGET (the attack plan's binding constraint): using the REAL
 *     placements, the worst-case on-screen triangle load — densest possible
 *     R0 disc + densest R1 disc + every remaining figure as an impostor —
 *     stays under CROWD_LOD.trisBudget, and every compact-region capacity
 *     covers its worst-case count with margin (a clipped cap silently
 *     drops figures);
 *  D. the IMPOSTOR path inputs: baked capture colors in gamut, the far
 *     ring's capacity covering the whole multitude.
 *
 *   npx tsx tools/probe-crowd.ts
 */

export {}; // top-level await needs module context

import { makeChecker } from './check';

Object.defineProperty(globalThis, 'window', {
  value: { location: { search: '?scene=newjerusalem' }, addEventListener() {} },
  configurable: true,
});

const {
  ARCHETYPE_WEIGHTS,
  CROWD_LOD,
  FIGURE_ARCHETYPES,
  figureModelInvariants,
  figureParams,
} = await import('../src/nj/figureModel');
const { bakeRegionColors, buildFigureGeometry } = await import('../src/nj/FigureMesh');
const { multitudePlacements, assemblyVolumes } = await import('../src/nj/populationModel');
const { NJ_SCALE } = await import('../src/nj/rimModel');

const c = makeChecker();
const V = FIGURE_ARCHETYPES.length;
const placements = multitudePlacements();
const N = placements.length;

// ---- A: parameter model -------------------------------------------------------

const params = placements.map((_, i) => figureParams(i));
{
  const again = placements.map((_, i) => figureParams(i));
  const same = params.every(
    (p, i) =>
      p.variant === again[i].variant &&
      p.skin01 === again[i].skin01 &&
      p.hair01 === again[i].hair01 &&
      p.warm01 === again[i].warm01 &&
      p.widthJ === again[i].widthJ,
  );
  c.check('A1 figure params are deterministic (fixed seed, index-keyed)', same);
}

const inv = figureModelInvariants();
c.check('A2 model invariants: weights, palettes, bloom worst case', inv.ok, inv.detail);

{
  const counts = new Array<number>(V).fill(0);
  for (const p of params) counts[p.variant]++;
  const allPresent = counts.every((n) => n > 0);
  let worstDrift = 0;
  for (let v = 0; v < V; v++) {
    worstDrift = Math.max(worstDrift, Math.abs(counts[v] / N - ARCHETYPE_WEIGHTS[v]));
  }
  c.check(
    'A3 every archetype present at ~its authored weight',
    allPresent && worstDrift < 0.02,
    `counts ${counts.join('/')}, worst drift ${(worstDrift * 100).toFixed(2)}%`,
  );
}

{
  // diversity axes actually span their ranges (rule 2 is a property here):
  // both tails of the skin/hair ramps are populated
  const lo = (xs: number[]): number => xs.filter((x) => x < 0.2).length / xs.length;
  const hi = (xs: number[]): number => xs.filter((x) => x > 0.8).length / xs.length;
  const skins = params.map((p) => p.skin01);
  const hairs = params.map((p) => p.hair01);
  c.check(
    'A4 skin/hair parameters populate both ends of their ramps',
    lo(skins) > 0.12 && hi(skins) > 0.12 && lo(hairs) > 0.12 && hi(hairs) > 0.12,
    `skin tails ${(lo(skins) * 100).toFixed(0)}%/${(hi(skins) * 100).toFixed(0)}%, hair ${(lo(hairs) * 100).toFixed(0)}%/${(hi(hairs) * 100).toFixed(0)}%`,
  );
}

// ---- B: generator ---------------------------------------------------------------

// lod0 carries the vendored eye region (4) too — asserted separately in E
const REGIONS = [0, 1, 2, 3];
let tris0Max = 0;
let tris1Max = 0;
{
  let ok = true;
  let detail = '';
  for (let v = 0; v < V && ok; v++) {
    const a = FIGURE_ARCHETYPES[v];
    for (const lod of [0, 1] as const) {
      const g = buildFigureGeometry(a, lod);
      const tris = (g.index ? g.index.count : 0) / 3;
      if (lod === 0) tris0Max = Math.max(tris0Max, tris);
      else tris1Max = Math.max(tris1Max, tris);
      const ceil = lod === 0 ? CROWD_LOD.tris0Max : CROWD_LOD.tris1Max;
      g.computeBoundingBox();
      const bb = g.boundingBox;
      const region = g.getAttribute('aregion');
      const present = new Set<number>();
      for (let i = 0; i < region.count; i++) present.add(region.getX(i));
      const missing = REGIONS.filter((r) => !present.has(r));
      if (tris > ceil) {
        ok = false;
        detail = `${a.name} lod${lod}: ${tris} tris > ceiling ${ceil}`;
      } else if (!bb || bb.min.y < -1e-4 || bb.min.y > 0.03 * a.height) {
        ok = false;
        detail = `${a.name} lod${lod}: feet not at origin (minY ${bb?.min.y.toFixed(4)})`;
      } else if (bb.max.y < a.height * 0.98 || bb.max.y > a.height * 1.7) {
        // top of the envelope is the RAISED FROND, not the head — overhead
        // reach + branch ≈ 1.6×height; past 1.7 the pose arithmetic broke
        ok = false;
        detail = `${a.name} lod${lod}: envelope top ${bb.max.y.toFixed(2)} vs height ${a.height}`;
      } else if (missing.length > 0) {
        ok = false;
        detail = `${a.name} lod${lod}: missing regions ${missing.join(',')}`;
      }
      if (!ok) break;
    }
  }
  c.check(
    'B1 both LODs build for every archetype: tri ceilings, feet at origin, all regions',
    ok,
    ok ? `worst lod0 ${tris0Max} tris, lod1 ${tris1Max} tris` : detail,
  );
}

{
  // LOD identity: the two tiers of one archetype agree on the body envelope
  let ok = true;
  let detail = '';
  for (let v = 0; v < V && ok; v++) {
    const a = FIGURE_ARCHETYPES[v];
    const g0 = buildFigureGeometry(a, 0);
    const g1 = buildFigureGeometry(a, 1);
    g0.computeBoundingBox();
    g1.computeBoundingBox();
    const t0 = g0.boundingBox?.max.y ?? 0;
    const t1 = g1.boundingBox?.max.y ?? 0;
    if (Math.abs(t0 - t1) > 0.06 * a.height) {
      ok = false;
      detail = `${a.name}: lod0 top ${t0.toFixed(2)} vs lod1 ${t1.toFixed(2)}`;
    }
  }
  c.check('B2 LOD tiers keep the same identity envelope', ok, detail);
}

// ---- C: budgets against the REAL placements -------------------------------------

/** max count of figures within radius R (world m) of any candidate centre —
 *  grid-bucketed exact circle counts; candidates are every figure plus every
 *  assembly centroid (a camera can stand anywhere; these dominate) */
function worstDiscCount(radiusW: number, perVariant: false): number;
function worstDiscCount(radiusW: number, perVariant: true): number[];
function worstDiscCount(radiusW: number, perVariant: boolean): number | number[] {
  const S = NJ_SCALE;
  const pts = placements.map((p, i) => ({
    x: p.x * S,
    z: p.z * S,
    v: params[i].variant,
  }));
  const cell = radiusW;
  const grid = new Map<string, typeof pts>();
  for (const p of pts) {
    const k = `${Math.floor(p.x / cell)},${Math.floor(p.z / cell)}`;
    let b = grid.get(k);
    if (!b) {
      b = [];
      grid.set(k, b);
    }
    b.push(p);
  }
  const centres = [
    ...pts,
    ...assemblyVolumes().map((v) => ({ x: v.x * S, z: v.z * S, v: -1 })),
  ];
  let worstTotal = 0;
  const worstVar = new Array<number>(V).fill(0);
  const r2 = radiusW * radiusW;
  const varCount = new Array<number>(V).fill(0);
  for (const ctr of centres) {
    let total = 0;
    varCount.fill(0);
    const cx = Math.floor(ctr.x / cell);
    const cz = Math.floor(ctr.z / cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const b = grid.get(`${cx + dx},${cz + dz}`);
        if (!b) continue;
        for (const p of b) {
          const ddx = p.x - ctr.x;
          const ddz = p.z - ctr.z;
          if (ddx * ddx + ddz * ddz <= r2) {
            total++;
            varCount[p.v]++;
          }
        }
      }
    }
    if (total > worstTotal) worstTotal = total;
    for (let v = 0; v < V; v++) {
      if (varCount[v] > worstVar[v]) worstVar[v] = varCount[v];
    }
  }
  return perVariant ? worstVar : worstTotal;
}

const worstR0 = worstDiscCount(CROWD_LOD.r0Far + CROWD_LOD.band0, false);
const worstR1 = worstDiscCount(CROWD_LOD.r1Far + CROWD_LOD.band1, false);
{
  // worst case: densest near disc at full LOD0 + densest mid disc at LOD1 +
  // EVERY figure as an impostor (aerial view) — all simultaneously
  const worstTris = worstR0 * tris0Max + worstR1 * tris1Max + N * 2;
  c.check(
    'C1 worst-case on-screen triangles under the attack-plan budget',
    worstTris <= CROWD_LOD.trisBudget,
    `${worstR0}×${tris0Max} + ${worstR1}×${tris1Max} + ${N}×2 = ${worstTris.toLocaleString()} ≤ ${CROWD_LOD.trisBudget.toLocaleString()}`,
  );
}

{
  const worstVarR0 = worstDiscCount(CROWD_LOD.r0Far + CROWD_LOD.band0, true);
  const worstVarR1 = worstDiscCount(CROWD_LOD.r1Far + CROWD_LOD.band1, true);
  const maxR0 = Math.max(...worstVarR0);
  const maxR1 = Math.max(...worstVarR1);
  c.check(
    'C2 compact-region capacities cover worst-case counts with margin',
    CROWD_LOD.capR0 >= maxR0 * 1.5 && CROWD_LOD.capR1 >= maxR1 * 1.2 && CROWD_LOD.capImp >= N,
    `worst per-variant R0 ${maxR0} (cap ${CROWD_LOD.capR0}), R1 ${maxR1} (cap ${CROWD_LOD.capR1}), N ${N} (cap ${CROWD_LOD.capImp})`,
  );
}

c.check(
  'C3 ring plan is ordered and dither bands stay positive',
  CROWD_LOD.r0Far > CROWD_LOD.band0 &&
    CROWD_LOD.r1Far - CROWD_LOD.band1 > CROWD_LOD.r0Far + CROWD_LOD.band0 &&
    CROWD_LOD.band0 > 0 &&
    CROWD_LOD.band1 > 0,
  `r0 ${CROWD_LOD.r0Far}±${CROWD_LOD.band0}, r1 ${CROWD_LOD.r1Far}±${CROWD_LOD.band1}`,
);

// ---- D: impostor path inputs ------------------------------------------------------

{
  const g = buildFigureGeometry(FIGURE_ARCHETYPES[0], 0);
  bakeRegionColors(g);
  const col = g.getAttribute('color');
  let ok = col !== undefined && col.itemSize === 3 && col.count > 0;
  if (ok) {
    for (let i = 0; i < col.count && ok; i++) {
      for (const x of [col.getX(i), col.getY(i), col.getZ(i)]) {
        if (!(x >= 0 && x <= 1)) ok = false;
      }
    }
  }
  c.check('D1 impostor-capture bake: per-vertex albedo present and in gamut', ok);
}

// ---- E: the ADR 0020 vendored module ----------------------------------------------

const { FIGURES_VENDORED } = await import('../src/nj/figuresVendored.gen');
{
  const p = FIGURES_VENDORED.provenance;
  const required = ['generator', 'adr', 'source', 'topology', 'annyVersion', 'generated', 'determinism'];
  const missing = required.filter((k) => !p[k] || p[k].trim().length === 0);
  c.check(
    'E1 vendored provenance header complete; anny topology only (ADR 0020 rule 2)',
    missing.length === 0 &&
      p.topology.includes('anny') &&
      /smplx.*(banned|non-commercial)/i.test(p.topology) &&
      p.source.includes('CC0'),
    missing.length ? `missing ${missing.join(',')}` : `anny ${p.annyVersion}, generated ${p.generated}`,
  );
}

{
  const decode = (s: string): Uint8Array => {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  let ok = FIGURES_VENDORED.figures.length === V;
  let detail = `${FIGURES_VENDORED.figures.length} figures`;
  const names = new Set(FIGURES_VENDORED.figures.map((f) => f.name));
  for (const a of FIGURE_ARCHETYPES) {
    if (!names.has(a.name)) {
      ok = false;
      detail = `archetype ${a.name} missing from the vendored set`;
    }
  }
  for (const f of FIGURES_VENDORED.figures) {
    const parts = [
      ['head', f.head, 2400],
      ['eyes', f.eyes, 400],
      ['handL', f.handL, 240],
      ['handR', f.handR, 240],
    ] as const;
    for (const [label, part, ceil] of parts) {
      const pos = decode(part.pos);
      const idx = decode(part.idx);
      const posOk = pos.length === part.vertCount * 12;
      const idxOk = idx.length === part.triCount * 6;
      const bboxOk =
        part.bbox[0] < part.bbox[3] && part.bbox[1] < part.bbox[4] && part.bbox[2] < part.bbox[5];
      // slice 2: every part carries per-vertex hm08 UVs, all inside [0,1]
      const uvBytes = decode(part.uv);
      const uv = new Float32Array(uvBytes.buffer, uvBytes.byteOffset, uvBytes.length / 4);
      let uvOk = uvBytes.length === part.vertCount * 8;
      for (let i = 0; i < uv.length && uvOk; i++) {
        if (!(uv[i] >= 0 && uv[i] <= 1.0001)) uvOk = false;
      }
      if (!(posOk && idxOk && uvOk && part.triCount <= ceil && part.vertCount < 65536 && bboxOk)) {
        ok = false;
        detail = `${f.name}.${label}: pos ${posOk}, idx ${idxOk}, uv ${uvOk}, tris ${part.triCount}<=${ceil}, bbox ${bboxOk}`;
      }
    }
  }
  c.check('E2 vendored parts decode consistently and stay under their ceilings', ok, detail);
}

{
  // E4: the slice-2 skin atlas — CC0 provenance pinned and hash-recorded,
  // tile plan matching the material's tile = floor(skin01 * tiles) key,
  // means ordered dark -> pale (the SKIN_RAMP direction), JPEG payload
  // honest (magic bytes) and under a bundle-weight ceiling.
  const sa = FIGURES_VENDORED.skinAtlas;
  const decode = (s: string): Uint8Array => {
    const bin = atob(s);
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  const jpeg = decode(sa.jpegB64);
  const magicOk = jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg[2] === 0xff;
  const sizeOk = jpeg.length <= 400 * 1024;
  const planOk =
    sa.tiles === 4 &&
    sa.res === 2048 &&
    sa.tileOrder.length === sa.tiles &&
    sa.tileMeansLinear.length === sa.tiles &&
    sa.tileMeansLinear.every((m) => m.length === 3 && m.every((x) => x > 0 && x <= 1));
  const lum = sa.tileMeansLinear.map((m) => 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]);
  const orderOk = lum.every((l, i) => i === 0 || l >= lum[i - 1]);
  const provOk =
    /^[0-9a-f]{40}$/.test(sa.sourceCommit) &&
    sa.sources.length === sa.tiles &&
    sa.sources.every((s) => /^[0-9a-f]{64}$/.test(s.sha256)) &&
    /CC0/.test(FIGURES_VENDORED.provenance.skinSource ?? '');
  c.check(
    'E4 skin atlas: pinned CC0 provenance, dark->pale tile plan, honest JPEG payload',
    magicOk && sizeOk && planOk && orderOk && provOk,
    `jpeg ${(jpeg.length / 1024).toFixed(0)} KB, tiles ${sa.tileOrder.join(', ')}`,
  );
}

{
  // E5: the built LOD0 geometry carries 'auv' — vendored vertices with real
  // UVs (exactly the vendored part vertex counts), procedural vertices with
  // the -1 sentinel the material's ramp fallback keys on.
  let ok = true;
  let detail = '';
  for (let v = 0; v < V && ok; v++) {
    const f = FIGURES_VENDORED.figures.find((x) => x.name === FIGURE_ARCHETYPES[v].name);
    if (!f) continue;
    const g = buildFigureGeometry(FIGURE_ARCHETYPES[v], 0);
    const auv = g.getAttribute('auv');
    if (!auv) {
      ok = false;
      detail = `${FIGURE_ARCHETYPES[v].name}: no auv attribute`;
      break;
    }
    let real = 0;
    for (let i = 0; i < auv.count; i++) {
      const u = auv.getX(i);
      if (u >= 0) real++;
    }
    const want = f.head.vertCount + f.eyes.vertCount + f.handL.vertCount + f.handR.vertCount;
    if (real !== want) {
      ok = false;
      detail = `${FIGURE_ARCHETYPES[v].name}: ${real} textured verts, want ${want}`;
    }
  }
  c.check('E5 LOD0 auv: vendored verts textured, procedural verts sentinel', ok, detail);
}

{
  // the vendored eye region actually reaches the built LOD0 geometry
  const g = buildFigureGeometry(FIGURE_ARCHETYPES[0], 0);
  const region = g.getAttribute('aregion');
  let hasEye = false;
  for (let i = 0; i < region.count && !hasEye; i++) {
    if (region.getX(i) === 4) hasEye = true;
  }
  c.check('E3 LOD0 geometry carries the vendored eye region', hasEye);
}

c.finish();
