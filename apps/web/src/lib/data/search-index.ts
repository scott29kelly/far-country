/**
 * Build the searchable view of the canonical export.
 *
 * Per spec §3.4 the lexical index covers entity name, entity summary, and
 * descriptor statements. For Phase 2 we build a small denormalized
 * `SearchableEntity[]` server-side and ship it as a prop to the client
 * search component, which constructs its own MiniSearch instance. A
 * serialized index file (per spec §3.4) is a future optimization once the
 * dataset is large enough to make build-time serialization worth it.
 *
 * This module also computes the per-entity tier set so the `/entities`
 * tier filter can ask "does any descriptor of entity X carry tier T".
 */

import { loadCanonical } from "./load";
import type { Descriptor, EntityType, Tier } from "./types";

export type SearchableEntity = {
  id: string;
  name: string;
  entity_type: EntityType;
  summary: string | null;
  tiers: Tier[];
  /** Concatenated descriptor statements for this entity — search corpus. */
  statementsText: string;
};

let cached: SearchableEntity[] | null = null;

export async function loadSearchableEntities(): Promise<SearchableEntity[]> {
  if (cached) return cached;
  const canonical = await loadCanonical();

  const byEntity = new Map<string, Descriptor[]>();
  for (const d of canonical.descriptors) {
    const arr = byEntity.get(d.entity_id) ?? [];
    arr.push(d);
    byEntity.set(d.entity_id, arr);
  }

  cached = canonical.entities
    .map((e) => {
      const descriptors = byEntity.get(e.id) ?? [];
      const tiers = Array.from(new Set(descriptors.map((d) => d.tier))).sort();
      const statementsText = descriptors.map((d) => d.statement).join(" • ");
      return {
        id: e.id,
        name: e.name,
        entity_type: e.entity_type,
        summary: e.summary ?? null,
        tiers,
        statementsText,
      } satisfies SearchableEntity;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return cached;
}

export function _resetSearchableCacheForTests(): void {
  cached = null;
}
