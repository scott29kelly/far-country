/**
 * Targeted three-internals patches (Phase 7 perf). Verified against the
 * pinned 0.184 source — re-check on any upgrade (docs/THREE-NOTES.md).
 *
 * THE SHADOW-PASS HASH STORM (profiled ~4.5-8.4 ms/frame at ~600 draws,
 * scaling with cascade renders, gone with ?ablate=shadows): the renderer
 * mutates the per-light shared shadow override material PER OBJECT —
 * `overrideMaterial.alphaTest = material.alphaTest` — and Material's
 * alphaTest accessor bumps `version` on every 0↔cutout crossing (bark=0,
 * cards=0.32 alternate constantly). A version bump makes RenderObjects.get
 * re-validate EVERY shadow render object sharing that material, and each
 * validation re-hashes the full material node graph (getMaterialCacheKey →
 * customProgramCacheKey → graph walk + cyrb53): ~328 full hashes/frame.
 *
 * Fix 1 — freezeShadowAlphaTest: shadow-pass materials get an instance-own
 * PLAIN `alphaTest` property (shadows the prototype accessor). The value
 * still updates per object (the alpha-test threshold is a per-draw uniform
 * read at bind time), but version stops thrashing. Each shadow render
 * object keeps the pipeline built for its own alphaTest class — initial
 * cache keys already encode alphaTest as a 0/1 bucket per object.
 *
 * Fix 2 — per-RenderObject getMaterialCacheKey memo (belt and braces for
 * any remaining gate fire): the key reads material state + FIXED
 * per-render-object bits (object.uuid, context.id, receiveShadow), so it
 * is exact keyed on (material identity, material.version,
 * contextNode.version). We never mutate node graphs post-build without
 * bumping needsUpdate (three would miss the pipeline rebuild anyway).
 */

import { Vector2 } from 'three';
import type { Texture, WebGPURenderer } from 'three/webgpu';

const _fbSize = new Vector2();

interface RenderObjectShape {
  material: { version: number };
  renderer: { contextNode: { version: number } };
  getMaterialCacheKey(): number;
}

interface RenderObjectsShape {
  createRenderObject(...args: unknown[]): RenderObjectShape;
}

function freezeShadowAlphaTest(mat: object): void {
  if (Object.prototype.hasOwnProperty.call(mat, 'alphaTest')) return;
  const current = (mat as { alphaTest: number }).alphaTest;
  Object.defineProperty(mat, 'alphaTest', {
    value: current,
    writable: true,
    enumerable: false, // keep it out of the cache-key property loop, like the accessor
    configurable: true,
  });
}

export function installMaterialKeyMemo(renderer: WebGPURenderer): void {
  const objects = (renderer as unknown as { _objects: RenderObjectsShape })._objects;
  const managerProto = Object.getPrototypeOf(objects) as RenderObjectsShape & {
    __laasKeyMemo?: boolean;
  };
  if (managerProto.__laasKeyMemo === true) return;
  managerProto.__laasKeyMemo = true;

  const memo = new WeakMap<
    object,
    { mat: object; v: number; ctxV: number; key: number }
  >();
  const origCreate = managerProto.createRenderObject;
  let protoPatched = false;

  managerProto.createRenderObject = function (
    this: RenderObjectsShape,
    ...args: unknown[]
  ): RenderObjectShape {
    // args: nodes, geometries, renderer, object, material, scene, camera,
    //       lightsNode, renderContext, clippingContext, passId
    const mat = args[4] as { isShadowPassMaterial?: boolean } | undefined;
    if (mat?.isShadowPassMaterial === true) freezeShadowAlphaTest(mat);
    const ro = origCreate.apply(this, args);
    if (!protoPatched) {
      protoPatched = true;
      const proto = Object.getPrototypeOf(ro) as RenderObjectShape;
      const origKey = proto.getMaterialCacheKey;
      proto.getMaterialCacheKey = function (this: RenderObjectShape): number {
        const m = this.material as unknown as object & { version: number };
        const ctxV = this.renderer.contextNode.version;
        const hit = memo.get(this);
        if (
          hit !== undefined &&
          hit.mat === m &&
          hit.v === m.version &&
          hit.ctxV === ctxV
        ) {
          return hit.key;
        }
        const key = origKey.call(this);
        memo.set(this, { mat: m, v: m.version, ctxV, key });
        return key;
      };
    }
    return ro;
  };
}

