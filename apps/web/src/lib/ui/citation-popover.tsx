"use client";

/**
 * Scripture citation popover.
 *
 * The reference (e.g. "Revelation 21:21") is always rendered. Clicking it
 * fetches verse text from /api/esv (server-side proxy — see app/api/esv/
 * route.ts and ADR 0006). The ESV API key never reaches the browser.
 *
 * The popover only fires the fetch on first open per mount; subsequent
 * opens reuse the result. Server-side cache handles repeats across users.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Citation } from "@/lib/data/types";
import { formatCitation } from "./citation";

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; reference: string; text: string }
  | { status: "error"; message: string };

export function ScriptureCitationPopover({
  citation,
}: {
  citation: Citation;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const panelRef = useRef<HTMLDivElement>(null);

  const reference = formatCitation(citation);

  const fetchPassage = useCallback(async () => {
    if (state.status === "loading" || state.status === "ready") return;
    setState({ status: "loading" });
    try {
      const params = new URLSearchParams();
      if (citation.book) params.set("book", citation.book);
      if (citation.chapter != null)
        params.set("chapter", String(citation.chapter));
      if (citation.verse_start != null)
        params.set("verse_start", String(citation.verse_start));
      if (citation.verse_end != null)
        params.set("verse_end", String(citation.verse_end));

      const res = await fetch(`/api/esv?${params.toString()}`);
      const json = (await res.json()) as {
        reference?: string;
        text?: string;
        error?: string;
      };
      if (!res.ok || !json.text) {
        setState({
          status: "error",
          message: json.error ?? `Request failed (${res.status}).`,
        });
        return;
      }
      setState({
        status: "ready",
        reference: json.reference ?? reference,
        text: json.text,
      });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Network error.",
      });
    }
  }, [citation, reference, state.status]);

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      if (next) void fetchPassage();
      return next;
    });
  }, [fetchPassage]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        data-citation-trigger
        className="font-mono text-xs text-(--color-accent) underline-offset-2 hover:underline focus:outline-none focus:underline"
      >
        {reference}
      </button>

      {open ? (
        <div
          ref={panelRef}
          role="region"
          aria-label={`ESV text for ${reference}`}
          data-citation-panel
          className="absolute left-0 top-full z-10 mt-2 w-80 max-w-[90vw] rounded-md border border-(--color-border) bg-(--color-card) p-3 shadow-lg"
        >
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-(--color-fg)">
              {state.status === "ready" ? state.reference : reference}{" "}
              <span className="font-normal text-(--color-fg-muted)">(ESV)</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-xs text-(--color-fg-muted) hover:text-(--color-fg)"
            >
              ×
            </button>
          </div>
          <PanelBody state={state} />
          <p className="mt-2 text-[10px] text-(--color-fg-muted)">
            Scripture quotations from The ESV® Bible (The Holy Bible, English
            Standard Version®). Used by permission. All rights reserved.
          </p>
        </div>
      ) : null}
    </span>
  );
}

function PanelBody({ state }: { state: FetchState }) {
  switch (state.status) {
    case "idle":
    case "loading":
      return (
        <p className="text-sm text-(--color-fg-muted)">Loading…</p>
      );
    case "error":
      return (
        <p className="text-sm text-(--color-tier-debated)">
          {state.message}
        </p>
      );
    case "ready":
      return (
        <p
          data-citation-text
          className="whitespace-pre-line text-sm leading-relaxed text-(--color-fg)"
        >
          {state.text}
        </p>
      );
  }
}
