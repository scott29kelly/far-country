import Link from "next/link";
import { notFound } from "next/navigation";

import { loadCanonical, loadEntity } from "@/lib/data/load";
import type {
  Entity,
  EntityDescriptor,
  EntityMeasurement,
  EntityType,
  Relation,
  TemporalPhase,
  Tier,
} from "@/lib/data/types";
import { TIERS } from "@/lib/data/types";
import { TemporalPhaseBadge, TierBadge } from "@/lib/ui/badges";
import { CitationLine } from "@/lib/ui/citation";
import { formatMeasurement } from "@/lib/ui/measurement";

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  person: "Person",
  place: "Place",
  thing: "Thing",
  event: "Event",
  attribute: "Attribute",
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const entity = await loadEntity(slug);
  if (!entity) return { title: "Not found — Far Country" };
  return { title: `${entity.name} — Far Country` };
}

export default async function EntityDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const entity = await loadEntity(slug);
  if (!entity) notFound();

  const canonical = await loadCanonical();
  const entitiesById = new Map<string, Entity>(
    canonical.entities.map((e) => [e.id, e]),
  );

  const grouped = groupByTier(entity.descriptors);
  const relations = entity.relations ?? [];
  const measurements = entity.measurements ?? [];

  return (
    <article className="space-y-10">
      <header className="space-y-3">
        <p className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
          <Link href="/entities" className="hover:text-(--color-accent)">
            ← All entities
          </Link>
        </p>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {entity.name}
          </h1>
          <span className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
            {ENTITY_TYPE_LABELS[entity.entity_type]}
          </span>
        </div>
        {entity.summary ? (
          <p className="text-base leading-relaxed text-(--color-fg)">
            {entity.summary}
          </p>
        ) : null}
      </header>

      <section aria-labelledby="descriptors-heading" className="space-y-6">
        <h2
          id="descriptors-heading"
          className="text-sm font-medium uppercase tracking-wider text-(--color-fg-muted)"
        >
          Descriptors ({entity.descriptors.length})
        </h2>

        {entity.descriptors.length === 0 ? (
          <p className="text-(--color-fg-muted)">
            {measurements.length > 0
              ? "No approved descriptors for this entity yet — it is grounded by its cited measurements below."
              : "No approved descriptors for this entity yet."}
          </p>
        ) : (
          TIERS.map((tier) => {
            const items = grouped[tier];
            if (items.length === 0) return null;
            return (
              <TierGroup key={tier} tier={tier} descriptors={items} />
            );
          })
        )}
      </section>

      {measurements.length > 0 ? (
        <section aria-labelledby="measurements-heading" className="space-y-4">
          <h2
            id="measurements-heading"
            className="text-sm font-medium uppercase tracking-wider text-(--color-fg-muted)"
          >
            Measurements ({measurements.length})
          </h2>
          <p className="text-sm leading-relaxed text-(--color-fg-muted)">
            Dimensions as the text gives them — the unit is Scripture&apos;s
            own, not a conversion.
          </p>
          <ul className="space-y-3">
            {measurements.map((m) => (
              <MeasurementCard key={m.id} measurement={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {relations.length > 0 ? (
        <section aria-labelledby="relations-heading" className="space-y-4">
          <h2
            id="relations-heading"
            className="text-sm font-medium uppercase tracking-wider text-(--color-fg-muted)"
          >
            Related entities
          </h2>
          <ul className="space-y-3">
            {relations.map((rel) => (
              <RelationRow
                key={rel.id}
                relation={rel}
                currentEntityId={entity.id}
                entitiesById={entitiesById}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

function groupByTier(
  descriptors: EntityDescriptor[],
): Record<Tier, EntityDescriptor[]> {
  const out: Record<Tier, EntityDescriptor[]> = {
    clear: [],
    fuzzy: [],
    debated: [],
    symbolic: [],
  };
  for (const d of descriptors) out[d.tier].push(d);
  return out;
}

function TierGroup({
  tier,
  descriptors,
}: {
  tier: Tier;
  descriptors: EntityDescriptor[];
}) {
  return (
    <div data-tier-group={tier} className="space-y-3">
      <ul className="space-y-3">
        {descriptors.map((d) => (
          <DescriptorCard key={d.id} descriptor={d} />
        ))}
      </ul>
    </div>
  );
}

function DescriptorCard({ descriptor }: { descriptor: EntityDescriptor }) {
  const phase: TemporalPhase = descriptor.temporal_phase ?? "unspecified";
  return (
    <li
      data-descriptor-id={descriptor.id}
      className="rounded-lg border border-(--color-border) bg-(--color-card) p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
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

function MeasurementCard({
  measurement,
}: {
  measurement: EntityMeasurement;
}) {
  return (
    <li
      data-measurement-id={measurement.id}
      className="rounded-lg border border-(--color-border) bg-(--color-card) p-5"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TierBadge tier={measurement.tier} />
        <span className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
          {measurement.dimension}
        </span>
      </div>

      <p className="text-base leading-relaxed text-(--color-fg)">
        {measurement.subject} —{" "}
        <span data-measurement-value className="font-medium">
          {formatMeasurement(measurement)}
        </span>
      </p>

      {measurement.basis ? (
        <p className="mt-2 text-sm leading-relaxed text-(--color-fg-muted)">
          <span className="font-medium">Basis:</span> {measurement.basis}
        </p>
      ) : null}

      {/*
        `notes` is where a text-critical variant lives (e.g. the Ezek 45:1
        10,000-vs-20,000 breadth crux). Never collapse it into the value —
        the tier badge above says the reading is contested, and this says why.
      */}
      {measurement.notes ? (
        <p
          data-measurement-notes
          className="mt-3 border-l-2 border-(--color-border) pl-3 text-sm italic leading-relaxed text-(--color-fg-muted)"
        >
          {measurement.notes}
        </p>
      ) : null}

      {measurement.citations.length > 0 ? (
        <ul className="mt-4 space-y-1">
          {measurement.citations.map((c) => (
            <li key={c.id}>
              <CitationLine citation={c} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function RelationRow({
  relation,
  currentEntityId,
  entitiesById,
}: {
  relation: Relation;
  currentEntityId: string;
  entitiesById: Map<string, Entity>;
}) {
  const otherId =
    relation.from_entity_id === currentEntityId
      ? relation.to_entity_id
      : relation.from_entity_id;
  const direction =
    relation.from_entity_id === currentEntityId ? "outgoing" : "incoming";
  const other = entitiesById.get(otherId);

  return (
    <li
      data-relation-id={relation.id}
      className="rounded-md border border-(--color-border) bg-(--color-card) p-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
            {relation.relation_type}{" "}
            {direction === "incoming" ? "(of)" : null}
          </span>
          <div className="mt-1">
            {other ? (
              <Link
                href={`/entities/${other.id}`}
                className="text-base font-medium text-(--color-accent) hover:underline"
              >
                {other.name}
              </Link>
            ) : (
              <span className="text-base font-medium text-(--color-fg-muted)">
                {otherId}{" "}
                <span className="text-xs">(not in export)</span>
              </span>
            )}
          </div>
        </div>
      </div>
      {relation.notes ? (
        <p className="mt-2 text-sm leading-relaxed text-(--color-fg-muted)">
          {relation.notes}
        </p>
      ) : null}
    </li>
  );
}
