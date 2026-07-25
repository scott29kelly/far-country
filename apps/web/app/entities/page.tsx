import { loadSearchableEntities } from "@/lib/data/search-index";
import {
  ENTITY_TYPES,
  TIERS,
  type EntityType,
  type Tier,
} from "@/lib/data/types";
import { EntitySearchList } from "@/lib/ui/entity-search";
import { EntityTypeFilter, TierFilter } from "@/lib/ui/filter-chips";

export const metadata = {
  title: "Entities — Far Country",
};

type PageProps = {
  searchParams: Promise<{
    entity_type?: string;
    tier?: string;
  }>;
};

function parseEntityType(raw: string | undefined): EntityType | null {
  if (!raw) return null;
  return (ENTITY_TYPES as readonly string[]).includes(raw)
    ? (raw as EntityType)
    : null;
}

function parseTier(raw: string | undefined): Tier | null {
  if (!raw) return null;
  return (TIERS as readonly string[]).includes(raw) ? (raw as Tier) : null;
}

export default async function EntityIndexPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const entityType = parseEntityType(params.entity_type);
  const tier = parseTier(params.tier);

  const all = await loadSearchableEntities();
  const filtered = all.filter((e) => {
    if (entityType && e.entity_type !== entityType) return false;
    if (tier && !e.tiers.includes(tier)) return false;
    return true;
  });

  const baseParams = {
    entity_type: entityType ?? undefined,
    tier: tier ?? undefined,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
        <p className="text-sm text-(--color-fg-muted)">
          {all.length} {all.length === 1 ? "entity" : "entities"} in the
          dataset. Filter by type or tier, or search names, descriptors and
          measurements.
        </p>
      </header>

      <section
        aria-labelledby="filters-heading"
        className="space-y-3 rounded-lg border border-(--color-border) bg-(--color-card) p-4"
      >
        <h2 id="filters-heading" className="sr-only">
          Filters
        </h2>
        <EntityTypeFilter active={entityType} baseParams={baseParams} />
        <TierFilter active={tier} baseParams={baseParams} />
      </section>

      {all.length === 0 ? (
        <p className="text-(--color-fg-muted)">
          The dataset is empty. Run the pipeline export and copy{" "}
          <code className="font-mono text-xs">data/exports/*</code> into{" "}
          <code className="font-mono text-xs">apps/web/public/data/</code>.
        </p>
      ) : (
        <EntitySearchList entities={filtered} />
      )}
    </div>
  );
}
