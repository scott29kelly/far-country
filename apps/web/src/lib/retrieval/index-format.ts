/**
 * Wire format for `public/data/embeddings.json`.
 *
 * The index is one row per approved descriptor: the descriptor id plus
 * its embedding vector. Descriptor metadata (statement, tier, entity,
 * citations) is NOT duplicated here — the retriever joins back to
 * `canonical.json` / per-entity exports at read time so a single source
 * of truth governs descriptor content.
 *
 * The top-level header records what produced the file so a future
 * migration can detect stale indices and refuse them (the same posture
 * as `assertSupportedSchema` for the canonical manifest).
 */

export const EMBEDDING_INDEX_SCHEMA_VERSION = "0.1.0";

export type EmbeddingRow = {
  descriptor_id: string;
  vector: number[];
};

export type EmbeddingIndex = {
  /** Wire-format version of this file. Independent of canonical schema_version. */
  schema_version: string;
  /** ISO 8601 timestamp the file was generated at. */
  generated_at: string;
  /** Embedding model identifier, e.g. "text-embedding-3-small". */
  embedding_model: string;
  /** Embedding dimensionality, e.g. 1536. Must match every row's vector length. */
  embedding_dim: number;
  /** The descriptor schema_version this index was built against (from manifest.json). */
  source_schema_version: string;
  /** Embeddings in arbitrary stable order; the retriever does not assume order. */
  rows: EmbeddingRow[];
};

export class UnsupportedEmbeddingIndexError extends Error {
  constructor(reason: string) {
    super(`Embedding index is unusable: ${reason}`);
    this.name = "UnsupportedEmbeddingIndexError";
  }
}

/**
 * Verify the index file is internally consistent and compatible with
 * this build. Called once at load time; throws on mismatch so the app
 * fails loud rather than silently retrieving against the wrong vectors.
 */
export function assertSupportedEmbeddingIndex(
  index: EmbeddingIndex,
  expectedDim: number,
  expectedModel: string,
): void {
  if (index.schema_version !== EMBEDDING_INDEX_SCHEMA_VERSION) {
    throw new UnsupportedEmbeddingIndexError(
      `wire schema_version ${index.schema_version} != supported ${EMBEDDING_INDEX_SCHEMA_VERSION}`,
    );
  }
  if (index.embedding_dim !== expectedDim) {
    throw new UnsupportedEmbeddingIndexError(
      `embedding_dim ${index.embedding_dim} != expected ${expectedDim}`,
    );
  }
  if (index.embedding_model !== expectedModel) {
    throw new UnsupportedEmbeddingIndexError(
      `embedding_model ${index.embedding_model} != expected ${expectedModel}`,
    );
  }
  for (const row of index.rows) {
    if (row.vector.length !== expectedDim) {
      throw new UnsupportedEmbeddingIndexError(
        `row ${row.descriptor_id} vector length ${row.vector.length} != ${expectedDim}`,
      );
    }
  }
}
