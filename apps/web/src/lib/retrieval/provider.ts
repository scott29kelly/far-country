/**
 * EmbeddingProvider — the pluggable interface from ADR 0007.
 *
 * Providers expose a single async method that turns N input strings into
 * N float vectors. They also surface their model identifier so callers
 * (the build script, the manifest, future migration tooling) can record
 * what produced a given index.
 *
 * The default implementation is OpenAI `text-embedding-3-small`
 * (`./openai.ts`), but the only contract is this interface — swapping
 * to Voyage or a local model is a one-file change.
 */

export type EmbeddingProvider = {
  /** Canonical model identifier, e.g. "text-embedding-3-small". */
  readonly model: string;
  /** Embedding dimensionality, e.g. 1536. */
  readonly dim: number;
  /** Embed N inputs in declaration order. Output length must equal input length. */
  embed(texts: string[]): Promise<number[][]>;
};

export class EmbeddingError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EmbeddingError";
  }
}
