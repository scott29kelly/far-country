/**
 * New Jerusalem massing — M3, the arched golden mountain-city (toward Willis).
 *
 * Built to read like Janet Willis's book-cover renderings: a jasper wall with
 * twelve pearl gates (Ezekiel 48:30-34 tribe order) and a jewelled foundation
 * course at its base, three grand terraces each faced with FOUR tall arched
 * window-gates (twelve per side), and a glowing crown under the open-air
 * glory. Every arched bay is a recessed luminous window framed by gold piers
 * with an arched head, so the city reads as detailed translucent gold
 * "glowing from within its arches" rather than smooth or striped blocks.
 * Lower tiers are warm gold; upper tiers grade toward pale crystal; the glow
 * intensifies toward the throne.
 *
 * The base tier is split into an inner solid plinth (structural support for
 * the terraces above) and an outer wall RING with real gaps at the twelve
 * named gates (RENDERING-DECISIONS #2 governs the tribe/side assignment) —
 * a camera can fly/walk through a gate gap, not just past a decorative panel.
 *
 * Abstract glory-light only at the summit (Rev 21:23; 22:5; ADR 0010 — no
 * figure). Materials are placeholder PBR approximations (no true gem
 * transmission yet — CITY-QUALITY-BAR.md delta #3). Still to come: the
 * vaulted interior.
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  SphereGeometry,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  CITY_HALF,
  FOUNDATION_BANDS,
  FOUNDATION_BAND_LENGTH,
  FOUNDATION_GEMS,
  GATE_OFFSETS,
  GATE_WIDTH,
  GATES,
  type Side,
} from './cityModel';

const GOLD = new Color(0xd9a441);
const CRYSTAL = new Color(0xdfeaf0);
const PEARL = new Color(0xf3ecdf);

type Face = { axis: 'x' | 'z'; sign: 1 | -1 };
const FACES: Face[] = [
  { axis: 'z', sign: 1 },
  { axis: 'z', sign: -1 },
  { axis: 'x', sign: 1 },
  { axis: 'x', sign: -1 },
];

/** Maps a cardinal `Side` (from cityModel's GATES/FOUNDATION_BANDS) to a wall Face. */
const SIDE_FACE: Record<Side, Face> = {
  south: { axis: 'z', sign: 1 },
  north: { axis: 'z', sign: -1 },
  east: { axis: 'x', sign: 1 },
  west: { axis: 'x', sign: -1 },
};

/** Tangent-axis (x for z-faces, z for x-faces) segment ranges with gate gaps cut out. */
function wallSegments(outer: number): Array<[number, number]> {
  const gaps = [...GATE_OFFSETS]
    .sort((a, b) => a - b)
    .map((o): [number, number] => [o - GATE_WIDTH / 2, o + GATE_WIDTH / 2]);
  const segs: Array<[number, number]> = [];
  let cursor = -outer;
  for (const [g0, g1] of gaps) {
    if (g0 > cursor) segs.push([cursor, g0]);
    cursor = g1;
  }
  if (cursor < outer) segs.push([cursor, outer]);
  return segs;
}

/**
 * The wall ring for one side: a band from `inner` to `outer` radius, height
 * `h`, split into segments so the three gate gaps on this side are genuinely
 * open (no infill mesh across them).
 */
function buildWallSide(face: Face, inner: number, outer: number, h: number, mat: MeshStandardNodeMaterial): Mesh[] {
  const meshes: Mesh[] = [];
  const radialMid = face.sign * (inner + outer) / 2;
  const radialThick = outer - inner;
  for (const [t0, t1] of wallSegments(outer)) {
    const len = t1 - t0;
    const mid = (t0 + t1) / 2;
    const geo =
      face.axis === 'z'
        ? new BoxGeometry(len, h, radialThick)
        : new BoxGeometry(radialThick, h, len);
    const seg = new Mesh(geo, mat);
    if (face.axis === 'z') seg.position.set(mid, h / 2, radialMid);
    else seg.position.set(radialMid, h / 2, mid);
    seg.castShadow = true;
    seg.receiveShadow = true;
    meshes.push(seg);
  }
  return meshes;
}