/**
 * THE RESIZE DESTROYED-TEXTURE RACE (probe-resize.ts, diagnosed 2026-07-18):
 * on a viewport resize, `ViewportTextureNode.updateBefore` resizes its
 * FramebufferTexture (the transmission backdrop) MID-PASS — inside the scene
 * pass's copyFramebufferToTexture — and `Textures.updateTexture`'s update
 * branch calls `backend.destroyTexture` in place (Textures.js:208). Two
 * failure modes, both observed via per-submit error scopes: (a) the current
 * command encoder already holds references to the old GPU texture, so its
 * own submit fails with "Destroyed texture used in a submit"; (b) unlike
 * the dispose path (`_destroyTexture`), the update branch never purges the
 * texture's cached bind groups, so later frames — including the NEXT
 * resize, which round-trips the size — can re-bind the destroyed texture.
 *
 * Fix, two coordinated parts (scoped to `isFramebufferTexture` — the
 * viewport backdrop/shared textures; render-target resizes and normal
 * texture disposals keep their exact timing):
 *
 * 1. `resizeFramebufferTextures` — called from the engine's window-resize
 *    listener, BETWEEN frames: pre-sizes every live framebuffer texture to
 *    the new drawing-buffer size and runs `texture.dispose()` +
 *    `needsUpdate = true`. Dispose invokes three's own `_destroyTexture`,
 *    the one path that purges cached bind groups; the version bump forces
 *    every binding to refresh onto the recreated texture. `updateBefore`
 *    then sees matching sizes and never performs its buggy mid-pass
 *    in-place resize.
 *
 * 2. `installDeferredFramebufferDestroy` — insurance for any residual
 *    in-place destroy: backend bookkeeping proceeds identically (data
 *    deleted, new texture created fresh) but the raw GPUTexture.destroy()
 *    calls wait DESTROY_DEFER_FRAMES frames, drained from the engine frame
 *    loop, so already-encoded references validate against a still-alive
 *    texture. Replicates WebGPUTextureUtils.destroyTexture's handle logic.
 *
 * Verified against the pinned 0.184 source — re-check both on any three
 * upgrade (docs/THREE-NOTES.md).
 */

// Observed worst case: stale bind-group references to the previous backdrop
// texture persist ~3 frames after a resize (see probe-resize --diag runs);
// 16 gives 5x margin at ~16 MB held per resize for a quarter second.
const DESTROY_DEFER_FRAMES = 16;

interface TextureBackendShape {
  get(obj: object): { texture?: GPUTexture; msaaTexture?: GPUTexture };
  delete(obj: object): void;
  createTexture(texture: Texture, options?: object): void;
  destroyTexture(texture: Texture, isDefaultTexture?: boolean): void;
}

interface FramebufferTextureShape extends Texture {
  isFramebufferTexture?: boolean;
  image: { width: number; height: number };
  __laasFbTracked?: boolean;
}

const liveFramebufferTextures = new Set<FramebufferTextureShape>();

/** Returns the per-frame drain tick; Engine.frame() must call it. */
export function installDeferredFramebufferDestroy(renderer: WebGPURenderer): () => void {
  const backend = (renderer as unknown as { backend: TextureBackendShape }).backend;
  const pending: { frames: number; handles: GPUTexture[] }[] = [];

  const origCreate = backend.createTexture.bind(backend);
  backend.createTexture = (texture: Texture, options?: object): void => {
    origCreate(texture, options);
    const fb = texture as FramebufferTextureShape;
    if (fb.isFramebufferTexture === true) {
      liveFramebufferTextures.add(fb);
      if (fb.__laasFbTracked !== true) {
        fb.__laasFbTracked = true;
        fb.addEventListener('dispose', () => liveFramebufferTextures.delete(fb));
      }
    }
  };

  const origDestroy = backend.destroyTexture.bind(backend);
  backend.destroyTexture = (texture: Texture, isDefaultTexture = false): void => {
    if ((texture as FramebufferTextureShape).isFramebufferTexture !== true) {
      origDestroy(texture, isDefaultTexture);
      return;
    }
    const data = backend.get(texture);
    const handles: GPUTexture[] = [];
    if (data.texture !== undefined && isDefaultTexture === false) handles.push(data.texture);
    if (data.msaaTexture !== undefined) handles.push(data.msaaTexture);
    backend.delete(texture);
    if (handles.length > 0) pending.push({ frames: DESTROY_DEFER_FRAMES, handles });
  };

  return (): void => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const entry = pending[i];
      if (--entry.frames <= 0) {
        for (const handle of entry.handles) handle.destroy();
        pending.splice(i, 1);
      }
    }
  };
}

/**
 * Recreate every live viewport framebuffer texture at the current
 * drawing-buffer size. Call from the window-resize listener, after
 * renderer.setSize — never mid-frame.
 */
