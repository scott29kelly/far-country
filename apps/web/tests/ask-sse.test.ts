/**
 * Tests for the SSE parser used by the /ask chat client.
 *
 * The parser is fed raw decoded chunks (the same shape `TextDecoder`
 * produces from `ReadableStream`). It must handle:
 *   - Multiple events delivered in one chunk
 *   - One event split across chunks (including across a `data:` boundary)
 *   - CRLF as well as LF line endings
 *   - Trailing event delivered without a final blank line (covered by flush)
 *   - Token payloads that aren't JSON (they're raw text)
 */

import { describe, expect, it } from "vitest";

import { SseEventParser } from "@/lib/ui/ask/sse";

const META = JSON.stringify({
  model: "claude-sonnet-4-6",
  prompt_version: "0.1.0",
  schema_version: "0.3.0",
  refused: false,
  refusal_reason: null,
  retrieved_descriptor_ids: ["desc-a", "desc-b"],
});

describe("SseEventParser", () => {
  it("parses meta → token* → citations → done in one chunk", () => {
    const parser = new SseEventParser();
    const stream =
      `event: meta\ndata: ${META}\n\n` +
      `event: token\ndata: Hello \n\n` +
      `event: token\ndata: world.\n\n` +
      `event: citations\ndata: ${JSON.stringify([
        {
          id: "desc-a",
          tier: "clear",
          temporal_phase: "final",
          statement: "x",
          symbolic_referent: null,
          citations: [],
        },
      ])}\n\n` +
      `event: done\ndata: {}\n\n`;
    const events = parser.push(stream);

    expect(events.map((e) => e.type)).toEqual([
      "meta",
      "token",
      "token",
      "citations",
      "done",
    ]);
    expect(events[0]).toMatchObject({
      type: "meta",
      model: "claude-sonnet-4-6",
      prompt_version: "0.1.0",
      schema_version: "0.3.0",
      refused: false,
      refusal_reason: null,
      retrieved_descriptor_ids: ["desc-a", "desc-b"],
    });
    expect(events[1]).toEqual({ type: "token", text: "Hello " });
    expect(events[2]).toEqual({ type: "token", text: "world." });
    expect((events[3] as { type: string; descriptors: unknown[] }).descriptors).toHaveLength(1);
    expect(events[4]).toEqual({ type: "done" });
  });

  it("handles events split across multiple chunks", () => {
    const parser = new SseEventParser();
    const chunks = [
      "event: meta\nda",
      "ta: " + META.slice(0, 20),
      META.slice(20) + "\n\nevent: tok",
      "en\ndata: stream",
      "ed\n\n",
    ];

    const out = chunks.flatMap((c) => parser.push(c));
    expect(out.map((e) => e.type)).toEqual(["meta", "token"]);
    expect(out[1]).toEqual({ type: "token", text: "streamed" });
  });

  it("preserves raw token text rather than JSON-decoding it", () => {
    const parser = new SseEventParser();
    // The route does not wrap token payloads in JSON. Make sure a payload
    // that *looks* like JSON is still treated as literal text.
    const events = parser.push(`event: token\ndata: {"not":"json"}\n\n`);
    expect(events).toEqual([{ type: "token", text: '{"not":"json"}' }]);
  });

  it("tolerates CRLF line endings", () => {
    const parser = new SseEventParser();
    const events = parser.push(
      `event: token\r\ndata: hi\r\n\r\nevent: done\r\ndata: {}\r\n\r\n`,
    );
    expect(events.map((e) => e.type)).toEqual(["token", "done"]);
    expect(events[0]).toEqual({ type: "token", text: "hi" });
  });

  it("decodes refusal meta correctly", () => {
    const parser = new SseEventParser();
    const refusalMeta = JSON.stringify({
      model: "claude-sonnet-4-6",
      prompt_version: "0.1.0",
      schema_version: "0.3.0",
      refused: true,
      refusal_reason: "no-retrieval",
      retrieved_descriptor_ids: [],
    });
    const events = parser.push(`event: meta\ndata: ${refusalMeta}\n\n`);
    expect(events[0]).toMatchObject({
      type: "meta",
      refused: true,
      refusal_reason: "no-retrieval",
      retrieved_descriptor_ids: [],
    });
  });

  it("flush surfaces a trailing event missing the final blank line", () => {
    const parser = new SseEventParser();
    parser.push(`event: token\ndata: tail`);
    expect(parser.flush()).toEqual([{ type: "token", text: "tail" }]);
  });

  it("ignores unknown event names without breaking subsequent events", () => {
    const parser = new SseEventParser();
    const events = parser.push(
      `event: noise\ndata: {}\n\nevent: token\ndata: ok\n\n`,
    );
    expect(events.map((e) => e.type)).toEqual(["token"]);
  });

  it("returns empty citations array on a malformed citations payload", () => {
    const parser = new SseEventParser();
    const events = parser.push(`event: citations\ndata: not-json\n\n`);
    expect(events).toEqual([{ type: "citations", descriptors: [] }]);
  });
});
