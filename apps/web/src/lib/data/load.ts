/**
 * Server-side loaders for the canonical export.
 *
 * The web app reads canonical data from `apps/web/public/data/` at runtime.
 * If those files aren't present (e.g. you cloned the repo and haven't run
 * the pipeline yet), loaders fall through to a small fixture set under
 * `src/lib/data/__fixtures__/` so `npm run dev` works out-of-the-box.
 *
 * Behaviour, in order:
 *   1. Try `public/data/<file>.json`.
 *   2. Fall through to `src/lib/data/__fixtures__/<file>.json`.
 *   3. Surface a clear error if neither is present.
 *
 * Loaders are server-side only (Node `fs` imports). Cache the parsed JSON
 * across requests so a warm server pays the disk read once.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  assertSupportedSchema,
  UnsupportedSchemaError,
} from "./manifest";
import type {
  CanonicalExport,
  Entity,
  EntityExport,
  Manifest,
  MeasurementRecord,
  MeasurementsExport,
} from "./types";

// Resolved per-call rather than at module-load time so tests can swap the
// working directory between cases.
function publicDataDir(): string {
  return path.join(process.cwd(), "public", "data");
}

function fixtureDataDir(): string {
  return path.join(process.cwd(), "src", "lib", "data", "__fixtures__");
}

type CacheKey =
  | "manifest"
  | "canonical"
  | "measurements"
  | `entity:${string}`
  | "entities:index";

const cache = new Map<CacheKey, unknown>();

async function readJsonWithFallback<T>(relPath: string): Promise<T> {
  const publicPath = path.join(publicDataDir(), relPath);
  try {
    const raw = await fs.readFile(publicPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (!isMissingFile(err)) throw err;
  }

  const fixturePath = path.join(fixtureDataDir(), relPath);
  try {
    const raw = await fs.readFile(fixturePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if (!isMissingFile(err)) throw err;
    throw new Error(
      `Canonical export file not found at either '${publicPath}' or '${fixturePath}'. ` +
        `Run the pipeline export and copy data/exports/* into apps/web/public/data/.`,
    );
  }
}

function isMissingFile(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  );
}

/**
 * Load `manifest.json` and verify schema-version compatibility.
 * Throws `UnsupportedSchemaError` on major-version mismatch.
 */
export async function loadManifest(): Promise<Manifest> {
  const cached = cache.get("manifest") as Manifest | undefined;
  if (cached) return cached;

  const manifest = await readJsonWithFallback<Manifest>("manifest.json");
  assertSupportedSchema(manifest);
  cache.set("manifest", manifest);
  return manifest;
}

/** Load the full flat canonical export. */
export async function loadCanonical(): Promise<CanonicalExport> {
  const cached = cache.get("canonical") as CanonicalExport | undefined;
  if (cached) return cached;

  const canonical = await readJsonWithFallback<CanonicalExport>(
    "canonical.json",
  );
  cache.set("canonical", canonical);
  return canonical;
}

/**
 * Load a single entity's detail file by slug. Returns null if the entity
 * does not exist in the export (not an error — caller decides how to
 * render a 404).
 */
export async function loadEntity(slug: string): Promise<EntityExport | null> {
  const key: CacheKey = `entity:${slug}`;
  const cached = cache.get(key) as EntityExport | null | undefined;
  if (cached !== undefined) return cached;

  try {
    const entity = await readJsonWithFallback<EntityExport>(
      path.join("entities", `${slug}.json`),
    );
    cache.set(key, entity);
    return entity;
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found at either")) {
      cache.set(key, null);
      return null;
    }
    throw err;
  }
}

/**
 * Load the flat measurement export (`measurements.json`, ADR 0017).
 *
 * Written by `far-country measure export`, NOT by `far-country export` —
 * the two commands are separate, so this file can legitimately be absent
 * from a checkout that has only ever run the descriptor export. A missing
 * file is therefore an empty list, not an error: the browse UI degrades to
 * descriptor-only tiers rather than 500ing.
 */
export async function loadMeasurements(): Promise<MeasurementRecord[]> {
  const cached = cache.get("measurements") as MeasurementRecord[] | undefined;
  if (cached) return cached;

  let records: MeasurementRecord[] = [];
  try {
    const payload =
      await readJsonWithFallback<MeasurementsExport>("measurements.json");
    records = payload.measurements ?? [];
  } catch (err) {
    if (!(err instanceof Error && err.message.includes("not found at either"))) {
      throw err;
    }
  }
  cache.set("measurements", records);
  return records;
}

/**
 * Load the entity index — just the top-level entity list from the
 * canonical export. Convenience wrapper for the `/entities` page.
 */
export async function loadEntityIndex(): Promise<Entity[]> {
  const cached = cache.get("entities:index") as Entity[] | undefined;
  if (cached) return cached;

  const canonical = await loadCanonical();
  const sorted = [...canonical.entities].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  cache.set("entities:index", sorted);
  return sorted;
}

/** Test-only — clear the loader cache. Not exported in the public surface. */
export function _resetLoaderCacheForTests(): void {
  cache.clear();
}

export { UnsupportedSchemaError };
