/**
 * probe-bootrite.ts — headless verification of the boot rite (BootUI) via
 * tools/bootrite-harness.html. No GPU, no world-gen: plain headless Chromium
 * drives BootUI.set() through a staged fake gen (including multi-second
 * stalls, matching the real loader's rAF starvation) and asserts the three
 * hide() contracts:
 *
 *   1. cinematic path: staged dissolve completes — #boot display:none within
 *      2.4 s of hide(), veil blooms mid-dissolve
 *   2. ?rite=0 tooling bypass: display:none within 600 ms of hide()
 *   3. prefers-reduced-motion: no rAF pacing (set() applies directly),
 *      display:none within 600 ms of hide()
 *
 * Also captures shots/wip/bootrite-*.png at several descent stages for
 * visual review (the paced displayP chases realP at ~3.5%/s, so waits are
 * generous). Requires the dev server on :5173.
 *
 * Usage: npx tsx tools/probe-bootrite.ts
 */

import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { FOUNDATION_GEMS } from '../src/nj/cityModel';
import { makeChecker } from './check';
import { launchAnyChromium } from './launch';

const W = 1280;
const H = 800;
const BASE = 'http://localhost:5173/tools/bootrite-harness.html';

const { check, fail, finish } = makeChecker();

async function bootGone(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const b = document.getElementById('boot');
    return b ? getComputedStyle(b).display === 'none' : true;
  });
}

async function setP(page: Page, p: number, msg: string): Promise<void> {
  await page.evaluate(
    ([pp, mm]) => {
      const rig = (window as unknown as { __rig: { ui: { set(p: number, m: string): void } } }).__rig;
      rig.ui.set(Number(pp), String(mm));
    },
    [String(p), msg],
  );
}

async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    const rig = (window as unknown as { __rig: { ui: { hide(): void } } }).__rig;
    rig.ui.hide();
  });
}

async function waitRig(page: Page): Promise<void> {
  await page.waitForFunction(() => '__rig' in window, undefined, { timeout: 20000 });
}

