"use client";

/**
 * /ask chat surface.
 *
 * Consumes the SSE contract from app/api/ask/route.ts:
 *   - event: meta       — { model, prompt_version, schema_version, refused, refusal_reason, retrieved_descriptor_ids }
 *   - event: token      — text chunk (repeated)
 *   - event: citations  — array of cited descriptors
 *   - event: done
 *
 * Rendering pass:
 *   1. While `token` events arrive, append to the in-progress answer text.
 *      Inline `[descriptor:ID]` markers are parsed *after* meta has arrived;
 *      until citations land, marker pills render as numbered placeholders.
 *   2. On `citations`, render the cited-descriptor cards below the answer
 *      with the same TierBadge / TemporalPhaseBadge / ScriptureCitationPopover
 *      primitives the entity-detail page uses.
 *   3. On `done`, mark the turn finished and re-enable the input.
 *
 * Refusals flow through the same path: `refused=true` on meta, the refusal
 * prose streams as normal tokens, and the citations array is empty. The UI
 * surfaces the refusal_reason as a small label so it's distinguishable from
 * a normal answer.
 *
 * Single-turn for PR 2B.3 (no history beyond the most recent question).
 * Multi-turn conversation is a later refinement — the endpoint is single-
 * turn anyway.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { TemporalPhaseBadge, TierBadge } from "@/lib/ui/badges";
import { CitationLine } from "@/lib/ui/citation";
import type { TemporalPhase } from "@/lib/data/types";

import {
  AnswerWithMarkers,
  descriptorAnchorId,
  markerOrdinals,
} from "./marker";
import {
  SseEventParser,
  type AskCitationEvent,
  type AskMetaEvent,
} from "./sse";

type TurnState =
  | { kind: "idle" }
  | { kind: "streaming"; question: string; text: string; meta: AskMetaEvent | null }
  | {
      kind: "done";
      question: string;
      text: string;
      meta: AskMetaEvent;
      citations: AskCitationEvent[];
    }
  | { kind: "error"; question: string; message: string };

export function AskChat() {
  const [draft, setDraft] = useState("");
  const [turn, setTurn] = useState<TurnState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const question = draft.trim();
      if (!question) return;
      if (turn.kind === "streaming") return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setTurn({ kind: "streaming", question, text: "", meta: null });
      setDraft("");

      let res: Response;
      try {
        res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setTurn({
          kind: "error",
          question,
          message: err instanceof Error ? err.message : "Network error.",
        });
        return;
      }

      if (!res.ok || !res.body) {
        let message = `Request failed (${res.status}).`;
        try {
          const json = (await res.json()) as { error?: string };
          if (json.error) message = json.error;
        } catch {
          /* keep default */
        }
        setTurn({ kind: "error", question, message });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseEventParser();

      let meta: AskMetaEvent | null = null;
      let text = "";
      let citations: AskCitationEvent[] = [];
      let finished = false;

      try {
        while (!finished) {
          const { value, done } = await reader.read();
          const events = done
            ? parser.flush()
            : parser.push(decoder.decode(value, { stream: true }));
          for (const ev of events) {
            if (ev.type === "meta") {
              meta = ev;
              setTurn({ kind: "streaming", question, text, meta });
            } else if (ev.type === "token") {
              text += ev.text;
              setTurn({ kind: "streaming", question, text, meta });
            } else if (ev.type === "citations") {
              citations = ev.descriptors;
            } else if (ev.type === "done") {
              finished = true;
            }
          }
          if (done) break;
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setTurn({
          kind: "error",
          question,
          message: err instanceof Error ? err.message : "Stream error.",
        });
        return;
      }

      if (!meta) {
        setTurn({
          kind: "error",
          question,
          message: "Server stream ended without metadata.",
        });
        return;
      }

      setTurn({ kind: "done", question, text, meta, citations });
    },
    [draft, turn.kind],
  );

  const isStreaming = turn.kind === "streaming";

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3" data-ask-form>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-(--color-fg)">
            Ask about heaven
          </span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget.form as HTMLFormElement)?.requestSubmit();
              }
            }}
            placeholder="e.g. What does the dataset say about the gates of the New Jerusalem?"
            rows={3}
            maxLength={2000}
            disabled={isStreaming}
            data-ask-input
            className="w-full resize-y rounded-md border border-(--color-border) bg-(--color-card) px-3 py-2 text-sm text-(--color-fg) placeholder:text-(--color-fg-muted) focus:border-(--color-accent) focus:outline-none disabled:opacity-60"
          />
        </label>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-(--color-fg-muted)">
            Answers cite descriptors in the dataset. If nothing in the catalog
            grounds your question, the system refuses rather than guesses.
          </p>
          <button
            type="submit"
            disabled={isStreaming || draft.trim().length === 0}
            data-ask-submit
            className="rounded-md border border-(--color-accent) bg-(--color-accent) px-4 py-2 text-sm font-medium text-white hover:bg-(--color-fg) disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStreaming ? "Asking…" : "Ask"}
          </button>
        </div>
      </form>

      <AnswerPanel turn={turn} />
    </div>
  );
}

