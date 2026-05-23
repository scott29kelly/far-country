/**
 * Public surface for `@/lib/retrieval` — barrel export.
 */

export { EmbeddingError, type EmbeddingProvider } from "./provider";
export {
  createOpenAIProvider,
  OPENAI_EMBEDDING_DIM,
  OPENAI_EMBEDDING_MODEL,
  type OpenAIProviderOptions,
} from "./openai";
export {
  applyTierWeight,
  cosineSimilarity,
  DEFAULT_TIER_WEIGHTS,
  type TierWeights,
} from "./scoring";
export {
  assertSupportedEmbeddingIndex,
  EMBEDDING_INDEX_SCHEMA_VERSION,
  UnsupportedEmbeddingIndexError,
  type EmbeddingIndex,
  type EmbeddingRow,
} from "./index-format";
export {
  _resetRetrievalCacheForTests,
  retrieve,
  retrieveByVector,
  type RetrievalHit,
  type RetrieveOptions,
} from "./retrieve";
