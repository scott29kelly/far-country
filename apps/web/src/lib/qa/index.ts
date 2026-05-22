/**
 * Public surface for `@/lib/qa` — barrel export.
 */

export { answer, type GroundedOptions, type RetrieveFn } from "./grounded";
export {
  _resetSystemPromptCacheForTests,
  loadSystemPrompt,
  type SystemPrompt,
} from "./system-prompt";
export { assemblePrompt, extractCitedIds } from "./prompt";
export {
  createAnthropicProvider,
  LlmError,
  type LlmMessage,
  type LlmProvider,
  type LlmRequest,
  type LlmResponse,
} from "./llm";
export type { GroundedAnswer, GroundedDescriptor } from "./types";
