/**
 * The trees of life (Rev 22:2) — "on either side of the river, the tree of
 * life with its twelve kinds of fruit... the leaves of the tree were for the
 * healing of the nations."
 *
 * Built with the engine's OWN tree pipeline (Species → growSkeleton →
 * buildTree + the VegMaterials factories) instead of the old box-trunk +
 * sphere-canopy placeholders — the single starkest quality contrast in the
 * scene was these blobs standing metres from real per-instance-unique forest
 * trees (CITY-QUALITY-BAR delta #5). Four unique hero variants (dieted
 * hybrid builds, ~120-200k tris each) are shared across twelve placements
 * flanking the river's approach reach, each with a lod-1 twin grown from the
 * SAME stateless seed label (pop-free far swap), the forest's wind field
 * wired into positionNode/castShadowPositionNode, probe-GI parity, and
 * glowing fruit instanced at real skeleton anchors.
 *
 * Trees are placed in WORLD space (never under the ×20 allotment group — a
 * buildTree tree parented there would be 300-500 m tall) on the meadow bank
 * strip the scatter system already excludes, so they never collide with
 * scattered forest trees.
 */

import {
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import { IrradianceNode, MeshStandardNodeMaterial } from 'three/webgpu';
import {
  float,
  instanceIndex,
  normalWorld,
  positionLocal,
  positionWorld,
  uniform,
  varying,
  vec3,
  vec4,
} from 'three/tsl';
import type { WorldContext } from '../debug/Scenes';
import type { ProbeGI } from '../gpu/passes/ProbeGI';
import type { NF, NU, NV3 } from '../gpu/TSLTypes';
import { slotHash, vegViewPos } from '../render/VegInstance';
import {
  barkTexturedMaterial,
  foliageCardMaterial,
  foliageMaterial,
} from '../render/VegMaterials';
import { vegWindOffset, windContext } from '../render/Wind';
import { captureFoliageAtlas } from '../vegetation/FoliageCards';
import { BEECH } from '../vegetation/Species';
import { buildTree, type BuiltTree } from '../vegetation/TreeBuilder';
import type { VegLib } from '../vegetation/VegLibrary';
import type { SpeciesParams } from '../vegetation/VegTypes';
import type { Heightfield } from '../world/Heightfield';

/**
 * Tree-of-life species: a monumental broadleaf derived from BEECH (which
 * reuses the already-baked beech bark layer), enlarged proportionally —
 * foliage scale/spacing/leaf sizes are ABSOLUTE metres and must scale with
 * height or the crown goes sparse — with a warm gold blossom fraction in the
 * card atlas standing in for fruit-laden boughs at range. The species look is
 * a rendering choice; the trees' existence, riverside placement, fruit and
 * leaves are the cited content (Rev 22:2).
 */
const TREE_OF_LIFE: SpeciesParams = {
  ...BEECH,
  id: 'treeoflife',
  label: 'Tree of life',
  height: [24, 31],
  foliage: BEECH.foliage
    ? {
        ...BEECH.foliage,
        spacing: 0.2,
        scale: [0.26, 0.38],
        leaf: { ...BEECH.foliage.leaf, len: 1.55, width: 0.65 },
      }
    : null,
  foliageColor: { r: 0.055, g: 0.15, b: 0.038, hueVar: 0.26 },
  blossom: { r: 0.9, g: 0.64, b: 0.24, frac: 0.07 },
};

/** River-bank offset (world m) — just off the 100 m channel, Rev 22:2. */
const BANK_X = 150;
/** Six stations along the approach reach (world m, inside the scatter keep-out). */
const Z_STATIONS = [2450, 2610, 2770, 2930, 3090, 3250];
/** Hero ↔ lod-1 swap distance (world m). */
const HERO_DIST = 220;

function patchGI(mat: MeshStandardNodeMaterial, gi: ProbeGI | null): void {
  if (!gi) return;
  const irr = gi.irradiance(positionWorld as unknown as NV3, normalWorld as unknown as NV3);
  const irrV = varying(irr as unknown as Parameters<typeof varying>[0]);
  (mat as unknown as { setupLightMap: () => unknown }).setupLightMap = () =>
    new IrradianceNode(irrV as unknown as ConstructorParameters<typeof IrradianceNode>[0]);
}

/** Wire the forest wind field into a static tree material (world origin uniform). */
function patchWind(mat: MeshStandardNodeMaterial, origin: Vector3, phase: number): void {
  if (!windContext()) return;
  const originU = uniform(origin.clone());
  const dist = vec3(originU as unknown as NV3)
    .sub(vegViewPos as unknown as NV3)
    .length() as unknown as NF;
  const wpos = positionLocal.add(
    vegWindOffset({
      origin: originU as unknown as NV3,
      localY: positionLocal.y as unknown as NF,
      scale: float(1) as unknown as NF,
      instPhase: float(phase) as unknown as NF,
      dist,
      bind: { k: 1, freq: 1, h0: 6 },
    }),
  );
  mat.positionNode = wpos as unknown as typeof mat.positionNode;
  // shadows must sway with the crown or the canopy detaches from its shadow
  (mat as unknown as { castShadowPositionNode: unknown }).castShadowPositionNode = wpos;
}

/** The card material's shadow-alpha contract (VegInstance.ts precedent). */
function patchCardShadow(mat: MeshStandardNodeMaterial): void {
  const rgb = mat.colorNode as unknown as NV3;
  mat.colorNode = vec4(rgb, 1) as unknown as typeof mat.colorNode;
  (mat as unknown as { maskShadowNode: unknown }).maskShadowNode = (
    mat.opacityNode as unknown as NF
  ).greaterThan(0.45);
}

export async function buildTreesOfLife(ctx: WorldContext): Promise<Group | null> {
  const { engine, seed } = ctx;
  const lib = (engine as unknown as { vegLib?: VegLib }).vegLib ?? null;
  const hf = (engine as unknown as { heightfield?: Heightfield }).heightfield ?? null;
  const gi = (engine as unknown as { gi?: ProbeGI }).gi ?? null;
  if (!lib || !hf) return null; // ?ablate=veg debug boot — skip, like the forest
  const bark = lib.barks.get(TREE_OF_LIFE.barkLayer);
  if (!bark) return null;

  // One new card atlas for the species' own leaf + gold-blossom look; bark
  // reuses the boot-baked beech layer (zero extra bake).
  const atlas = await captureFoliageAtlas(
    engine.renderer,
    TREE_OF_LIFE,
    seed.rng('cards/treeoflife'),
  );

  // Four unique variants shared across twelve placements (12 unique heroes
  // would be ~180 MB of VRAM for no visible gain). The lod-1 twin grows from
  // the SAME stateless rng label ⇒ identical skeleton ⇒ pop-free swaps.
  type Variant = { hero: BuiltTree; far: BuiltTree; yaw: number };
  const variants: Variant[] = [];
  for (let v = 0; v < 4; v++) {
    const r = seed.rng(`nj/tol/inst/${v}`);
    const inst = {
      leanX: (r.float() - 0.5) * 0.12,
      leanZ: (r.float() - 0.5) * 0.12,
      biasX: r.float() * 2 - 1,
      biasZ: r.float() * 2 - 1,
      age: 0.75 + r.float() * 0.25,
    };
    const hero = buildTree(TREE_OF_LIFE, seed.rng(`nj/tol/${v}`), {
      lod: 0,
      foliageMode: 'hybrid',
      inst,
      hero: { meshAnchorTarget: 1200, cardTarget: 1500, barkK: 0.6 },
    });
    const far = buildTree(TREE_OF_LIFE, seed.rng(`nj/tol/${v}`), { lod: 1, inst });
    // bake the yaw into the geometry — the mesh transform must stay identity
    // (rotation would skew the world-space wind vector added in local space)
    const yaw = v * 1.7;
    for (const g of [hero.bark, hero.foliage, hero.foliageMesh, far.bark, far.foliage]) {
      g?.rotateY(yaw);
    }
    variants.push({ hero, far, yaw });
  }

  const group = new Group();
  group.name = 'trees-of-life';

  // Twelve kinds of fruit (Rev 22:2) — warm glowing globes at real skeleton
  // anchors, hue-varied per instance. Rigid (no vdata on the sphere), pulled
  // slightly crown-inward so gentle sway doesn't visibly detach them.
  const fruitGeo = new SphereGeometry(0.3, 10, 8);
  const fruitMat = new MeshStandardNodeMaterial();
  fruitMat.color.setHex(0xffcf6b);
  fruitMat.roughness = 0.45;
  const fh = slotHash(instanceIndex as unknown as NU, 5);
  fruitMat.emissiveNode = vec3(
    float(1.0),
    fh.mul(0.28).add(0.58),
    fh.mul(0.2).add(0.24),
  ).mul(1.05) as unknown as typeof fruitMat.emissiveNode;
  const fruitMats: Matrix4[] = [];

  const swap: Array<{ pos: Vector3; hero: Group; far: Group }> = [];
  const Y_AXIS = new Vector3(0, 1, 0);
  const q0 = new Quaternion();
  const mtmp = new Matrix4();
  const ptmp = new Vector3();
  const stmp = new Vector3();

  let k = 0;
  for (const zBase of Z_STATIONS) {
    for (const sx of [-1, 1] as const) {
      const jr = seed.rng(`nj/tol/place/${k}`);
      const wx = sx * BANK_X + (jr.float() - 0.5) * 12;
      const wz = zBase + (jr.float() - 0.5) * 16;
      const wy = hf.heightAtCpu(wx, wz) - 0.15;
      const pos = new Vector3(wx, wy, wz);
      const v = variants[k % 4];
      const phase = (k * 0.618034) % 1;

      // fresh material instances per tree (wind origin is a per-material
      // uniform; the node graph is identical, so pipelines are shared)
      const barkMat = barkTexturedMaterial(bark);
      const cardMat = foliageCardMaterial(atlas, { color: TREE_OF_LIFE.foliageColor });
      const leafMat = foliageMaterial({ color: TREE_OF_LIFE.foliageColor });
      for (const m of [barkMat, cardMat, leafMat]) {
        patchWind(m, pos, phase);
        patchGI(m, gi);
      }
      patchCardShadow(cardMat);

      const hero = new Group();
      const heroBark = new Mesh(v.hero.bark, barkMat);
      heroBark.castShadow = true;
      heroBark.receiveShadow = true;
      hero.add(heroBark);
      if (v.hero.foliage) {
        const cards = new Mesh(v.hero.foliage, cardMat);
        cards.castShadow = true;
        hero.add(cards);
      }
      if (v.hero.foliageMesh) {
        // cards own the crown shadow — doubling casters is pure raster cost
        const leaves = new Mesh(v.hero.foliageMesh, leafMat);
        leaves.castShadow = false;
        hero.add(leaves);
      }
      hero.position.copy(pos);
      group.add(hero);

      const far = new Group();
      const farBark = new Mesh(v.far.bark, barkMat);
      farBark.castShadow = true;
      farBark.receiveShadow = true;
      far.add(farBark);
      if (v.far.foliage) {
        const farCards = new Mesh(v.far.foliage, cardMat);
        farCards.castShadow = true;
        far.add(farCards);
      }
      far.position.copy(pos);
      far.visible = false;
      group.add(far);

      swap.push({ pos, hero, far });

      const anchors = v.hero.skeleton.anchors;
      const stride = Math.max(1, Math.floor(anchors.length / 36));
      for (let ai = 0; ai < anchors.length; ai += stride) {
        const a = anchors[ai];
        ptmp.copy(a.pos).multiplyScalar(0.92).applyAxisAngle(Y_AXIS, v.yaw).add(pos);
        stmp.setScalar(0.8 + a.scale * 0.4);
        mtmp.compose(ptmp, q0, stmp);
        fruitMats.push(mtmp.clone());
      }

      k += 1;
    }
  }

  const fruit = new InstancedMesh(fruitGeo, fruitMat, fruitMats.length);
  fruitMats.forEach((m, i) => fruit.setMatrixAt(i, m));
  fruit.computeBoundingSphere();
  fruit.castShadow = false;
  group.add(fruit);

  // manual hero ↔ lod-1 swap (the spawn views these from 1-2 km; twelve
  // always-on heroes would be ~2M tris of subpixel raster)
  engine.onUpdate(() => {
    const cam = engine.camera.position;
    for (const t of swap) {
      const near = cam.distanceToSquared(t.pos) < HERO_DIST * HERO_DIST;
      if (t.hero.visible !== near) {
        t.hero.visible = near;
        t.far.visible = !near;
      }
    }
  });

  return group;
}
