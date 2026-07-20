// One-off asset prep for the layered boot backdrop:
// - measures the city cutout's alpha bbox (constants for BootUI seating)
// - re-encodes sky/clouds (opaque webp) and city (alpha webp) at target widths
// Usage: npx tsx tools/intro-assets.tmp.ts <skyPng> <cityPng> <cloudPng> <outDir>
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const [sky, city, cloud, outDir] = process.argv.slice(2);

async function main() {
  fs.mkdirSync(outDir!, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();

  const process1 = async (
    file: string,
    outName: string,
    targetW: number,
    quality: number,
    measure: boolean,
    feather = 0, // fade RGB to black within this edge fraction (screen-blend sprites)
  ): Promise<void> => {
    const b64 = fs.readFileSync(file!).toString('base64');
    const res = await page.evaluate(
      async ({ b64, targetW, quality, measure, feather }) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const scale = Math.min(1, targetW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0, w, h);
        if (feather > 0) {
          const im = g.getImageData(0, 0, w, h);
          const d = im.data;
          const fx = Math.round(w * feather);
          const fy = Math.round(h * feather);
          for (let y = 0; y < h; y++) {
            const ky = Math.min(1, y / fy, (h - 1 - y) / fy);
            for (let x = 0; x < w; x++) {
              const k = Math.min(ky, Math.min(1, x / fx, (w - 1 - x) / fx));
              if (k >= 1) continue;
              const i = (y * w + x) * 4;
              const s = k * k * (3 - 2 * k); // smoothstep
              d[i] = d[i]! * s;
              d[i + 1] = d[i + 1]! * s;
              d[i + 2] = d[i + 2]! * s;
            }
          }
          g.putImageData(im, 0, 0);
        }
        let bbox: number[] | null = null;
        if (measure) {
          const d = g.getImageData(0, 0, w, h).data;
          let x0 = w, y0 = h, x1 = 0, y1 = 0;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const a = d[(y * w + x) * 4 + 3]!;
              if (a > 24) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
              }
            }
          }
          bbox = [x0 / w, y0 / h, x1 / w, y1 / h];
        }
        const url = c.toDataURL('image/webp', quality);
        return { url, w, h, bbox };
      },
      { b64, targetW, quality, measure, feather },
    );
    const data = Buffer.from(res.url.split(',')[1]!, 'base64');
    fs.writeFileSync(path.join(outDir!, outName), data);
    console.log(
      `${outName}: ${res.w}x${res.h}, ${(data.length / 1024).toFixed(0)} KB` +
        (res.bbox ? `, alpha bbox frac [${res.bbox.map((v) => v.toFixed(4)).join(', ')}]` : ''),
    );
  };

  await process1(sky!, 'descent-sky.webp', 1920, 0.95, false);
  await process1(city!, 'descent-city.webp', 1600, 0.93, true);
  await process1(cloud!, 'descent-cloud.webp', 1280, 0.88, false, 0.1);
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
