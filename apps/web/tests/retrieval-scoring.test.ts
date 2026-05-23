/**
 * Unit tests for similarity + tier-aware scoring primitives.
 *
 * These have zero filesystem dependency — they exercise the math only.
 */

import { describe, expect, it } from "vitest";

import {
  applyTierWeight,
  cosineSimilarity,
  DEFAULT_TIER_WEIGHTS,
} from "@/lib/retrieval/scoring";

describe("cosineSimilarity", () => {
  it("returns 1.0 for identical vectors", () => {
    const v = [1, 2, 3];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 10);
  });

  it("returns 1.0 for parallel non-unit vectors (scale invariance)", () => {
    expect(cosineSimilarity([1, 0, 0], [7, 0, 0])).toBeCloseTo(1.0, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
  });

  it("returns -1.0 for opposite vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [-1, -2, -3])).toBeCloseTo(-1.0, 10);
  });

  it("returns 0 when either input is the zero vector", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });

  it("throws on dimension mismatch", () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow(/dimension mismatch/);
  });
});

describe("applyTierWeight", () => {
  it("returns the raw score when no weights are provided", () => {
    expect(applyTierWeight(0.8, "clear")).toBe(0.8);
    expect(applyTierWeight(0.8, "symbolic")).toBe(0.8);
  });

  it("multiplies by the per-tier weight when provided", () => {
    expect(applyTierWeight(0.8, "symbolic", { symbolic: 0.5 })).toBeCloseTo(0.4, 10);
    expect(applyTierWeight(0.8, "clear", { symbolic: 0.5 })).toBe(0.8);
  });

  it("treats a missing tier in the weights map as weight 1.0", () => {
    expect(applyTierWeight(0.8, "debated", { symbolic: 0.3 })).toBe(0.8);
  });
});

describe("DEFAULT_TIER_WEIGHTS", () => {
  it("is all 1.0 — no tier is downweighted by default", () => {
    expect(DEFAULT_TIER_WEIGHTS).toEqual({
      clear: 1,
      fuzzy: 1,
      debated: 1,
      symbolic: 1,
    });
  });
});
