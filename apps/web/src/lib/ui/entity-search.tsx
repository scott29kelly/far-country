"use client";

/**
 * Client-side text search over the filtered entity set.
 *
 * Server applies the entity_type + tier filters via query params; this
 * client component takes the resulting `SearchableEntity[]` and lets the
 * user further narrow by free text over entity name + summary +
 * descriptor statements (spec §3.2, §3.4 lexical index).
 *
 * MiniSearch index is built per-mount from the prop. For Phase 2 dataset
 * sizes this is fine; a serialized index file is a Phase 2.5 optimization.
 */

import Link from "next/link";
import MiniSearch from "minisearch";
import { useMemo, useState } from "react";

import type { EntityType } from "@/lib/data/types";
import type { SearchableEntity } from "@/lib/data/search-index";

const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  person: "Person",
  place: "Place",
  thing: "Thing",
  event: "Event",
  attribute: "Attribute",
};

export function EntitySearchList({
  entities,
}: {
  entities: SearchableEntity[];
}) {
  const [query, setQuery] = useState("");

  const index = useMemo(() => {
    const ms = new MiniSearch<SearchableEntity>({
      fields: ["name", "summary", "statementsText"],
      storeFields: ["id"],
      idField: "id",
      searchOptions: {
        boost: { name: 3, summary: 1.5 },
        prefix: true,
        fuzzy: 0.2,
      },
    });
    ms.addAll(entities);
    return ms;
  }, [entities]);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return entities;
    const hits = index.search(trimmed);
    const order = new Map(hits.map((h, i) => [h.id as string, i]));
    return entities
      .filter((e) => order.has(e.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }, [trimmed, entities, index]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">Search entities</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names, summaries, descriptors…"
          className="w-full rounded-md border border-(--color-border) bg-(--color-card) px-3 py-2 text-sm text-(--color-fg) placeholder:text-(--color-fg-muted) focus:border-(--color-accent) focus:outline-none"
          data-entity-search-input
        />
      </label>

      <p
        data-entity-search-status
        className="text-xs text-(--color-fg-muted)"
      >
        {trimmed
          ? `${filtered.length} match${filtered.length === 1 ? "" : "es"} for "${trimmed}"`
          : `${entities.length} entit${entities.length === 1 ? "y" : "ies"}`}
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-(--color-fg-muted)">
          No entities match those filters. Clear the search or pick a different
          filter.
        </p>
      ) : (
        <ul className="divide-y divide-(--color-border) overflow-hidden rounded-lg border border-(--color-border) bg-(--color-card)">
          {filtered.map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/entities/${entity.id}`}
                className="block p-5 transition hover:bg-(--color-bg)"
                data-entity-id={entity.id}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="text-lg font-semibold text-(--color-fg)">
                    {entity.name}
                  </h2>
                  <span className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
                    {ENTITY_TYPE_LABEL[entity.entity_type]}
                  </span>
                </div>
                {entity.summary ? (
                  <p className="mt-2 text-sm leading-relaxed text-(--color-fg-muted)">
                    {entity.summary}
                  </p>
                ) : null}
                {entity.tiers.length > 0 ? (
                  <p className="mt-2 text-xs text-(--color-fg-muted)">
                    Tiers: {entity.tiers.join(", ")}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
