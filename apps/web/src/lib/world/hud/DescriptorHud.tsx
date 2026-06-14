"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { EntityExport } from "@/lib/data/types";

import { useWorldStore } from "../state/worldStore";

/**
 * HUD overlay: shows the descriptor(s) for the entity nearest the camera.
 *
 * Wired to `useWorldStore.nearbyEntitySlug`. When the slug changes, this
 * component fetches `/data/entities/[slug].json` and renders up to three
 * descriptor cards with tier badges and Scripture/Willis citations.
 *
 * Clicking a card opens /entities/[slug] in a new tab so the camera state
 * is preserved.
 */
const MAX_CARDS = 3;

export function DescriptorHud() {
  const nearby = useWorldStore((s) => s.nearbyEntitySlug);
  const pinned = useWorldStore((s) => s.pinnedEntitySlug);
  const setPinned = useWorldStore((s) => s.setPinnedEntity);
  // A clicked (pinned) element takes precedence over the proximity readout.
  const slug = pinned ?? nearby;
  const pointerLocked = useWorldStore((s) => s.pointerLocked);
  const [entity, setEntity] = useState<EntityExport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setEntity(null);
      return;
    }
    setLoading(true);
    fetch(`/data/entities/${slug}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: EntityExport | null) => {
        if (cancelled) return;
        setEntity(data);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEntity(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-10 flex justify-center px-4 pb-4 sm:left-auto sm:right-4 sm:max-w-md sm:justify-end"
    >
      <div className="pointer-events-auto w-full space-y-2">
        {!pointerLocked && (
          <ClickToBeginHint />
        )}
        {entity && (
          <div className="rounded-lg border border-(--color-border) bg-(--color-card)/95 p-3 shadow-lg backdrop-blur-sm">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="flex items-baseline gap-1.5 text-sm font-semibold text-(--color-fg)">
                {entity.name}
                {pinned && (
                  <span className="rounded bg-(--color-accent)/15 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wider text-(--color-accent)">
                    pinned
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <Link
                  href={`/entities/${entity.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-(--color-accent) hover:underline"
                >
                  open ↗
                </Link>
                {pinned && (
                  <button
                    type="button"
                    onClick={() => setPinned(null)}
                    aria-label="Unpin"
                    className="text-xs leading-none text-(--color-fg-muted) hover:text-(--color-fg)"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <ul className="space-y-2">
              {entity.descriptors.slice(0, MAX_CARDS).map((d) => (
                <DescriptorCard key={d.id} descriptor={d} />
              ))}
            </ul>
            {entity.descriptors.length > MAX_CARDS && (
              <p className="mt-2 text-xs text-(--color-fg-muted)">
                +{entity.descriptors.length - MAX_CARDS} more in the entity
                page
              </p>
            )}
          </div>
        )}
        {!entity && loading && (
          <div className="rounded-lg border border-(--color-border) bg-(--color-card)/95 px-3 py-2 text-xs text-(--color-fg-muted) shadow">
            loading…
          </div>
        )}
      </div>
    </div>
  );
}

function ClickToBeginHint() {
  return (
    <div className="rounded-lg border border-(--color-border) bg-(--color-card)/95 px-3 py-2 text-xs text-(--color-fg-muted) shadow">
      Click the scene to begin. WASD to move, mouse to look, Shift to sprint.
      The city is a step mountain — press <strong>Space</strong> to fly up and
      ascend the terraces toward the summit throne, <strong>C</strong> to
      descend. <strong>Aim and click any element</strong> — a gate, a gem, the
      throne — to pin its descriptor. Use the mini-map (top-left) to{" "}
      <strong>fly</strong> to a gate, the summit, or a tree.
    </div>
  );
}

const TIER_CLASS: Record<string, string> = {
  clear: "bg-(--color-tier-clear) text-white",
  fuzzy: "bg-(--color-tier-fuzzy) text-white",
  debated: "bg-(--color-tier-debated) text-white",
  symbolic: "bg-(--color-tier-symbolic) text-white",
};

function DescriptorCard({
  descriptor,
}: {
  descriptor: EntityExport["descriptors"][number];
}) {
  return (
    <li className="space-y-1 rounded-md border border-(--color-border) bg-(--color-bg) p-2">
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
            TIER_CLASS[descriptor.tier] ?? "bg-gray-500 text-white"
          }`}
        >
          {descriptor.tier}
        </span>
        {descriptor.citations.map((c) => (
          <span
            key={c.id}
            className="inline-block rounded border border-(--color-border) px-1.5 py-0.5 text-[10px] font-mono text-(--color-fg-muted)"
          >
            {formatCitation(c)}
          </span>
        ))}
      </div>
      <p className="text-xs leading-snug text-(--color-fg)">
        {descriptor.statement}
      </p>
      {descriptor.tier === "symbolic" && descriptor.symbolic_referent && (
        <p className="text-[11px] italic text-(--color-fg-muted)">
          referent: {descriptor.symbolic_referent}
        </p>
      )}
    </li>
  );
}

function formatCitation(
  c: EntityExport["descriptors"][number]["citations"][number],
): string {
  if (c.source_type === "scripture" && c.book && c.chapter) {
    const verses =
      c.verse_start && c.verse_end && c.verse_end !== c.verse_start
        ? `${c.verse_start}-${c.verse_end}`
        : c.verse_start
          ? `${c.verse_start}`
          : "";
    return verses
      ? `${c.book} ${c.chapter}:${verses}`
      : `${c.book} ${c.chapter}`;
  }
  if (c.source_type === "willis" && c.willis_chapter) {
    const pages =
      c.willis_page_start && c.willis_page_end
        ? `${c.willis_page_start}-${c.willis_page_end}`
        : c.willis_page_start
          ? `${c.willis_page_start}`
          : "";
    return pages
      ? `Willis ${c.willis_chapter} p.${pages}`
      : `Willis ${c.willis_chapter}`;
  }
  if (c.source_type === "secondary" && c.secondary_work) {
    return c.secondary_work;
  }
  return c.source_type;
}
