/**
 * Filter chips for the entity index.
 *
 * State lives in the URL (`?entity_type=...&tier=...`) so filtered views
 * are linkable and the back button restores prior state. Active chips
 * link to the same URL with that param removed; inactive chips link to
 * the URL with the param set.
 */

import Link from "next/link";

import type { EntityType, Tier } from "@/lib/data/types";
import { ENTITY_TYPES, TIERS } from "@/lib/data/types";

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  person: "Person",
  place: "Place",
  thing: "Thing",
  event: "Event",
  attribute: "Attribute",
};

const TIER_LABEL: Record<Tier, string> = {
  clear: "Clear",
  fuzzy: "Fuzzy",
  debated: "Debated",
  symbolic: "Symbolic",
};

function buildHref(
  base: Record<string, string | undefined>,
  key: string,
  value: string | undefined,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (k === key) continue;
    if (v) params.set(k, v);
  }
  if (value) params.set(key, value);
  const qs = params.toString();
  return qs ? `/entities?${qs}` : "/entities";
}

export function EntityTypeFilter({
  active,
  baseParams,
}: {
  active: EntityType | null;
  baseParams: Record<string, string | undefined>;
}) {
  return (
    <FilterRow label="Type">
      <Chip
        href={buildHref(baseParams, "entity_type", undefined)}
        isActive={active === null}
      >
        All
      </Chip>
      {ENTITY_TYPES.map((t) => (
        <Chip
          key={t}
          href={buildHref(
            baseParams,
            "entity_type",
            active === t ? undefined : t,
          )}
          isActive={active === t}
        >
          {ENTITY_TYPE_LABEL[t]}
        </Chip>
      ))}
    </FilterRow>
  );
}

export function TierFilter({
  active,
  baseParams,
}: {
  active: Tier | null;
  baseParams: Record<string, string | undefined>;
}) {
  return (
    <FilterRow label="Tier">
      <Chip
        href={buildHref(baseParams, "tier", undefined)}
        isActive={active === null}
      >
        All
      </Chip>
      {TIERS.map((t) => (
        <Chip
          key={t}
          href={buildHref(baseParams, "tier", active === t ? undefined : t)}
          isActive={active === t}
          tier={t}
        >
          {TIER_LABEL[t]}
        </Chip>
      ))}
    </FilterRow>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({
  href,
  isActive,
  tier,
  children,
}: {
  href: string;
  isActive: boolean;
  tier?: Tier;
  children: React.ReactNode;
}) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition";
  const activeCls =
    "border-(--color-accent) bg-(--color-accent) text-white";
  const inactiveCls =
    "border-(--color-border) bg-(--color-card) text-(--color-fg-muted) hover:border-(--color-accent) hover:text-(--color-accent)";
  return (
    <Link
      href={href}
      data-tier-filter={tier ?? undefined}
      data-active={isActive ? "true" : "false"}
      className={`${base} ${isActive ? activeCls : inactiveCls}`}
    >
      {children}
    </Link>
  );
}
