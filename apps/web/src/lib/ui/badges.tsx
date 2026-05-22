/**
 * Shared badge components for descriptor metadata.
 *
 * Tier and temporal_phase are surfaced on every descriptor in the UI —
 * hermeneutic non-negotiable (CLAUDE.md, spec §3.2, §7). Render through
 * these badges so the visual language stays consistent across pages.
 */

import type { TemporalPhase, Tier } from "@/lib/data/types";

const TIER_LABEL: Record<Tier, string> = {
  clear: "Clear",
  fuzzy: "Fuzzy",
  debated: "Debated",
  symbolic: "Symbolic",
};

const TIER_CLASSES: Record<Tier, string> = {
  clear: "border-(--color-tier-clear) text-(--color-tier-clear)",
  fuzzy: "border-(--color-tier-fuzzy) text-(--color-tier-fuzzy)",
  debated: "border-(--color-tier-debated) text-(--color-tier-debated)",
  symbolic: "border-(--color-tier-symbolic) text-(--color-tier-symbolic)",
};

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      data-tier={tier}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${TIER_CLASSES[tier]}`}
    >
      {TIER_LABEL[tier]}
    </span>
  );
}

const PHASE_LABEL: Record<TemporalPhase, string> = {
  intermediate: "Intermediate",
  final: "Final",
  either: "Either",
  unspecified: "Unspecified",
};

export function TemporalPhaseBadge({ phase }: { phase: TemporalPhase }) {
  return (
    <span
      data-temporal-phase={phase}
      className="inline-flex items-center rounded-full border border-(--color-border) bg-(--color-bg) px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-(--color-fg-muted)"
    >
      {PHASE_LABEL[phase]}
    </span>
  );
}
