/**
 * probe-bootui.ts — captures the boot overlay ("The Preparation") mid-load.
 *
 * Boots ?scene=newjerusalem and screenshots the DOM overlay at several real
 * progress thresholds (world-gen provides the wait), with the mouse parked
 * over the canvas so the lamp/mote interaction is visible, plus one shot
 * after ready to confirm the overlay is fully gone.
 *
 * Usage: npx tsx tools/probe-bootui.ts
 * Output: shots/wip/bootui-*.png
 */

import { mkdirSync } from 'node:fs';
import { launchWebGPU, laasUrl } from './launch';

const W = 1280;
const H = 800;

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[page:error] ${msg.text()}`);
  });

  mkdirSync('shots/wip', { recursive: true });
  // rite=1: this probe exercises the arrival rite itself, overriding the
  // rite=0 tooling default in laasUrl
  const url = laasUrl({
    scene: 'newjerusalem',
    width: W,
    height: H,
    hud: false,
    freeze: false,
    extra: { rite: '1' },
  });
  console.log(`[probe] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // park the cursor mid-canvas so the lamp halo + mote attraction render
  await page.mouse.move(W * 0.62, H * 0.4, { steps: 8 });

  const thresholds = [0.15, 0.45, 0.75, 0.92];
  for (const t of thresholds) {
    await page
      .waitForFunction(`window.__laas && (window.__laas.progress >= ${t} || window.__laas.ready)`, undefined, {
        timeout: 180000,
        polling: 100,
      })
      .catch(() => console.log(`[probe] threshold ${t} not reached before ready`));
    await page.waitForTimeout(350); // let stones/strokes transition
    await page.screenshot({ path: `shots/wip/bootui-${Math.round(t * 100)}.png` });
    console.log(`[probe] wrote shots/wip/bootui-${Math.round(t * 100)}.png`);
  }

  // a click pulse near the end, captured immediately
  await page.mouse.click(W * 0.38, H * 0.55);
  await page.waitForTimeout(220);
  await page.screenshot({ path: 'shots/wip/bootui-pulse.png' });
  console.log('[probe] wrote shots/wip/bootui-pulse.png');

  await page.waitForFunction('window.__laas && (window.__laas.ready || window.__laas.error !== null)', undefined, {
    timeout: 240000,
    polling: 250,
  });
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);
  await page.waitForTimeout(2400); // staged dissolve (~1.85 s) + display:none
  const gone = await page.evaluate(
    `(() => { const b = document.getElementById('boot'); return b ? getComputedStyle(b).display === 'none' : true; })()`,
  );
  console.log(`[probe] overlay removed after ready: ${String(gone)}`);
  // the rite hands off to the 5 s camera arrival ease — skip it with a
  // movement-intent key (the designed skip) so the final capture is the
  // landed spawn pose every run, not a random point of the descent
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(150);
  await page.evaluate('window.__laas.settle ? window.__laas.settle(10) : 0');
  await page.screenshot({ path: 'shots/wip/bootui-after.png' });
  console.log('[probe] wrote shots/wip/bootui-after.png');

  await browser.close();
  console.log('[probe] done');
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
