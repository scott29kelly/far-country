/**
 * FigureMesh — the seeded parametric human-figure generator (M3.6 attack
 * plan step 2; ADR 0019). ONE generator emits every LOD tier of the same
 * archetype: a robed human figure — head, hair, neck, sleeved arms (one
 * raised holding a palm branch), hands, and a fold-pleated robe falling to
 * the pavement — so LOD transitions swap detail, never identity.
 *
 * These meshes are the honest CURRENT ceiling of the runtime-procedural
 * path: real human proportions, pose, skin/hair regions — not yet photoreal
 * faces. The near-ring photoreal tier is gated on the authoring-posture
 * decision recorded in STATUS.md (ADR 0019 consequence); under EITHER
 * answer these meshes remain the mid/near LOD scaffolding.
 *
 * Conventions:
 *   - local origin at the feet, +Y up, the figure FACES −Z (yaw 0 looks
 *     north, matching FlyCamera and the placement's summit-facing yaw).
 *   - every vertex carries an 'aregion' float (REGION.robe/skin/hair/frond)
 *     — the crowd material selects albedo/roughness/emissive per region so
 *     one draw covers the whole figure.
 *   - geometry is watertight where it can be seen INTO (hem and neckline
 *     capped) — a walker stands right next to the near ring.
 *   - pure three.js BufferGeometry: builds headless under node for the
 *     triangle-budget probes.
 */

import { BufferAttribute, BufferGeometry, Quaternion, Vector3 } from 'three';
import {
  EYE_ALBEDO,
  REGION,
  hairAt,
  robeAlbedo,
  skinAt,
  type FigureArchetype,
} from './figureModel';
import { FIGURES_VENDORED, type VendoredPart } from './figuresVendored.gen';

/**
 * The ADR 0020 vendored near tier: per-archetype Anny head/eye/hand
 * submeshes, keyed by archetype name. The near LOD consumes them when
 * present; every other tier and the probe fallback path stay procedural.
 */
const VENDORED = new Map(FIGURES_VENDORED.figures.map((f) => [f.name, f]));

function decodeB64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function decodePart(p: VendoredPart): { pos: Float32Array; idx: Uint16Array } {
  return {
    pos: new Float32Array(decodeB64(p.pos).buffer),
    idx: new Uint16Array(decodeB64(p.idx).buffer),
  };
}

/** per-LOD tessellation plan (the generator's only LOD-dependent input) */
interface LodSpec {
  robeRadial: number;
  robeRings: number;
  headW: number;
  headH: number;
  armRadial: number;
  hands: boolean;
  nose: boolean;
  hairShell: boolean;
  frondLeafPairs: number;
  foldHarmonics: number;
}

const LODS: readonly LodSpec[] = [
  {
    robeRadial: 44,
    robeRings: 26,
    headW: 22,
    headH: 16,
    armRadial: 12,
    hands: true,
    nose: true,
    hairShell: true,
    frondLeafPairs: 11,
    foldHarmonics: 3,
  },
  {
    robeRadial: 14,
    robeRings: 8,
    headW: 9,
    headH: 7,
    armRadial: 6,
    hands: false,
    nose: false,
    hairShell: true,
    frondLeafPairs: 3,
    foldHarmonics: 1,
  },
];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** growable soup the part builders append into */
class MeshAcc {
  pos: number[] = [];
  region: number[] = [];
  idx: number[] = [];

