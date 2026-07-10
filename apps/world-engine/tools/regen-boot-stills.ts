/**
 * regen-boot-stills.ts — regenerate the boot-rite stills carousel from the
 * REAL engine (ADR 0019: the boot screen's images are self-produced captures
 * of this codebase's own output — the zero-external-asset rule is about
 * provenance, not pixels).
 *
 * One NJ boot, then each judging framing is posed, settled (TAA), and saved
 * as a compressed JPEG into src/nj/boot-stills/ where bootStills.ts imports
 * them into the bundle. Re-run whenever the world's look materially changes
 * (the rite must always show the CURRENT world, not a flattering memory).
 *
 * Usage: dev server on :5173, then  npx tsx tools/regen-boot-stills.ts
 * (run FOREGROUND — harness background tasks die ~2 min in)
 */

import { mkdirSync } from 'node:fs';
import { launchWebGPU, laasUrl } from './launch';

const W = 1920;
const H = 1080;
const QUALITY = 82;
const OUT_DIR = 'src/nj/boot-stills';

/** The established judging framings (STATUS/handoff): x,y,z,yaw,pitch,fov. */
const FRAMINGS: Array<{ name: string; cam: [number, number, number, number, number, number] }> = [
  { name: 'still-1-spawn-hero', cam: [350, 482, 4150, 0, 0.12, 60] },
  { name: 'still-2-south-establishing', cam: [0, 1000, 5200, 0, -0.12, 55] },
  { name: 'still-3-gate-level', cam: [0, 510, 2650, 0, 0.05, 65] },
  { name: 'still-4-summit', cam: [500, 3950, 1500, 0.32, -0.09, 55] },
  { name: 'still-5-temple-wide', cam: [0, 520, -6050, 3.1416, -0.03, 60] },
  { name: 'still-6-campus-aerial', cam: [900, 700, -6650, 2.43, -0.28, 55] },
];

async function main(): Promise<void> {
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[page:error] ${msg.text()}`);
  });

  mkdirSync(OUT_DIR, { recursive: true });
  const url = laasUrl({ scene: 'newjerusalem', width: W, height: H, hud: false });
  console.log(`[stills] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    'window.__laas && (window.__laas.ready || window.__laas.error !== null)',
    undefined,
    { timeout: 300000, polling: 250 },
  );
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);

  // product stills, not judging shots: suppress the always-on fps chip
  await page.evaluate(
    "for (const id of ['hud-fps', 'hud']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }",
  );

  for (const f of FRAMINGS) {
    const [x, y, z, yaw, pitch, fov] = f.cam;
    await page.evaluate(
      `window.__laas.setPose({p:[${x},${y},${z}],yaw:${yaw},pitch:${pitch},fov:${fov}})`,
    );
    await page.evaluate('window.__laas.settle(20)');
    await page.screenshot({
      path: `${OUT_DIR}/${f.name}.jpg`,
      type: 'jpeg',
      quality: QUALITY,
    });
    console.log(`[stills] wrote ${OUT_DIR}/${f.name}.jpg`);
  }

  await browser.close();
  console.log('[stills] done — rebuild + re-vendor to ship the new carousel');
}

main().catch((e: unknown) => {
  console.error('[stills] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
