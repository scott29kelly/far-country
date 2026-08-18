/**
 * probe-warnstack — boots a scene headless with console.warn wrapped BEFORE
 * any app code runs, and prints the JS call stack of every warning matching
 * --match (default: the TSL missing-attribute warning). Diagnostic tool for
 * warnings three emits without stack context.
 *
 *   npx tsx tools/probe-warnstack.ts [--scene newjerusalem] [--match normal]
 */

import { launchWebGPU, laasUrl } from './launch';

// window.__laas comes from the app's own global declaration (src/core/Hooks.ts)
declare global {
  interface Window {
    __warnStacks?: string[];
  }
}

function str(v: string | boolean | undefined): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

async function main(): Promise<void> {
  const args = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args.set(a.slice(2), argv[i + 1] ?? '1');
  }
  const scene = str(args.get('scene')) ?? 'newjerusalem';
  const match = str(args.get('match')) ?? 'not found on geometry';

  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript((needle: string) => {
    window.__warnStacks = [];
    const orig = console.warn.bind(console);
    console.warn = (...a: unknown[]) => {
      const msg = a.map(String).join(' ');
      if (msg.includes(needle)) {
        window.__warnStacks?.push(`${msg}\n${new Error('warn-site').stack ?? 'no stack'}`);
      }
      orig(...a);
    };
  }, match);

  await page.goto(laasUrl({ scene }), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
    undefined,
    { timeout: 300000, polling: 250 },
  );
  // a few extra frames so lazily-compiled pipelines (first render) get hit
  await page.waitForTimeout(2000);
  const stacks = await page.evaluate(() => window.__warnStacks ?? []);
  if (stacks.length === 0) {
    console.log(`[warnstack] no console.warn matched "${match}"`);
  } else {
    for (const s of stacks) console.log(`[warnstack] ---\n${s}\n`);
  }
  await browser.close();
}

void main();
