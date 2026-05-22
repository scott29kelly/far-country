/**
 * Tests for `retrieveByVector` and `retrieve` — the read-path retriever.
 *
 * We build a synthetic embeddings.json with 3-D vectors chosen so the
 * intended hits are obvious by inspection: each descriptor in the
 * fixture canonical export gets a unit vector along one axis. A query
 * along axis X returns the descriptor assigned to X with cosine 1.
 *
 * This lets us assert top-K, tier filter, tier weights, and the
 * descriptor → citations join without depending on a real embedding
 * model.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { _resetLoaderCacheForTests } from "@/lib/data/load";
import {
  _resetRetrievalCacheForTests,
  EMBEDDING_INDEX_SCHEMA_VERSION,
  type EmbeddingIndex,
  OPENAI_EMBEDDING_MODEL,
  retrieve,
  retrieveByVector,
} from "@/lib/retrieval";

const FIXTURE_SRC = path.join(
  __dirname,
  "..",
  "src",
  "lib",
  "data",
  "__fixtures__",
);

// 3-D unit vectors, one per descriptor in the canonical fixture.
const DESCRIPTOR_VECTORS: Record<string, number[]> = {
  // new-jerusalem.tier=clear
  "desc-nj-descends": [1, 0, 0],
  // new-jerusalem.tier=debated
  "desc-nj-cube": [0, 1, 0],
  // twelve-gates.tier=symbolic
  "desc-gates-pearl": [0, 0, 1],
  // twelve-gates.tier=clear (mixed axis so symbolic stays unique)
  "desc-gates-inscribed": [0.7071, 0.7071, 0],
};

const DIM = 3;

function syntheticIndex(): EmbeddingIndex {
  // We test retrieval algebra here, not the wire-format dim/model guard
  // (that's covered by retrieval-index-format.test.ts). Each call passes
  // `expectedDim: 3` so the file's own header is accepted by the loader.
  return {
    schema_version: EMBEDDING_INDEX_SCHEMA_VERSION,
    generated_at: "2026-05-22T00:00:00Z",
    embedding_model: OPENAI_EMBEDDING_MODEL,
    embedding_dim: DIM,
    source_schema_version: "0.1.0",
    rows: Object.entries(DESCRIPTOR_VECTORS).map(([descriptor_id, vector]) => ({
      descriptor_id,
      vector,
    })),
  };
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  for (const entry of await fs.readdir(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}

let originalCwd: string;
let tmpDir: string;
let indexPath: string;

beforeEach(async () => {
  originalCwd = process.cwd();
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "far-country-retrieve-"));
  await copyDir(
    FIXTURE_SRC,
    path.join(tmpDir, "src", "lib", "data", "__fixtures__"),
  );
  indexPath = path.join(tmpDir, "embeddings.json");
  await fs.writeFile(indexPath, JSON.stringify(syntheticIndex()), "utf-8");
  process.chdir(tmpDir);
  _resetLoaderCacheForTests();
  _resetRetrievalCacheForTests();
});

afterEach(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpDir, { recursive: true, force: true });
  _resetLoaderCacheForTests();
  _resetRetrievalCacheForTests();
});

describe("retrieveByVector", () => {
  it("returns top-K by cosine similarity, highest first", async () => {
    const hits = await retrieveByVector([1, 0, 0], { k: 2, indexPath, expectedDim: DIM });
    expect(hits).toHaveLength(2);
    expect(hits[0].descriptor.id).toBe("desc-nj-descends");
    expect(hits[0].rawScore).toBeCloseTo(1.0, 4);
    // desc-gates-inscribed has a 0.7071 X component → next-highest.
    expect(hits[1].descriptor.id).toBe("desc-gates-inscribed");
    expect(hits[1].rawScore).toBeCloseTo(0.7071, 3);
  });

  it("attaches citations from the canonical export to each hit", async () => {
    const hits = await retrieveByVector([1, 0, 0], { k: 1, indexPath, expectedDim: DIM });
    const cits = hits[0].citations;
    expect(cits.length).toBeGreaterThan(0);
    // The fixture has one scripture citation on desc-nj-descends.
    expect(cits[0].source_type).toBe("scripture");
    expect(cits[0].book).toBe("Revelation");
  });

  it("filters by tier when `tierFilter` is supplied", async () => {
    const hits = await retrieveByVector([0, 0, 1], {
      k: 5,
      indexPath,
      expectedDim: DIM,
      tierFilter: ["clear", "debated"],
    });
    // desc-gates-pearl is symbolic and would otherwise be top-1, but
    // the filter excludes it.
    expect(hits.find((h) => h.descriptor.id === "desc-gates-pearl")).toBeUndefined();
    for (const h of hits) {
      expect(["clear", "debated"]).toContain(h.descriptor.tier);
    }
  });

  it("applies tier weights multiplicatively after cosine", async () => {
    // Query [0, 0.5, 1] is mostly aligned with the symbolic descriptor
    // (Z axis) but also has a Y component aligned with desc-nj-cube
    // (debated). Without weights, pearl wins; with symbolic heavily
    // downweighted, cube wins.
    const query = [0, 0.5, 1];

    const baseline = await retrieveByVector(query, {
      k: 1,
      indexPath,
      expectedDim: DIM,
    });
    expect(baseline[0].descriptor.id).toBe("desc-gates-pearl");
    // Raw cosine of [0,0.5,1] · [0,0,1] / |[0,0.5,1]| ≈ 0.894.
    expect(baseline[0].rawScore).toBeCloseTo(0.894, 3);

    const weighted = await retrieveByVector(query, {
      k: 5,
      indexPath,
      expectedDim: DIM,
      tierWeights: { symbolic: 0.01 },
    });
    // After downweighting symbolic by 100×, the cube (debated, raw ~0.447,
    // weight 1.0) beats the pearl (symbolic, raw ~0.894, weight 0.01 →
    // weighted ~0.00894).
    expect(weighted[0].descriptor.id).toBe("desc-nj-cube");

    const symbolicHit = weighted.find(
      (h) => h.descriptor.id === "desc-gates-pearl",
    );
    expect(symbolicHit?.rawScore).toBeCloseTo(0.894, 3);
    expect(symbolicHit?.score).toBeCloseTo(0.00894, 4);
  });

  it("drops hits below `minScore`", async () => {
    const hits = await retrieveByVector([1, 0, 0], {
      k: 10,
      indexPath,
      expectedDim: DIM,
      minScore: 0.9,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].descriptor.id).toBe("desc-nj-descends");
  });

  it("throws on a query vector with the wrong dimensionality", async () => {
    await expect(
      retrieveByVector([1, 0], { indexPath, expectedDim: DIM }),
    ).rejects.toThrow(/dim 2 != index dim 3/);
  });
});

describe("retrieve (high-level wrapper)", () => {
  it("routes the query through a provider then retrieves", async () => {
    const calls: string[][] = [];
    const stub = {
      async embed(texts: string[]) {
        calls.push(texts);
        // Pretend any query is "axis Z".
        return [[0, 0, 1]] as number[][];
      },
    };

    const hits = await retrieve("anything", stub, { k: 1, indexPath, expectedDim: DIM });
    expect(calls).toEqual([["anything"]]);
    expect(hits[0].descriptor.id).toBe("desc-gates-pearl");
  });
});
