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
 * tier filter can ask "does any descriptor OR measurement of entity X carry
 * tier T". Measurements are included deliberately: they carry the same
 * tiers under the same review discipline (ADR 0017), and the whole point of
 * the tier vocabulary is that fuzzy/debated material stays visible. The
 * Ezek 45:1 10,000-vs-20,000 crux is a `debated` MEASUREMENT — if the tier
 * filter only saw descriptors, the chip built to surface contested readings
 * would hide the most contested reading in the dataset.
 */

import { loadCanonical, loadMeasurements } from "./load";
import type { Descriptor, EntityType, MeasurementRecord, Tier } from "./types";

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
  const [canonical, measurements] = await Promise.all([
    loadCanonical(),
    loadMeasurements(),
  ]);

  const byEntity = new Map<string, Descriptor[]>();
  for (const d of canonical.descriptors) {
    const arr = byEntity.get(d.entity_id) ?? [];
    arr.push(d);
    byEntity.set(d.entity_id, arr);
  }

  const measurementsByEntity = new Map<string, MeasurementRecord[]>();
  for (const m of measurements) {
    const arr = measurementsByEntity.get(m.entity_id) ?? [];
    arr.push(m);
    measurementsByEntity.set(m.entity_id, arr);
  }

  cached = canonical.entities
    .map((e) => {
      const descriptors = byEntity.get(e.id) ?? [];
      const entityMeasurements = measurementsByEntity.get(e.id) ?? [];
      const tiers = Array.from(
        new Set([
          ...descriptors.map((d) => d.tier),
          ...entityMeasurements.map((m) => m.tier),
        ]),
      ).sort();
      // Measurement subjects join the search corpus so a dimensional fact is
      // findable by what it measures ("breadth", "the priests' allotment").
      const statementsText = [
        ...descriptors.map((d) => d.statement),
        ...entityMeasurements.map((m) => m.subject),
      ].join(" • ");
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
