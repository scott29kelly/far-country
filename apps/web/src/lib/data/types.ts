/**
 * TypeScript types for the Far Country canonical export.
 *
 * Source of truth: `pipeline/src/far_country/export/schema.py` (Python
 * JSON Schemas) and `docs/data-model.md` §4 (the human-readable contract).
 * These types are HAND-MAINTAINED to mirror that schema.
 *
 * If you change the Python schema, change these types in the same PR.
 * Codegen-from-schema is tracked as deferred tech debt — see PR 2A.1
 * description for the rationale.
 */

export const ENTITY_TYPES = [
  "person",
  "place",
  "thing",
  "event",
  "attribute",
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const TIERS = ["clear", "fuzzy", "debated", "symbolic"] as const;
export type Tier = (typeof TIERS)[number];

export const TEMPORAL_PHASES = [
  "intermediate",
  "final",
  "either",
  "unspecified",
] as const;
export type TemporalPhase = (typeof TEMPORAL_PHASES)[number];

export const SOURCE_TYPES = ["scripture", "willis", "secondary"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export type Citation = {
  id: string;
  descriptor_id?: string;
  source_type: SourceType;
  // Scripture
  book?: string | null;
  chapter?: number | null;
  verse_start?: number | null;
  verse_end?: number | null;
  // Willis
  willis_chapter?: string | null;
  willis_page_start?: number | null;
  willis_page_end?: number | null;
  // Secondary
  secondary_work?: string | null;
  secondary_locator?: string | null;
  quote?: string | null;
};

/** Descriptor as it appears in the flat top-level canonical.json. */
export type Descriptor = {
  id: string;
  entity_id: string;
  statement: string;
  tier: Tier;
  symbolic_referent?: string | null;
  temporal_phase?: TemporalPhase | null;
};

/** Descriptor as it appears INSIDE a per-entity export, with citations inlined. */
export type EntityDescriptor = Omit<Descriptor, "entity_id"> & {
  citations: Citation[];
};

export type Entity = {
  id: string;
  name: string;
  entity_type: EntityType;
  summary?: string | null;
};

export type Relation = {
  id: string;
  from_entity_id: string;
  to_entity_id: string;
  relation_type: string;
  notes?: string | null;
};

export type CanonicalExport = {
  schema_version: string;
  generated_at: string;
  entities: Entity[];
  descriptors: Descriptor[];
  citations: Citation[];
  relations: Relation[];
};

/**
 * Citation on a measurement. Same source shape as a descriptor citation,
 * but keyed to a measurement row (`docs/data-model.md` — the citation
 * mirror table).
 */
export type MeasurementCitation = Omit<Citation, "descriptor_id"> & {
  measurement_id?: string;
};

/**
 * A cited dimensional fact (ADR 0017), as it appears inside a per-entity
 * export. `value` + `unit` are text-native — "one reed" is stored as
 * `1 reed`, never pre-converted to metres. The metric realization is the
 * engine resolver's job (ADR 0018); this layer only displays what the
 * text says.
 */
export type EntityMeasurement = {
  id: string;
  subject: string;
  dimension: string;
  value: number;
  unit: string;
  basis?: string | null;
  tier: Tier;
  notes?: string | null;
  citations: MeasurementCitation[];
};

export type EntityExport = {
  id: string;
  name: string;
  entity_type: EntityType;
  summary?: string | null;
  descriptors: EntityDescriptor[];
  relations?: Relation[];
  /** 0.2.0+ — omitted entirely when the entity carries no measurements. */
  measurements?: EntityMeasurement[];
};

export type Manifest = {
  schema_version: string;
  generated_at: string;
  counts: {
    entities: number;
    descriptors: number;
    citations: number;
    relations: number;
  };
  entity_files: string[];
};
