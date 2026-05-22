/**
 * OpenAI `text-embedding-3-small` provider.
 *
 * Talks to the OpenAI embeddings REST endpoint directly via `fetch` so
 * we do not take a runtime dependency on the `openai` npm package — the
 * surface we need is a single POST.
 *
 * Used by `scripts/build-index.ts` at deploy time and by the future
 * `/api/ask` route at runtime to embed user questions. The retrieval
 * read path does NOT call this — it loads the prebuilt vectors from
 * `public/data/embeddings.json`.
 */

import { EmbeddingError, type EmbeddingProvider } from "./provider";

export const OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const OPENAI_EMBEDDING_DIM = 1536;

const OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";

type OpenAIEmbeddingResponse = {
  data: { embedding: number[]; index: number }[];
  model: string;
  usage?: { prompt_tokens: number; total_tokens: number };
};

export type OpenAIProviderOptions = {
  /** API key — defaults to `process.env.OPENAI_API_KEY`. */
  apiKey?: string;
  /** Override the fetch impl, primarily for tests. */
  fetchImpl?: typeof fetch;
  /** Override the base URL, primarily for tests. */
  url?: string;
};

export function createOpenAIProvider(
  options: OpenAIProviderOptions = {},
): EmbeddingProvider {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingError(
      "OPENAI_API_KEY is not set. Add it to .env or your deploy environment.",
    );
  }
  const url = options.url ?? OPENAI_EMBEDDINGS_URL;
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    model: OPENAI_EMBEDDING_MODEL,
    dim: OPENAI_EMBEDDING_DIM,

    async embed(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: OPENAI_EMBEDDING_MODEL,
          input: texts,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new EmbeddingError(
          `OpenAI embeddings request failed: ${response.status} ${response.statusText} — ${body.slice(0, 200)}`,
        );
      }

      const payload = (await response.json()) as OpenAIEmbeddingResponse;
      if (!Array.isArray(payload.data) || payload.data.length !== texts.length) {
        throw new EmbeddingError(
          `OpenAI returned ${payload.data?.length ?? 0} embeddings for ${texts.length} inputs.`,
        );
      }

      // OpenAI returns items with explicit `index`. Re-sort to defend
      // against future ordering changes.
      const sorted = [...payload.data].sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    },
  };
}
