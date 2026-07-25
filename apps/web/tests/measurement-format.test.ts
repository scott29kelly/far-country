/**
 * Measurement display grammar.
 *
 * This mirrors `formatMeasurement` in the world engine
 * (`apps/world-engine/src/core/EntityHud.ts`) so a measurement reads the
 * same in the 3D world and on the entity page. These cases are the ones
 * that bit the engine implementation — keep both in step.
 */

import { describe, expect, it } from "vitest";

import type { EntityMeasurement } from "@/lib/data/types";
import { formatMeasurement } from "@/lib/ui/measurement";

function measurement(
  overrides: Partial<EntityMeasurement> &
    Pick<EntityMeasurement, "value" | "unit">,
): EntityMeasurement {
  return {
    id: "m-1",
    subject: "test subject",
    dimension: "length",
    tier: "clear",
    citations: [],
    ...overrides,
  };
}

describe("formatMeasurement", () => {
  it("pluralizes a normal unit", () => {
    expect(formatMeasurement(measurement({ value: 25000, unit: "cubit" }))).toBe(
      "25,000 cubits",
    );
  });

  it("keeps a value of one singular", () => {
    expect(formatMeasurement(measurement({ value: 1, unit: "reed" }))).toBe(
      "1 reed",
    );
  });

  it("reads a hyphenated unit as words", () => {
    expect(
      formatMeasurement(measurement({ value: 10000, unit: "long-cubit" })),
    ).toBe("10,000 long cubits");
  });

  it("leaves 'stadia' alone — the singular is 'stadion', never 'stadias'", () => {
    expect(
      formatMeasurement(measurement({ value: 12000, unit: "stadia" })),
    ).toBe("12,000 stadia");
  });

  it("renders a bare count for unit 'item'", () => {
    // The subject carries the noun ("thirty chambers"), so the value stands alone.
    expect(
      formatMeasurement(
        measurement({ value: 30, unit: "item", dimension: "count" }),
      ),
    ).toBe("30");
  });

  it("groups thousands so large dimensions stay readable", () => {
    expect(
      formatMeasurement(measurement({ value: 144, unit: "cubit" })),
    ).toBe("144 cubits");
    expect(
      formatMeasurement(measurement({ value: 1000000, unit: "cubit" })),
    ).toBe("1,000,000 cubits");
  });
});
