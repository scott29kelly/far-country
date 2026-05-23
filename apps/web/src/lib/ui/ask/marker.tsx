/**
 * Inline citation marker rendering.
 *
 * The LLM emits `[descriptor:DESCRIPTOR_ID]` markers inline with the prose
 * (see lib/qa/system-prompt.md). This module:
 *
 *   1. Splits answer text into segments — plain text vs. marker.
 *   2. Renders each marker as a small clickable pill that scrolls to and
 *      briefly highlights the matching descriptor card below the answer.
 *   3. Ignores markers whose IDs aren't in the cited set (the orchestrator
 *      already filters phantoms, but this is defense-in-depth so a leaked
 *      hallucinated ID never renders as a real-looking pill).
 *
 * `parseMarkers` is exported separately so it can be unit-tested without
 * mounting React.
 */

"use client";

import { Fragment, useCallback } from "react";

const MARKER_RE = /\[descriptor:([A-Za-z0-9_\-]+)\]/g;

export type MarkerSegment =
  | { kind: "text"; text: string }
  | { kind: "marker"; descriptorId: string };

/** Split text into plain-text and marker segments. Pure, no DOM. */
export function parseMarkers(text: string): MarkerSegment[] {
  const segments: MarkerSegment[] = [];
  let lastIndex = 0;
  // matchAll requires resetting global state per call; using exec loop instead
  // would mutate a shared regex. Re-create the iterator locally:
  const re = new RegExp(MARKER_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index;
    if (start > lastIndex) {
      segments.push({ kind: "text", text: text.slice(lastIndex, start) });
    }
    segments.push({ kind: "marker", descriptorId: match[1] });
    lastIndex = start + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ kind: "text", text: text.slice(lastIndex) });
  }
  return segments;
}

/** Number markers in the order they first appear in the prose. */
export function markerOrdinals(
  text: string,
  knownIds: ReadonlySet<string>,
): Map<string, number> {
  const order = new Map<string, number>();
  for (const seg of parseMarkers(text)) {
    if (seg.kind !== "marker") continue;
    if (!knownIds.has(seg.descriptorId)) continue;
    if (!order.has(seg.descriptorId)) {
      order.set(seg.descriptorId, order.size + 1);
    }
  }
  return order;
}

export function descriptorAnchorId(descriptorId: string): string {
  return `cited-${descriptorId}`;
}

export function AnswerWithMarkers({
  text,
  knownIds,
  ordinals,
}: {
  text: string;
  knownIds: ReadonlySet<string>;
  ordinals: ReadonlyMap<string, number>;
}) {
  const segments = parseMarkers(text);

  const onMarkerClick = useCallback((descriptorId: string) => {
    const el = document.getElementById(descriptorAnchorId(descriptorId));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.dataset.flash = "1";
    window.setTimeout(() => {
      delete el.dataset.flash;
    }, 1200);
  }, []);

  return (
    <p
      data-ask-answer
      className="whitespace-pre-wrap text-base leading-relaxed text-(--color-fg)"
    >
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <Fragment key={i}>{seg.text}</Fragment>;
        }
        if (!knownIds.has(seg.descriptorId)) {
          // Unknown marker: render nothing (don't surface phantom IDs).
          return null;
        }
        const n = ordinals.get(seg.descriptorId);
        return (
          <button
            key={i}
            type="button"
            data-marker-id={seg.descriptorId}
            onClick={() => onMarkerClick(seg.descriptorId)}
            className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-(--color-accent) px-1.5 text-[10px] font-semibold text-(--color-accent) align-baseline hover:bg-(--color-accent) hover:text-white focus:outline-none focus:bg-(--color-accent) focus:text-white"
            aria-label={`Citation ${n ?? "?"} — ${seg.descriptorId}`}
          >
            {n ?? "?"}
          </button>
        );
      })}
    </p>
  );
}
