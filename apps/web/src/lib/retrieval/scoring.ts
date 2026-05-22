/**
 * Similarity + tier-aware scoring primitives.
 *
 * Kept dependency-free so unit tests run instantly and the same code is
 * usable from the build script, the runtime retriever, and any future
 * offline evaluator.
 *
 * `tier-aware scoring` (spec §3.4) is implemented in two layers:
 *
 *   - **Tier filter** — drop descriptors whose tier is not in the
 *     caller's allowed set. Default: all four tiers allowed.
 *   - **Tier weights** — multiply the raw cosine similarity by a
 *     per-tier weight. Defaults are 1.0 across the board; the caller
 *     can demote, e.g., `symbolic` for questions that demand literal
 *     facts. Weighting is multiplicative and applied after cosine, so
 *     it operates on already-normalized scores in `[-1, 1]`.
 *
 * Neither layer is opinionated by default — the spec's contract is "tier
 * is rendered on every grounded answer", not "symbolic is downweighted".
 * Callers (the future `/api/ask` route) choose policy.
 */

import type { Tier } from "@/lib/data/types";

export type TierWeights = Partial<Record<Tier, number>>;

/**
 * Cosine similarity between two equal-length vectors. Inputs may be
 * non-unit-length; we normalize on the fly. Returns 0 when either
 * vector is the zero vector.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `cosineSimilarity: dimension mismatch (a=${a.length}, b=${b.length})`,
    );
  }
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    aNorm += x * x;
    bNorm += y * y;
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

/**
 * Apply per-tier weighting to a raw similarity. Missing weights default
 * to 1.0 (no change).
 */
export function applyTierWeight(
  rawScore: number,
  tier: Tier,
  weights?: TierWeights,
): number {
  if (!weights) return rawScore;
  const w = weights[tier];
  return w === undefined ? rawScore : rawScore * w;
}

/** Default weight set — all tiers equal. Exported so callers can copy and adjust. */
export const DEFAULT_TIER_WEIGHTS: Required<TierWeights> = {
  clear: 1,
  fuzzy: 1,
  debated: 1,
  symbolic: 1,
};