  vert(x: number, y: number, z: number, region: number): number {
    const i = this.pos.length / 3;
    this.pos.push(x, y, z);
    this.region.push(region);
    return i;
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.idx.push(a, b, c, a, c, d);
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  /** append a decoded vendored part, rotated then offset into figure space */
  part(
    p: { pos: Float32Array; idx: Uint16Array },
    region: number,
    rot: Quaternion | null,
    off: Vector3,
  ): void {
    const base = this.pos.length / 3;
    const v = new Vector3();
    for (let i = 0; i < p.pos.length; i += 3) {
      v.set(p.pos[i], p.pos[i + 1], p.pos[i + 2]);
      if (rot) v.applyQuaternion(rot);
      this.pos.push(v.x + off.x, v.y + off.y, v.z + off.z);
      this.region.push(region);
    }
    for (let i = 0; i < p.idx.length; i++) this.idx.push(base + p.idx[i]);
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute('aregion', new BufferAttribute(new Float32Array(this.region), 1));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

/** smoothstep-interpolated piecewise profile through (t, value) points */
function profileAt(pts: readonly (readonly [number, number])[], t: number): number {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1];
      const [t1, v1] = pts[i];
      const f = (t - t0) / (t1 - t0);
      const s = f * f * (3 - 2 * f);
      return v0 + (v1 - v0) * s;
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Tapered tube along a polyline (arms, frond rachis) — radial ring per
 * node, quads between, end cap fan at the tail. Frames via a fixed
 * reference up (limbs never point straight up at the reference).
 */
function tube(
  acc: MeshAcc,
  nodes: readonly Vector3[],
  radii: readonly number[],
  radial: number,
  region: number,
  capEnd: boolean,
): number[] {
  const rings: number[][] = [];
  const tang = new Vector3();
  const side = new Vector3();
  const up = new Vector3();
  const ref = new Vector3(0, 1, 0);
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[Math.max(0, i - 1)];
    const b = nodes[Math.min(nodes.length - 1, i + 1)];
    tang.subVectors(b, a).normalize();
    if (Math.abs(tang.dot(ref)) > 0.95) ref.set(1, 0, 0);
    side.crossVectors(ref, tang).normalize();
    up.crossVectors(tang, side).normalize();
    const ring: number[] = [];
    for (let k = 0; k < radial; k++) {
      const th = (k / radial) * Math.PI * 2;
      const r = radii[i];
      ring.push(
        acc.vert(
          nodes[i].x + (side.x * Math.cos(th) + up.x * Math.sin(th)) * r,
          nodes[i].y + (side.y * Math.cos(th) + up.y * Math.sin(th)) * r,
          nodes[i].z + (side.z * Math.cos(th) + up.z * Math.sin(th)) * r,
          region,
        ),
      );
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let k = 0; k < radial; k++) {
      const kn = (k + 1) % radial;
      acc.quad(rings[i][k], rings[i][kn], rings[i + 1][kn], rings[i + 1][k]);
    }
  }
  if (capEnd) {
    const last = nodes[nodes.length - 1];
    const c = acc.vert(last.x, last.y, last.z, region);
    const ring = rings[rings.length - 1];
    for (let k = 0; k < radial; k++) acc.tri(ring[k], ring[(k + 1) % radial], c);
  }
  return rings[rings.length - 1];
}

/** lat/long ellipsoid with optional jaw taper + nose ridge (the head) */
function ellipsoid(
  acc: MeshAcc,
  center: Vector3,
  rx: number,
  ry: number,
  rz: number,
  w: number,
  h: number,
  region: number,
  shape?: { jaw?: number; nose?: number },
): void {
  const grid: number[][] = [];
  for (let j = 0; j <= h; j++) {
    const row: number[] = [];
    const phi = (j / h) * Math.PI; // 0 top → π bottom
    for (let i = 0; i < w; i++) {
      const th = (i / w) * Math.PI * 2;
      let dx = Math.sin(phi) * Math.sin(th);
      const dy = Math.cos(phi);
      let dz = Math.sin(phi) * Math.cos(th);
      // jaw taper: below the equator the skull narrows toward the chin
      let lat = 1;
      if (shape?.jaw && dy < 0) lat = 1 - shape.jaw * dy * dy;
      dx *= lat;
      dz *= lat;
      let px = center.x + dx * rx;
      let py = center.y + dy * ry;
      let pz = center.z + dz * rz;
      // nose ridge: a subtle outward push on the front column just below
      // the equator — a face HINT, not a face claim (ADR 0019 near tier
      // is gated; this keeps the head reading human in silhouette)
      if (shape?.nose) {
        const front = -dz; // face is −z
        const band = Math.exp(-Math.pow((dy + 0.18) / 0.16, 2));
        const col = Math.exp(-Math.pow(dx / 0.22, 2));
        if (front > 0.6) pz -= shape.nose * band * col * front;
      }
      row.push(acc.vert(px, py, pz, region));
    }
    grid.push(row);
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const inx = (i + 1) % w;
      acc.quad(grid[j][i], grid[j][inx], grid[j + 1][inx], grid[j + 1][i]);
    }
  }
}

/**
 * Hair shell: partial sphere over the head, offset outward, the face window
 * left open. Style 1 (shoulder-length) stretches the lower back rows down.
 */
function hairShell(
  acc: MeshAcc,
  center: Vector3,
  rx: number,
  ry: number,
  rz: number,
  style: 0 | 1 | 2,
  w: number,
  h: number,
  // face-window thresholds: no hair where -dz > faceDz AND dy < faceDy.
  // Defaults fit the procedural ellipsoid head; the vendored Anny heads
  // (real skull proportions, chin inside the bbox) pass a smaller window
  // or the shell collapses to a back strip — GPU-review finding, slice 1.
  faceDz = 0.42,
  faceDy = 0.55,
  // angular-reach multiplier: the vendored Anny skulls need the shell to
  // reach the nape (the ellipsoid tuning stops above the occiput)
  phiScale = 1,
): void {
  const off = 1.09;
  const maxPhi =
    (style === 2 ? Math.PI * 0.46 : style === 1 ? Math.PI * 0.72 : Math.PI * 0.6) * phiScale;
  const grid: (number | null)[][] = [];
  for (let j = 0; j <= h; j++) {
    const row: (number | null)[] = [];
    const phi = (j / h) * maxPhi;
    for (let i = 0; i < w; i++) {
      const th = (i / w) * Math.PI * 2;
      const dx = Math.sin(phi) * Math.sin(th);
      const dy = Math.cos(phi);
      const dz = Math.sin(phi) * Math.cos(th);
      // face window: forward-and-low directions carry no hair
      if (-dz > faceDz && dy < faceDy) {
        row.push(null);
        continue;
      }
      let py = center.y + dy * ry * off;
      // shoulder-length: the lower back rows fall toward the shoulders
      if (style === 1 && dz > 0.15 && phi > Math.PI * 0.5) {
        py -= (phi / maxPhi - 0.68) * ry * 2.2 * dz;
      }
      row.push(
        acc.vert(center.x + dx * rx * off, py, center.z + dz * rz * off, REGION.hair),
      );
    }
    grid.push(row);
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const inx = (i + 1) % w;
      const a = grid[j][i];
      const b = grid[j][inx];
      const c = grid[j + 1][inx];
      const d = grid[j + 1][i];
      if (a !== null && b !== null && c !== null && d !== null) acc.quad(a, b, c, d);
    }
  }
}