async function main(): Promise<void> {
  mkdirSync('shots/wip', { recursive: true });
  const browser = await launchAnyChromium();

  // --- run 1: the cinematic rite (descent stages + staged dissolve) ------------
  {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (err) => {
      console.error('[pageerror]', err.message);
      fail('pageerror');
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitRig(page);
    await page.mouse.move(W * 0.62, H * 0.42, { steps: 6 });

    // staged fake gen with a stall, as the real loader starves rAF
    await setP(page, 0.08, 'creating renderer');
    await page.waitForTimeout(2500);
    await page.screenshot({ path: 'shots/wip/bootrite-early.png' });
    await setP(page, 0.35, 'terrain synth');
    await page.waitForTimeout(4500);
    await page.screenshot({ path: 'shots/wip/bootrite-mid.png' });
    await setP(page, 0.75, 'planting vegetation');
    await page.waitForTimeout(6000);
    await setP(page, 0.95, 'preparing the city');
    await page.waitForTimeout(4500);
    await page.mouse.click(W * 0.38, H * 0.55);
    await page.waitForTimeout(240);
    await page.screenshot({ path: 'shots/wip/bootrite-late.png' });

    // displayP pacing: must lag realP mid-run, never exceed it
    const disp = await page.evaluate(
      () => ((window as unknown as { __rig: { ui: unknown } }).__rig.ui as { displayP: number }).displayP,
    );
    check('pacing: displayP chases realP without passing it', disp > 0.2 && disp <= 0.951, `displayP=${disp.toFixed(3)}`);

    // stones: whatever is lit mid-rite must be a PREFIX of the foundation
    // order — no stone ignites before the ones laid before it
    const litFlags = await page.evaluate(() => {
      const row = document.getElementById('boot-stones');
      return row
        ? Array.from(row.querySelectorAll('.stone')).map((el) => el.classList.contains('lit'))
        : [];
    });
    const firstUnlit = litFlags.indexOf(false);
    check(
      'stones: lit set is a prefix of the foundation order',
      litFlags.length === 12 && (firstUnlit === -1 || litFlags.slice(firstUnlit).every((v) => !v)),
      `lit=[${litFlags.map((v) => (v ? '1' : '0')).join('')}]`,
    );

    // the word: a short quoted excerpt with a book-chapter:verse ESV citation
    // (the personal-study posture — never uncited, never bulk text)
    const word = await page.evaluate(() => ({
      verse: document.getElementById('boot-verse')?.textContent ?? '',
      cite: document.getElementById('boot-cite')?.textContent ?? '',
    }));
    check(
      'verse: short quoted excerpt',
      /^“.+”$/.test(word.verse) && word.verse.length < 140,
      word.verse.slice(0, 44),
    );
    check('verse: ESV citation format', /^[A-Za-z][A-Za-z ]* \d+:\d+ · ESV$/.test(word.cite), word.cite);

    // mid-rite resize: the Rng-seeded layers must keep every star in place
    // across a rebuild (and the debounced rebuild must survive a flurry)
    const starSig = (): Promise<string> =>
      page.evaluate(() =>
        (
          (window as unknown as { __rig: { ui: unknown } }).__rig.ui as {
            brightStars: Array<{ fx: number; fy: number }>;
          }
        ).brightStars
          .map((s) => `${s.fx.toFixed(6)},${s.fy.toFixed(6)}`)
          .join('|'),
      );
    const sigBefore = await starSig();
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.waitForTimeout(260); // > the 150 ms rebuild debounce
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(260);
    check('resize: star layout is position-stable', (await starSig()) === sigBefore);

    // the seat line: drive the descent to rest and capture the p=1
    // composition — wall base just behind the meadow's back ridge
    await setP(page, 1, 'ready');
    await page.waitForFunction(
      () => ((window as unknown as { __rig: { ui: unknown } }).__rig.ui as { displayP: number }).displayP >= 0.999,
      undefined,
      { timeout: 15000, polling: 100 },
    );
    await page.waitForTimeout(250);
    await page.screenshot({ path: 'shots/wip/bootrite-seated.png' });

    // at rest all twelve stones burn in the exact Rev 21:19-20 gem colors
    const stoneColors = await page.evaluate(() => {
      const row = document.getElementById('boot-stones');
      return row
        ? Array.from(row.querySelectorAll('.stone')).map((el) => (el as HTMLElement).style.background)
        : [];
    });
    const hexToRgb = (hex: string): string => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const expected = FOUNDATION_GEMS.map((g) => hexToRgb(g.color));
    const orderOk = stoneColors.length === 12 && stoneColors.every((c, i) => c === expected[i]);
    check(
      'stones: all twelve ignite in Rev 21:19-20 gem order',
      orderOk,
      orderOk ? 'exact color match' : `got [${stoneColors.join('; ')}]`,
    );

    await hide(page);
    await page.waitForTimeout(700); // veil ease-in (0.7 s from t+120 ms) near peak
    const veilUp = await page.evaluate(() => {
      const v = document.getElementById('boot-veil');
      return v ? Number(getComputedStyle(v).opacity) : 0;
    });
    check('cinematic hide: glory veil blooms mid-dissolve', veilUp > 0.35, `veil opacity=${veilUp.toFixed(2)}`);
    await page.screenshot({ path: 'shots/wip/bootrite-dissolve.png' });
    await page.waitForTimeout(1300); // hide()+2.0 s total
    check('cinematic hide: overlay gone within 2.4 s', await bootGone(page));
    const prog = await page.evaluate(
      () => (window as unknown as { __rig: { hooks: { progress: number } } }).__rig.hooks.progress,
    );
    check('hooks mirror: progress pinned to 1 after hide', prog === 1);
    await page.close();
  }

  // --- run 2: ?rite=0 tooling bypass -------------------------------------------
  {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    page.on('pageerror', (err) => {
      console.error('[pageerror]', err.message);
      fail('pageerror');
    });
    await page.goto(`${BASE}?rite=0`, { waitUntil: 'domcontentloaded' });
    await waitRig(page);
    await setP(page, 0.5, 'terrain synth');
    // bypass pacing: displayP tracks realP immediately
    const disp = await page.evaluate(
      () => ((window as unknown as { __rig: { ui: unknown } }).__rig.ui as { displayP: number }).displayP,
    );
    check('rite=0: displayP applies immediately (no pacing)', disp === 0.5, `displayP=${disp}`);
    await hide(page);
    await page.waitForTimeout(600);
    check('rite=0: overlay gone within 600 ms of hide()', await bootGone(page));
    await page.close();
  }

  // --- run 3: prefers-reduced-motion --------------------------------------------
  {
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    page.on('pageerror', (err) => {
      console.error('[pageerror]', err.message);
      fail('pageerror');
    });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitRig(page);
    await setP(page, 0.6, 'gathering the light');
    const disp = await page.evaluate(
      () => ((window as unknown as { __rig: { ui: unknown } }).__rig.ui as { displayP: number }).displayP,
    );
    check('reduced motion: set() applies directly (no rAF pacing)', disp === 0.6, `displayP=${disp}`);
    await page.screenshot({ path: 'shots/wip/bootrite-reduced.png' });
    await hide(page);
    await page.waitForTimeout(600);
    check('reduced motion: overlay gone within 600 ms of hide()', await bootGone(page));
    await ctx.close();
  }

  await browser.close();
  finish();
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
