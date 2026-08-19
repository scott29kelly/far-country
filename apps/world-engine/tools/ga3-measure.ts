/**
 * GA-3 round-1 light metrics over a still (throwaway-grade, but kept in
 * tools/ so the round's numbers are reproducible):
 *   seam   — column-mean sky luminance around x = width/2 (FC-0011): prints
 *            per-column means over a sky row band and the max adjacent step
 *   rb     — mean R/B ratio over a given rect (lit-midtone patch metric)
 *   patch  — mean RGB over a rect (cloud top vs underside stops)
 *
 * Usage:
 *   npx tsx tools/ga3-measure.ts seam <png> [y0 y1] [x0 x1]
 *   npx tsx tools/ga3-measure.ts rb <png> x0 y0 x1 y1
 *   npx tsx tools/ga3-measure.ts patch <png> x0 y0 x1 y1
 */
import sharp from 'sharp';

async function loadRaw(p: string): Promise<{ data: Buffer; w: number; h: number }> {
  const img = sharp(p);
  const meta = await img.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const data = await img.raw().toBuffer();
  return { data, w, h };
}

function lum(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function main(): Promise<void> {
  const [mode, file, ...rest] = process.argv.slice(2);
  if (!mode || !file) throw new Error('usage: seam|rb|patch <png> ...');
  const { data, w, h } = await loadRaw(file);
  const ch = data.length / (w * h); // 3 or 4
  const px = (x: number, y: number): [number, number, number] => {
    const i = (y * w + x) * ch;
    return [data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0];
  };

  if (mode === 'seam') {
    const y0 = Number(rest[0] ?? 100);
    const y1 = Number(rest[1] ?? 450);
    const x0 = Number(rest[2] ?? Math.floor(w / 2) - 12);
    const x1 = Number(rest[3] ?? Math.floor(w / 2) + 12);
    const cols: number[] = [];
    for (let x = x0; x <= x1; x++) {
      let s = 0;
      for (let y = y0; y < y1; y++) {
        const [r, g, b] = px(x, y);
        s += lum(r, g, b);
      }
      cols.push(s / (y1 - y0));
    }
    let maxStep = 0;
    let maxAt = -1;
    for (let i = 1; i < cols.length; i++) {
      const d = Math.abs((cols[i] ?? 0) - (cols[i - 1] ?? 0));
      if (d > maxStep) {
        maxStep = d;
        maxAt = x0 + i;
      }
    }
    for (let i = 0; i < cols.length; i++) {
      console.log(`x=${x0 + i}  ${(cols[i] ?? 0).toFixed(3)}`);
    }
    console.log(`max adjacent step ${maxStep.toFixed(3)}/255 at x=${maxAt}`);
  } else if (mode === 'rb' || mode === 'patch') {
    const [x0, y0, x1, y1] = rest.map(Number);
    if ([x0, y0, x1, y1].some((v) => !Number.isFinite(v))) throw new Error('need x0 y0 x1 y1');
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    for (let y = y0 as number; y < (y1 as number); y++) {
      for (let x = x0 as number; x < (x1 as number); x++) {
        const [r, g, b] = px(x, y);
        sr += r;
        sg += g;
        sb += b;
        n++;
      }
    }
    const mr = sr / n;
    const mg = sg / n;
    const mb = sb / n;
    console.log(
      `mean RGB (${mr.toFixed(1)}, ${mg.toFixed(1)}, ${mb.toFixed(1)})  R/B=${(mr / Math.max(mb, 1e-3)).toFixed(3)}  lum=${lum(mr, mg, mb).toFixed(1)}`,
    );
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