/** A pearl gate portal: two jambs framing the gap + an arched pearl lintel over it (walkable). */
function buildGatePortal(face: Face, offset: number, inner: number, outer: number, h: number): Group {
  const g = new Group();
  const jambMat = new MeshStandardNodeMaterial();
  jambMat.color.copy(GOLD);
  jambMat.metalness = 0.6;
  jambMat.roughness = 0.28;
  const pearlMat = new MeshStandardNodeMaterial();
  pearlMat.color.copy(PEARL);
  pearlMat.emissive.copy(PEARL);
  pearlMat.emissiveIntensity = 0.6;
  pearlMat.roughness = 0.22;
  pearlMat.metalness = 0.15;
  pearlMat.side = DoubleSide;

  const radialThick = outer - inner;
  const radialMid = face.sign * (inner + outer) / 2;
  const jambW = 1.4;
  const archH = GATE_WIDTH * 0.42; // clearance under the arch stays walkable

  for (const side of [-1, 1] as const) {
    const u = offset + side * (GATE_WIDTH / 2 + jambW / 2);
    const jamb = new Mesh(new BoxGeometry(jambW, h, radialThick), jambMat);
    if (face.axis === 'z') jamb.position.set(u, h / 2, radialMid);
    else jamb.position.set(radialMid, h / 2, u);
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    g.add(jamb);
  }

  // Pearl arch head — a luminous half-disc capping the gap's top, thin along
  // the radial axis so it reads from both inside and outside the wall.
  const arch = new Mesh(new CircleGeometry(GATE_WIDTH / 2, 20, 0, Math.PI), pearlMat);
  if (face.axis === 'z') {
    arch.position.set(offset, h - archH, radialMid);
    arch.rotation.x = face.sign > 0 ? Math.PI / 2 : -Math.PI / 2;
    arch.rotation.z = Math.PI;
  } else {
    arch.position.set(radialMid, h - archH, offset);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = face.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
  g.add(arch);

  return g;
}

/** Twelve jewelled foundation stones (Rev 21:19-20) as a course at the wall's base. */
function buildFoundationCourse(outer: number): Group {
  const g = new Group();
  const bandH = 3;
  const bandThick = 3;
  for (const band of FOUNDATION_BANDS) {
    const face = SIDE_FACE[band.side];
    const gemMat = new MeshStandardNodeMaterial();
    // FOUNDATION_GEMS colours are ESV-order stylised hues (ADR 0009 rule 2 —
    // not photoreal mineralogy); ordered access here mirrors cityModel's own
    // FOUNDATION_BANDS↔FOUNDATION_GEMS[band.gem] pairing.
    gemMat.color.set(FOUNDATION_GEMS[band.gem].color);
    gemMat.emissive.copy(gemMat.color);
    gemMat.emissiveIntensity = 0.35;
    gemMat.roughness = 0.35;
    gemMat.metalness = 0.1;
    // Sits just OUTSIDE the wall's outer face, on the plaza, so it reads as a
    // distinct girdling course rather than being buried inside the wall mass.
    const radialMid = face.sign * (outer + bandThick / 2);
    const geo =
      face.axis === 'z'
        ? new BoxGeometry(FOUNDATION_BAND_LENGTH - 1, bandH, bandThick)
        : new BoxGeometry(bandThick, bandH, FOUNDATION_BAND_LENGTH - 1);
    const stone = new Mesh(geo, gemMat);
    if (face.axis === 'z') stone.position.set(band.offset, bandH / 2, radialMid);
    else stone.position.set(radialMid, bandH / 2, band.offset);
    stone.castShadow = true;
    stone.receiveShadow = true;
    g.add(stone);
  }
  return g;
}

/** Position+orient an object built facing +Z onto a given tier face. */
function placeOnFace(obj: Mesh | Group, u: number, y: number, off: number, face: Face): void {
  if (face.axis === 'z') {
    obj.position.set(u, y, face.sign * off);
    obj.rotation.y = face.sign > 0 ? 0 : Math.PI;
  } else {
    obj.position.set(face.sign * off, y, u);
    obj.rotation.y = face.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
  }
}

/** An arched window: a tall luminous panel with a semicircular head, facing +Z. */
export function makeArchWindow(width: number, height: number, m: MeshStandardNodeMaterial): Group {
  const g = new Group();
  const rect = new Mesh(new BoxGeometry(width, height, 0.6), m);
  rect.position.y = height / 2;
  g.add(rect);
  const arch = new Mesh(new CircleGeometry(width / 2, 18, 0, Math.PI), m);
  arch.position.set(0, height, 0.3);
  g.add(arch);
  return g;
}

/**
 * A blind-arcade frieze — a fascia carrying a row of small recessed arches,
 * facing +Z. This is the dense "little arches" banding that runs along every
 * step-back in Willis's renderings (a Lombard band). Cheap by design: shares
 * two materials and casts no shadows.
 */
function makeArcadeBand(
  width: number,
  height: number,
  count: number,
  body: MeshStandardNodeMaterial,
  recess: MeshStandardNodeMaterial,
): Group {
  const g = new Group();
  const fascia = new Mesh(new BoxGeometry(width, height, 1.4), body);
  fascia.position.y = height / 2;
  g.add(fascia);
  const bay = width / count;
  const aw = bay * 0.66;
  const stem = height * 0.42;
  const base = height * 0.14;
  for (let i = 0; i < count; i++) {
    const u = -width / 2 + bay * (i + 0.5);
    const jamb = new Mesh(new BoxGeometry(aw, stem, 0.5), recess);
    jamb.position.set(u, base + stem / 2, 0.7);
    g.add(jamb);
    const head = new Mesh(new CircleGeometry(aw / 2, 10, 0, Math.PI), recess);
    head.position.set(u, base + stem, 0.72);
    g.add(head);
  }
  return g;
}

type Tier = { half: number; h: number; arches: number };

export function buildCityMassing(): Group {
  const city = new Group();
  city.name = 'new-jerusalem';

  // Street-of-gold apron around the base.
  const apron = new MeshStandardNodeMaterial();
  apron.color.copy(GOLD);
  apron.metalness = 0.5;
  apron.roughness = 0.3;
  const plaza = new Mesh(new BoxGeometry(232, 5, 232), apron);
  plaza.position.y = -2.5;
  plaza.receiveShadow = true;
  plaza.castShadow = true;
  city.add(plaza);

  // Plinth + three grand terraces (12 arched gates per side) + glowing crown.
  const tiers: Tier[] = [
    { half: CITY_HALF, h: 16, arches: 4 }, // jasper wall + street-of-gold plinth / gates
    { half: 82, h: 42, arches: 4 },
    { half: 60, h: 38, arches: 4 },
    { half: 40, h: 34, arches: 4 },
    { half: 22, h: 26, arches: 0 }, // crown (solid, glowing) under the glory
  ];

  let yBot = 0;
  const last = tiers.length - 1;
  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti];
    const f = ti / last; // 0 at base .. 1 at crown
    const tierColor = GOLD.clone().lerp(CRYSTAL, f);
    const H = t.h;
    const yc = yBot + H / 2;

    // Solid tier mass (the silhouette).
    const mass = new MeshStandardNodeMaterial();
    mass.color.copy(tierColor);
    mass.metalness = 0.55 * (1 - f);
    mass.roughness = 0.3 - 0.16 * f;
    mass.emissive.copy(tierColor);
    // Self-luminous city (Rev 21:23 — the glory of God is its light, so the
    // city is the brightest thing, glowing THROUGH the km-scale aerial haze
    // rather than washing into it). The base was ~0.05 (purely sunlit → it
    // dissolved into the haze at citywide distance); now every tier glows in
    // its own tier colour (warm gold low → cool crystal high), brightest at
    // the summit. Tuned to the post stack: the base floor stays below the 1.5
    // bloom threshold (PostStack bloom) so close-up it glows without blooming
    // to flat white (the failure mode that toned the windows down); only the
    // crown crosses the threshold for a gentle apex bloom. Auto-exposure does
    // the rest — a brighter centre-frame city pulls global exposure down, so
    // the hazy landscape recedes and the city reads as the source of light.
    mass.emissiveIntensity = 0.55 + 1.15 * f * f;

    if (ti === 0) {
      // Base tier = jasper WALL (RENDERING-DECISIONS #2 governs the gate
      // order/assignment), split into a solid inner plinth (structural
      // support for the terraces above) and an outer wall ring with real
      // gaps at the twelve named gates — a camera can pass through a gate,
      // not just past a decorative panel.
      const innerHalf = tiers[1].half + 6; // clears tier 1's footprint
      const plinth = new Mesh(new BoxGeometry(2 * innerHalf, H, 2 * innerHalf), mass);
      plinth.position.y = yc;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      city.add(plinth);

      for (const face of FACES) {
        for (const seg of buildWallSide(face, innerHalf, t.half, H, mass)) city.add(seg);
      }
      for (const gate of GATES) {
        const portal = buildGatePortal(SIDE_FACE[gate.side], gate.offset, innerHalf, t.half, H);
        city.add(portal);
      }
      city.add(buildFoundationCourse(t.half));
    } else {
      const box = new Mesh(new BoxGeometry(2 * t.half, H, 2 * t.half), mass);
      box.position.y = yc;
      box.castShadow = true;
      box.receiveShadow = true;
      city.add(box);
    }

    // Gold cornice lip at the tier top.
    const trim = new MeshStandardNodeMaterial();
    trim.color.copy(GOLD.clone().lerp(CRYSTAL, f));
    trim.metalness = 0.7;
    trim.roughness = 0.22;
    const cornice = new Mesh(new BoxGeometry(2 * t.half + 6, 3, 2 * t.half + 6), trim);
    cornice.position.y = yBot + H - 1.5;
    cornice.castShadow = true;
    city.add(cornice);

    if (t.arches > 0) {
      const winMat = new MeshStandardNodeMaterial();
      winMat.color.copy(GOLD.clone().lerp(new Color(0xffffff), f));
      winMat.emissive.setHex(0xffdf9e);
      // The lit openings stay the brightest part of each face. Nudged up from
      // 0.7+1.0f now that the tier mass self-glows too (so the windows read as
      // openings, not the only light); still kept under the 1.5 bloom
      // threshold at the base to avoid the old flat-white blowout.
      winMat.emissiveIntensity = 0.9 + 1.3 * f;
      winMat.roughness = 0.5;
      winMat.side = DoubleSide;

      // Frieze materials: a gold fascia and a darker recessed arch (blind).
      const friezeBody = new MeshStandardNodeMaterial();
      friezeBody.color.copy(GOLD.clone().lerp(CRYSTAL, f));
      friezeBody.metalness = 0.6;
      friezeBody.roughness = 0.32;
      const friezeRecess = new MeshStandardNodeMaterial();
      friezeRecess.color.copy(GOLD.clone().lerp(CRYSTAL, f).multiplyScalar(0.5));
      friezeRecess.roughness = 0.6;

      const off = t.half + 0.2;
      const W = 2 * t.half;
      const bay = W / t.arches;
      const ow = bay * 0.58;
      const winH = H * 0.56;
      const winBot = yBot + H * 0.16;
      const pierW = bay * 0.34;

      const friezeH = Math.min(7, H * 0.16);
      const friezeBot = yBot + H - friezeH - 2.5; // just under the cornice lip
      const smallCount = Math.max(6, Math.round(W / 11)); // dense little arches

      for (const face of FACES) {
        // Arched windows.
        for (let i = 0; i < t.arches; i++) {
          const u = -W / 2 + bay * (i + 0.5);
          const win = makeArchWindow(ow, winH, winMat);
          placeOnFace(win, u, winBot, off, face);
          city.add(win);
        }
        // Gold piers between/around the bays.
        for (let i = 0; i <= t.arches; i++) {
          const u = -W / 2 + bay * i;
          // The base tier's pier rhythm (u = 0, ±50, ±100) lands exactly on
          // the three gate offsets per side — a solid pier there stands
          // immediately outside the wall's real gate gap and reads as a
          // blocked door head-on (found 2026-07-01 once the grade NaN fix
          // unmasked the forecourt). The pearl portals own those slots.
          if (ti === 0 && GATE_OFFSETS.some((g) => Math.abs(g - u) < GATE_WIDTH)) continue;
          const pier = new Mesh(new BoxGeometry(pierW, H, 2.6), trim);
          placeOnFace(pier, u, yc, off, face);
          pier.castShadow = true;
          pier.receiveShadow = true;
          city.add(pier);
        }
        // Blind-arcade frieze along the tier top (the Willis "little arches").
        const band = makeArcadeBand(W, friezeH, smallCount, friezeBody, friezeRecess);
        placeOnFace(band, 0, friezeBot, off + 0.1, face);
        city.add(band);
      }
    }

    yBot += H;
  }

  // Throne glory: a radiant, self-luminous source at the open-air summit, which
  // the engine's bloom turns into a beacon. Abstract light only (ADR 0010).
  const gloryMat = new MeshStandardNodeMaterial();
  gloryMat.color.setHex(0xfff4d6);
  gloryMat.emissive.setHex(0xfff1c8);
  // The summit glory is THE light of the city — pushed well past the 1.5 bloom
  // threshold so it stays a blinding beacon even through the aerial haze at
  // citywide distance (Rev 21:23; 22:5). Abstract light only (ADR 0010).
  gloryMat.emissiveIntensity = 12;
  gloryMat.roughness = 1;
  const glory = new Mesh(new SphereGeometry(11, 32, 24), gloryMat);
  glory.position.y = yBot + 10;
  city.add(glory);

  return city;
}
