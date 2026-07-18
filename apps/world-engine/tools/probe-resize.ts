/** Regression probe for render-target lifetime errors during viewport resize.
 *
 * Usage: npx tsx tools/probe-resize.ts [--ablate city,river,transmission,allotment]
 *        [--cycles N] [--diag]
 * Default is NO ablation (the full scene) — the regression configuration.
 * --ablate exists for bisecting which subsystem owns a failure; --diag patches
 * GPUDevice.createTexture/GPUTexture.destroy before boot and, on a validation
 * error, prints the creation stack of every destroyed texture matching the
 * error's size/format — naming the owner instead of guessing it.
 */
import { launchWebGPU, laasUrl } from './launch';

const DESTROYED_TEXTURE = 'Destroyed texture';

function argOf(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
}

async function main(): Promise<void> {
  const ablate = argOf('--ablate') ?? '';
  const cycles = Number(argOf('--cycles') ?? '1');
  const diag = process.argv.includes('--diag');
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
  });
  const failures: string[] = [];

  if (diag) {
    await page.addInitScript(() => {
      // esbuild keep-names helper does not survive Playwright serialization
      (globalThis as unknown as { __name: (fn: unknown) => unknown }).__name = (fn) => fn;
      type Rec = {
        id: number;
        w: number;
        h: number;
        format: string;
        label: string;
        stack: string;
        destroyedAt: number;
      };
      const registry: Rec[] = [];
      (window as unknown as { __texdiag: Rec[] }).__texdiag = registry;
      let nextId = 1;
      const origCreate = GPUDevice.prototype.createTexture;
      GPUDevice.prototype.createTexture = function (
        this: GPUDevice,
        desc: GPUTextureDescriptor,
      ): GPUTexture {
        // Attribute unlabeled textures by creation stack so Dawn's validation
        // errors name the owner instead of "(unlabeled WxH px, ...)".
        if (!desc.label) {
          const stack = new Error().stack ?? '';
          const owner = stack.match(/at (\w+)\.updateBefore/)?.[1];
          if (owner) desc = { ...desc, label: `diag:${owner}` };
        }
        const tex = origCreate.call(this, desc);
        const size = desc.size as { width?: number; height?: number } | number[];
        const rec: Rec = {
          id: nextId++,
          w: Array.isArray(size) ? (size[0] ?? 0) : (size.width ?? 0),
          h: Array.isArray(size) ? (size[1] ?? 1) : (size.height ?? 1),
          format: String(desc.format),
          label: String(desc.label ?? ''),
          stack: new Error().stack ?? '',
          destroyedAt: -1,
        };
        registry.push(rec);
        const origDestroy = tex.destroy.bind(tex);
        tex.destroy = () => {
          rec.destroyedAt = performance.now();
          if (rec.label.startsWith('diag:Viewport')) {
            const seq = (window as unknown as { __submitSeq: number }).__submitSeq ?? 0;
            console.log(`[diag] destroy ${rec.label} #${rec.id} after submit#${seq}`);
          }
          origDestroy();
        };
        return tex;
      };

      // Trace which bind groups / render bundles reference Viewport-labeled
      // textures, and log a JS stack the moment one referencing a DESTROYED
      // texture is bound or executed — naming the stale binder exactly.
      try {
      const viewToRec = new WeakMap<GPUTextureView, Rec>();
      const recOf = (tex: GPUTexture): Rec | undefined =>
        registry.find((r) => (r as unknown as { __tex?: GPUTexture }).__tex === tex);
      const origCreate2 = GPUDevice.prototype.createTexture;
      GPUDevice.prototype.createTexture = function (
        this: GPUDevice,
        desc: GPUTextureDescriptor,
      ): GPUTexture {
        const tex = origCreate2.call(this, desc);
        const rec = registry[registry.length - 1];
        if (rec) (rec as unknown as { __tex?: GPUTexture }).__tex = tex;
        return tex;
      };
      const origView = GPUTexture.prototype.createView;
      GPUTexture.prototype.createView = function (
        this: GPUTexture,
        desc?: GPUTextureViewDescriptor,
      ): GPUTextureView {
        const view = origView.call(this, desc);
        const rec = recOf(this);
        if (rec && rec.label.startsWith('diag:Viewport')) viewToRec.set(view, rec);
        return view;
      };
      const origCreateBG = GPUDevice.prototype.createBindGroup;
      GPUDevice.prototype.createBindGroup = function (
        this: GPUDevice,
        desc: GPUBindGroupDescriptor,
      ): GPUBindGroup {
        const bg = origCreateBG.call(this, desc);
        const refs: Rec[] = [];
        for (const entry of Array.from(desc.entries)) {
          const res = entry.resource as GPUTextureView;
          const rec = res instanceof GPUTextureView ? viewToRec.get(res) : undefined;
          if (rec) refs.push(rec);
        }
        if (refs.length > 0) {
          const w = window as unknown as { __bgSeq?: number; __submitSeq: number };
          const bgId = (w.__bgSeq = (w.__bgSeq ?? 0) + 1);
          (bg as unknown as { __diagRefs: Rec[]; __diagBgId: number }).__diagRefs = refs;
          (bg as unknown as { __diagBgId: number }).__diagBgId = bgId;
          console.log(
            `[diag] createBindGroup bg${bgId} -> [${refs.map((r) => `${r.label}#${r.id}`).join(',')}] at submit#${w.__submitSeq ?? 0}\n${new Error().stack}`,
          );
        }
        return bg;
      };
      const checkBind = (bg: GPUBindGroup, where: string): void => {
        const refs = (bg as unknown as { __diagRefs?: Rec[] }).__diagRefs;
        if (!refs) return;
        const bgId = (bg as unknown as { __diagBgId?: number }).__diagBgId ?? -1;
        for (const rec of refs) {
          if (rec.destroyedAt >= 0) {
            console.log(
              `[diag] STALE BIND ${where}: bg${bgId} -> ${rec.label}#${rec.id} (destroyed) seq=${
                (window as unknown as { __submitSeq: number }).__submitSeq
              }`,
            );
          }
        }
      };
      const origSetBG = GPURenderPassEncoder.prototype.setBindGroup;
      (GPURenderPassEncoder.prototype.setBindGroup as unknown) = function (
        this: GPURenderPassEncoder,
        ...args: Parameters<GPURenderPassEncoder['setBindGroup']>
      ) {
        if (args[1]) checkBind(args[1] as GPUBindGroup, 'pass.setBindGroup');
        return (origSetBG as unknown as (...a: unknown[]) => unknown).apply(this, args);
      };
      const origBundleSetBG = GPURenderBundleEncoder.prototype.setBindGroup;
      (GPURenderBundleEncoder.prototype.setBindGroup as unknown) = function (
        this: GPURenderBundleEncoder,
        ...args: Parameters<GPURenderBundleEncoder['setBindGroup']>
      ) {
        const bg = args[1] as GPUBindGroup | null;
        if (bg) {
          const refs = (bg as unknown as { __diagRefs?: Rec[] }).__diagRefs;
          if (refs) {
            const enc = this as unknown as { __diagRefs?: Rec[] };
            enc.__diagRefs = [...(enc.__diagRefs ?? []), ...refs];
          }
        }
        return (origBundleSetBG as unknown as (...a: unknown[]) => unknown).apply(this, args);
      };
      const origBundleFinish = GPURenderBundleEncoder.prototype.finish;
      GPURenderBundleEncoder.prototype.finish = function (
        this: GPURenderBundleEncoder,
        desc?: GPURenderBundleDescriptor,
      ): GPURenderBundle {
        const bundle = origBundleFinish.call(this, desc);
        const refs = (this as unknown as { __diagRefs?: Rec[] }).__diagRefs;
        if (refs) (bundle as unknown as { __diagRefs: Rec[] }).__diagRefs = refs;
        return bundle;
      };
      const origExec = GPURenderPassEncoder.prototype.executeBundles;
      GPURenderPassEncoder.prototype.executeBundles = function (
        this: GPURenderPassEncoder,
        bundles: Iterable<GPURenderBundle>,
      ): undefined {
        for (const b of Array.from(bundles)) checkBind(b as unknown as GPUBindGroup, 'executeBundles');
        return origExec.call(this, bundles);
      };
      } catch (e) {
        console.log(`[diag] TRACING BLOCK DIED: ${String(e)}`);
      }

      // Order submits against destroys, and pin each validation error to the
      // exact submit that raised it (per-submit error scopes).
      (window as unknown as { __submitSeq: number }).__submitSeq = 0;
      const origEncoder = GPUDevice.prototype.createCommandEncoder;
      GPUDevice.prototype.createCommandEncoder = function (
        this: GPUDevice,
        desc?: GPUCommandEncoderDescriptor,
      ): GPUCommandEncoder {
        const enc = origEncoder.call(this, desc);
        const origFinish = enc.finish.bind(enc);
        enc.finish = (fdesc?: GPUCommandBufferDescriptor) => {
          const cb = origFinish(fdesc);
          (cb as unknown as { __diagLabel: string }).__diagLabel = String(desc?.label ?? '?');
          return cb;
        };
        return enc;
      };
      const origSubmit = GPUQueue.prototype.submit;
      GPUQueue.prototype.submit = function (this: GPUQueue, buffers: GPUCommandBuffer[]) {
        const w = window as unknown as { __submitSeq: number };
        const seq = ++w.__submitSeq;
        const labels = Array.from(buffers)
          .map((b) => (b as unknown as { __diagLabel?: string }).__diagLabel ?? '?')
          .join(',');
        const device = (this as unknown as { __diagDevice?: GPUDevice }).__diagDevice;
        if (device) {
          device.pushErrorScope('validation');
          const r = origSubmit.call(this, buffers);
          void device.popErrorScope().then((err) => {
            if (err) console.error(`[diag] submit#${seq} (${labels}) FAILED: ${err.message}`);
          });
          return r;
        }
        return origSubmit.call(this, buffers);
      };
      const origRequestDevice = GPUAdapter.prototype.requestDevice;
      GPUAdapter.prototype.requestDevice = async function (
        this: GPUAdapter,
        desc?: GPUDeviceDescriptor,
      ): Promise<GPUDevice> {
        const device = await origRequestDevice.call(this, desc);
        (device.queue as unknown as { __diagDevice: GPUDevice }).__diagDevice = device;
        return device;
      };
    });
  }

  page.on('console', (message) => {
    const text = message.text();
    if (text.startsWith('[diag]')) console.log(text);
    if (message.type() === 'error' && text.includes(DESTROYED_TEXTURE)) failures.push(text);
  });

  try {
    const extra: Record<string, string> = {};
    if (ablate) extra.resizeprobe = ablate;
    await page.goto(laasUrl({ scene: 'newjerusalem', extra }), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
      undefined,
      { timeout: 240000, polling: 100 },
    );
    await page.evaluate(async () => window.__laas.settle && (await window.__laas.settle(8)));

    for (let i = 0; i < cycles; i++) {
      await page.setViewportSize({ width: 590, height: 600 });
      await page.evaluate(async () => window.__laas.settle && (await window.__laas.settle(4)));
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.evaluate(async () => window.__laas.settle && (await window.__laas.settle(4)));
    }

    if (failures.length > 0) {
      if (diag) {
        // e.g. "... [Texture (unlabeled 1920x1080 px, TextureFormat::RGBA16Float)] used ..."
        const m = failures[0].match(/\(([^ ]*) ?(\d+)x(\d+) px, TextureFormat::(\w+)\)/);
        const wantW = m ? Number(m[2]) : -1;
        const wantH = m ? Number(m[3]) : -1;
        const wantF = m ? m[4].toLowerCase() : '';
        const report = await page.evaluate(
          ([w, h, f]) => {
            const regs = (
              window as unknown as {
                __texdiag: {
                  id: number;
                  w: number;
                  h: number;
                  format: string;
                  label: string;
                  stack: string;
                  destroyedAt: number;
                }[];
              }
            ).__texdiag;
            return regs
              .filter(
                (r) =>
                  r.destroyedAt >= 0 &&
                  r.w === w &&
                  r.h === h &&
                  r.format.replace(/-/g, '') === f,
              )
              .map(
                (r) =>
                  `#${r.id} ${r.w}x${r.h} ${r.format} label="${r.label}" destroyedAt=${r.destroyedAt.toFixed(0)}ms\n${r.stack}`,
              );
          },
          [wantW, wantH, String(wantF)] as const,
        );
        console.log(`\n--- DIAG: destroyed textures matching ${wantW}x${wantH} ${wantF} ---`);
        for (const line of report) console.log(line, '\n');
      }
      throw new Error(
        `resize submitted destroyed render targets (${failures.length} errors)\n${failures[0]}`,
      );
    }
    console.log(
      `PASS resize did not submit a destroyed texture (ablate="${ablate}", cycles=${cycles})`,
    );
  } finally {
    await browser.close();
  }
}

void main();
