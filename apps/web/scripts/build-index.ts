#!/usr/bin/env node
/**
 * Build `public/data/embeddings.json` — the deploy-time semantic index.
 *
 * Reads the canonical export (preferring `public/data/canonical.json`,
 * falling back to `src/lib/data/__fixtures__/canonical.json` so a fresh
 * checkout can build an index against fixtures), embeds each descriptor
 * statement with the configured `EmbeddingProvider` (default: OpenAI
 * `text-embedding-3-small`), and writes the result alongside the rest of
 * `public/data/`.
 *
 * Invoked by `npm run build:index` in `apps/web/`. The runtime read
 * path never re-embeds the corpus — `retrieve()` loads this file and
 * only embeds the user question.
 *
 * Required env:
 *   OPENAI_API_KEY — see ADR 0007 and .env.example
 *
 * Optional env:
 *   FAR_COUNTRY_INDEX_BATCH — batch size for the embed call (default 96)
 *   FAR_COUNTRY_DRY_RUN     — "1" prints what would be embedded and exits
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import {
  EMBEDDING_INDEX_SCHEMA_VERSION,
  type EmbeddingIndex,
  type EmbeddingRow,
} from "../src/lib/retrieval/index-format";
import { createOpenAIProvider } from "../src/lib/retrieval/openai";
import type { EmbeddingProvider } from "../src/lib/retrieval/provider";
import type {
  CanonicalExport,
  Descriptor,
  Manifest,
} from "../src/lib/data/types";

const DEFAULT_BATCH = 96;

async function readJsonWithFallback<T>(relPath: string): Promise<T> {
  const candidates = [
    path.join(process.cwd(), "public", "data", relPath),
    path.join(process.cwd(), "src", "lib", "data", "__fixtures__", relPath),
  ];
  for (const candidate of candidates) {
    try {
      const raw = await fs.readFile(candidate, "utf-8");
      return JSON.parse(raw) as T;
    } catch (err) {
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "ENOENT"
      ) {
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `Required data file '${relPath}' not found under public/data or src/lib/data/__fixtures__/. ` +
      `Run the pipeline export and sync into public/data first.`,
  );
}

async function loadDescriptors(): Promise<{
  descriptors: Descriptor[];
  schemaVersion: string;
}> {
  const manifest = await readJsonWithFallback<Manifest>("manifest.json");
  const canonical = await readJsonWithFallback<CanonicalExport>(
    "canonical.json",
  );
  if (canonical.descriptors.length === 0) {
    throw new Error("Canonical export contains zero descriptors — nothing to embed.");
  }
  return {
    descriptors: canonical.descriptors,
    schemaVersion: manifest.schema_version,
  };
}

async function embedAll(
  provider: EmbeddingProvider,
  descriptors: Descriptor[],
  batchSize: number,
): Promise<EmbeddingRow[]> {
  const rows: EmbeddingRow[] = [];
  for (let i = 0; i < descriptors.length; i += batchSize) {
    const slice = descriptors.slice(i, i + batchSize);
    const inputs = slice.map((d) => d.statement);
    const vectors = await provider.embed(inputs);
    if (vectors.length !== slice.length) {
      throw new Error(
        `Provider returned ${vectors.length} vectors for ${slice.length} descriptors in batch starting at ${i}.`,
      );
    }
    for (let j = 0; j < slice.length; j++) {
      rows.push({
        descriptor_id: slice[j].id,
        vector: vectors[j],
      });
    }
    process.stdout.write(
      `  embedded ${Math.min(i + batchSize, descriptors.length)}/${descriptors.length}\n`,
    );
  }
  return rows;
}

async function main(): Promise<number> {
  const dryRun = process.env.FAR_COUNTRY_DRY_RUN === "1";
  const batchSize = Number(
    process.env.FAR_COUNTRY_INDEX_BATCH ?? DEFAULT_BATCH,
  );
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(
      `FAR_COUNTRY_INDEX_BATCH must be a positive integer; got '${process.env.FAR_COUNTRY_INDEX_BATCH}'`,
    );
  }

  const { descriptors, schemaVersion } = await loadDescriptors();
  process.stdout.write(
    `Building embedding index for ${descriptors.length} descriptor(s) ` +
      `against canonical schema ${schemaVersion}.\n`,
  );

  if (dryRun) {
    process.stdout.write("Dry-run: skipping OpenAI call and write.\n");
    for (const d of descriptors.slice(0, 5)) {
      process.stdout.write(`  - ${d.id} [${d.tier}] ${d.statement.slice(0, 60)}…\n`);
    }
    return 0;
  }

  const provider = createOpenAIProvider();
  const rows = await embedAll(provider, descriptors, batchSize);

  const index: EmbeddingIndex = {
    schema_version: EMBEDDING_INDEX_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    embedding_model: provider.model,
    embedding_dim: provider.dim,
    source_schema_version: schemaVersion,
    rows,
  };

  const outDir = path.join(process.cwd(), "public", "data");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "embeddings.json");
  await fs.writeFile(outPath, JSON.stringify(index), "utf-8");

  process.stdout.write(
    `Wrote ${outPath} (${rows.length} row(s), ${provider.model}, dim ${provider.dim}).\n`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`build-index failed: ${msg}\n`);
    process.exit(1);
  });
