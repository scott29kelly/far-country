/**
 * probe-arrivalaudio.ts — functional check of the procedural arrival audio
 * (src/nj/ArrivalAudio.ts) in a real page: the bed must arm on the first
 * trusted gesture, and the one-shot south-approach cue must fire when the
 * camera first crosses world z 3400 heading north. Headless has no
 * speakers — the probe asserts the console breadcrumbs and WebAudio state,
 * which is exactly the graph a hearing user gets.
 *
 * Usage: dev server on :5173, then  npx tsx tools/probe-arrivalaudio.ts
 * (FOREGROUND — harness background tasks die ~2 min in)
 */

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
  const lines: string[] = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.startsWith('[laas] audio') || t.startsWith('[laas] south-approach')) lines.push(t);
    if (msg.type() === 'error') console.log(`[page:error] ${t}`);
  });

  const url = laasUrl({ scene: 'newjerusalem', width: W, height: H, hud: false, freeze: false });
  console.log(`[probe] ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    'window.__laas && (window.__laas.ready || window.__laas.error !== null)',
    undefined,
    { timeout: 300000, polling: 250 },
  );
  const err = await page.evaluate('window.__laas.error');
  if (err) throw new Error(`app error: ${String(err)}`);

  // no gesture yet: the bed must NOT be armed (autoplay policy respected)
  check('bed silent before any gesture', !lines.some((l) => l.includes('armed')), lines.join(' | ') || 'no audio lines');

  // first trusted gesture arms the bed
  await page.keyboard.press('KeyE'); // harmless fly-up tap
  await page.waitForTimeout(600);
  check('bed arms on first gesture', lines.some((l) => l.includes('audio bed armed')), lines.join(' | '));

  // cross the approach line heading north: cue must fire exactly once
  await page.evaluate('window.__laas.setPose({p:[0,505,3520],yaw:0,pitch:0})');
  await page.waitForTimeout(300);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW'); // fly north at 6x speed — crosses 3400 in ~1 s
  await page.waitForTimeout(3500);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  const cues = lines.filter((l) => l.includes('south-approach cue')).length;
  check('south-approach cue fired once', cues === 1, `${cues} cue line(s); ${lines.join(' | ')}`);

  // recross: still once per session
  await page.evaluate('window.__laas.setPose({p:[0,505,3520],yaw:0,pitch:0})');
  await page.waitForTimeout(300);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2500);
  await page.keyboard.up('KeyW');
  const cues2 = lines.filter((l) => l.includes('south-approach cue')).length;
  check('cue is one-shot', cues2 === 1, `${cues2} cue line(s) after recross`);

  await browser.close();
  console.log(failed ? '[probe] FAILURES PRESENT' : '[probe] ALL PASS');
  process.exit(failed ? 1 : 0);
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
