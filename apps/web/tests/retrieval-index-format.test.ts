/**
 * Tests for the embeddings.json wire-format guard.
 *
 * The retriever loads this file at startup. If it's wrong (stale schema,
 * wrong model, wrong dim), retrieval would silently return garbage. The
 * guard exists to fail loud instead.
 */

import { describe, expect, it } from "vitest";

import {
  assertSupportedEmbeddingIndex,
  EMBEDDING_INDEX_SCHEMA_VERSION,
  type EmbeddingIndex,
  UnsupportedEmbeddingIndexError,
} from "@/lib/retrieval/index-format";

function makeIndex(overrides: Partial<EmbeddingIndex> = {}): EmbeddingIndex {
  return {
    schema_version: EMBEDDING_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-22T00:00:00Z",
    embedding_model: "text-embedding-3-small",
    embedding_dim: 4,
    source_schema_version: "0.1.0",
    rows: [
      { descriptor_id: "d-1", vector: [0.1, 0.2, 0.3, 0.4] },
      { descriptor_id: "d-2", vector: [0.5, 0.6, 0.7, 0.8] },
    ],
    ...overrides,
  };
}

describe("assertSupportedEmbeddingIndex", () => {
  it("accepts a well-formed index", () => {
    expect(() =>
      assertSupportedEmbeddingIndex(makeIndex(), 4, "text-embedding-3-small"),
    ).not.toThrow();
  });

  it("rejects mismatched wire schema_version", () => {
    expect(() =>
      assertSupportedEmbeddingIndex(
        makeIndex({ schema_version: "9.9.9" }),
        4,
        "text-embedding-3-small",
      ),
    ).toThrow(UnsupportedEmbeddingIndexError);
  });

  it("rejects mismatched embedding_dim", () => {
    expect(() =>
      assertSupportedEmbeddingIndex(makeIndex(), 8, "text-embedding-3-small"),
    ).toThrow(/embedding_dim/);
  });

  it("rejects mismatched embedding_model", () => {
    expect(() =>
      assertSupportedEmbeddingIndex(makeIndex(), 4, "voyage-3"),
    ).toThrow(/embedding_model/);
  });

  it("rejects a row whose vector length disagrees with embedding_dim", () => {
    const bad = makeIndex({
      rows: [
        { descriptor_id: "d-1", vector: [0.1, 0.2, 0.3, 0.4] },
        { descriptor_id: "d-bad", vector: [0.1, 0.2] },
      ],
    });
    expect(() =>
      assertSupportedEmbeddingIndex(bad, 4, "text-embedding-3-small"),
    ).toThrow(/d-bad.*length/);
  });
});
