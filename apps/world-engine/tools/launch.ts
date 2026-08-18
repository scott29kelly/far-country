/**
 * Shared Playwright launcher that guarantees a WebGPU-capable Chromium.
 * Probes flag sets (headless first, headed fallback) and caches the winner
 * in .cache/webgpu-flags.json so subsequent runs start instantly.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type Browser } from 'playwright';

interface LaunchRecipe {
  headless: boolean;
  channel?: string;
  /** Absolute path to a Chromium build, when the pinned browser is absent. */
  executablePath?: string;
  args: string[];
}

/**
 * IMPORTANT (discovered empirically on this machine):
 *  - WebGPU requires a secure context — probe on http://localhost, never about:blank
 *    (navigator.gpu is simply absent on opaque origins).
 *  - Playwright's default headless uses the GPU-less "headless shell": adapter = null.
 *    Full Chromium new-headless via channel:'chromium' yields an apple/metal-3 adapter.
 *  - On a GPU-less runner there is no hardware adapter at all, but Chromium's
 *    SwiftShader fallback answers requestAdapter() under --enable-unsafe-webgpu.
 *    It renders the real pipeline in software: correct pixels, ~100x slower.
 */
/**
 * Dual-GPU Windows laptops: Chrome IGNORES WebGPU's powerPreference on
 * Windows (crbug.com/369219127) and defaults to the OS-assigned adapter —
 * the power-saving iGPU. This switch forces the discrete GPU at the process
 * level (observed 2026-08-13: intel/xe-lpg vs nvidia on Scott's Legion —
 * every GPU-bound boot bake and capture runs several times faster).
 * Harmless on single-GPU machines and headless runners.
 */
const FORCE_DGPU = '--force_high_performance_gpu';

const CANDIDATES: LaunchRecipe[] = [
  { headless: true, channel: 'chromium', args: [FORCE_DGPU] },
  { headless: true, channel: 'chromium', args: [FORCE_DGPU, '--enable-unsafe-webgpu'] },
  { headless: false, args: [FORCE_DGPU] },
  { headless: true, args: [FORCE_DGPU, '--enable-unsafe-webgpu'] },
];

/**
 * A system Chromium to fall back on when the Playwright-pinned build is not
 * installed (cloud runners preinstall one and point PLAYWRIGHT_BROWSERS_PATH
 * at it). LAAS_CHROMIUM overrides for anything unusual.
 */
function systemChromium(): string | undefined {
  const candidates = [process.env['LAAS_CHROMIUM'], '/opt/pw-browsers/chromium'];
  return candidates.find((p): p is string => !!p && existsSync(p));
}

const CACHE_PATH = '.cache/webgpu-flags.json';
const PROBE_BASE = 'http://localhost:5173';

async function probeRecipe(recipe: LaunchRecipe, probeBase: string): Promise<Browser | null> {
  let browser: Browser | null = null;
  try {
    const launchOpts: Parameters<typeof chromium.launch>[0] = {
      headless: recipe.headless,
      args: recipe.args,
    };
    if (recipe.executablePath) launchOpts.executablePath = recipe.executablePath;
    else if (recipe.channel) launchOpts.channel = recipe.channel;
    browser = await chromium.launch(launchOpts);
    const page = await browser.newPage();
    // any path on the dev server works — we only need the secure localhost origin
    await page.goto(`${probeBase}/__webgpu_probe__`, { waitUntil: 'domcontentloaded' });
    const ok = await page.evaluate(async () => {
      const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
      if (!gpu) return false;
      const adapter = await gpu.requestAdapter();
      return adapter !== null;
    });
    await page.close();
    if (ok) return browser;
    await browser.close();
    return null;
  } catch {
    if (browser) await browser.close().catch(() => undefined);
    return null;
  }
}

/** `probeBase` — dev-server origin for the secure-context probe; tools running
 *  against a non-default port (worktree sessions) pass their own. */
export async function launchWebGPU(
  probeBase: string = PROBE_BASE,
): Promise<{ browser: Browser; recipe: LaunchRecipe }> {
  // cached recipe first
  try {
    const cached = JSON.parse(readFileSync(CACHE_PATH, 'utf8')) as LaunchRecipe;
    const browser = await probeRecipe(cached, probeBase);
    if (browser) return { browser, recipe: cached };
  } catch {
    /* no cache yet */
  }
  // Each recipe is tried as written, then re-tried against a system Chromium —
  // a runner whose pinned browser is missing fails the first form on launch,
  // not on WebGPU, and would otherwise never reach the software fallback.
  const sys = systemChromium();
  const recipes = CANDIDATES.flatMap((r) =>
    sys ? [r, { ...r, channel: undefined, executablePath: sys }] : [r],
  );
  for (const recipe of recipes) {
    const browser = await probeRecipe(recipe, probeBase);
    if (browser) {
      mkdirSync('.cache', { recursive: true });
      writeFileSync(CACHE_PATH, JSON.stringify(recipe, null, 2));
      console.log(
        `[launch] WebGPU OK — headless=${recipe.headless} browser=${recipe.executablePath ?? recipe.channel ?? 'default'} args=[${recipe.args.join(' ')}]`,
      );
      return { browser, recipe };
    }
  }
  throw new Error(
    `No Chromium launch recipe produced a WebGPU adapter (requires a dev server at ${probeBase} ` +
      `for the secure-context probe). Tried channel:chromium headless and headed${sys ? `, and ${sys}` : ''}.`,
  );
}

/** Any Chromium — no GPU needed (BootUI / ambience-class probes). Falls back
 *  to a system-provided build (cloud runners preinstall one) when the pinned
 *  Playwright browser is missing, so these probes run where WebGPU cannot. */
export async function launchAnyChromium(): Promise<Browser> {
  try {
    return await chromium.launch({ headless: true });
  } catch (e) {
    const sys = systemChromium();
    if (sys) return chromium.launch({ headless: true, executablePath: sys });
    throw e;
  }
}

export interface LaasPageOptions {
  scene?: string;
  seed?: number;
  T?: number;
  cam?: string;
  preset?: string;
  hud?: boolean;
  freeze?: boolean;
  width?: number;
  height?: number;
  extra?: Record<string, string>;
}

export function laasUrl(opts: LaasPageOptions, base = 'http://localhost:5173/'): string {
  const q = new URLSearchParams();
  if (opts.scene) q.set('scene', opts.scene);
  if (opts.seed !== undefined) q.set('seed', String(opts.seed));
  if (opts.T !== undefined) q.set('T', String(opts.T));
  if (opts.cam) q.set('cam', opts.cam);
  if (opts.preset) q.set('preset', opts.preset);
  q.set('hud', opts.hud ? '1' : '0');
  if (opts.freeze !== false) q.set('freeze', '1');
  // tooling bypasses the arrival rite: instant overlay hide (<400 ms after
  // ready), no camera ease, no audio — captures/probes see the bare world.
  // Override with extra: {rite: '1'} to exercise the cinematic itself.
  q.set('rite', '0');
  for (const [k, v] of Object.entries(opts.extra ?? {})) q.set(k, v);
  return `${base}?${q.toString()}`;
}
