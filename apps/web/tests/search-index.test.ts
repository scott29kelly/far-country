/**
 * search-index helper tests.
 *
 * Verifies the per-entity tier set is computed from canonical descriptors
 * and that the searchable view is sorted by name.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _resetLoaderCacheForTests } from "@/lib/data/load";
import {
  _resetSearchableCacheForTests,
  loadSearchableEntities,
} from "@/lib/data/search-index";

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
    if (entry.isDirectory()) await copyDir(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "far-country-search-"));
  await copyDir(
    FIXTURE_SRC,
    path.join(tmpDir, "src", "lib", "data", "__fixtures__"),
  );
  process.chdir(tmpDir);
  _resetLoaderCacheForTests();
  _resetSearchableCacheForTests();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpDir, { recursive: true, force: true });
  _resetLoaderCacheForTests();
  _resetSearchableCacheForTests();
});

describe("loadSearchableEntities", () => {
  it("returns entries sorted by name", async () => {
    const entries = await loadSearchableEntities();
    expect(entries.map((e) => e.name)).toEqual([
      "The Holy District",
      "The New Jerusalem",
      "The Twelve Gates",
    ]);
  });

  it("gives a measurement-only entity the tiers of its measurements", async () => {
    // The fixture district has a `debated` breadth (the Ezek 45:1 MT/LXX
    // crux) and a `clear` length, and no descriptors at all. Both tiers must
    // reach the filter — a tier vocabulary that hides contested readings
    // defeats its own purpose.
    const entries = await loadSearchableEntities();
    const district = entries.find((e) => e.id === "holy-district");
    expect(district).toBeDefined();
    expect(district?.tiers).toEqual(["clear", "debated"]);
  });

  it("puts measurement subjects in the search corpus", async () => {
    const entries = await loadSearchableEntities();
    const district = entries.find((e) => e.id === "holy-district");
    expect(district?.statementsText).toContain("breadth");
    expect(district?.statementsText).toContain("length");
  });

  it("keeps descriptor tiers when an entity has both kinds", async () => {
    // new-jerusalem has descriptors but no measurements in the fixture:
    // unioning must not drop or reorder what was already there.
    const entries = await loadSearchableEntities();
    const nj = entries.find((e) => e.id === "new-jerusalem");
    expect(nj?.tiers).toEqual(expect.arrayContaining(["clear", "debated"]));
    expect(nj?.statementsText).toContain("comes down out of heaven");
  });

  it("computes per-entity tier set from descriptors", async () => {
    const entries = await loadSearchableEntities();
    const nj = entries.find((e) => e.id === "new-jerusalem");
    const gates = entries.find((e) => e.id === "twelve-gates");
    // new-jerusalem fixture: 'clear' + 'debated'
    expect(nj?.tiers).toEqual(expect.arrayContaining(["clear", "debated"]));
    // twelve-gates fixture: 'clear' + 'symbolic'
    expect(gates?.tiers).toEqual(expect.arrayContaining(["clear", "symbolic"]));
  });

  it("includes descriptor statements in the search corpus", async () => {
    const entries = await loadSearchableEntities();
    const gates = entries.find((e) => e.id === "twelve-gates");
    expect(gates?.statementsText).toContain("twelve pearls");
  });
});
