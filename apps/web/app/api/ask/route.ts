/**
 * /api/ask — grounded Q&A endpoint.
 *
 * Pipeline (see `lib/qa/grounded.ts` for the contract):
 *   1. Parse the user question from the POST body.
 *   2. Run the grounded orchestrator: retrieval → refusal-if-empty →
 *      Claude → citation enforcement (single retry).
 *   3. Stream the result back as Server-Sent Events:
 *        event: meta   data: { model, prompt_version, schema_version,
 *                              refused, refusal_reason }
 *        event: token  data: <text chunk>           (repeated)
 *        event: citations data: [{ id, tier, ... }]
 *        event: done   data: {}
 *
 *      Note: because citation enforcement requires the *full* model
 *      output to validate the answer, the route only starts streaming
 *      after the orchestrator returns. The `token` events partition the
 *      finalized text for incremental UI rendering, not for time-to-
 *      first-token latency. True token-pass-through streaming is a
 *      Phase 2B.3+ refinement.
 *
 * Body shape:
 *   { question: string }
 *
 * Response codes:
 *   200 — SSE stream (text/event-stream)
 *   400 — invalid/missing question
 *   500 — orchestrator threw (e.g., misconfigured key)
 */

import { NextRequest, NextResponse } from "next/server";

import { loadCanonical } from "@/lib/data/load";
import { createOpenAIProvider, retrieve } from "@/lib/retrieval";
import {
  answer,
  createAnthropicProvider,
  type GroundedAnswer,
  type RetrieveFn,
} from "@/lib/qa";

const TOKEN_CHUNK_SIZE = 40;

type AskBody = { question?: unknown };

function isStringQuestion(q: unknown): q is string {
  return typeof q === "string" && q.trim().length > 0 && q.length <= 2000;
}

function sseEvent(event: string, data: unknown): string {
  const payload = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

export async function POST(req: NextRequest): Promise<Response> {
  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON of shape { question: string }." },
      { status: 400 },
    );
  }
  if (!isStringQuestion(body.question)) {
    return NextResponse.json(
      { error: "Missing or invalid 'question' (1-2000 chars)." },
      { status: 400 },
    );
  }
  const question = body.question.trim();

  const canonical = await loadCanonical();
  const embedProvider = createOpenAIProvider();
  const llmProvider = createAnthropicProvider({});

  const retrieveFn: RetrieveFn = (q, opts) =>
    retrieve(q, embedProvider, {
      k: opts.k,
      minScore: opts.minScore,
      tierFilter: opts.tierFilter,
    });

  let result: GroundedAnswer;
  try {
    result = await answer(
      question,
      { retrieve: retrieveFn, llm: llmProvider },
      { schemaVersion: canonical.schema_version },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          sseEvent("meta", {
            model: result.model,
            prompt_version: result.prompt_version,
            schema_version: result.schema_version,
            refused: result.refused,
            refusal_reason: result.refusal_reason,
            retrieved_descriptor_ids: result.retrieved.map((d) => d.id),
          }),
        ),
      );
      for (const chunk of chunkText(result.text, TOKEN_CHUNK_SIZE)) {
        controller.enqueue(encoder.encode(sseEvent("token", chunk)));
      }
      controller.enqueue(
        encoder.encode(
          sseEvent(
            "citations",
            result.cited.map((d) => ({
              id: d.id,
              tier: d.tier,
              temporal_phase: d.temporal_phase,
              statement: d.statement,
              symbolic_referent: d.symbolic_referent ?? null,
              citations: d.citations,
            })),
          ),
        ),
      );
      controller.enqueue(encoder.encode(sseEvent("done", {})));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
