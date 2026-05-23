/**
 * Grounded-answer orchestrator.
 *
 * The contract (ADR 0004 + spec §3.5):
 *
 *   1. Retrieve descriptors relevant to the user's question.
 *   2. If retrieval is empty → return a refusal *without calling the LLM*.
 *   3. Otherwise call the LLM with the retrieved set + the system prompt.
 *   4. Post-process: if the answer cites zero retrieved descriptors,
 *      retry once with a stricter prompt; if the retry also fails,
 *      refuse.
 *   5. In all cases, surface `{ model, prompt_version, schema_version,
 *      retrieved_descriptor_ids, refused }` on the response (spec §6).
 *
 * The orchestrator is dependency-injected with a retrieval function
 * and an `LlmProvider` so the contract is testable end-to-end with no
 * network calls.
 */

import type { Tier } from "@/lib/data/types";

import type { RetrievalHit } from "@/lib/retrieval";

import type { LlmProvider } from "./llm";
import { assemblePrompt, extractCitedIds } from "./prompt";
import { loadSystemPrompt, type SystemPrompt } from "./system-prompt";
import type { GroundedAnswer, GroundedDescriptor } from "./types";

const STRICTER_RETRY_NOTE =
  "\n\nIMPORTANT: Your previous response did not include any [descriptor:ID] " +
  "marker pointing at a retrieved descriptor. Per the grounding contract, " +
  "every substantive answer must cite at least one retrieved descriptor by " +
  "its ID. If no retrieved descriptor supports an answer, refuse instead.";

const REFUSAL_NO_RETRIEVAL =
  "The dataset does not contain a grounded answer to that question. " +
  "Try asking about a specific entity or topic that appears in the descriptor catalog.";

const REFUSAL_ENFORCEMENT =
  "The dataset has nearby material on this topic, but the answer drafted " +
  "from it did not stay within the grounded contract. No grounded answer is returned.";

export type RetrieveFn = (
  query: string,
  options: { k: number; minScore: number; tierFilter?: Iterable<Tier> },
) => Promise<RetrievalHit[]>;

export type GroundedOptions = {
  /** Override the model id. Default: prompt frontmatter `default_model`. */
  model?: string;
  /** Max retrieved descriptors. Default 6. */
  k?: number;
  /** Refusal threshold: if no retrieval scores above this, refuse. Default 0.2. */
  minScore?: number;
  /** Tier filter passed through to retrieval. Default: all tiers. */
  tierFilter?: Iterable<Tier>;
  /** Canonical schema version to record on the response. */
  schemaVersion: string;
  /** Override system-prompt loading (test seam). */
  systemPrompt?: SystemPrompt;
};

function toGroundedDescriptor(hit: RetrievalHit): GroundedDescriptor {
  return {
    id: hit.descriptor.id,
    tier: hit.descriptor.tier,
    temporal_phase: hit.descriptor.temporal_phase ?? null,
    statement: hit.descriptor.statement,
    symbolic_referent: hit.descriptor.symbolic_referent ?? null,
    citations: hit.citations,
  };
}

export async function answer(
  question: string,
  deps: { retrieve: RetrieveFn; llm: LlmProvider },
  options: GroundedOptions,
): Promise<GroundedAnswer> {
  const systemPrompt =
    options.systemPrompt ?? (await loadSystemPrompt());
  const model = options.model ?? systemPrompt.defaultModel;
  const k = options.k ?? 6;
  const minScore = options.minScore ?? 0.2;

  const hits = await deps.retrieve(question, {
    k,
    minScore,
    tierFilter: options.tierFilter,
  });

  const retrieved = hits.map(toGroundedDescriptor);

  if (retrieved.length === 0) {
    return {
      text: REFUSAL_NO_RETRIEVAL,
      cited: [],
      retrieved: [],
      model,
      prompt_version: systemPrompt.version,
      schema_version: options.schemaVersion,
      refused: true,
      refusal_reason: "no-retrieval",
    };
  }

  const retrievedById = new Map(retrieved.map((d) => [d.id, d]));

  const prompt = assemblePrompt({
    systemBody: systemPrompt.body,
    question,
    retrieved,
  });

  // First attempt.
  let llmResponse = await deps.llm.complete({
    system: prompt.system,
    messages: prompt.messages,
    model,
  });

  let citedIds = extractCitedIds(llmResponse.text).filter((id) =>
    retrievedById.has(id),
  );

  // Single-retry citation enforcement (spec open question E3 → option c).
  if (citedIds.length === 0) {
    llmResponse = await deps.llm.complete({
      system: prompt.system + STRICTER_RETRY_NOTE,
      messages: prompt.messages,
      model,
    });
    citedIds = extractCitedIds(llmResponse.text).filter((id) =>
      retrievedById.has(id),
    );
  }

  if (citedIds.length === 0) {
    return {
      text: REFUSAL_ENFORCEMENT,
      cited: [],
      retrieved,
      model,
      prompt_version: systemPrompt.version,
      schema_version: options.schemaVersion,
      refused: true,
      refusal_reason: "enforcement-failed",
    };
  }

  const cited = citedIds
    .map((id) => retrievedById.get(id))
    .filter((d): d is GroundedDescriptor => d !== undefined);

  return {
    text: llmResponse.text,
    cited,
    retrieved,
    model: llmResponse.model || model,
    prompt_version: systemPrompt.version,
    schema_version: options.schemaVersion,
    refused: false,
    refusal_reason: null,
  };
}

export const _REFUSAL_NO_RETRIEVAL = REFUSAL_NO_RETRIEVAL;
export const _REFUSAL_ENFORCEMENT = REFUSAL_ENFORCEMENT;
