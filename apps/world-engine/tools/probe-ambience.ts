/**
 * probe-ambience.ts — headless soundness check for the arrival audio, via
 * tools/ambience-harness.html. No GPU, no speakers: the harness builds the
 * REAL Ambience graph against an OfflineAudioContext, renders 10 s per
 * movement, and reports RMS / peak / NaN stats. This probe asserts:
 *
 *   - every movement renders audible signal (RMS within sane bounds)
 *   - nothing clips (headroom under the 0.5 master is enormous by design)
 *   - no NaNs escape the graph
 *   - the south-approach gold-chord cue fires on the first crossing only,
 *     and its render carries more energy than the plain meadow bed
 *
 * Requires the dev server on :5173.
 *
 * Usage: npx tsx tools/probe-ambience.ts
 */

import { launchAnyChromium } from './launch';

const BASE = 'http://localhost:5173/tools/ambience-harness.html';

interface AmbStats {
  rms: number;
  peak: number;
  nan: number;
  cueOnce: boolean | null;
  cueStill: boolean;
}

let failures = 0;
function check(name: string, ok: boolean, detail = ''): void {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function main(): Promise<void> {
  const browser = await launchAnyChromium();
  const page = await browser.newPage();
  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
    failures++;
  });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => '__ambReady' in window, undefined, { timeout: 20000 });

  const render = (movement: string): Promise<AmbStats> =>
    page.evaluate(
      (m) =>
        (window as unknown as { __ambRender: (m: string) => Promise<AmbStats> }).__ambRender(m),
      movement,
    );

  const sane = (name: string, s: AmbStats): void => {
    check(`${name}: audible, in-bounds RMS`, s.rms > 0.003 && s.rms < 0.25, `rms=${s.rms.toFixed(4)}`);
    check(`${name}: no clipping`, s.peak < 0.95, `peak=${s.peak.toFixed(3)}`);
    check(`${name}: no NaNs in the render`, s.nan === 0, `nan=${s.nan}`);
  };

  const drone = await render('drone');
  sane('drone', drone);

  const meadow = await render('meadow');
  sane('meadow', meadow);

  const cue = await render('cue');
  sane('cue', cue);
  check('cue: fires on the first crossing', cue.cueOnce === true, `cueOnce=${String(cue.cueOnce)}`);
  check('cue: stays latched (one-shot)', cue.cueStill, `cueStill=${String(cue.cueStill)}`);
  check(
    'cue: adds energy over the plain meadow bed',
    cue.rms > meadow.rms + 0.001,
    `cue rms ${cue.rms.toFixed(4)} vs meadow ${meadow.rms.toFixed(4)}`,
  );

  await browser.close();
  console.log(failures === 0 ? '[probe] ALL PASS' : `[probe] ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e: unknown) => {
  console.error('[probe] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
