/** Shared PASS/FAIL printer + exit-code state for the arrival probes
 *  (probe-bootrite / probe-arrival / probe-ambience). */

export interface Checker {
  /** print one PASS/FAIL line; failures accumulate into finish()'s exit code */
  check(name: string, ok: boolean, detail?: string): void;
  /** record an out-of-band failure (e.g. a pageerror handler) */
  fail(name: string): void;
  /** print the summary line and exit 0/1 */
  finish(): never;
}

export function makeChecker(): Checker {
  const failures: string[] = [];
  return {
    check(name: string, ok: boolean, detail = ''): void {
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
      if (!ok) failures.push(name);
    },
    fail(name: string): void {
      failures.push(name);
    },
    finish(): never {
      console.log(
        failures.length === 0
          ? '[probe] ALL PASS'
          : `[probe] ${failures.length} FAILURE(S): ${failures.join(', ')}`,
      );
      process.exit(failures.length === 0 ? 0 : 1);
    },
  };
}
