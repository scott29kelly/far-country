/**
 * New Jerusalem massing — M3 material/geometry pass (CITY-QUALITY-BAR #1/#3).
 *
 * The city reads as Rev 21:18 states it: "the wall was built of jasper, while
 * the city was pure gold, like clear glass." Tier faces are TRANSLUCENT GOLD
 * GLASS (MeshPhysicalNodeMaterial transmission) lit from within — giant arch
 * bays carrying a mullion grid of small arched panes (emissiveNode mask) over
 * an opaque glowing interior core that the refraction parallaxes — framed by
 * real kit-bash relief: fluted gold piers, voussoir arch rings, IVORY cornice
 * bands with gold dentil courses, and gold-on-ivory arcade courses at every
 * setback (the USER-REFS directive #1 composition: gold lattice faces
 * alternating with white arcade bands). All relief is instanced geometry
 * (plain InstancedMesh — the engine's sanctioned static-content path), not
 * paint: ≥0.3 m real depth at world scale everywhere within near range.
 *
 * The base tier stays the jasper WALL with real gaps at the twelve named
 * gates (Ezekiel 48:30-34 order, RENDERING-DECISIONS #2), now in a pale
 * crystal-jasper material; the twelve foundation courses are FACETED gem
 * volumes (Rev 21:19-20, transmission + dispersion, stylised hues per ADR
 * 0009 rule 2); the pearl gate heads get a nacre iridescence pass.
 *
 * Abstract glory-light only at the summit (Rev 21:23; 22:5; ADR 0010).
 * Emissive contract: base-tier emissives stay under the PostStack bloom
 * threshold (luminance 1.5); only the crown and the glory cross it.
 */

import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  FrontSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  IrradianceNode,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
} from 'three/webgpu';
import {
  float,
  fract,
  instanceIndex,
  mix,
  normalWorld,
  positionLocal,
  positionWorld,
  smoothstep,
  vec3,
} from 'three/tsl';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NU, NV3 } from '../gpu/TSLTypes';
import { slotHash } from '../render/VegInstance';
import {
  CITY_TIERS,
  FOUNDATION_BAND_OFFSETS,
  FOUNDATION_BANDS,
  FOUNDATION_COURSE,
  foundationCourseSpans,
  FOUNDATION_GEMS,
  GATE_OFFSETS,
  GATE_WIDTH,
  GATES,
  PLINTH_HALF,
  TIER_GLASS_PROUD,
  type Side,
} from './cityModel';

const GOLD = new Color(0xd9a441);
const CRYSTAL = new Color(0xdfeaf0);
const PEARL = new Color(0xf3ecdf);
const IVORY = new Color(0xf1e9d7);
const JASPER = new Color(0xbfd6d2); // pale crystal-jasper (stylised, ADR 0009 r2)

/**
 * Live-tunable handles for the dev-only ?edit=1 panel (plan doc §1 Phase A).
 * Populated when the city builds; the full data-driven NewJerusalemConfig
 * (Phase B) supersedes this ad-hoc registry.
 */
export const njLive: { glory?: MeshStandardNodeMaterial } = {};

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

/** Yaw so +Z-facing geometry looks outward from the given face. */
function faceYaw(face: Face): number {
  if (face.axis === 'z') return face.sign > 0 ? 0 : Math.PI;
  return face.sign > 0 ? -Math.PI / 2 : Math.PI / 2;
}

/** The river cascades the south (+Z) meridian — relief courses skip its slot. */
function riverSlot(face: Face, u: number): boolean {
  return face.axis === 'z' && face.sign === 1 && Math.abs(u) < 5;
}

// ---------------------------------------------------------------------------
// Probe-GI opt-in (fragment stage — tier faces are far larger than the 16 m
// probe grid, so the veg-style vertex hoist would smear; see Forests.patchGI)
// ---------------------------------------------------------------------------

