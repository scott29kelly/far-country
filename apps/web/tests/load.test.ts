/**
 * Loader tests.
 *
 * The loader has two backing locations (public/data and __fixtures__) and
 * we want to verify the fallback chain works without polluting the actual
 * apps/web/public/data tree. Each test runs in a temporary working
 * directory with whatever layout it wants and resets the in-memory cache
 * between cases.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  UnsupportedSchemaError,
  _resetLoaderCacheForTests,
  loadCanonical,
  loadEntity,
  loadEntityIndex,
  loadManifest,
  loadMeasurements,
} from "@/lib/data/load";

const FIXTURE_SRC = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "data",
  "__fixtures__",
);

let originalCwd: string;
let tmpDir: string;

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(from, to);
    } else if (entry.isFile()) {
      await fs.copyFile(from, to);
    }
  }
}

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "far-country-web-test-"));
  // Stage the fixture set under src/lib/data/__fixtures__ so the loader's
  // fallback path resolves inside the temp cwd.
  await copyDir(
    FIXTURE_SRC,
    path.join(tmpDir, "src", "lib", "data", "__fixtures__"),
  );
  process.chdir(tmpDir);
  _resetLoaderCacheForTests();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpDir, { recursive: true, force: true });
  _resetLoaderCacheForTests();
});

describe("loadManifest", () => {
  it("falls back to fixtures when public/data is empty", async () => {
    const manifest = await loadManifest();
    expect(manifest.schema_version).toBe("0.3.0");
    expect(manifest.counts.entities).toBe(3);
  });

  it("prefers public/data when present", async () => {
    const publicDir = path.join(tmpDir, "public", "data");
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(
      path.join(publicDir, "manifest.json"),
      JSON.stringify({
        schema_version: "0.1.0",
        generated_at: "2030-01-01T00:00:00Z",
        counts: { entities: 99, descriptors: 0, citations: 0, relations: 0 },
        entity_files: [],
      }),
    );
    const manifest = await loadManifest();
    expect(manifest.counts.entities).toBe(99);
    expect(manifest.generated_at).toBe("2030-01-01T00:00:00Z");
  });

  it("throws UnsupportedSchemaError on major-version mismatch", async () => {
    const publicDir = path.join(tmpDir, "public", "data");
    await fs.mkdir(publicDir, { recursive: true });
    await fs.writeFile(
      path.join(publicDir, "manifest.json"),
      JSON.stringify({
        schema_version: "9.0.0",
        generated_at: "2030-01-01T00:00:00Z",
        counts: { entities: 0, descriptors: 0, citations: 0, relations: 0 },
        entity_files: [],
      }),
    );
    await expect(loadManifest()).rejects.toBeInstanceOf(UnsupportedSchemaError);
  });
});

describe("loadCanonical + loadEntityIndex", () => {
  it("returns the full canonical export from fixtures", async () => {
    const canonical = await loadCanonical();
    // Three entities, but only two of them carry descriptors: the holy
    // district is grounded by measurements alone (export 0.3.0).
    expect(canonical.entities).toHaveLength(3);
    expect(canonical.descriptors).toHaveLength(4);
  });

  it("indexes an entity that has no descriptors", async () => {
    const index = await loadEntityIndex();
    const district = index.find((e) => e.id === "holy-district");
    expect(district).toBeDefined();
    const withDescriptors = new Set(
      (await loadCanonical()).descriptors.map((d) => d.entity_id),
    );
    expect(withDescriptors.has("holy-district")).toBe(false);
  });

  it("loads the flat measurement export", async () => {
    const measurements = await loadMeasurements();
    expect(measurements).toHaveLength(2);
    expect(measurements.map((m) => m.entity_id)).toEqual([
      "holy-district",
      "holy-district",
    ]);
    expect(measurements.find((m) => m.tier === "debated")).toBeDefined();
  });

  it("treats a missing measurements.json as empty, not an error", async () => {
    // `far-country measure export` writes this file, `far-country export`
    // does not — a checkout that has only run the latter must still render
    // the browse UI, just with descriptor-only tiers.
    await fs.rm(
      path.join(tmpDir, "src", "lib", "data", "__fixtures__", "measurements.json"),
    );
    _resetLoaderCacheForTests();
    await expect(loadMeasurements()).resolves.toEqual([]);
  });

  it("sorts the entity index alphabetically by name", async () => {
    const index = await loadEntityIndex();
    expect(index.map((e) => e.name)).toEqual([
      "The Holy District",
      "The New Jerusalem",
      "The Twelve Gates",
    ]);
  });
});

describe("loadEntity", () => {
  it("returns the entity export for an existing slug", async () => {
    const entity = await loadEntity("new-jerusalem");
    expect(entity).not.toBeNull();
    expect(entity?.name).toBe("The New Jerusalem");
    expect(entity?.descriptors).toHaveLength(2);
  });

  it("returns null for an unknown slug", async () => {
    const entity = await loadEntity("nonexistent-entity");
    expect(entity).toBeNull();
  });

  it("rendering contract: symbolic descriptors always carry a referent", async () => {
    const gates = await loadEntity("twelve-gates");
    const symbolic = gates?.descriptors.filter((d) => d.tier === "symbolic");
    expect(symbolic?.length).toBeGreaterThan(0);
    for (const d of symbolic ?? []) {
      expect(d.symbolic_referent).toBeTruthy();
      expect(d.symbolic_referent?.length).toBeGreaterThan(10);
    }
  });
});
