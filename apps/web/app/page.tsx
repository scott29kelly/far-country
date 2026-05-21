import { promises as fs } from "node:fs";
import path from "node:path";

// ----- shape of the canonical export (see docs/data-model.md §4) -----

type Citation = {
  id: string;
  source_type: "scripture" | "willis" | "secondary";
  book?: string | null;
  chapter?: number | null;
  verse_start?: number | null;
  verse_end?: number | null;
  willis_chapter?: string | null;
  willis_page_start?: number | null;
  willis_page_end?: number | null;
  secondary_work?: string | null;
  secondary_locator?: string | null;
};

type EntityDescriptor = {
  id: string;
  statement: string;
  tier: "clear" | "fuzzy" | "debated" | "symbolic";
  symbolic_referent?: string | null;
  temporal_phase?: "intermediate" | "final" | "either" | "unspecified" | null;
  citations: Citation[];
};

type EntityFile = {
  id: string;
  name: string;
  entity_type: "person" | "place" | "thing" | "event" | "attribute";
  summary?: string | null;
  descriptors: EntityDescriptor[];
};

// ----- data loading -----

async function loadEntity(slug: string): Promise<EntityFile | null> {
  const filePath = path.join(
    process.cwd(),
    "public",
    "data",
    "entities",
    `${slug}.json`,
  );
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as EntityFile;
  } catch {
    return null;
  }
}

// ----- rendering -----

function renderCitation(citation: Citation): string {
  if (citation.source_type === "scripture") {
    const range =
      citation.verse_end && citation.verse_end !== citation.verse_start
        ? `${citation.verse_start}–${citation.verse_end}`
        : `${citation.verse_start}`;
    return `${citation.book ?? "?"} ${citation.chapter ?? "?"}:${range}`;
  }
  if (citation.source_type === "willis") {
    const pages =
      citation.willis_page_end &&
      citation.willis_page_end !== citation.willis_page_start
        ? `${citation.willis_page_start}–${citation.willis_page_end}`
        : `${citation.willis_page_start}`;
    return `Willis ch. ${citation.willis_chapter ?? "?"}, p. ${pages}`;
  }
  return `${citation.secondary_work ?? "?"} — ${
    citation.secondary_locator ?? "?"
  }`;
}

export default async function NewJerusalemPage() {
  const entity = await loadEntity("new-jerusalem");

  return (
    <main>
      <h1>Far Country</h1>
      <p className="muted">Phase 1 placeholder &mdash; one entity, no navigation.</p>

      {entity ? (
        <article>
          <h1>{entity.name}</h1>
          <span className="entity-type">{entity.entity_type}</span>
          {entity.summary ? <p className="summary">{entity.summary}</p> : null}

          <p className="muted">
            Approved descriptors ({entity.descriptors.length})
          </p>
          <ul className="descriptor-list">
            {entity.descriptors.map((d) => (
              <li key={d.id} className={`descriptor tier-${d.tier}`}>
                <div className="badges">
                  <span className="badge">{d.tier}</span>
                  {d.temporal_phase ? (
                    <span className="badge">{d.temporal_phase}</span>
                  ) : null}
                </div>
                <p className="statement">{d.statement}</p>
                {d.symbolic_referent ? (
                  <p className="referent">
                    <em>Refers to:</em> {d.symbolic_referent}
                  </p>
                ) : null}
                <ul className="citations">
                  {d.citations.map((c) => (
                    <li key={c.id}>
                      <code>{renderCitation(c)}</code>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </article>
      ) : (
        <div className="notice">
          <p>
            <strong>No data yet.</strong> The page is wired but
            <code> public/data/entities/new-jerusalem.json</code> isn&apos;t
            present.
          </p>
          <p>
            From the repo root, run the pipeline and copy the export into the
            web app&apos;s <code>public/data/</code>:
          </p>
          <pre>
            <code>
              uv run --project pipeline far-country export{"\n"}
              mkdir -p apps/web/public/data{"\n"}
              cp -r data/exports/* apps/web/public/data/
            </code>
          </pre>
          <p>
            Then <code>npm install &amp;&amp; npm run dev</code> inside{" "}
            <code>apps/web/</code> and open{" "}
            <a href="http://localhost:3030">http://localhost:3030</a>.
          </p>
        </div>
      )}
    </main>
  );
}
