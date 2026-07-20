// One-off visual QA: screenshots of the boot overlay during a real rite boot.
// Usage: npx tsx tools/boot-shots.tmp.ts <outDir>
import { mkdirSync } from 'node:fs';
import { launchWebGPU, laasUrl } from './launch';

const outDir = process.argv[2] ?? 'shots/wip/bootqa';
const SHOT_AT = [2, 6, 14, 25, 40, 55, 70]; // seconds after navigation

async function main() {
  mkdirSync(outDir, { recursive: true });
  const { browser } = await launchWebGPU();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`[page:error] ${m.text()}`);
  });
  const url = laasUrl({ scene: 'newjerusalem', hud: false, extra: { rite: '1' } });
  console.log(`[bootqa] ${url}`);
  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  for (const at of SHOT_AT) {
    const wait = t0 + at * 1000 - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    const state = await page.evaluate(() => {
      const boot = document.getElementById('boot');
      const gone = !boot || boot.style.display === 'none';
      const hooks = (window as unknown as { __laas?: { progress?: number; progressMsg?: string } }).__laas;
      return { gone, p: hooks?.progress ?? -1, msg: hooks?.progressMsg ?? '' };
    });
    const file = `${outDir}/boot-t${at}.png`;
    await page.screenshot({ path: file });
    console.log(`[bootqa] t=${at}s p=${state.p.toFixed(2)} "${state.msg}" gone=${state.gone} → ${file}`);
    if (state.gone) break;
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
