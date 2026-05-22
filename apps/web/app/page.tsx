import Link from "next/link";

import { loadManifest } from "@/lib/data/load";

export default async function LandingPage() {
  const manifest = await loadManifest();
  const { entities, descriptors, citations, relations } = manifest.counts;

  return (
    <div className="space-y-10">
      <section>
        <h1 className="mb-4 text-3xl font-semibold tracking-tight">
          Far Country
        </h1>
        <p className="text-lg leading-relaxed text-(--color-fg)">
          A biblically grounded world model of heaven. Every claim is sourced
          to Scripture (ESV) and{" "}
          <span className="italic">
            What on Earth Is Heaven Like? A Look at God&apos;s City New
            Jerusalem
          </span>{" "}
          by Janet Willis. Fuzzy, debated, and symbolic material is preserved
          and labelled rather than smoothed over.
        </p>
      </section>

      <section
        aria-labelledby="dataset-heading"
        className="rounded-lg border border-(--color-border) bg-(--color-card) p-6"
      >
        <h2
          id="dataset-heading"
          className="mb-3 text-sm font-medium uppercase tracking-wider text-(--color-fg-muted)"
        >
          Dataset
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Entities" value={entities} />
          <Stat label="Descriptors" value={descriptors} />
          <Stat label="Citations" value={citations} />
          <Stat label="Relations" value={relations} />
        </dl>
        <p className="mt-4 text-xs text-(--color-fg-muted)">
          Schema {manifest.schema_version} · generated {manifest.generated_at}
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          href="/entities"
          className="rounded-md border border-(--color-accent) bg-(--color-accent) px-4 py-2 text-sm font-medium text-white hover:bg-(--color-fg)"
        >
          Browse entities
        </Link>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-(--color-fg-muted)">
        {label}
      </dt>
      <dd className="mt-1 text-2xl font-semibold text-(--color-fg)">
        {value}
      </dd>
    </div>
  );
}
