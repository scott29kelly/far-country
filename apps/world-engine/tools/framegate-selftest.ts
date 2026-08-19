/** Negative controls for the frame-content gate (framegate.ts): synthetic
 *  black, white, and flat frames MUST be rejected and a noise frame MUST be
 *  accepted. A gate that has never been observed refusing has never been
 *  observed at all (DEFECTS.md FC-0004).
 *
 *    npx tsx tools/framegate-selftest.ts
 */

import { unlinkSync } from 'node:fs';
import sharp from 'sharp';
import { inspectFrame } from './framegate';

async function main(): Promise<void> {
  const mk = (name: string, bg: { r: number; g: number; b: number }): Promise<unknown> =>
    sharp({ create: { width: 64, height: 48, channels: 3, background: bg } }).png().toFile(name);
  await mk('.tmp-black.png', { r: 0, g: 0, b: 0 });
  await mk('.tmp-white.png', { r: 255, g: 255, b: 255 });
  await mk('.tmp-flat.png', { r: 120, g: 90, b: 60 });
  await sharp({
    create: { width: 64, height: 48, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
  })
    .png()
    .toFile('.tmp-noise.png');
  let bad = 0;
  const expect: Record<string, boolean> = {
    '.tmp-black.png': false,
    '.tmp-white.png': false,
    '.tmp-flat.png': false,
    '.tmp-noise.png': true,
  };
  for (const [f, want] of Object.entries(expect)) {
    const v = await inspectFrame(f);
    const verdict = v.ok ? 'ACCEPT' : 'REJECT';
    const ok = v.ok === want;
    if (!ok) bad++;
    console.log(`${ok ? 'ok ' : 'BAD'} ${f} -> ${verdict} | ${v.reason}`);
  }
  for (const f of Object.keys(expect)) unlinkSync(f);
  console.log(bad === 0 ? '[framegate-selftest] ALL CONTROLS CORRECT' : `[framegate-selftest] ${bad} WRONG VERDICT(S)`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
