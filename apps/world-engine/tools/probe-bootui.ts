/**
 * probe-bootui.ts — captures the boot overlay ("The Arrival") mid-load.
 *
 * Boots ?scene=newjerusalem with the FULL rite (rite=1 — every other tool
 * runs the ?rite=0 bypass) and screenshots the overlay at several real
 * progress thresholds (world-gen provides the wait), asserting the stills
 * carousel is actually presenting, then verifies the staged cinematic hide
 * completes: overlay display:none within ~3.5 s of ready.
 *
 * Usage: npx tsx tools/probe-bootui.ts   (dev server on :5173, FOREGROUND)
 * Output: shots/wip/bootui-*.png
 */

import { mkdirSync } from 'node:fs';
import { launchWebGPU, laasUrl } from './launch';

const W = 1280;
const H = 800;
let failed = false;
const check = (name: string, ok: boolean, detail: string): void => {
  console.log(`[probe] ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failed = true;
};

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('[pageerror]', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[page:error] ${msg.text()}`);
  });

  mkdirSync('shots/wip', { recursive: true });
  const url = laasUrl({ scene: 'newjerusalem', width: W, height: H, hud: false, freeze: false, rite: true });
  console.log(`[probe] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  const thresholds = [0.15, 0.45, 0.75, 0.92];
  for (const t of thresholds) {
    await page
      .waitForFunction(`window.__laas && (window.__laas.progress >= ${t} || window.__laas.ready)`, undefined, {
        timeout: 180000,
        polling: 100,
      })
      .catch(() => console.log(`[probe] threshold ${t} not reached before ready`));
    await page.waitForTimeout(350); // let stones/crossfades transition
    await page.screenshot({ path: `shots/wip/bootui-${Math.round(t * 100)}.png` });
    console.log(`[probe] wrote shots/wip/bootui-${Math.round(t * 100)}.png`);
  }

  // the carousel must be live mid-boot: a still layer visible with imagery
  const stillOn = (await page.evaluate(
    `(() => { const s = document.querySelector('#boot-stills .still.on'); return s ? getComputedStyle(s).backgroundImage.includes('url') : false; })()`,
  )) as boolean;
  check('stills carousel presenting', stillOn, `visible .still.on with background-image: ${String(stillOn)}`);
  const verseUp = (await page.evaluate(
    `(() => { const v = document.getElementById('boot-verse'); return v !== null && v.textContent !== '' && parseFloat(getComputedStyle(v).opacity) > 0.1; })()`,
  )) as boolean;
  check('the word rotating', verseUp, `verse visible: ${String(verseUp)}`);
  const stonesLit = (await page.evaluate(
    "document.querySelectorAll('#boot-stones .stone.lit').length",
  )) as number;
  check('foundation stones igniting', stonesLit > 0, `${stonesLit} lit`);

  await page.waitForFunction('window.__laas && (window.__laas.ready || window.__laas.error !== null)', undefined, {
    timeout: 240000,
    polling: 250,
  });
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);

  // cinematic arrival: veil in fast, world revealed, overlay GONE by ~3.5 s
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'shots/wip/bootui-arrival-veil.png' });
  console.log('[probe] wrote shots/wip/bootui-arrival-veil.png');
  await page.waitForTimeout(3100);
  const gone = (await page.evaluate(
    `(() => { const b = document.getElementById('boot'); return b ? getComputedStyle(b).display === 'none' : true; })()`,
  )) as boolean;
  check('overlay removed after cinematic arrival', gone, `display none by ready+3.5 s: ${String(gone)}`);
  await page.evaluate('window.__laas.settle ? window.__laas.settle(10) : 0');
  await page.screenshot({ path: 'shots/wip/bootui-after.png' });
  console.log('[probe] wrote shots/wip/bootui-after.png');

  await browser.close();
  console.log(failed ? '[probe] FAILURES PRESENT' : '[probe] ALL PASS');
  process.exit(failed ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