export function resizeFramebufferTextures(renderer: WebGPURenderer): void {
  const size = renderer.getDrawingBufferSize(_fbSize);
  let touched = 0;
  for (const fb of [...liveFramebufferTextures]) {
    if (fb.image.width === size.width && fb.image.height === size.height) continue;
    fb.image.width = size.width;
    fb.image.height = size.height;
    fb.dispose(); // _destroyTexture: purges cached bind groups + (deferred) GPU handles
    fb.needsUpdate = true; // version bump: every binding refreshes onto the new texture
    touched++;
  }
  if (touched > 0) fbEpoch++;
}

/** bumped by resizeFramebufferTextures whenever backdrop textures recreate */
let fbEpoch = 0;

interface SampledTextureBindingShape {
  isSampledTexture?: boolean;
  texture?: FramebufferTextureShape | null;
}

interface BindGroupShape {
  bindings: SampledTextureBindingShape[];
  /** our tag: this group has sampled a framebuffer texture at least once */
  __laasFbGroup?: boolean;
  /** last fbEpoch this group was force-rebuilt at */
  __laasFbEpoch?: number;
}

interface BindingsShape {
  backend: {
    get(obj: object): { groups?: unknown[]; versions?: unknown[] };
    updateBindings(
      bindGroup: BindGroupShape,
      bindings: BindGroupShape[],
      cacheIndex: number,
      version: number,
    ): void;
  };
  textures: { updateTexture(tex: object): void };
  _update(bindGroup: BindGroupShape, bindings: BindGroupShape[]): void;
}

/**
 * Bind groups that sample the viewport backdrop can dodge every upstream
 * refresh path after the backdrop texture is recreated: the shared
 * `NodeSampledTexture` binding's version/generation is synced by the FIRST
 * group that updates (the generation check is gated behind `updated`,
 * Bindings.js:303-317), and the binding's `texture` reference is swapped
 * between framebuffer-texture objects across render passes — so
 * per-texture bookkeeping misses groups whose current reference differs
 * from the one their GPU views were built against (probe-resize --diag:
 * bg64/bg72 bound stale EVERY frame after a resize). Epoch heal instead:
 * any group that has EVER sampled a framebuffer texture (tag on the group
 * wrapper — survives data purges and reference swaps) is force-rebuilt
 * exactly once per resize epoch, with its textures initialized first;
 * cacheIndex 0 bypasses the version cache.
 */
export function installFramebufferBindingRefresh(renderer: WebGPURenderer): void {
  const bindings = (renderer as unknown as { _bindings: BindingsShape })._bindings;

  const healGroup = (bindGroup: BindGroupShape, groupBindings: BindGroupShape[]): void => {
    bindGroup.__laasFbEpoch = fbEpoch;
    for (const binding of bindGroup.bindings) {
      if (binding.isSampledTexture === true && binding.texture) {
        bindings.textures.updateTexture(binding.texture);
      }
    }
    // purge the version-keyed cache: the version SUM is non-monotonic when a
    // binding's texture reference swaps objects, so stale entries can be
    // revived by a later cache hit (createBindings, WebGPUBindingUtils:155)
    const data = bindings.backend.get(bindGroup);
    delete data.groups;
    delete data.versions;
    bindings.backend.updateBindings(bindGroup, groupBindings, 0, 0);
  };

  // Tag + heal on the ordinary update path.
  const origUpdate = bindings._update.bind(bindings);
  bindings._update = (bindGroup: BindGroupShape, groupBindings: BindGroupShape[]): void => {
    origUpdate(bindGroup, groupBindings);
    if (bindGroup.__laasFbGroup !== true) {
      for (const binding of bindGroup.bindings) {
        if (binding.isSampledTexture === true && binding.texture?.isFramebufferTexture === true) {
          bindGroup.__laasFbGroup = true;
          bindGroup.__laasFbEpoch = fbEpoch;
          break;
        }
      }
      return;
    }
    if (bindGroup.__laasFbEpoch !== fbEpoch) healGroup(bindGroup, groupBindings);
  };

  // Heal at draw time too: `_renderObjectDirect` gates binding updates behind
  // `_nodes.needsRefresh` (Renderer.js:3535-3546), so an object the
  // NodeMaterialObserver judges static can be DRAWN without its bindings
  // ever updating — the path the two rarely-drawn transmissive meshes took
  // to bind a destroyed backdrop (probe-resize --diag STALE DRAW trace).
  interface DrawableRO {
    getBindings(): BindGroupShape[];
  }
  const backend = (renderer as unknown as {
    backend: { draw(ro: DrawableRO, info: unknown): void };
  }).backend;
  const origDraw = backend.draw.bind(backend);
  backend.draw = (ro: DrawableRO, info: unknown): void => {
    for (const bindGroup of ro.getBindings()) {
      if (bindGroup.__laasFbGroup === true && bindGroup.__laasFbEpoch !== fbEpoch) {
        healGroup(bindGroup, ro.getBindings());
      }
    }
    origDraw(ro, info);
  };
}
