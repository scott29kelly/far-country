/**
 * Prompt assembly.
 *
 * The orchestrator gives this module a question + a retrieved descriptor
 * list and gets back a `system` string + a `messages` array ready to
 * hand to an `LlmProvider`.
 *
 * Descriptors are formatted with a stable, machine-readable shape so the
 * model can use the inline `[descriptor:ID]` markers reliably. The whole
 * retrieved set goes into a single user message; conversation history
 * is not yet wired (single-turn UI for PR 2B.2/3).
 */

import type { Citation } from "@/lib/data/types";

import type { LlmMessage } from "./llm";
import type { GroundedDescriptor } from "./types";

export type PromptInput = {
  systemBody: string;
  question: string;
  retrieved: GroundedDescriptor[];
};

export type AssembledPrompt = {
  system: string;
  messages: LlmMessage[];
};

function formatCitation(c: Citation): string {
  switch (c.source_type) {
    case "scripture": {
      const verseRange =
        c.verse_end && c.verse_end !== c.verse_start
          ? `${c.verse_start}-${c.verse_end}`
          : `${c.verse_start ?? ""}`;
      return `Scripture ${c.book ?? "?"} ${c.chapter ?? "?"}:${verseRange}`.trim();
    }
    case "willis": {
      const pageRange =
        c.willis_page_end && c.willis_page_end !== c.willis_page_start
          ? `pp. ${c.willis_page_start}-${c.willis_page_end}`
          : `p. ${c.willis_page_start ?? "?"}`;
      return `Willis "${c.willis_chapter ?? "?"}" ${pageRange}`;
    }
    case "secondary":
      return `Secondary: ${c.secondary_work ?? "?"} ${c.secondary_locator ?? ""}`.trim();
    default:
      return `Citation (${c.source_type})`;
  }
}

function formatDescriptor(d: GroundedDescriptor): string {
  const lines: string[] = [
    `- id: ${d.id}`,
    `  tier: ${d.tier}`,
    `  temporal_phase: ${d.temporal_phase ?? "unspecified"}`,
    `  statement: ${d.statement}`,
  ];
  if (d.symbolic_referent) {
    lines.push(`  symbolic_referent: ${d.symbolic_referent}`);
  }
  if (d.citations.length > 0) {
    lines.push(`  citations:`);
    for (const c of d.citations) {
      lines.push(`    - ${formatCitation(c)}`);
    }
  }
  return lines.join("\n");
}

export function assemblePrompt(input: PromptInput): AssembledPrompt {
  const retrievedBlock =
    input.retrieved.length === 0
      ? "(none — refuse per the grounding contract.)"
      : input.retrieved.map(formatDescriptor).join("\n");

  const userContent = [
    "Retrieved descriptors:",
    retrievedBlock,
    "",
    "User question:",
    input.question,
  ].join("\n");

  return {
    system: input.systemBody,
    messages: [{ role: "user", content: userContent }],
  };
}

/**
 * Find every `[descriptor:ID]` marker in the model output.
 * Used by the citation-enforcement post-processor.
 */
const MARKER_RE = /\[descriptor:([A-Za-z0-9_\-]+)\]/g;

export function extractCitedIds(text: string): string[] {
  const ids = new Set<string>();
  for (const match of text.matchAll(MARKER_RE)) {
    ids.add(match[1]);
  }
  return Array.from(ids);
}
