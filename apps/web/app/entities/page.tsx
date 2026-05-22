import { loadEntityIndex } from "@/lib/data/load";
import type { EntityType } from "@/lib/data/types";

export const metadata = {
  title: "Entities — Far Country",
};

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  person: "Person",
  place: "Place",
  thing: "Thing",
  event: "Event",
  attribute: "Attribute",
};

export default async function EntityIndexPage() {
  const entities = await loadEntityIndex();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Entities</h1>
        <p className="mt-1 text-sm text-(--color-fg-muted)">
          {entities.length}{" "}
          {entities.length === 1 ? "entity" : "entities"} in the dataset.
          Filtering and search land in PR 2A.3.
        </p>
      </header>

      {entities.length === 0 ? (
        <p className="text-(--color-fg-muted)">
          The dataset is empty. Run the pipeline export and copy{" "}
          <code className="font-mono text-xs">data/exports/*</code> into{" "}
          <code className="font-mono text-xs">apps/web/public/data/</code>.
        </p>
      ) : (
        <ul className="divide-y divide-(--color-border) overflow-hidden rounded-lg border border-(--color-border) bg-(--color-card)">
          {entities.map((entity) => (
            <li key={entity.id} className="p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold text-(--color-fg)">
                  {entity.name}
                </h2>
                <span className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
                  {ENTITY_TYPE_LABELS[entity.entity_type]}
                </span>
              </div>
              {entity.summary ? (
                <p className="mt-2 text-sm leading-relaxed text-(--color-fg-muted)">
                  {entity.summary}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
