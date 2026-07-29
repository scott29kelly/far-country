/**
 * City contact sheet: boots the New Jerusalem ONCE and captures every composed
 * review framing (`src/nj/reviewFramings.ts`) from that single boot.
 *
 * The point is the single boot. A world build costs ~50 s, so shooting the
 * nine framings with `shoot.ts` costs ~8 minutes and — worse — nine different
 * auto-exposure histories, nine different cloud states, and nine different
 * TRAA histories, which makes a before/after comparison across a material
 * change unreadable. One boot gives every framing the same world, and the same
 * settle discipline, so the sheet is directly comparable build to build.
 *
 *   npm run dev   (port 5173, strict)
 *   npx tsx tools/cityshots.ts
 *   npx tsx tools/cityshots.ts --only foundation-course,arcade-bay --w 1600 --h 1000
 *   npx tsx tools/cityshots.ts --dir shots/city/before --settle 24
 *
 * Flags: --only <ids>  --dir <path>  --w/--h  --settle N  --tod H  --stages S
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from 'playwright';
import { launchWebGPU, laasUrl } from './launch';

interface Args {
  [k: string]: string | undefined;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    out[a.slice(2)] = next !== undefined && !next.startsWith('--') ? (i++, next) : '1';
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const width = Number(args['w'] ?? 1280);
  const height = Number(args['h'] ?? 800);
  const settle = Number(args['settle'] ?? 20);
  const dir = args['dir'] ?? 'shots/city';
  const only = args['only'] ? new Set(args['only'].split(',').map((s) => s.trim())) : null;

  const extra: Record<string, string> = {};
  if (args['stages']) extra['stages'] = args['stages'];

  const { browser } = await launchWebGPU();
  const page: Page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));

  try {
    const opts: Parameters<typeof laasUrl>[0] = { scene: 'newjerusalem', hud: false };
    if (args['T']) opts.T = Number(args['T']);
    if (Object.keys(extra).length > 0) opts.extra = extra;
    const url = laasUrl(opts);
    console.log(`[cityshots] boot ${url}`);
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
      undefined,
      { timeout: 300000, polling: 250 },
    );
    const err = await page.evaluate(() => window.__laas.error);
    if (err) throw new Error(`engine error: ${err}`);
    console.log(`[cityshots] ready in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

    const framings = await page.evaluate(() => window.__laas.reviewFramings);
    if (framings.length === 0) {
      throw new Error('scene published no reviewFramings — is this the newjerusalem scene?');
    }

    mkdirSync(dir, { recursive: true });
    const sheet: { id: string; name: string; tests: string; file: string; stats: unknown }[] = [];

    for (const f of framings) {
      if (only && !only.has(f.id)) continue;
      // Re-settle from scratch at every framing. A cut to a wildly different
      // exposure (gallery interior -> 10 km aerial) needs the auto-exposure
      // and TRAA histories to converge or the still reads as a mis-graded
      // frame rather than as the framing's actual look.
      await page.evaluate(
        async ([pose, tod, frames]) => {
          window.__laas.setTimeOfDay?.(tod as number);
          window.__laas.setPose?.(pose as Parameters<NonNullable<Window['__laas']['setPose']>>[0]);
          if (window.__laas.settle) await window.__laas.settle(frames as number);
        },
        [f.pose, f.tod, settle] as const,
      );
      const file = `${dir}/${f.id}.png`;
      await page.screenshot({ path: file });
      const stats = await page.evaluate(() => {
        const s = window.__laas.stats;
        return s ? { fps: s.fps, drawCalls: s.drawCalls, triangles: s.triangles } : null;
      });
      sheet.push({ id: f.id, name: f.name, tests: f.tests, file, stats });
      const tri = stats ? `${(stats.triangles / 1e6).toFixed(1)}M tris` : 'no stats';
      console.log(`[cityshots] ${f.id.padEnd(22)} ${tri.padStart(10)}  -> ${file}`);
    }

    writeFileSync(`${dir}/sheet.json`, JSON.stringify(sheet, null, 2));
    console.log(`[cityshots] ${sheet.length} framings, index at ${dir}/sheet.json`);
  } finally {
    await browser.close();
  }
}

main().catch((e: unknown) => {
  console.error('[cityshots] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