function AnswerPanel({ turn }: { turn: TurnState }) {
  if (turn.kind === "idle") {
    return null;
  }

  if (turn.kind === "error") {
    return (
      <section
        data-ask-error
        className="rounded-lg border border-(--color-tier-debated) bg-(--color-card) p-5"
      >
        <p className="text-xs uppercase tracking-wider text-(--color-tier-debated)">
          Error
        </p>
        <p className="mt-2 text-sm text-(--color-fg)">{turn.message}</p>
        <p className="mt-2 text-sm text-(--color-fg-muted)">
          You asked: {turn.question}
        </p>
      </section>
    );
  }

  const text = turn.text;
  const meta = turn.meta;
  const citations = turn.kind === "done" ? turn.citations : [];
  const citedIds = new Set(citations.map((c) => c.id));
  const ordinals = markerOrdinals(text, citedIds);

  return (
    <section className="space-y-6" data-ask-answer-panel>
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
          Your question
        </p>
        <p className="text-sm text-(--color-fg)">{turn.question}</p>
      </header>

      <div className="space-y-3">
        {meta?.refused ? (
          <p
            data-ask-refusal
            className="inline-flex items-center rounded-full border border-(--color-tier-debated) px-3 py-1 text-xs uppercase tracking-wider text-(--color-tier-debated)"
          >
            Refused
            {meta.refusal_reason
              ? ` — ${formatRefusalReason(meta.refusal_reason)}`
              : null}
          </p>
        ) : null}

        {text.length === 0 && turn.kind === "streaming" ? (
          <p
            data-ask-streaming-placeholder
            className="text-sm italic text-(--color-fg-muted)"
          >
            Retrieving and grounding…
          </p>
        ) : (
          <AnswerWithMarkers
            text={text}
            knownIds={citedIds}
            ordinals={ordinals}
          />
        )}
      </div>

      {citations.length > 0 ? (
        <div className="space-y-3" data-ask-citations>
          <h2 className="text-sm font-medium uppercase tracking-wider text-(--color-fg-muted)">
            Cited descriptors ({citations.length})
          </h2>
          <ul className="space-y-3">
            {citations.map((d) => (
              <CitedDescriptorCard
                key={d.id}
                descriptor={d}
                ordinal={ordinals.get(d.id)}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {meta && turn.kind === "done" ? <MetaFooter meta={meta} /> : null}
    </section>
  );
}

function formatRefusalReason(
  reason: "no-retrieval" | "enforcement-failed",
): string {
  switch (reason) {
    case "no-retrieval":
      return "no grounded descriptors found";
    case "enforcement-failed":
      return "drafted answer did not cite the retrieved set";
  }
}

function CitedDescriptorCard({
  descriptor,
  ordinal,
}: {
  descriptor: AskCitationEvent;
  ordinal: number | undefined;
}) {
  const phase: TemporalPhase = descriptor.temporal_phase ?? "unspecified";
  return (
    <li
      id={descriptorAnchorId(descriptor.id)}
      data-descriptor-id={descriptor.id}
      className="rounded-lg border border-(--color-border) bg-(--color-card) p-5 transition-colors data-[flash=1]:border-(--color-accent) data-[flash=1]:bg-(--color-bg)"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {ordinal != null ? (
          <span
            data-cited-ordinal
            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-(--color-accent) px-1.5 text-[10px] font-semibold text-(--color-accent)"
          >
            {ordinal}
          </span>
        ) : null}
        <TierBadge tier={descriptor.tier} />
        <TemporalPhaseBadge phase={phase} />
      </div>
      <p className="text-base leading-relaxed text-(--color-fg)">
        {descriptor.statement}
      </p>

      {descriptor.tier === "symbolic" && descriptor.symbolic_referent ? (
        <p
          data-symbolic-referent
          className="mt-3 border-l-2 border-(--color-tier-symbolic) pl-3 text-sm italic leading-relaxed text-(--color-fg-muted)"
        >
          <span className="not-italic font-medium text-(--color-tier-symbolic)">
            Refers to:
          </span>{" "}
          {descriptor.symbolic_referent}
        </p>
      ) : null}

      {descriptor.citations.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {descriptor.citations.map((c) => (
            <li key={c.id}>
              <CitationLine citation={c} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MetaFooter({ meta }: { meta: AskMetaEvent }) {
  return (
    <p
      data-ask-meta
      className="text-[11px] font-mono text-(--color-fg-muted)"
    >
      model {meta.model} · prompt {meta.prompt_version} · schema{" "}
      {meta.schema_version}
    </p>
  );
}
