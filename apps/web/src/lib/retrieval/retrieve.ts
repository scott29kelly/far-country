/**
 * Read-path retrieval: question vector → top-K descriptors.
 *
 * The retriever joins three pieces:
 *
 *   1. `public/data/embeddings.json` — descriptor id → vector, built by
 *      `scripts/build-index.ts` at deploy time (no runtime embedding
 *      of the corpus).
 *   2. The canonical export (descriptors, citations, entities) — for
 *      the metadata a grounded answer needs to cite a hit.
 *   3. The caller's query vector — produced by an `EmbeddingProvider`
 *      (the same one used at build time, so vectors live in the same
 *      space).
 *
 * The retriever never reads the SQLite store and never reads
 * ESV/Willis source text (per spec §3.4).
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { loadCanonical } from "@/lib/data/load";
import type { Citation, Descriptor, Tier } from "@/lib/data/types";

import {
  assertSupportedEmbeddingIndex,
  type EmbeddingIndex,
  type EmbeddingRow,
} from "./index-format";
import {
  OPENAI_EMBEDDING_DIM,
  OPENAI_EMBEDDING_MODEL,
} from "./openai";
import {
  applyTierWeight,
  cosineSimilarity,
  type TierWeights,
} from "./scoring";

const INDEX_FILE = "embeddings.json";

/** A single retrieval hit — descriptor + score + the citations behind it. */
export type RetrievalHit = {
  descriptor: Descriptor;
  /** Tier-weighted similarity in roughly `[-1, 1]` (post-weighting). */
  score: number;
  /** Raw cosine similarity in `[-1, 1]`, pre-weighting. */
  rawScore: number;
  /** Citations attached to this descriptor in the canonical export. */
  citations: Citation[];
};

export type RetrieveOptions = {
  /** Maximum number of hits to return. Default 5. */
  k?: number;
  /** Drop hits whose weighted score is below this threshold. Default `-Infinity`. */
  minScore?: number;
  /** Allowed tiers. Default: all four. */
  tierFilter?: Iterable<Tier>;
  /** Per-tier multiplicative weights applied to cosine. Default: all 1.0. */
  tierWeights?: TierWeights;
  /** Override the embeddings.json path for tests. */
  indexPath?: string;
  /** Override expected embedding dim. Default = OpenAI text-embedding-3-small (1536). */
  expectedDim?: number;
  /** Override expected embedding model id. Default = OpenAI text-embedding-3-small. */
  expectedModel?: string;
};

let cachedIndex: EmbeddingIndex | null = null;

async function loadEmbeddingIndex(
  indexPath?: string,
  expectedDim?: number,
  expectedModel?: string,
): Promise<EmbeddingIndex> {
  if (cachedIndex && !indexPath) return cachedIndex;

  const resolved =
    indexPath ?? path.join(process.cwd(), "public", "data", INDEX_FILE);
  const raw = await fs.readFile(resolved, "utf-8");
  const index = JSON.parse(raw) as EmbeddingIndex;
  assertSupportedEmbeddingIndex(
    index,
    expectedDim ?? OPENAI_EMBEDDING_DIM,
    expectedModel ?? OPENAI_EMBEDDING_MODEL,
  );

  if (!indexPath) cachedIndex = index;
  return index;
}

/** Test-only — clear the retriever cache. */
export function _resetRetrievalCacheForTests(): void {
  cachedIndex = null;
}

/**
 * Score every descriptor in the index against `queryVector`, apply tier
 * filter + tier weights, sort, and return the top `k`.
 *
 * Exported separately from `retrieve()` so the caller can avoid embedding
 * the question when they already have a vector (e.g., during eval/replay).
 */
export async function retrieveByVector(
  queryVector: number[],
  options: RetrieveOptions = {},
): Promise<RetrievalHit[]> {
  const k = options.k ?? 5;
  const minScore = options.minScore ?? Number.NEGATIVE_INFINITY;
  const allowedTiers = options.tierFilter
    ? new Set<Tier>(options.tierFilter)
    : null;

  const index = await loadEmbeddingIndex(
    options.indexPath,
    options.expectedDim,
    options.expectedModel,
  );
  if (queryVector.length !== index.embedding_dim) {
    throw new Error(
      `retrieveByVector: query dim ${queryVector.length} != index dim ${index.embedding_dim}`,
    );
  }

  const canonical = await loadCanonical();
  const descriptorById = new Map<string, Descriptor>();
  for (const d of canonical.descriptors) descriptorById.set(d.id, d);
  const citationsByDescriptor = new Map<string, Citation[]>();
  for (const c of canonical.citations) {
    if (!c.descriptor_id) continue;
    const arr = citationsByDescriptor.get(c.descriptor_id) ?? [];
    arr.push(c);
    citationsByDescriptor.set(c.descriptor_id, arr);
  }

  const hits: RetrievalHit[] = [];
  for (const row of index.rows) {
    const descriptor = descriptorById.get(row.descriptor_id);
    // An index row whose descriptor was dropped from the canonical
    // export (e.g., un-approved between build and read) is silently
    // ignored — the export is the source of truth.
    if (!descriptor) continue;
    if (allowedTiers && !allowedTiers.has(descriptor.tier)) continue;

    const raw = cosineSimilarity(queryVector, row.vector);
    const score = applyTierWeight(raw, descriptor.tier, options.tierWeights);
    if (score < minScore) continue;

    hits.push({
      descriptor,
      score,
      rawScore: raw,
      citations: citationsByDescriptor.get(descriptor.id) ?? [],
    });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

/**
 * High-level: embed the question with the given provider, then retrieve.
 */
export async function retrieve(
  query: string,
  provider: { embed: (texts: string[]) => Promise<number[][]> },
  options: RetrieveOptions = {},
): Promise<RetrievalHit[]> {
  const [vector] = await provider.embed([query]);
  return retrieveByVector(vector, options);
}

/** Re-exported here so consumers import everything from `@/lib/retrieval`. */
export type { EmbeddingRow };
