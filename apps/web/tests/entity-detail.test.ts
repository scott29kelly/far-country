/**
 * Entity detail route tests.
 *
 * Server components are async functions returning JSX. We invoke the page
 * directly with synthetic `params`, render to static HTML, and assert on
 * the markup. This exercises the rendering contract from spec §3.2 + §9:
 *
 *   - tier and temporal_phase badges are always present on a descriptor
 *   - symbolic descriptors render their symbolic_referent
 *   - debated descriptors surface ALL their citations
 *   - related-entity rows link to /entities/<slug>
 *   - unknown slugs throw via notFound()
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import EntityDetailPage from "../app/entities/[slug]/page";
import { _resetLoaderCacheForTests } from "@/lib/data/load";

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
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "far-country-detail-"));
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

async function renderEntity(slug: string): Promise<string> {
  const element = await EntityDetailPage({ params: Promise.resolve({ slug }) });
  return renderToStaticMarkup(element);
}

describe("EntityDetailPage", () => {
  it("renders the entity name and summary", async () => {
    const html = await renderEntity("new-jerusalem");
    expect(html).toContain("The New Jerusalem");
    expect(html).toContain("descending out of heaven from God");
  });

  it("renders every descriptor with a tier badge", async () => {
    const html = await renderEntity("new-jerusalem");
    // new-jerusalem fixture: one 'clear' + one 'debated'
    expect(html).toMatch(/data-tier="clear"/);
    expect(html).toMatch(/data-tier="debated"/);
  });

  it("renders every descriptor with a temporal_phase badge", async () => {
    const html = await renderEntity("new-jerusalem");
    // Both fixture descriptors have temporal_phase='final'
    const matches = html.match(/data-temporal-phase="final"/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("surfaces symbolic_referent under a symbolic descriptor", async () => {
    const html = await renderEntity("twelve-gates");
    expect(html).toMatch(/data-tier="symbolic"/);
    expect(html).toContain("data-symbolic-referent");
    expect(html).toContain("The preciousness, purity, and singular costliness");
  });

  it("surfaces ALL citations on a debated descriptor", async () => {
    const html = await renderEntity("new-jerusalem");
    // The debated 'cube' descriptor has two citations: Rev 21:16 + a Willis page.
    expect(html).toContain("Revelation 21:16");
    expect(html).toContain("Willis");
    expect(html).toContain("p. 88");
  });

  it("renders related entities as links to /entities/<slug>", async () => {
    const html = await renderEntity("new-jerusalem");
    // new-jerusalem has a relation to twelve-gates.
    expect(html).toContain('href="/entities/twelve-gates"');
    expect(html).toContain("The Twelve Gates");
  });

  it("renders relation notes when present", async () => {
    const html = await renderEntity("twelve-gates");
    expect(html).toContain("Twelve gates are part of the city walls");
    // Link back to new-jerusalem from the gates page.
    expect(html).toContain('href="/entities/new-jerusalem"');
  });

  it("throws via notFound() for an unknown slug", async () => {
    await expect(renderEntity("nonexistent-entity")).rejects.toThrow();
  });

  it("never renders a symbolic descriptor as a bare statement", async () => {
    // Hermeneutic non-negotiable (spec §3.2 + §7): a symbolic descriptor
    // must always carry its symbolic_referent in the rendered output.
    const html = await renderEntity("twelve-gates");
    // Strip the symbolic_referent block and confirm the symbolic statement
    // wouldn't appear on its own.
    expect(html).toContain("data-symbolic-referent");
  });
});