/** two-sided leaflet quad for the palm frond */
function leaflet(acc: MeshAcc, base: Vector3, dir: Vector3, len: number, width: number, upRef: Vector3): void {
  const tip = base.clone().addScaledVector(dir, len);
  const side = new Vector3().crossVectors(dir, upRef).normalize().multiplyScalar(width / 2);
  const droop = new Vector3(0, -len * 0.18, 0);
  const a = acc.vert(base.x - side.x, base.y - side.y, base.z - side.z, REGION.frond);
  const b = acc.vert(base.x + side.x, base.y + side.y, base.z + side.z, REGION.frond);
  const c = acc.vert(tip.x + side.x * 0.25 + droop.x, tip.y + droop.y, tip.z + side.z * 0.25 + droop.z, REGION.frond);
  const d = acc.vert(tip.x - side.x * 0.25 + droop.x, tip.y + droop.y, tip.z - side.z * 0.25 + droop.z, REGION.frond);
  acc.quad(a, b, c, d);
  acc.quad(a, d, c, b); // back face — region material renders single-sided
}

const lerp3 = (a: readonly number[], b: readonly number[], t: number): Vector3 =>
  new Vector3(
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  );

/**
 * Build one archetype's figure at one LOD tier. Deterministic: geometry
 * depends only on (archetype, lod).
 */