function patchCityGI(mat: MeshStandardNodeMaterial, gi: ProbeGI | null): void {
  if (!gi) return;
  const irr = gi.irradiance(positionWorld as unknown as NV3, normalWorld as unknown as NV3);
  (mat as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irr as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------

/** Opaque gold trim for INSTANCED relief (per-instance value jitter). */
function trimGoldInstanced(gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.metalness = 0.85;
  m.roughness = 0.3;
  const jit = slotHash(instanceIndex as unknown as NU, 11).mul(0.14).add(0.93) as unknown as NF;
  m.colorNode = vec3(GOLD.r, GOLD.g, GOLD.b).mul(jit) as unknown as NV3;
  // faint self-light so shaded courses stay legible gold, far under bloom
  m.emissiveNode = vec3(GOLD.r, GOLD.g, GOLD.b).mul(jit).mul(0.18) as unknown as NV3;
  patchCityGI(m, gi);
  return m;
}

/** Opaque gold trim for plain (non-instanced) meshes — no instanceIndex nodes. */
function trimGoldPlain(gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color.copy(GOLD);
  m.metalness = 0.85;
  m.roughness = 0.3;
  m.emissive.copy(GOLD);
  m.emissiveIntensity = 0.18;
  patchCityGI(m, gi);
  return m;
}

/** Ivory/white course material — the pale bands alternating with the gold. */
function ivoryMaterial(gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  m.color.copy(IVORY);
  m.metalness = 0.05;
  m.roughness = 0.5;
  m.emissive.copy(IVORY);
  m.emissiveIntensity = 0.12;
  patchCityGI(m, gi);
  return m;
}

/**
 * The opaque interior core behind each tier's glass skin: a warm glowing
 * "inhabited interior" — floor bands and column shading under a vertical
 * gradient — that the glass transmission refracts into real parallax depth.
 */
function interiorMaterial(f: number, tierH: number, gi: ProbeGI | null): MeshStandardNodeMaterial {
  const m = new MeshStandardNodeMaterial();
  const col = GOLD.clone().lerp(CRYSTAL, f * 0.6).multiplyScalar(0.55);
  m.color.copy(col);
  m.metalness = 0.2;
  m.roughness = 0.6;
  const ly = positionLocal.y.div(tierH).add(0.5).clamp(0, 1) as unknown as NF; // 0 floor..1 ceiling
  const grad = mix(float(1.0), float(0.45), ly) as unknown as NF;
  const fy = fract(positionLocal.y.div(2.6)) as unknown as NF;
  const floors = smoothstep(0.5, 0.35, fy).mul(0.5).add(0.5) as unknown as NF;
  const fx = fract(positionLocal.x.div(3.4)) as unknown as NF;
  const fz = fract(positionLocal.z.div(3.4)) as unknown as NF;
  const colsX = smoothstep(0.0, 0.12, fx).mul(smoothstep(1.0, 0.88, fx) as unknown as NF) as unknown as NF;
  const colsZ = smoothstep(0.0, 0.12, fz).mul(smoothstep(1.0, 0.88, fz) as unknown as NF) as unknown as NF;
  const cols = colsX.mul(colsZ).mul(0.35).add(0.65) as unknown as NF;
  // warm interior light; K stays under the 1.5 bloom line at every tier
  const K = 1.05 + 0.4 * f;
  m.emissiveNode = vec3(1.0, 0.85, 0.556)
    .mul(grad.mul(floors).mul(cols))
    .mul(K) as unknown as NV3;
  patchCityGI(m, gi);
  return m;
}

/**
 * Translucent gold glass for the giant arch-bay panes ("pure gold, like clear
 * glass", Rev 21:18): WebGPU transmission for real see-into depth, plus an
 * emissive mullion grid of small ARCHED panes with an interior-glow gradient.
 * Pane-local coordinates (origin bottom-centre of each bay pane).
 */
function goldGlassMaterial(f: number, paneH: number): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  m.color.copy(GOLD.clone().lerp(CRYSTAL, f));
  m.metalness = 0;
  m.roughness = 0.07;
  // 0.85 muddied the panes to beige — keep more gold body
  m.transmission = transmissionAblated() ? 0 : 0.7;
  m.ior = 1.45;
  m.thickness = 0.9; // local units — ×20 world scale ⇒ ~18 m of gold glass depth
  m.attenuationColor.copy(GOLD);
  m.attenuationDistance = 1.4;
  m.specularIntensity = 1.0;
  m.side = FrontSide; // avoids the DoubleSide double-pass + second framebuffer copy

  // mullion grid: cells ~21×29 m world, each cell an arched pane (bright
  // glass inside a gold rib + arched head — the "whole facades of small
  // arched panes" directive), under a vertical interior-glow gradient.
  const cx = fract(positionLocal.x.div(1.05)) as unknown as NF;
  const cy = fract(positionLocal.y.div(1.45)) as unknown as NF;
  const dx = cx.sub(0.5).abs() as unknown as NF;
  const ay = cy.sub(0.58).max(0).mul(1.5) as unknown as NF;
  const rr = dx.mul(dx).add(ay.mul(ay)).sqrt() as unknown as NF;
  // thin ribs, bright panes — thick dark spandrels read as a waffle grid
  const pane = smoothstep(0.475, 0.435, rr).mul(
    smoothstep(0.015, 0.05, cy) as unknown as NF,
  ) as unknown as NF;
  const grad = mix(float(1.0), float(0.55), positionLocal.y.div(paneH).clamp(0, 1)) as unknown as NF;
  const jit = slotHash(instanceIndex as unknown as NU, 7).mul(0.25).add(0.85) as unknown as NF;
  // bloom contract: K·grad·Y(warm) ≤ ~0.85 at the base tier, rising with f;
  // only the crown/glory cross the 1.5 threshold
  const K = 1.05 + 1.0 * f;
  m.emissiveNode = vec3(1.0, 0.74, 0.42)
    .mul(pane.mul(0.62).add(0.38))
    .mul(grad)
    .mul(jit)
    .mul(K) as unknown as NV3;
  return m;
}

/** Crystal-jasper wall material (Rev 21:18 "wall built of jasper... clear as glass"). */
function jasperMaterial(gi: ProbeGI | null): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  m.color.copy(JASPER);
  m.metalness = 0.05;
  m.roughness = 0.3; // 0.18 + 0.35 emissive washed the wall flat white
  m.clearcoat = 1.0;
  m.clearcoatRoughness = 0.15;
  m.emissive.copy(JASPER);
  m.emissiveIntensity = 0.22;
  patchCityGI(m, gi);
  return m;
}

