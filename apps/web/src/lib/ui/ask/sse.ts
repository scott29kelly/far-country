/**
 * Minimal SSE parser for the /api/ask stream.
 *
 * The route emits four named events (see app/api/ask/route.ts):
 *   meta       — once, first
 *   token      — repeated, each carrying a text chunk
 *   citations  — once, after all tokens
 *   done       — once, last
 *
 * This parser is deliberately scoped to that contract:
 *   - It does not support multi-line `data:` payloads (the route emits
 *     single-line JSON / single-line text).
 *   - It does not support comments or `id:` / `retry:` lines (the route
 *     does not emit them).
 *
 * Keeping it small means it's fully unit-testable without a real
 * ReadableStream, which is the test seam used in chat.test/sse.test.
 */

export type AskMetaEvent = {
  type: "meta";
  model: string;
  prompt_version: string;
  schema_version: string;
  refused: boolean;
  refusal_reason: "no-retrieval" | "enforcement-failed" | null;
  retrieved_descriptor_ids: string[];
};

export type AskCitationEvent = {
  id: string;
  tier: import("@/lib/data/types").Tier;
  temporal_phase: import("@/lib/data/types").TemporalPhase | null;
  statement: string;
  symbolic_referent: string | null;
  citations: import("@/lib/data/types").Citation[];
};

export type AskEvent =
  | AskMetaEvent
  | { type: "token"; text: string }
  | { type: "citations"; descriptors: AskCitationEvent[] }
  | { type: "done" };

/**
 * Stateful line-buffered parser. Feed it raw decoded chunks; it emits
 * complete events as they become available.
 */
export class SseEventParser {
  private buffer = "";
  private pendingEvent: string | null = null;
  private pendingData: string | null = null;

  /** Push a decoded chunk; returns any complete events parsed from it. */
  push(chunk: string): AskEvent[] {
    this.buffer += chunk;
    const out: AskEvent[] = [];

    // SSE events are separated by blank lines (`\n\n` or `\r\n\r\n`).
    // We split on `\n` and walk lines, finalizing on each blank line.
    let nl: number;
    while ((nl = this.buffer.indexOf("\n")) !== -1) {
      let line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      // Tolerate CRLF.
      if (line.endsWith("\r")) line = line.slice(0, -1);

      if (line === "") {
        const finalized = this.finalize();
        if (finalized) out.push(finalized);
        continue;
      }

      if (line.startsWith("event:")) {
        this.pendingEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        this.pendingData = line.slice(5).replace(/^ /, "");
      }
      // Other line types (id:, retry:, comments) are ignored by contract.
    }

    return out;
  }

  /** Flush any trailing event when the stream ends without a blank line. */
  flush(): AskEvent[] {
    if (this.buffer.length > 0) {
      // Treat remaining content as if a trailing newline arrived.
      this.push("\n");
    }
    const finalized = this.finalize();
    return finalized ? [finalized] : [];
  }

  private finalize(): AskEvent | null {
    const eventName = this.pendingEvent;
    const data = this.pendingData;
    this.pendingEvent = null;
    this.pendingData = null;
    if (!eventName || data === null) return null;
    return decodeEvent(eventName, data);
  }
}

function decodeEvent(eventName: string, data: string): AskEvent | null {
  switch (eventName) {
    case "meta": {
      const parsed = safeJson(data);
      if (!parsed || typeof parsed !== "object") return null;
      const m = parsed as Record<string, unknown>;
      return {
        type: "meta",
        model: typeof m.model === "string" ? m.model : "",
        prompt_version:
          typeof m.prompt_version === "string" ? m.prompt_version : "",
        schema_version:
          typeof m.schema_version === "string" ? m.schema_version : "",
        refused: Boolean(m.refused),
        refusal_reason:
          m.refusal_reason === "no-retrieval" ||
          m.refusal_reason === "enforcement-failed"
            ? m.refusal_reason
            : null,
        retrieved_descriptor_ids: Array.isArray(m.retrieved_descriptor_ids)
          ? (m.retrieved_descriptor_ids.filter(
              (x) => typeof x === "string",
            ) as string[])
          : [],
      };
    }
    case "token":
      // Token payloads are raw text, not JSON.
      return { type: "token", text: data };
    case "citations": {
      const parsed = safeJson(data);
      if (!Array.isArray(parsed)) return { type: "citations", descriptors: [] };
      return {
        type: "citations",
        descriptors: parsed as AskCitationEvent[],
      };
    }
    case "done":
      return { type: "done" };
    default:
      return null;
  }
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
