/**
 * Timing-shape summary of a kimodo-metrics CSV: per clip and channel,
 * normalizes the channel to 0..1 (0 = standing sample, 1 = peak) and
 * reports onset / ramp / hold / release as fractions of the clip, plus a
 * coarse 21-sample profile — the same shape language as WORSHIP_KEYS.
 *
 * Usage: npx tsx tools/kimodo-shape.ts shots/wip/kimodo/metrics-seed7.csv
 */
import { readFileSync } from 'node:fs';

const [, , csv] = process.argv;
const lines = readFileSync(csv, 'utf8').trim().split('\n').slice(1);
const byClip = new Map<string, number[][]>();
for (const l of lines) {
  const [clip, ...rest] = l.split(',');
  const row = rest.map(Number);
  if (!byClip.has(clip)) byClip.set(clip, []);
  byClip.get(clip)!.push(row);
}
// cols: t hipsX hipsY torso neck armL armR footYmin
const channels: [string, (r: number[], r0: number[]) => number][] = [
  ['bow(torso)', (r, r0) => r[3] - r0[3]],
  ['neck', (r, r0) => r[4] - r0[4]],
  ['kneel(hipDrop)', (r, r0) => r0[2] - r[2]],
  ['arm(maxElev)', (r, r0) => Math.max(r[5], r[6]) - Math.max(r0[5], r0[6])],
];
function crossing(v: number[], level: number, from: number, dir: 1 | -1): number {
  for (let i = from; i >= 0 && i < v.length; i += dir) {
    if (dir === 1 ? v[i] >= level : v[i] <= level) return i;
  }
  return -1;
}
for (const [clip, rows] of byClip) {
  const n = rows.length;
  const dur = rows[n - 1][0];
  console.log(`\n== ${clip} (${dur.toFixed(2)} s, ${n} samples)`);
  for (const [name, fn] of channels) {
    const raw = rows.map((r) => fn(r, rows[0]));
    const peak = Math.max(...raw);
    if (peak < 0.02) {
      console.log(`  ${name.padEnd(16)} flat (peak ${peak.toFixed(3)})`);
      continue;
    }
    const v = raw.map((x) => Math.max(0, x) / peak);
    const iPeak = v.indexOf(1);
    const on = crossing(v, 0.1, 0, 1);
    const up90 = crossing(v, 0.9, 0, 1);
    const down90 = crossing(v, 0.9, n - 1, -1);
    const off = crossing(v, 0.1, n - 1, -1);
    const f = (i: number) => (i < 0 ? ' -- ' : (i / (n - 1)).toFixed(2));
    const end = v[n - 1];
    const prof = Array.from({ length: 21 }, (_, k) => v[Math.round((k / 20) * (n - 1))].toFixed(2)).join(' ');
    console.log(
      `  ${name.padEnd(16)} peak ${peak.toFixed(3)} @${f(iPeak)} | onset ${f(on)} up90 ${f(up90)} ` +
        `hold-end ${f(down90)} off ${f(off)} | end-level ${end.toFixed(2)}` +
        `\n${' '.repeat(18)}${prof}`,
    );
  }
}