/** Nacre pearl for the gate heads (Rev 21:21 — each gate a single pearl). */
function pearlMaterial(): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  m.color.copy(PEARL);
  m.metalness = 0;
  m.roughness = 0.32;
  m.clearcoat = 1.0;
  m.clearcoatRoughness = 0.12;
  m.iridescence = 1.0;
  m.iridescenceIOR = 1.8;
  m.iridescenceThicknessRange = [180, 480];
  m.sheen = 0.5;
  m.sheenColor.set(0xfff2e0);
  m.emissive.copy(PEARL);
  m.emissiveIntensity = 0.5;
  m.side = DoubleSide;
  return m;
}

/**
 * ?resizeprobe=transmission — diagnostic ablation used by
 * tools/probe-resize.ts (--ablate) to bisect render-target-lifetime
 * regressions (transmission triggers the mid-pass backdrop copy); never set
 * in normal navigation.
 */
function transmissionAblated(): boolean {
  return (
    new URLSearchParams(window.location.search)
      .get('resizeprobe')
      ?.split(',')
      .includes('transmission') === true
  );
}

/** Faceted gem material for one foundation stone (transmission + dispersion). */
function gemMaterial(hex: string): MeshPhysicalNodeMaterial {
  const m = new MeshPhysicalNodeMaterial();
  m.color.set(hex);
  m.metalness = 0;
  m.roughness = 0.08;
  // 0.6: enough body that per-facet shading survives
  m.transmission = transmissionAblated() ? 0 : 0.6;
  m.ior = 2.0;
  m.thickness = 1.2;
  m.attenuationColor.copy(m.color);
  m.attenuationDistance = 0.9;
  m.dispersion = 0.25;
  m.specularIntensity = 1.0;
  m.side = FrontSide;
  m.emissive.copy(m.color);
  // low enough that facet shading reads (0.7 flattened the cut faces to a
  // uniform pastel strip); saturated hues stay far under bloom either way,
  // and the grade's c.max(0) clamp (PostStack) covers the saturated-dark case
  m.emissiveIntensity = 0.4;
  return m;
}

// ---------------------------------------------------------------------------
// Kit-bash module geometries (all facing +Z, origin at the mount point)
// ---------------------------------------------------------------------------

/** Glass bay pane: rect + semicircular head, origin bottom-centre. */
function glassPaneGeometry(ow: number, winH: number): BufferGeometry {
  const rect = new PlaneGeometry(ow, winH);
  rect.translate(0, winH / 2, 0);
  const head = new CircleGeometry(ow / 2, 24, 0, Math.PI);
  head.translate(0, winH, 0);
  const merged = mergeGeometries([rect, head]);
  rect.dispose();
  head.dispose();
  return merged;
}

/** Arch bay frame: two jambs + capitals + a voussoir half-ring, origin bottom-centre. */
function archFrameGeometry(ow: number, winH: number, jambW: number, depth: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const jamb = new BoxGeometry(jambW, winH, depth);
    jamb.translate(s * (ow / 2 + jambW / 2), winH / 2, 0);
    parts.push(jamb);
    const cap = new BoxGeometry(jambW * 1.5, 1.1, depth * 1.2);
    cap.translate(s * (ow / 2 + jambW / 2), winH + 0.55, 0);
    parts.push(cap);
  }
  const ring = new TorusGeometry(ow / 2 + jambW / 2, jambW / 2, 10, 28, Math.PI);
  ring.translate(0, winH, 0);
  parts.push(ring);
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Fluted pier: core + three proud ridges + plinth + capital, origin bottom-centre. */
function flutedPierGeometry(w: number, h: number, d: number): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const core = new BoxGeometry(w, h, d);
  core.translate(0, h / 2, 0);
  parts.push(core);
  for (const k of [-0.3, 0, 0.3]) {
    const ridge = new BoxGeometry(w * 0.16, h * 0.92, d * 0.3);
    ridge.translate(k * w, h / 2, d / 2);
    parts.push(ridge);
  }
  const plinth = new BoxGeometry(w * 1.25, 1.6, d * 1.25);
  plinth.translate(0, 0.8, 0);
  parts.push(plinth);
  const cap = new BoxGeometry(w * 1.3, 1.4, d * 1.3);
  cap.translate(0, h - 0.7, 0);
  parts.push(cap);
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Arcade module: two mini piers + arch ring (the gold arches on ivory bands). */
function arcadeArchGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const pier = new BoxGeometry(0.5, 3.4, 0.8);
    pier.translate(s * 1.05, 1.7, 0);
    parts.push(pier);
  }
  const ring = new TorusGeometry(1.05, 0.26, 8, 20, Math.PI);
  ring.translate(0, 3.4, 0);
  parts.push(ring);
  const merged = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** Warm glow pane recessed inside each arcade arch. */
