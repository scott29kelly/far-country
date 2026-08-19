/** Shared PASS/FAIL printer + exit-code state for probes and the battery.
 *
 *  Exit-code contract (tools/battery.ts depends on it):
 *    0 = ALL PASS (at least one check actually ran)
 *    1 = one or more FAILs
 *    2 = UNMEASURED — the probe could not measure what it exists to measure
 *        (missing debug hook, empty fixture set, zero checks ran). Never
 *        conflate with PASS: "a check that cannot be evaluated must never be
 *        indistinguishable from one that passed" (DEFECTS.md FC-0005).
 *
 *  finish() treats zero recorded checks as UNMEASURED by default, so a probe
 *  whose fixture set silently comes back empty no longer prints ALL PASS.
 */

export interface Checker {
  /** print one PASS/FAIL line; failures accumulate into finish()'s exit code */
  check(name: string, ok: boolean, detail?: string): void;
  /** record an out-of-band failure (e.g. a pageerror handler) */
  fail(name: string): void;
  /** record that a measurement was impossible (missing hook/fixture); forces exit 2 */
  unmeasured(name: string, why: string): void;
  /** print the summary line and exit 0/1/2; minChecks guards vacuous runs */
  finish(opts?: { minChecks?: number }): never;
}

export function makeChecker(): Checker {
  const failures: string[] = [];
  const unmeasurable: string[] = [];
  let ran = 0;
  return {
    check(name: string, ok: boolean, detail = ''): void {
      ran++;
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
      if (!ok) failures.push(name);
    },
    fail(name: string): void {
      failures.push(name);
    },
    unmeasured(name: string, why: string): void {
      console.log(`[UNMEASURED] ${name} — ${why}`);
      unmeasurable.push(name);
    },
    finish(opts?: { minChecks?: number }): never {
      const minChecks = opts?.minChecks ?? 1;
      if (failures.length > 0) {
        console.log(`[probe] ${failures.length} FAILURE(S): ${failures.join(', ')}`);
        process.exit(1);
      }
      if (unmeasurable.length > 0) {
        console.log(`[probe] UNMEASURED: ${unmeasurable.join(', ')} — not a pass`);
        process.exit(2);
      }
      if (ran < minChecks) {
        console.log(`[probe] UNMEASURED: only ${ran} check(s) ran (expected >= ${minChecks}) — not a pass`);
        process.exit(2);
      }
      console.log(`[probe] ALL PASS (${ran} checks)`);
      process.exit(0);
    },
  };
}
