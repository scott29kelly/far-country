/**
 * The grounded-answer contract test.
 *
 * Per spec §4 acceptance criterion 7: the suite covers retrieval shape,
 * refusal path, the citation-enforcement post-processor, and the
 * grounded-answer contract under at least three canned questions
 * (clear, symbolic, no-grounding). All four are here.
 *
 * The orchestrator is dependency-injected with a stub retrieval fn and
 * a stub `LlmProvider`, so this entire suite runs without any network
 * call, ESV key, OpenAI key, or Anthropic key.
 */

import { describe, expect, it, vi } from "vitest";

import {
  _REFUSAL_ENFORCEMENT,
  _REFUSAL_NO_RETRIEVAL,
} from "@/lib/qa/grounded";
import { answer } from "@/lib/qa";
import type {
  GroundedDescriptor,
  LlmProvider,
  RetrieveFn,
  SystemPrompt,
} from "@/lib/qa";
import type { RetrievalHit } from "@/lib/retrieval";

const FAKE_PROMPT: SystemPrompt = {
  version: "test.0.0",
  defaultModel: "claude-sonnet-test",
  body: "SYSTEM BODY (test fixture)",
};

function fakeHit(descriptor: GroundedDescriptor): RetrievalHit {
  return {
    descriptor: {
      id: descriptor.id,
      entity_id: "entity-x",
      statement: descriptor.statement,
      tier: descriptor.tier,
      symbolic_referent: descriptor.symbolic_referent ?? null,
      temporal_phase: descriptor.temporal_phase,
    },
    score: 0.9,
    rawScore: 0.9,
    citations: descriptor.citations,
  };
}

const CLEAR_DESCRIPTOR: GroundedDescriptor = {
  id: "desc-clear",
  tier: "clear",
  temporal_phase: "final",
  statement: "The New Jerusalem comes down out of heaven from God.",
  citations: [
    {
      id: "cit-clear",
      source_type: "scripture",
      book: "Revelation",
      chapter: 21,
      verse_start: 2,
      verse_end: null,
    },
  ],
};

const SYMBOLIC_DESCRIPTOR: GroundedDescriptor = {
  id: "desc-symbolic",
  tier: "symbolic",
  temporal_phase: "final",
  statement: "The twelve gates of the city are twelve pearls.",
  symbolic_referent: "preciousness and singularity of access",
  citations: [
    {
      id: "cit-symbolic",
      source_type: "scripture",
      book: "Revelation",
      chapter: 21,
      verse_start: 21,
      verse_end: null,
    },
  ],
};

function makeRetrieve(hits: RetrievalHit[]): RetrieveFn {
  return vi.fn(async () => hits) as RetrieveFn;
}

function makeLlm(
  responses: string[],
  model = "claude-sonnet-test",
): LlmProvider & { calls: number } {
  let i = 0;
  const provider: LlmProvider & { calls: number } = {
    calls: 0,
    async complete() {
      provider.calls++;
      const text = responses[i++] ?? "";
      return { text, model };
    },
  };
  return provider;
}

describe("answer — refusal path (no retrieval)", () => {
  it("returns the refusal text WITHOUT calling the LLM", async () => {
    const retrieveFn = makeRetrieve([]);
    const llm = makeLlm(["should never be reached"]);

    const result = await answer(
      "What color are the chairs in heaven?",
      { retrieve: retrieveFn, llm },
      { schemaVersion: "0.1.0", systemPrompt: FAKE_PROMPT },
    );

    expect(llm.calls).toBe(0);
    expect(result.refused).toBe(true);
    expect(result.refusal_reason).toBe("no-retrieval");
    expect(result.text).toBe(_REFUSAL_NO_RETRIEVAL);
    expect(result.retrieved).toEqual([]);
    expect(result.cited).toEqual([]);
    expect(result.prompt_version).toBe("test.0.0");
    expect(result.schema_version).toBe("0.1.0");
  });
});

