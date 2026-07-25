/**
 * Measurement display grammar.
 *
 * Deliberately mirrors `formatMeasurement` in the world engine's
 * `src/core/EntityHud.ts` so a measurement reads identically whether the
 * user meets it in the 3D world or on the entity page. If you change one,
 * change both.
 *
 * Values are text-native (ADR 0017): "one reed" is `1 reed`, never
 * pre-converted to metres. Metric realization belongs to the engine's
 * declared resolver (ADR 0018) — this layer only renders what the text says.
 */

import type { EntityMeasurement } from "@/lib/data/types";

export function formatMeasurement(measurement: EntityMeasurement): string {
  const n = measurement.value.toLocaleString("en-US");
  // A bare count reads as a number: "thirty chambers" is subject + value.
  if (measurement.unit === "item") return n;
  // Invariant plural — the singular is "stadion", so never "stadias".
  if (measurement.unit === "stadia") return `${n} stadia`;
  const unit = measurement.unit.replace(/-/g, " ");
  return `${n} ${unit}${measurement.value === 1 ? "" : "s"}`;
}
