/**
 * Trees-of-life placement table (Rev 22:2) — the single owner consumed by
 * the builder (TreesOfLife.ts, which adds seeded ±6/±8 m jitter per tree)
 * and the entity pick registry (entityPicks.ts). Import-light on purpose:
 * CPU probes import this without pulling the vegetation pipeline.
 */

/** River-bank offset (world m) — just off the 100 m channel. */
export const TOL_BANK_X = 150;

/** Six stations along the approach reach (world m, inside the scatter keep-out). */
export const TOL_Z_STATIONS = [2450, 2610, 2770, 2930, 3090, 3250] as const;

/** The twelve nominal tree stations (world m). */
export function treeOfLifeStations(): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  for (const z of TOL_Z_STATIONS) for (const sx of [-1, 1]) out.push({ x: sx * TOL_BANK_X, z });
  return out;
}
