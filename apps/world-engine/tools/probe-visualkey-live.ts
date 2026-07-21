/**
 * Live browser check for the reading key (roadmap M3.5): boots the real NJ
 * world on a real adapter and asserts the key's full contract — hidden by
 * default with the KEY chip present, ?key=1 boots visible, markers project
 * over the south approach with canonical names + tier dots fetched from the
 * real /data/entities exports, the legend renders all four tiers, and K
 * toggles the whole surface off and on.
 *
 *   npm run dev   (port 5173)
 *   npx tsx tools/probe-visualkey-live.ts
 */

import { launchWebGPU, laasUrl } from './launch';
import { makeChecker } from './check';

const c = makeChecker();

/** tier badge palette — mirror of EntityHud's TIER_COLOR for DOM assertions */
const TIER_HEX = ['#3f9e63', '#b8862d', '#b0562d', '#7a5bbb'];

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => {
    console.log(`[page:error] ${e.message}`);
    c.fail('pageerror');
  });

  try {
    // ---- A: default boot — key off, chip discoverable ----------------------
    await page.goto(laasUrl({ scene: 'newjerusalem' }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
      undefined,
      { timeout: 240000, polling: 100 },
    );
    const err = await page.evaluate(() => window.__laas.error);
    if (err) throw new Error(`engine error: ${err}`);

    const markers = await page.evaluate(() => window.__laas.entityKeyMarkers.length);
    c.check('A1 scene installs 12 key anchors', markers === 12, `got ${markers}`);
    const defaultState = await page.evaluate(() => ({
      layerHidden: document.getElementById('visual-key-layer')?.hidden ?? null,
      legendHidden: document.getElementById('visual-key-legend')?.hidden ?? null,
      chip: document.getElementById('visual-key-chip')?.textContent ?? '',
      inCluster:
        document.getElementById('visual-key-chip')?.parentElement?.id === 'controls-cluster',
    }));
    c.check('A2 key is hidden by default', defaultState.layerHidden === true && defaultState.legendHidden === true);
    c.check('A3 KEY chip joins the controls cluster', defaultState.inCluster && defaultState.chip.includes('KEY'), defaultState.chip);

    // K toggles on without the param
    await page.keyboard.press('KeyK');
    const onAfterK = await page.evaluate(
      () => document.getElementById('visual-key-legend')?.hidden === false,
    );
    c.check('A4 K shows the key', onAfterK === true);
    await page.keyboard.press('KeyK');
    const offAfterK = await page.evaluate(
      () => document.getElementById('visual-key-legend')?.hidden === true,
    );
    c.check('A5 K hides it again', offAfterK === true);

    // ---- B: ?key=1 boots visible; markers project on the south approach ----
    await page.goto(laasUrl({ scene: 'newjerusalem', extra: { key: '1' } }), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForFunction(
      () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
      undefined,
      { timeout: 240000, polling: 100 },
    );
    const err2 = await page.evaluate(() => window.__laas.error);
    if (err2) throw new Error(`engine error: ${err2}`);

    const bootState = await page.evaluate(() => ({
      layerHidden: document.getElementById('visual-key-layer')?.hidden ?? null,
      legendHidden: document.getElementById('visual-key-legend')?.hidden ?? null,
      markerCount: document.querySelectorAll('#visual-key-layer .vk-m').length,
      legendRows: document.querySelectorAll('#visual-key-legend .vk-row').length,
    }));
    c.check('B1 ?key=1 boots with the key visible', bootState.layerHidden === false && bootState.legendHidden === false);
    c.check('B2 one marker element per anchor', bootState.markerCount === 12, `got ${bootState.markerCount}`);
    c.check('B3 legend lists the four tiers', bootState.legendRows === 4, `got ${bootState.legendRows}`);

    // south-approach framing: the wall-line markers should be on screen
    await page.evaluate(async () => {
      window.__laas.setPose?.({ p: [0, 900, 5400], yaw: 0, pitch: 0.06 });
      if (window.__laas.settle) await window.__laas.settle(4);
    });
    // tier dots arrive after the entity fetches resolve
    await page.waitForFunction(
      () => document.querySelectorAll('#visual-key-layer .vk-dot').length > 0,
      undefined,
      { timeout: 20000, polling: 200 },
    );
    await page.waitForTimeout(300);
    const proj = await page.evaluate(() => {
      const els = [...document.querySelectorAll('#visual-key-layer .vk-m')] as HTMLElement[];
      const visible = els.filter((el) => el.style.display !== 'none');
      const names = visible.map((el) => el.querySelector('.vk-name')?.textContent ?? '');
      let temple = -1;
      let gates = -1;
      for (const el of visible) {
        const n = el.querySelector('.vk-name')?.textContent ?? '';
        const o = parseFloat(el.style.opacity || '1');
        if (n === 'Sanctuary in the Midst') temple = o;
        if (n === 'Gates of Pearl') gates = o;
      }
      const dotColors = [...document.querySelectorAll('#visual-key-layer .vk-dot')].map(
        (d) => (d as HTMLElement).style.background,
      );
      const withDots = visible.filter((el) => el.querySelectorAll('.vk-dot').length > 0).length;
      const inView = visible.every((el) => {
        const x = parseFloat(el.style.left);
        const y = parseFloat(el.style.top);
        return x >= -80 && x <= window.innerWidth + 80 && y >= -80 && y <= window.innerHeight + 80;
      });
      return { visibleCount: visible.length, names, dotColors, withDots, inView, temple, gates };
    });
    c.check('B4 south approach shows a good spread of markers', proj.visibleCount >= 8, `visible=${proj.visibleCount}`);
    c.check('B5 canonical names replaced the fallback labels', proj.names.includes('Gates of Pearl') && proj.names.includes('Street of Pure Gold'), proj.names.join(' | '));
    c.check('B6 every visible marker carries tier dots', proj.withDots === proj.visibleCount, `${proj.withDots}/${proj.visibleCount}`);
    const hexOf = (rgb: string): string => {
      const m = rgb.match(/rgb\((\d+), (\d+), (\d+)\)/);
      if (!m) return rgb;
      return `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('')}`;
    };
    const badColor = proj.dotColors.map(hexOf).find((h) => !TIER_HEX.includes(h));
    c.check('B7 every dot color is a canonical tier color', badColor === undefined, badColor ?? '');
    c.check('B8 projected markers land on screen', proj.inView);
    c.check(
      'B9 the temple marker (11 km behind the city) dims as occluded',
      proj.temple > 0 && proj.temple < 0.4,
      `opacity=${proj.temple}`,
    );
    c.check(
      'B10 the facing gate marker stays fully visible',
      proj.gates === 1,
      `opacity=${proj.gates}`,
    );

    await page.screenshot({ path: 'shots/wip/visualkey-approach.png' });

    // ---- C: K toggles the booted-on key off --------------------------------
    await page.keyboard.press('KeyK');
    const offState = await page.evaluate(() => ({
      layerHidden: document.getElementById('visual-key-layer')?.hidden ?? null,
      legendHidden: document.getElementById('visual-key-legend')?.hidden ?? null,
      chipActive: document.getElementById('visual-key-chip')?.getAttribute('data-active'),
    }));
    c.check('C1 K hides layer + legend together', offState.layerHidden === true && offState.legendHidden === true);
    c.check('C2 the chip reflects the off state', offState.chipActive === 'false');
  } finally {
    await browser.close();
  }
  c.finish();
}

void main();