export function buildFigureGeometry(a: FigureArchetype, lod: 0 | 1): BufferGeometry {
  const spec = LODS[lod];
  const acc = new MeshAcc();
  const H = a.height;
  const bw = a.buildW;
  const rng = mulberry32(0x5c0ffee ^ Math.imul(a.foldSeed, 2654435761));
  const foldPhase = [rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2];

  // stoop: ring centres drift forward (−z) with height; everything above
  // the neckline follows czTop
  const cz = (t: number): number => {
    const s = t < 0.3 ? 0 : (t - 0.3) / 0.7;
    return -a.stoop * 0.09 * H * s * s;
  };
  const czTop = cz(1);

  // ---- robe loft: hem → neckline, capped both ends -------------------------
  const NECK_T = 0.865;
  const rxPts = [
    [0, 0.13 * Math.sqrt(bw)],
    [0.25, 0.1 * Math.pow(bw, 0.7)],
    [0.55, 0.088 * bw],
    [0.72, 0.105 * bw],
    [0.82, 0.128 * bw],
    [1, 0.032],
  ] as const;
  const rzPts = [
    [0, 0.115 * Math.sqrt(bw)],
    [0.25, 0.085 * Math.pow(bw, 0.7)],
    [0.55, 0.075 * bw],
    [0.72, 0.082 * bw],
    [0.82, 0.075 * bw],
    [1, 0.032],
  ] as const;
  const hemY = 0.012 * H;
  const robeGrid: number[][] = [];
  for (let j = 0; j <= spec.robeRings; j++) {
    const t = j / spec.robeRings;
    const y = hemY + t * (NECK_T * H - hemY);
    const rx = profileAt(rxPts, t) * H;
    const rz = profileAt(rzPts, t) * H;
    const foldAmp = 0.1 * Math.pow(1 - t, 1.3);
    const row: number[] = [];
    for (let i = 0; i < spec.robeRadial; i++) {
      const th = (i / spec.robeRadial) * Math.PI * 2;
      let fold = 0;
      if (spec.foldHarmonics >= 1) fold += 0.55 * Math.sin(3 * th + foldPhase[0]);
      if (spec.foldHarmonics >= 2) fold += 0.3 * Math.sin(7 * th + foldPhase[1]);
      if (spec.foldHarmonics >= 3) fold += 0.15 * Math.sin(11 * th + foldPhase[2]);
      const k = 1 + foldAmp * fold;
      row.push(acc.vert(Math.sin(th) * rx * k, y, cz(t) + Math.cos(th) * rz * k, REGION.robe));
    }
    robeGrid.push(row);
  }
  for (let j = 0; j < spec.robeRings; j++) {
    for (let i = 0; i < spec.robeRadial; i++) {
      const inx = (i + 1) % spec.robeRadial;
      acc.quad(robeGrid[j][i], robeGrid[j][inx], robeGrid[j + 1][inx], robeGrid[j + 1][i]);
    }
  }
  // hem + neckline caps (fans) — the robe is stood next to and looked into
  const hemC = acc.vert(0, hemY, cz(0), REGION.robe);
  for (let i = 0; i < spec.robeRadial; i++) {
    acc.tri(robeGrid[0][(i + 1) % spec.robeRadial], robeGrid[0][i], hemC);
  }
  const neckC = acc.vert(0, NECK_T * H, cz(1), REGION.skin);
  const topRow = robeGrid[spec.robeRings];
  for (let i = 0; i < spec.robeRadial; i++) {
    acc.tri(topRow[i], topRow[(i + 1) % spec.robeRadial], neckC);
  }

  // ---- neck + head + hair ---------------------------------------------------
  const neckR = 0.026 * H;
  tube(
    acc,
    [new Vector3(0, NECK_T * H - 0.005 * H, czTop), new Vector3(0, 0.9 * H, czTop)],
    [neckR, neckR * 0.92],
    Math.max(6, spec.armRadial),
    REGION.skin,
    false,
  );
  // ADR 0020 vendored near tier: the LOD0 head/eyes are the offline Anny
  // submeshes when present (bbox-centered in the payload — placed by
  // top-of-head alignment so the archetype height stays authoritative);
  // the procedural ellipsoid remains LOD1's head and the fallback.
  const vf = lod === 0 ? VENDORED.get(a.name) : undefined;
  const hairRows = Math.max(4, Math.round(spec.headH * 0.6));
  if (vf) {
    const hb = vf.head.bbox;
    const off = new Vector3(0, H * 0.995 - hb[4], czTop);
    acc.part(decodePart(vf.head), REGION.skin, null, off);
    acc.part(decodePart(vf.eyes), REGION.eye, null, off);
    if (spec.hairShell) {
      // hair shell fitted to the vendored head's real bounds. The Anny
      // head bbox includes chin and jaw, so the shell centers ABOVE the
      // bbox centre (crown-focused) with a smaller face window — the old
      // ellipsoid thresholds strip the hair to a mohawk band.
      // full bbox radii: the 1.09 shell offset provides the clearance; any
      // shrink sinks the shell inside the occipital bulge (skull pokes out)
      const ry = (hb[4] - hb[1]) / 2;
      const hc = new Vector3(
        (hb[0] + hb[3]) / 2,
        (hb[1] + hb[4]) / 2 + off.y + ((hb[4] - hb[1]) / 2) * 0.08,
        (hb[2] + hb[5]) / 2 + czTop,
      );
      hairShell(
        acc,
        hc,
        ((hb[3] - hb[0]) / 2) * 1.06,
        ry,
        ((hb[5] - hb[2]) / 2) * 1.02,
        a.hairStyle,
        spec.headW,
        hairRows,
        0.6,
        0.3,
        1.15,
      );
    }
  } else {
    const headRy = 0.062 * H;
    const headC = new Vector3(0, H - headRy * 1.06, czTop);
    ellipsoid(acc, headC, 0.048 * H, headRy, 0.052 * H, spec.headW, spec.headH, REGION.skin, {
      jaw: 0.32,
      ...(spec.nose ? { nose: 0.01 * H } : {}),
    });
    if (spec.hairShell) {
      hairShell(acc, headC, 0.048 * H, headRy, 0.052 * H, a.hairStyle, spec.headW, hairRows);
    }
  }

  // ---- arms (sleeved) --------------------------------------------------------
  const lift = a.armLift;
  const shX = 0.115 * H * bw + 0.01 * H;
  const shY = 0.8 * H;
  const upperLen = 0.16 * H;
  const foreLen = 0.15 * H;
  // raised right arm (+x), holding the frond
  const dirU = lerp3([0.78, 0.18, -0.25], [0.5, 0.82, -0.2], lift).normalize();
  const dirF = lerp3([0.15, 0.72, -0.5], [0.05, 0.95, -0.15], lift).normalize();
  const S = new Vector3(shX, shY, cz(0.82) - 0.01 * H);
  const E = S.clone().addScaledVector(dirU, upperLen);
  const W = E.clone().addScaledVector(dirF, foreLen);
  tube(acc, [S, E, W], [0.042 * H * bw, 0.036 * H, 0.023 * H], spec.armRadial, REGION.robe, !spec.hands);
  // lowered left arm (−x), hand settling in front
  const dirU2 = new Vector3(-0.28, -0.92, -0.06).normalize();
  const dirF2 = new Vector3(0.12, -0.78, -0.42).normalize();
  const S2 = new Vector3(-shX, shY, cz(0.82) - 0.01 * H);
  const E2 = S2.clone().addScaledVector(dirU2, upperLen);
  const W2 = E2.clone().addScaledVector(dirF2, foreLen);
  tube(acc, [S2, E2, W2], [0.042 * H * bw, 0.036 * H, 0.023 * H], spec.armRadial, REGION.robe, !spec.hands);
  if (vf) {
    // vendored Anny hands: wrist-centered in the payload; align the rest
    // forearm axis to this figure's own arm-chain direction and tuck the
    // wrist end just inside the sleeve cuff. Rest-pose OPEN hands are the
    // recorded slice-1 simplification (finger grip posing comes later).
    // Engine raised arm is the figure's RIGHT (+x local) — hand.R.
    const place = (
      part: VendoredPart,
      axis: readonly [number, number, number],
      wrist: Vector3,
      dir: Vector3,
    ): void => {
      const q = new Quaternion().setFromUnitVectors(
        new Vector3(axis[0], axis[1], axis[2]).normalize(),
        dir,
      );
      acc.part(decodePart(part), REGION.skin, q, wrist.clone().addScaledVector(dir, 0.012 * H));
    };
    place(vf.handR, vf.forearmAxisR, W, dirF);
    place(vf.handL, vf.forearmAxisL, W2, dirF2);
  } else if (spec.hands) {
    // the hand sits BEYOND the sleeve cuff (cuff 0.023H, hand ~0.029H tall)
    // or the cuff swallows it whole — GPU-review finding, first crowd pass
    const handR = 0.024 * H;
    for (const [wrist, dir] of [
      [W, dirF],
      [W2, dirF2],
    ] as const) {
      const hc = wrist.clone().addScaledVector(dir, handR * 1.25);
      ellipsoid(acc, hc, handR * 0.85, handR * 1.2, handR * 0.95, 7, 5, REGION.skin);
    }
  }

  // ---- palm branch in the raised hand (Rev 7:9) ------------------------------
  const grip = W.clone().addScaledVector(dirF, 0.02 * H);
  const axis = lerp3([0.16, 0.9, -0.22], [0.06, 0.98, -0.06], lift).normalize();
  const rachisLen = 0.42 * H;
  const base = grip.clone().addScaledVector(axis, -0.1 * H);
  const tipN = grip.clone().addScaledVector(axis, rachisLen);
  tube(acc, [base, grip, tipN], [0.007 * H, 0.006 * H, 0.003 * H], 5, REGION.frond, true);
  const upRef = new Vector3(0, 0, -1);
  for (let p = 0; p < spec.frondLeafPairs; p++) {
    const t = 0.25 + (0.7 * p) / Math.max(1, spec.frondLeafPairs - 1);
    const at = base.clone().lerp(tipN, t);
    const spread = 0.9 - t * 0.5;
    const len = 0.15 * H * (1 - t * 0.45);
    for (const sgn of [-1, 1]) {
      const side = new Vector3().crossVectors(axis, upRef).normalize();
      const dir = axis
        .clone()
        .multiplyScalar(1 - spread * 0.6)
        .addScaledVector(side, sgn * spread)
        .normalize();
      leaflet(acc, at, dir, len, 0.013 * H, upRef);
    }
  }
  // tip leaflet
  leaflet(acc, tipN, axis, 0.11 * H, 0.013 * H, upRef);

  return acc.build();
}

/**
 * Bake per-region MID-palette albedo into a 'color' vertex attribute — the
 * impostor capture's albedo source (a representative figure; the far ring
 * carries identity via scale/yaw/tint only).
 */
export function bakeRegionColors(geo: BufferGeometry, warm01 = 0.5, skin01 = 0.5, hair01 = 0.35, gray = 0.2): void {
  const region = geo.getAttribute('aregion') as BufferAttribute;
  const n = region.count;
  const colors = new Float32Array(n * 3);
  const robe = robeAlbedo(warm01);
  const skin = skinAt(skin01);
  const hair = hairAt(hair01, gray);
  const frond: readonly number[] = [0.31, 0.604, 0.235];
  for (let i = 0; i < n; i++) {
    const r = region.getX(i);
    const c =
      r < 0.5 ? robe : r < 1.5 ? skin : r < 2.5 ? hair : r < 3.5 ? frond : EYE_ALBEDO;
    colors[i * 3] = c[0];
    colors[i * 3 + 1] = c[1];
    colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
}