describe("answer — clear-tier grounded path", () => {
  it("returns an answer that cites the retrieved clear descriptor", async () => {
    const retrieveFn = makeRetrieve([fakeHit(CLEAR_DESCRIPTOR)]);
    const llm = makeLlm([
      "The New Jerusalem descends from heaven [descriptor:desc-clear].",
    ]);

    const result = await answer(
      "Where does the New Jerusalem come from?",
      { retrieve: retrieveFn, llm },
      { schemaVersion: "0.1.0", systemPrompt: FAKE_PROMPT },
    );

    expect(result.refused).toBe(false);
    expect(result.refusal_reason).toBeNull();
    expect(llm.calls).toBe(1);
    expect(result.cited.map((d) => d.id)).toEqual(["desc-clear"]);
    expect(result.text).toContain("[descriptor:desc-clear]");
  });
});

describe("answer — symbolic-tier grounded path", () => {
  it("preserves tier info on the cited descriptor for the UI", async () => {
    const retrieveFn = makeRetrieve([fakeHit(SYMBOLIC_DESCRIPTOR)]);
    const llm = makeLlm([
      "Scripture describes the gates *symbolically* [descriptor:desc-symbolic].",
    ]);

    const result = await answer(
      "What are the gates of the city made of?",
      { retrieve: retrieveFn, llm },
      { schemaVersion: "0.1.0", systemPrompt: FAKE_PROMPT },
    );

    expect(result.refused).toBe(false);
    expect(result.cited).toHaveLength(1);
    expect(result.cited[0].tier).toBe("symbolic");
    expect(result.cited[0].symbolic_referent).toContain("preciousness");
  });
});

describe("answer — citation enforcement", () => {
  it("retries once when the first answer cites nothing, then accepts", async () => {
    const retrieveFn = makeRetrieve([fakeHit(CLEAR_DESCRIPTOR)]);
    const llm = makeLlm([
      "No marker at all in this response.",
      "Better: the city descends [descriptor:desc-clear].",
    ]);

    const result = await answer(
      "How does the New Jerusalem appear?",
      { retrieve: retrieveFn, llm },
      { schemaVersion: "0.1.0", systemPrompt: FAKE_PROMPT },
    );

    expect(llm.calls).toBe(2);
    expect(result.refused).toBe(false);
    expect(result.cited.map((d) => d.id)).toEqual(["desc-clear"]);
  });

  it("refuses with `enforcement-failed` when retry also produces no citation", async () => {
    const retrieveFn = makeRetrieve([fakeHit(CLEAR_DESCRIPTOR)]);
    const llm = makeLlm([
      "No markers anywhere.",
      "Still no markers.",
    ]);

    const result = await answer(
      "Ambiguous question",
      { retrieve: retrieveFn, llm },
      { schemaVersion: "0.1.0", systemPrompt: FAKE_PROMPT },
    );

    expect(llm.calls).toBe(2);
    expect(result.refused).toBe(true);
    expect(result.refusal_reason).toBe("enforcement-failed");
    expect(result.text).toBe(_REFUSAL_ENFORCEMENT);
    // We still report what we retrieved, so the UI can surface "the
    // closest related material" if it wants to.
    expect(result.retrieved.map((d) => d.id)).toEqual(["desc-clear"]);
  });

  it("ignores citations that name a descriptor outside the retrieved set", async () => {
    const retrieveFn = makeRetrieve([fakeHit(CLEAR_DESCRIPTOR)]);
    const llm = makeLlm([
      "Citing a phantom [descriptor:not-in-retrieval] and nothing else.",
      "Try again [descriptor:still-not-real].",
    ]);

    const result = await answer(
      "Q",
      { retrieve: retrieveFn, llm },
      { schemaVersion: "0.1.0", systemPrompt: FAKE_PROMPT },
    );

    expect(result.refused).toBe(true);
    expect(result.refusal_reason).toBe("enforcement-failed");
  });
});

describe("answer — response metadata", () => {
  it("carries model, prompt_version, and schema_version through to the caller", async () => {
    const retrieveFn = makeRetrieve([fakeHit(CLEAR_DESCRIPTOR)]);
    const llm = makeLlm(["yes [descriptor:desc-clear]"], "claude-explicit-override");

    const result = await answer(
      "Q",
      { retrieve: retrieveFn, llm },
      {
        schemaVersion: "0.1.0",
        systemPrompt: FAKE_PROMPT,
        model: "claude-sonnet-test",
      },
    );

    expect(result.prompt_version).toBe("test.0.0");
    expect(result.schema_version).toBe("0.1.0");
    // LlmResponse.model wins when set — useful for surfacing the real
    // model id the provider reports back.
    expect(result.model).toBe("claude-explicit-override");
  });
});
