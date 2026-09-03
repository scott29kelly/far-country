/**
 * Frame capture for kimodo reference clips through glbview.html (dev server
 * on :5173). Pins the clip time with window.__seek and screenshots each
 * requested time — the evidence frames Scott reviews next to the metrics.
 *
 * Usage:
 *   npx tsx tools/kimodo-frames.ts [--times 0.1,1.2,2.4,3.6,4.8] [--follow]
 *                                  [--out shots/wip/kimodo/frames] <clip.glb>...
 */
import { mkdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { chromium } from 'playwright';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  let times = [0.1, 1.2, 2.4, 3.6, 4.8];
  let out = 'shots/wip/kimodo/frames';
  let follow = false;
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--times') times = argv[++i].split(',').map(Number);
    else if (argv[i] === '--out') out = argv[++i];
    else if (argv[i] === '--follow') follow = true;
    else files.push(argv[i]);
  }
  if (!files.length) {
    console.error('usage: kimodo-frames.ts [--times a,b,c] [--follow] [--out dir] <clip.glb>...');
    process.exit(2);
  }
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  for (const file of files) {
    const rel = file.split(String.fromCharCode(92)).join('/'); // backslash -> slash (Windows paths)
    const name = basename(file, '.glb');
    await page.goto(`http://localhost:5173/glbview.html?glb=${rel}${follow ? '&follow=1' : ''}`);
    await page.waitForFunction(() => (window as unknown as { __viewerReady?: boolean }).__viewerReady, null, {
      timeout: 30000,
    });
    await page.evaluate(() => {
      (window as unknown as { __paused: boolean }).__paused = true;
    });
    for (const t of times) {
      await page.evaluate((tt) => (window as unknown as { __seek: (t: number) => void }).__seek(tt), t);
      await page.waitForTimeout(150);
      const png = join(out, `${name}-t${String(t).replace('.', '_')}.png`);
      await page.screenshot({ path: png });
    }
    console.log(`${name}: ${times.length} frames -> ${out}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
