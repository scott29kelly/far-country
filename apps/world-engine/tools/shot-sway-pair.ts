/**
 * One-boot A/B capture for the figure idle sway: pose close to a plaza
 * assembly, settle, screenshot, wait half a sway cycle, screenshot again.
 * Same boot = same exposure/clouds; the only expected delta is the figures.
 * Diffed offline (tools note: not a standing probe — a verification aid).
 *
 *   npm run dev   (port 5173)
 *   npx tsx tools/shot-sway-pair.ts
 */

import { launchWebGPU, laasUrl } from './launch';

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  try {
    await page.goto(laasUrl({ scene: 'newjerusalem', hud: false }), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
      undefined,
      { timeout: 240000, polling: 100 },
    );
    const err = await page.evaluate(() => window.__laas.error);
    if (err) throw new Error(`engine error: ${err}`);
    await page.evaluate(async () => {
      window.__laas.setPose?.({ p: [500, 489, 1858], yaw: 0, pitch: -0.08 });
      if (window.__laas.settle) await window.__laas.settle(30);
    });
    await page.screenshot({ path: 'shots/wip/sway-pair-a.png' });
    await page.waitForTimeout(1750); // ≈ half a 0.9 rad/s sway cycle
    await page.evaluate(async () => {
      if (window.__laas.settle) await window.__laas.settle(2);
    });
    await page.screenshot({ path: 'shots/wip/sway-pair-b.png' });
    console.log('[shot] wrote sway-pair-a/b.png');
  } finally {
    await browser.close();
  }
}

void main();
