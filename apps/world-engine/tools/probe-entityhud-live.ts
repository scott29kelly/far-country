/**
 * Live browser check for the citation HUD (roadmap M3.4): boots the real NJ
 * world on a real adapter, drives picking through the tooling contract
 * (`__laas.entityPick` + exact-placement setPose), clicks the canvas with
 * trusted input, and asserts the card DOM: entity name, tier badge,
 * citation chip, dismissal (Escape + empty-world click), and that a click
 * never steers the camera.
 *
 *   npm run dev   (port 5173)
 *   npx tsx tools/probe-entityhud-live.ts
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

    // ---- A: the tooling contract picks the right entities ------------------
    const pickAt = (pose: { p: [number, number, number]; yaw: number; pitch: number }) =>
      page.evaluate(async (po) => {
        window.__laas.setPose?.(po);
        if (window.__laas.settle) await window.__laas.settle(2);
        return window.__laas.entityPick?.(0, 0) ?? null;
      }, pose);

    const gate = await pickAt({ p: [0, 520, 2600], yaw: 0, pitch: 0 });
    c.check('A1 gate head-on picks the Issachar gate', gate?.label === 'Issachar Gate · S', `got ${gate?.label ?? 'null'}`);

    const throne = await pickAt({ p: [0, 3800, 2500], yaw: 0, pitch: 0 });
    c.check('A2 summit glory picks the throne', throne?.slug === 'throne-of-god', `got ${throne?.slug ?? 'null'}`);

    const tree = await pickAt({ p: [150, 700, 2700], yaw: 0, pitch: -0.74 });
    c.check('A3 bank station picks a tree of life', tree?.slug === 'tree-of-life', `got ${tree?.slug ?? 'null'}`);

    const sky = await pickAt({ p: [0, 520, 2600], yaw: 0, pitch: 1.2 });
    c.check('A4 sky picks nothing', sky === null, `got ${sky?.slug ?? 'null'}`);

    // ---- B: the card itself ------------------------------------------------
    await page.evaluate(async () => {
      window.__laas.setPose?.({ p: [0, 520, 2600], yaw: 0, pitch: 0 });
      if (window.__laas.settle) await window.__laas.settle(2);
    });
    const before = await page.evaluate(() => window.__laas.getPose?.() ?? null);
    await page.mouse.click(640, 400);
    await page.waitForSelector('#entity-hud:not([hidden]) .eh-card', { timeout: 10000 });
    const card = await page.evaluate(() => {
      const root = document.getElementById('entity-hud');
      return {
        label: root?.querySelector('.eh-label')?.textContent ?? '',
        name: root?.querySelector('.eh-name')?.textContent ?? '',
        tier: root?.querySelector('.eh-tier')?.textContent ?? '',
        cite: root?.querySelector('.eh-cite')?.textContent ?? '',
        statement: root?.querySelector('.eh-statement')?.textContent ?? '',
        open: root?.querySelector('.eh-open')?.getAttribute('href') ?? '',
      };
    });
    c.check('B1 card label carries tribe + compass', card.label === 'Issachar Gate · S', card.label);
    c.check('B2 card names the canonical entity', card.name === 'Gates of Pearl', card.name);
    c.check('B3 tier badge renders', card.tier === 'clear', card.tier);
    c.check('B4 citation chip renders Rev 21:21', card.cite === 'Revelation 21:21', card.cite);
    c.check('B5 statement is the canonical text', card.statement.includes('twelve pearls'), card.statement.slice(0, 60));
    c.check('B6 open link targets the entity page', card.open === '/entities/gates-of-pearl', card.open);

    await page.screenshot({ path: 'shots/wip/entityhud-gate.png' });

    const after = await page.evaluate(() => window.__laas.getPose?.() ?? null);
    const steered =
      before && after
        ? Math.abs(before.yaw - after.yaw) + Math.abs(before.pitch - after.pitch)
        : 1;
    c.check('B7 the click did not steer the camera', steered < 0.02, `Δ=${steered.toFixed(4)}`);

    await page.keyboard.press('Escape');
    const hiddenAfterEsc = await page.evaluate(
      () => document.getElementById('entity-hud')?.hidden === true,
    );
    c.check('B8 Escape dismisses the card', hiddenAfterEsc === true);

    // re-open, then click empty sky to dismiss
    await page.mouse.click(640, 400);
    await page.waitForSelector('#entity-hud:not([hidden])', { timeout: 10000 });
    await page.evaluate(async () => {
      window.__laas.setPose?.({ p: [0, 520, 2600], yaw: 0, pitch: 1.2 });
      if (window.__laas.settle) await window.__laas.settle(2);
    });
    await page.mouse.click(640, 400);
    const hiddenAfterMiss = await page.evaluate(
      () => document.getElementById('entity-hud')?.hidden === true,
    );
    c.check('B9 empty-world click dismisses the card', hiddenAfterMiss === true);
  } finally {
    await browser.close();
  }
  c.finish();
}

void main();
