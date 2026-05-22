/**
 * Shared types for the Q&A pipeline. Kept in one file so route handlers,
 * the orchestrator, and tests refer to the same shapes.
 */

import type { Citation, Descriptor, Tier } from "@/lib/data/types";

/** A descriptor + its citations as the orchestrator hands it to the LLM. */
export type GroundedDescriptor = {
  id: string;
  tier: Tier;
  temporal_phase: Descriptor["temporal_phase"];
  statement: string;
  symbolic_referent?: string | null;
  citations: Citation[];
};

/** The full grounded answer envelope. */
export type GroundedAnswer = {
  /** The model's prose answer (post-enforcement). */
  text: string;
  /** Descriptors actually cited in `text` (subset of `retrieved`). */
  cited: GroundedDescriptor[];
  /** Every descriptor that was supplied to the model. */
  retrieved: GroundedDescriptor[];
  /** Which Claude model produced the answer. */
  model: string;
  /** System-prompt version that produced it. */
  prompt_version: string;
  /** Canonical-data schema_version the retrieval was joined against. */
  schema_version: string;
  /** True iff this is a refusal (no LLM call OR enforcement-driven refusal). */
  refused: boolean;
  /** Optional reason code for telemetry: 'no-retrieval' | 'enforcement-failed' | null. */
  refusal_reason?: "no-retrieval" | "enforcement-failed" | null;
};
