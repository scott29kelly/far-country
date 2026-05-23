/**
 * `LlmProvider` — the contract the orchestrator uses to talk to a chat
 * model. Production wires this to Claude via the Anthropic SDK; tests
 * stub it directly so the grounded-answer contract is exercisable
 * without a network call or an API key.
 *
 * Streaming is out-of-band: `complete` returns a finalized string. The
 * SSE route layer turns the finalized string into an event stream once
 * the orchestrator finishes enforcement, so a citation-enforcement
 * retry doesn't leak partial bad output to the client.
 */

export type LlmMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LlmRequest = {
  system: string;
  messages: LlmMessage[];
  model: string;
};

export type LlmResponse = {
  text: string;
  model: string;
};

export type LlmProvider = {
  complete(request: LlmRequest): Promise<LlmResponse>;
};

export class LlmError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LlmError";
  }
}

/**
 * Default Anthropic-backed provider. Imports the SDK lazily so tests can
 * stub `LlmProvider` without paying the SDK import cost or needing an
 * API key.
 */
export function createAnthropicProvider(options: {
  apiKey?: string;
}): LlmProvider {
  return {
    async complete(request) {
      const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new LlmError(
          "ANTHROPIC_API_KEY is not set. Add it to .env or your deploy environment.",
        );
      }
      // Lazy import so we never pay the SDK cost in tests that supply
      // their own provider.
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: request.model,
        system: request.system,
        max_tokens: 1024,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      const textBlocks = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("");
      return { text: textBlocks, model: response.model };
    },
  };
}
