/**
 * Live browser check for the dwelling-campus pick (Track A follow-on,
 * roadmap M3.4's last gap): boots the real NJ world, drives picking through
 * the tooling contract over both campus bands, then clicks the priests'
 * band and asserts the card renders MEASUREMENT content — subject, value in
 * long cubits, tier badge, Ezekiel citation chips — fetched from the real
 * /data/entities export (schema 0.2.0).
 *
 *   npm run dev   (port 5173)
 *   npx tsx tools/probe-campus-live.ts
 */

import { launchWebGPU, laasUrl } from './launch';
import { makeChecker } from './check';

const c = makeChecker();

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (e) => {
    console.log(`[page:error] ${e.message}`);
    c.fail('pageerror');
  });

  try {
    await page.goto(laasUrl({ scene: 'newjerusalem' }), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => window.__laas && (window.__laas.ready || window.__laas.error !== null),
      undefined,
      { timeout: 240000, polling: 100 },
    );
    const err = await page.evaluate(() => window.__laas.error);
    if (err) throw new Error(`engine error: ${err}`);
    await page.evaluate(async () => window.__laas.settle && (await window.__laas.settle(6)));

    const pickAt = (pose: { p: [number, number, number]; yaw: number; pitch: number }) =>
      page.evaluate(async (po) => {
        window.__laas.setPose?.(po);
        if (window.__laas.settle) await window.__laas.settle(2);
        return window.__laas.entityPick?.(0, 0) ?? null;
      }, pose);

    // ---- A: the tooling contract picks the campus zones --------------------
    // straight down over the east priests' band (world z ≈ -5300)
    const priests = await pickAt({ p: [1200, 1400, -5300], yaw: 0, pitch: -1.5 });
    c.check(
      'A1 east band picks the priests’ portion',
      priests?.slug === 'priests-portion',
      `got ${priests?.slug ?? 'null'}`,
    );

    const levites = await pickAt({ p: [0, 1400, -7000], yaw: 0, pitch: -1.5 });
    c.check(
      'A2 far band picks the Levites’ portion',
      levites?.slug === 'levites-portion',
      `got ${levites?.slug ?? 'null'}`,
    );

    // the cleared meridian lane still reaches the temple from walker height
    const lane = await pickAt({ p: [0, 500, -4600], yaw: 0, pitch: 0 });
    c.check(
      'A3 meridian lane reaches the temple compound',
      lane?.slug === 'sanctuary-in-the-midst',
      `got ${lane?.slug ?? 'null'}`,
    );

    // ---- B: the card renders measurement content ---------------------------
    await page.evaluate(async () => {
      window.__laas.setPose?.({ p: [1200, 1400, -5300], yaw: 0, pitch: -1.5 });
      if (window.__laas.settle) await window.__laas.settle(2);
    });
    await page.mouse.click(640, 400);
    await page.waitForFunction(
      () => {
        const el = document.querySelector('#entity-hud .eh-statement');
        return el !== null && !document.querySelector('#entity-hud .eh-loading');
      },
      undefined,
      { timeout: 20000, polling: 100 },
    );
    const card = await page.evaluate(() => {
      const root = document.querySelector('#entity-hud');
      if (!root) return null;
      const statements: string[] = [];
      for (const el of root.querySelectorAll('.eh-statement')) statements.push(el.textContent ?? '');
      const tiers: string[] = [];
      for (const el of root.querySelectorAll('.eh-tier')) tiers.push(el.textContent ?? '');
      const cites: string[] = [];
      for (const el of root.querySelectorAll('.eh-cite')) cites.push(el.textContent ?? '');
      return {
        name: root.querySelector('.eh-name')?.textContent ?? '',
        statements,
        tiers,
        cites,
      };
    });
    c.check(
      'B1 card names the canonical entity',
      card?.name === "The Priests' Portion",
      `got ${card?.name ?? 'null'}`,
    );
    c.check(
      'B2 a measurement statement renders with its long-cubit value',
      (card?.statements ?? []).some((s) => s.includes('25,000 long cubits')),
      `statements=${JSON.stringify(card?.statements)}`,
    );
    c.check(
      'B3 measurement tier badges render',
      (card?.tiers ?? []).length >= 1 && (card?.tiers ?? []).every((t) => t === 'clear'),
      `tiers=${JSON.stringify(card?.tiers)}`,
    );
    c.check(
      'B4 Ezekiel citation chips render',
      (card?.cites ?? []).some((t) => t.startsWith('Ezekiel 45:3')) &&
        (card?.cites ?? []).some((t) => t.startsWith('Ezekiel 48:10')),
      `cites=${JSON.stringify(card?.cites)}`,
    );
  } finally {
    await browser.close();
  }
  c.finish();
}

void main();
