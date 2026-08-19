/** The probe battery, as code. Before this file existed, "full battery ALL
 *  PASS" had no executable denominator — membership lived in prose and
 *  session memory, and a probe silently dropped from a session's ad-hoc run
 *  list kept the suite green (DEFECTS.md FC-0003). This manifest IS the
 *  battery: a member that is missing on disk is a FAILURE, and a member that
 *  exits 2 (UNMEASURED, see check.ts) is never counted as a pass.
 *
 *  Members run ONE AT A TIME — parallel probe runs have been flaky on this
 *  machine (probe-bootrite under back-to-back load; WebGPU device loss).
 *
 *  Usage:
 *    npm run battery            all members (LIVE members need :5173 up)
 *    npm run battery -- --cpu   CPU members only (no dev server needed)
 *    npm run battery -- --only wildwater,crowd
 *
 *  Exit: 0 = every member PASS; 1 = anything else (failures, unmeasured,
 *  missing members, unreachable server).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

interface Member {
  name: string;
  kind: 'cpu' | 'live';
  args?: string[];
}

// The 2026-08-18 thirteen (the verified-canyonlands record) plus the four
// standing CPU contract probes from earlier STATUS battery enumerations,
// plus rimfalls (added 2026-08-19 when the verify branch merged — verdicts
// R1-R3 were added first so it could FAIL; a bare report tool in the
// manifest would be the FC-0002 defect class again).
const MEMBERS: Member[] = [
  { name: 'stages', kind: 'cpu' },
  { name: 'navigation', kind: 'cpu' },
  { name: 'arrival', kind: 'cpu' },
  { name: 'walkfling', kind: 'cpu' },
  { name: 'wallcollide', kind: 'cpu' },
  { name: 'cityfloors', kind: 'cpu' },
  { name: 'templecollide', kind: 'cpu' },
  { name: 'dwellingscollide', kind: 'cpu' },
  { name: 'ascent', kind: 'cpu' },
  { name: 'population', kind: 'cpu' },
  { name: 'crowd', kind: 'cpu' },
  { name: 'framings', kind: 'cpu' },
  { name: 'entitypick', kind: 'cpu' },
  { name: 'gamepad', kind: 'cpu' },
  { name: 'gamepad-live', kind: 'live' },
  { name: 'mousesteer', kind: 'live' },
  { name: 'wildwater', kind: 'live' },
  { name: 'rimfalls', kind: 'live' },
];

const VERDICT = { 0: 'PASS', 1: 'FAIL', 2: 'UNMEASURED' } as Record<number, string>;

async function serverUp(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch('http://localhost:5173/', { signal: ctrl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const cpuOnly = args.includes('--cpu');
  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx >= 0 ? (args[onlyIdx + 1] ?? '').split(',').map((s) => s.trim()) : null;

  const toolsDir = dirname(fileURLToPath(import.meta.url));
  let members = MEMBERS.filter((m) => (only ? only.includes(m.name) : true));
  if (cpuOnly) members = members.filter((m) => m.kind === 'cpu');
  if (members.length === 0) {
    console.error('[battery] no members selected');
    process.exit(1);
  }

  const needsLive = members.some((m) => m.kind === 'live');
  const live = needsLive ? await serverUp() : true;
  if (needsLive && !live) {
    console.error(
      '[battery] :5173 unreachable — LIVE members will be reported UNMEASURED, not skipped.',
    );
  }

  const results: { name: string; verdict: string; ms: number }[] = [];
  for (const m of members) {
    const file = join(toolsDir, `probe-${m.name}.ts`);
    if (!existsSync(file)) {
      console.error(`[battery] probe-${m.name}.ts MISSING — a member that is not on disk is a failure`);
      results.push({ name: m.name, verdict: 'MISSING', ms: 0 });
      continue;
    }
    if (m.kind === 'live' && !live) {
      results.push({ name: m.name, verdict: 'UNMEASURED', ms: 0 });
      continue;
    }
    console.log(`\n[battery] === probe-${m.name} ===`);
    const t0 = Date.now();
    const r = spawnSync('npx', ['tsx', file, ...(m.args ?? [])], {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      timeout: 10 * 60 * 1000,
    });
    const code = r.status ?? 1;
    results.push({ name: m.name, verdict: VERDICT[code] ?? `EXIT ${code}`, ms: Date.now() - t0 });
  }

  console.log('\n[battery] ---- summary ----');
  for (const r of results) {
    console.log(`  ${r.verdict.padEnd(10)} ${r.name}${r.ms ? ` (${(r.ms / 1000).toFixed(0)} s)` : ''}`);
  }
  const bad = results.filter((r) => r.verdict !== 'PASS');
  if (bad.length > 0) {
    console.error(`[battery] NOT GREEN — ${bad.length} of ${results.length} member(s): ${bad.map((r) => `${r.name}=${r.verdict}`).join(', ')}`);
    process.exit(1);
  }
  console.log(`[battery] ALL ${results.length} MEMBERS PASS`);
  process.exit(0);
}

main().catch((e: unknown) => {
  console.error('[battery] FAILED:', e instanceof Error ? e.message : e);
  process.exit(1);
});