function arcadeGlowGeometry(): BufferGeometry {
  const rect = new PlaneGeometry(1.7, 3.4);
  rect.translate(0, 1.7, 0);
  const head = new CircleGeometry(0.85, 14, 0, Math.PI);
  head.translate(0, 3.4, 0);
  const merged = mergeGeometries([rect, head]);
  rect.dispose();
  head.dispose();
  return merged;
}

/**
 * Faceted foundation gem course: a coarsely-cut crystalline prism —
 * deterministic vertex jitter, then flat facet normals (non-indexed).
 */
function facetedBandGeometry(len: number, h: number, thick: number, seed: number): BufferGeometry {
  // facet pitch ~2.2 local (≈44 m world): big enough to read from the plaza,
  // small enough to break the band into distinct cut faces (len/7 gave 140 m
  // undulations that read as a smooth wavy strip, not a jewelled course)
  const segs = Math.max(12, Math.round(len / 2.2));
  const geo = new BoxGeometry(len, h, thick, segs, 3, 3);
  const pos = geo.getAttribute('position');
  let state = (seed * 2654435761) >>> 0;
  const rand = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff - 0.5;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // keep the ends and the ground line intact so courses still meet cleanly
    if (Math.abs(x) > len / 2 - 0.6 || y < -h / 2 + 0.3) continue;
    pos.setXYZ(i, x + rand() * 1.1, y + rand() * 0.85, pos.getZ(i) + rand() * 1.0);
  }
  const faceted = geo.toNonIndexed();
  geo.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

// ---------------------------------------------------------------------------
// Instanced placement
// ---------------------------------------------------------------------------

type Placement = { u: number; y: number; off: number; face: Face; sy?: number };

function instancedOnFaces(
  geo: BufferGeometry,
  mat: MeshStandardNodeMaterial,
  places: Placement[],
  opts?: { castShadow?: boolean },
): InstancedMesh {
  const mesh = new InstancedMesh(geo, mat, places.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3();
  const Y = new Vector3(0, 1, 0);
  places.forEach((pl, i) => {
    if (pl.face.axis === 'z') p.set(pl.u, pl.y, pl.face.sign * pl.off);
    else p.set(pl.face.sign * pl.off, pl.y, pl.u);
    q.setFromAxisAngle(Y, faceYaw(pl.face));
    s.set(1, pl.sy ?? 1, 1);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.computeBoundingSphere();
  mesh.castShadow = opts?.castShadow ?? true;
  mesh.receiveShadow = true;
  return mesh;
}

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
/**
 * Ivory cornice slab thickness (local units). Every tier-top pavement plane
 * must have exactly ONE owner mesh: coplanar top faces (core/plinth/wall/jamb
 * vs the cornice slab) z-fight into banded stripes that crawl with the camera
 * (user-reported, city-wide). Structural boxes under a cornice stop at the
 * cornice's UNDERSIDE; the walkable planes (cityCollide floors) never move.
 */
const CORNICE_T = 2.4;

function buildWallSide(
  face: Face,
  inner: number,
  outer: number,
  h: number,
  mat: MeshStandardNodeMaterial,
): Mesh[] {
  const meshes: Mesh[] = [];
  const radialMid = (face.sign * (inner + outer)) / 2;
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

/**
 * A pearl gate portal: gold jambs framing the gap, a nacre voussoir ring on
 * the outer wall plane, and the pearl arch head over the walkable opening.
 */
function buildGatePortal(
  face: Face,
  offset: number,
  inner: number,
  outer: number,
  h: number,
  jambMat: MeshStandardNodeMaterial,
  pearlMat: MeshPhysicalNodeMaterial,
): Group {
  const g = new Group();
  const radialThick = outer - inner;
  const radialMid = (face.sign * (inner + outer)) / 2;
  const jambW = 1.4;
  const archH = GATE_WIDTH * 0.42; // clearance under the arch stays walkable

  // jambs stop at the cornice underside (top face would z-fight its slab);
  // the voussoir ring and arch head keep their full-height h positions
  const jambH = h - CORNICE_T;
  for (const side of [-1, 1] as const) {
    const u = offset + side * (GATE_WIDTH / 2 + jambW / 2);
    const jamb = new Mesh(new BoxGeometry(jambW, jambH, radialThick), jambMat);
    if (face.axis === 'z') jamb.position.set(u, jambH / 2, radialMid);
    else jamb.position.set(radialMid, jambH / 2, u);
    jamb.castShadow = true;
    jamb.receiveShadow = true;
    g.add(jamb);
  }

  // Nacre voussoir ring around the opening on the outer wall plane — real
  // relief a visitor stands under, not a painted arch.
  const ring = new Mesh(
    new TorusGeometry(GATE_WIDTH / 2 + 0.8, 0.85, 12, 28, Math.PI),
    pearlMat,
  );
  const ringOff = face.sign * (outer + 0.3);
  if (face.axis === 'z') {
    ring.position.set(offset, h - archH, ringOff);
  } else {
    ring.position.set(ringOff, h - archH, offset);
    ring.rotation.y = Math.PI / 2;
  }
  ring.castShadow = true;
  g.add(ring);

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

/**
 * The inscribed tribe names over the twelve gates (Rev 21:12 — "on the
 * gates the names of the twelve tribes of the sons of Israel were
 * inscribed"; side assignment per Ezek 48:30-34, RENDERING-DECISIONS #2).
 * The inscription's EXISTENCE is cited content; the applied gold-letter
 * treatment, serif face and size are art direction. Zero assets: one
 * runtime Canvas2D atlas (the BootUI precedent), one alpha-cutout
 * material, one merged 12-quad mesh — a single draw. Emissive stays far
 * under the 1.5 bloom threshold (contract: base tier never blooms).
 */
function buildGateInscriptions(outer: number): Mesh {
  const ROW_H = 170;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 2048;
  const ctx2d = canvas.getContext('2d');
  if (ctx2d) {
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    ctx2d.fillStyle = '#ffffff';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.font = '600 118px Georgia, "Times New Roman", serif';
    GATES.forEach((gate, i) => {
      ctx2d.fillText(gate.tribe.toUpperCase(), 512, i * ROW_H + ROW_H / 2);
    });
  }
  const atlas = new CanvasTexture(canvas);
  atlas.colorSpace = SRGBColorSpace;
  atlas.anisotropy = 8;

  const mat = new MeshStandardNodeMaterial();
  mat.map = atlas;
  mat.alphaTest = 0.55;
  mat.color.copy(GOLD).multiplyScalar(1.15);
  mat.emissive.copy(GOLD);
  mat.emissiveIntensity = 0.4; // legible at approach range, never blooms
  mat.roughness = 0.45;
  mat.metalness = 0.15;
  mat.side = FrontSide;

  // On the ivory cornice fascia over each gate — the classical entablature
  // frieze position: the tier-0 cornice slab spans y 13.6..16 at radial
  // half+2.5 (built below), so letters sit proud of ITS outer face; the
  // dentil course (y ~12.9, radial half+2.1) passes underneath. Gold on
  // ivory matches the arcade-course language.
  const W = 13;
  const H = 2.0;
  const yMid = 14.8;
  const proud = outer + 2.5 + 0.35;

  const quads = GATES.map((gate, i) => {
    const geo = new PlaneGeometry(W, H);
    // row band in the atlas (CanvasTexture flipY: v=1 is canvas top, so
    // row i spans v in [1-(i+1)*rowV, 1-i*rowV])
    const rowV = ROW_H / canvas.height;
    const uv = geo.getAttribute('uv');
    for (let k = 0; k < uv.count; k++) {
      uv.setY(k, 1 - (i + 1) * rowV + uv.getY(k) * rowV);
    }
    // orient so the plane's normal faces outward and its +x is viewer-right
    const face = SIDE_FACE[gate.side];
    if (face.axis === 'z') {
      if (face.sign < 0) geo.rotateY(Math.PI);
      geo.translate(gate.offset, yMid, face.sign * proud);
    } else {
      geo.rotateY(face.sign > 0 ? Math.PI / 2 : -Math.PI / 2);
      geo.translate(face.sign * proud, yMid, gate.offset);
    }
    return geo;
  });
  const merged = mergeGeometries(quads);
  for (const q of quads) q.dispose();
  const mesh = new Mesh(merged, mat);
  mesh.name = 'gate-inscriptions';
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Twelve jewelled foundation courses (Rev 21:19-20) as faceted gem volumes,
 * NOTCHED at the gate openings (cityModel.foundationCourseSpans — the shared
 * table cityCollide's wall collision reads too). Un-notched, the course
 * walled off every gate approach at ground level, contradicting
 * RENDERING-DECISIONS #2's real, walkable gate gaps — the pilaster and
 * dentil courses already skip gate slots for the same reason.
 */
function buildFoundationCourse(outer: number): Group {
  const g = new Group();
  const { h: bandH, thick: bandThick, sink, inset } = FOUNDATION_COURSE;
  const spans = foundationCourseSpans();
  FOUNDATION_BANDS.forEach((band, bi) => {
    const face = SIDE_FACE[band.side];
    // FOUNDATION_GEMS colours are ESV-order stylised hues (ADR 0009 rule 2 —
    // not photoreal mineralogy); ordered access mirrors cityModel's own
    // FOUNDATION_BANDS↔FOUNDATION_GEMS[band.gem] pairing.
    const mat = gemMaterial(FOUNDATION_GEMS[band.gem].color);
    const bandIdx = FOUNDATION_BAND_OFFSETS.indexOf(band.offset);
    const radialMid = face.sign * (outer + bandThick / 2 - inset);
    spans
      .filter((s) => s.band === bandIdx)
      .forEach((s, si) => {
        const geo = facetedBandGeometry(s.u1 - s.u0, bandH, bandThick, bi * 4 + si + 3);
        const stone = new Mesh(geo, mat);
        const c = (s.u0 + s.u1) / 2;
        if (face.axis === 'z') stone.position.set(c, bandH / 2 - sink, radialMid);
        else stone.position.set(radialMid, bandH / 2 - sink, c);
        stone.rotation.y = face.axis === 'x' ? Math.PI / 2 : 0;
        stone.receiveShadow = true;
        g.add(stone);
      });
  });
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

// ---------------------------------------------------------------------------
// The city
// ---------------------------------------------------------------------------

export function buildCityMassing(gi: ProbeGI | null = null): Group {
  const city = new Group();
  city.name = 'new-jerusalem';

  const trimInst = trimGoldInstanced(gi);
  const trimPlain = trimGoldPlain(gi);
  const ivory = ivoryMaterial(gi);
  const pearl = pearlMaterial();

  // Street-of-gold apron around the base.
  const apron = new MeshStandardNodeMaterial();
  apron.color.copy(GOLD);
  apron.metalness = 0.5;
  apron.roughness = 0.3;
  patchCityGI(apron, gi);
  const plaza = new Mesh(new BoxGeometry(232, 5, 232), apron);
  plaza.position.y = -2.5;
  plaza.receiveShadow = true;
  plaza.castShadow = true;
  city.add(plaza);

  // Shared massing table (cityModel.CITY_TIERS — RiverOfLife reads the same).
  const tiers = CITY_TIERS;
  const last = tiers.length - 1;

  // Warm glow panes inside the arcade courses (shared, instanced).
  const arcGlowMat = new MeshStandardNodeMaterial();
  arcGlowMat.color.copy(GOLD);
  arcGlowMat.emissiveNode = vec3(1.0, 0.78, 0.47)
    .mul(slotHash(instanceIndex as unknown as NU, 23).mul(0.3).add(0.8))
    .mul(0.95) as unknown as NV3;
  arcGlowMat.roughness = 0.5;

  const arcadeArcGeo = arcadeArchGeometry();
  const arcadeGlowGeo = arcadeGlowGeometry();
  const dentilGeo = new BoxGeometry(0.72, 0.85, 0.7);
  const arcadePlaces: Placement[] = [];
  const arcadeGlowPlaces: Placement[] = [];
  const dentilPlaces: Placement[] = [];

  let yBot = 0;
  for (let ti = 0; ti < tiers.length; ti++) {
    const t = tiers[ti];
    const f = ti / last; // 0 at base .. 1 at crown
    const H = t.h;
    const yc = yBot + H / 2;
    const yTop = yBot + H;

    if (ti === 0) {
      // Base tier = jasper WALL (Rev 21:18; RENDERING-DECISIONS #2 governs
      // the gate order), split into a solid inner plinth and an outer wall
      // ring with real gaps at the twelve named gates.
      const jasper = jasperMaterial(gi);
      const innerHalf = PLINTH_HALF; // clears tier 1's footprint (shared with cityCollide)
      const plinthMat = new MeshStandardNodeMaterial();
      plinthMat.color.copy(GOLD);
      plinthMat.metalness = 0.55;
      plinthMat.roughness = 0.3;
      plinthMat.emissive.copy(GOLD);
      plinthMat.emissiveIntensity = 0.55;
      patchCityGI(plinthMat, gi);
      const plinth = new Mesh(
        new BoxGeometry(2 * innerHalf, H - CORNICE_T, 2 * innerHalf),
        plinthMat,
      );
      plinth.position.y = yc - CORNICE_T / 2;
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      city.add(plinth);

      for (const face of FACES) {
        for (const seg of buildWallSide(face, innerHalf, t.half, H - CORNICE_T, jasper))
          city.add(seg);
      }
      for (const gate of GATES) {
        city.add(
          buildGatePortal(SIDE_FACE[gate.side], gate.offset, innerHalf, t.half, H, trimPlain, pearl),
        );
      }
      city.add(buildGateInscriptions(t.half));
      city.add(buildFoundationCourse(t.half));

      // Wall pilasters between the gates (the pier rhythm skips every slot
      // within a gate width of a gate offset — the portals own those slots).
      const pilGeo = flutedPierGeometry(4, H, 2.6);
      const pilPlaces: Placement[] = [];
      for (const face of FACES) {
        for (let k = -4; k <= 4; k++) {
          const u = k * 25;
          if (GATE_OFFSETS.some((g0) => Math.abs(g0 - u) < GATE_WIDTH)) continue;
          pilPlaces.push({ u, y: 0, off: t.half + 0.6, face });
        }
      }
      city.add(instancedOnFaces(pilGeo, trimInst, pilPlaces));
    } else if (ti === last) {
      // Crown — solid, glowing, under the glory (deliberate gentle bloom).
      const crownMat = new MeshStandardNodeMaterial();
      const col = GOLD.clone().lerp(CRYSTAL, 1);
      crownMat.color.copy(col);
      crownMat.metalness = 0;
      crownMat.roughness = 0.14;
      crownMat.emissive.copy(col);
      crownMat.emissiveIntensity = 1.7;
      const crown = new Mesh(new BoxGeometry(2 * t.half, H, 2 * t.half), crownMat);
      crown.position.y = yc;
      crown.castShadow = true;
      crown.receiveShadow = true;
      city.add(crown);
    } else {
      // Terrace tier: opaque glowing interior core + translucent gold glass
      // skin in giant arch bays + instanced gold relief frames and piers.
      const coreHalf = t.half - 2;
      const coreH = H - CORNICE_T; // top abuts the cornice underside, no z-fight
      const core = new Mesh(
        new BoxGeometry(2 * coreHalf, coreH, 2 * coreHalf),
        interiorMaterial(f, coreH, gi),
      );
      core.position.y = yBot + coreH / 2;
      core.castShadow = true;
      core.receiveShadow = true;
      city.add(core);

      const W = 2 * t.half;
      const bay = W / t.arches;
      const ow = bay * 0.62;
      const coursesBelow = ti === 1 ? 2 : 1;
      const winBot = yBot + coursesBelow * 4.6 + 1.4;
      const winH = Math.max(8, yTop - 5.5 - winBot - ow / 2);
      const paneH = winH + ow / 2;

      const glassGeo = glassPaneGeometry(ow, winH);
      const frameGeo = archFrameGeometry(ow, winH, bay * 0.07, 2.4);
      const glassMat = goldGlassMaterial(f, paneH);
      const glassPlaces: Placement[] = [];
      const framePlaces: Placement[] = [];
      for (const face of FACES) {
        for (let i = 0; i < t.arches; i++) {
          const u = -W / 2 + bay * (i + 0.5);
          glassPlaces.push({ u, y: winBot, off: t.half + TIER_GLASS_PROUD, face });
          framePlaces.push({ u, y: winBot, off: t.half + 0.7, face });
        }
      }
      const glassMesh = instancedOnFaces(glassGeo, glassMat, glassPlaces, { castShadow: false });
      glassMesh.receiveShadow = false;
      city.add(glassMesh);
      city.add(instancedOnFaces(frameGeo, trimInst, framePlaces));

      // Full-height fluted piers at the bay lines.
      const pierGeo = flutedPierGeometry(bay * 0.2, H - 2.2, 3);
      const pierPlaces: Placement[] = [];
      for (const face of FACES) {
        for (let i = 0; i <= t.arches; i++) {
          const u = -W / 2 + bay * i;
          if (riverSlot(face, u)) continue; // the cascade owns the meridian
          pierPlaces.push({ u, y: yBot, off: t.half + 0.6, face });
        }
      }
      city.add(instancedOnFaces(pierGeo, trimInst, pierPlaces));

      // Gold frieze fascia between the glass heads and the cornice.
      for (const face of FACES) {
        const fascia = new Mesh(new BoxGeometry(W, 3.6, 1.2), trimPlain);
        placeOnFace(fascia, 0, yTop - 4.2, t.half + 0.2, face);
        fascia.castShadow = true;
        city.add(fascia);
      }
    }

    // IVORY cornice slab at the tier top (the pale band at every setback —
    // also the terrace pavement of the ledge above). On the crown the SUMMIT
    // floor is the crown mesh itself (sea of glass, cityCollide's claim), so
    // there the slab drops 0.15 (3 m world, imperceptible at the crown band's
    // 48 m height) to cede the top plane instead of z-fighting it.
    const corniceDrop = ti === last ? 0.15 : 0;
    const cornice = new Mesh(
      new BoxGeometry(2 * t.half + 5, CORNICE_T, 2 * t.half + 5),
      ivory,
    );
    cornice.position.y = yTop - CORNICE_T / 2 - corniceDrop;
    cornice.castShadow = true;
    cornice.receiveShadow = true;
    city.add(cornice);

    // Gold dentil course under the cornice lip.
    for (const face of FACES) {
      const n = Math.floor((2 * t.half) / 1.55);
      for (let i = 0; i < n; i++) {
        const u = -t.half + 1.55 * (i + 0.5);
        if (ti === 0 && GATE_OFFSETS.some((g0) => Math.abs(g0 - u) < GATE_WIDTH / 2 + 1.6)) continue;
        if (riverSlot(face, u)) continue;
        dentilPlaces.push({ u, y: yTop - 3.1, off: t.half + 2.1, face });
      }
    }

    // Arcade course(s) ringing the next tier's base on this ledge: ivory
    // fascia bands carrying rows of gold arches with warm glow panes.
    if (ti < last) {
      const ringHalf = tiers[ti + 1].half;
      const courses = ti === 0 ? 2 : 1;
      for (let c = 0; c < courses; c++) {
        const yb = yTop + c * 4.6;
        for (const face of FACES) {
          const fascia = new Mesh(new BoxGeometry(2 * ringHalf + 4, 4.6, 1.4), ivory);
          placeOnFace(fascia, 0, yb + 2.3, ringHalf + 0.9, face);
          fascia.castShadow = true;
          fascia.receiveShadow = true;
          city.add(fascia);
          const n = Math.floor((2 * ringHalf - 3) / 2.9);
          for (let i = 0; i < n; i++) {
            const u = -ringHalf + 1.5 + 2.9 * (i + 0.5);
            if (riverSlot(face, u)) continue;
            arcadePlaces.push({ u, y: yb + 0.5, off: ringHalf + 1.8, face });
            arcadeGlowPlaces.push({ u, y: yb + 0.6, off: ringHalf + 1.35, face });
          }
        }
      }
    }

    yBot += H;
  }

  city.add(instancedOnFaces(arcadeArcGeo, trimInst, arcadePlaces));
  const glows = instancedOnFaces(arcadeGlowGeo, arcGlowMat, arcadeGlowPlaces, {
    castShadow: false,
  });
  glows.receiveShadow = false;
  city.add(glows);
  city.add(instancedOnFaces(dentilGeo, trimInst, dentilPlaces));

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
  njLive.glory = gloryMat;
  const glory = new Mesh(new SphereGeometry(11, 32, 24), gloryMat);
  glory.position.y = yBot + 10;
  city.add(glory);

  // Sea of glass before the throne (Rev 4:6, clear tier — rendered as the
  // figure of the vision per ADR 0009 rule 2): a reflective crystalline
  // floor across the crown top.
  const seaMat = new MeshPhysicalNodeMaterial();
  seaMat.color.setHex(0xcfe8ee);
  seaMat.metalness = 0;
  seaMat.roughness = 0.05;
  seaMat.clearcoat = 1.0;
  seaMat.clearcoatRoughness = 0.06;
  seaMat.emissive.setHex(0xbfe2ec);
  seaMat.emissiveIntensity = 0.5;
  const crownHalf = tiers[tiers.length - 1].half;
  const seaGeo = new CircleGeometry(crownHalf - 0.5, 48);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new Mesh(seaGeo, seaMat);
  sea.position.y = yBot + 0.06;
  sea.receiveShadow = true;
  city.add(sea);

  // The rainbow around the throne (Rev 4:3) — full spectrum with emerald
  // prominence per RENDERING-DECISIONS #4: a horizontal spectral ring
  // encircling the glory, additive-glow read; the emerald band alone grazes
  // the bloom threshold (its stated prominence).
  const RING_R = 17;
  const RING_TUBE = 2.4;
  const rainGeo = new TorusGeometry(RING_R, RING_TUBE, 16, 96);
  rainGeo.rotateX(Math.PI / 2);
  const rainMat = new MeshStandardNodeMaterial();
  rainMat.transparent = true;
  rainMat.depthWrite = false;
  rainMat.side = DoubleSide;
  const rad = positionLocal.xz.length() as unknown as NF;
  const fSpec = rad.sub(RING_R - RING_TUBE).div(2 * RING_TUBE).clamp(0, 1) as unknown as NF;
  const cBlue = mix(
    vec3(0.45, 0.15, 0.85),
    vec3(0.15, 0.35, 0.95),
    smoothstep(0.0, 0.22, fSpec) as unknown as NF,
  ) as unknown as NV3;
  const cEmerald = mix(
    cBlue,
    vec3(0.05, 0.9, 0.4),
    smoothstep(0.22, 0.45, fSpec) as unknown as NF,
  ) as unknown as NV3;
  const cYellow = mix(
    cEmerald,
    vec3(0.85, 0.85, 0.2),
    smoothstep(0.58, 0.78, fSpec) as unknown as NF,
  ) as unknown as NV3;
  const cRed = mix(
    cYellow,
    vec3(0.9, 0.2, 0.15),
    smoothstep(0.78, 0.95, fSpec) as unknown as NF,
  ) as unknown as NV3;
  rainMat.colorNode = vec3(0, 0, 0) as unknown as typeof rainMat.colorNode;
  rainMat.emissiveNode = cRed.mul(2.1) as unknown as typeof rainMat.emissiveNode;
  rainMat.opacityNode = smoothstep(0.0, 0.12, fSpec)
    .mul(smoothstep(1.0, 0.88, fSpec) as unknown as NF)
    .mul(0.75) as unknown as typeof rainMat.opacityNode;
  const rainbow = new Mesh(rainGeo, rainMat);
  rainbow.position.y = glory.position.y;
  city.add(rainbow);

  return city;
}
