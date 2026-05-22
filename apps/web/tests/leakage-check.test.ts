/**
 * No-source-leakage script tests.
 *
 * Builds a tiny faux .next/ + public/data/ tree in a temp dir, runs the
 * leakage check against it, and asserts the script exits 0 when clean and
 * non-zero when a sentinel phrase is present.
 *
 * The script reads paths relative to its own location, so we copy it into
 * the temp tree at apps/web/scripts/ and execute from there.
 */

import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REAL_SCRIPT = path.join(
  __dirname,
  "..",
  "scripts",
  "check-no-source-leakage.mjs",
);

let tmpDir: string;
let webRoot: string;
let scriptPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "far-country-leakage-"));
  webRoot = path.join(tmpDir, "apps", "web");
  await fs.mkdir(path.join(webRoot, "scripts"), { recursive: true });
  await fs.mkdir(path.join(webRoot, ".next", "server"), { recursive: true });
  await fs.mkdir(path.join(webRoot, ".next", "static"), { recursive: true });
  await fs.mkdir(path.join(webRoot, "public", "data"), { recursive: true });
  scriptPath = path.join(webRoot, "scripts", "check-no-source-leakage.mjs");
  await fs.copyFile(REAL_SCRIPT, scriptPath);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function runScript() {
  return spawnSync("node", [scriptPath], { encoding: "utf-8" });
}

describe("check-no-source-leakage", () => {
  it("exits 0 when no sentinel phrases are present", async () => {
    await fs.writeFile(
      path.join(webRoot, ".next", "server", "chunk.js"),
      "console.log('hello world');",
    );
    await fs.writeFile(
      path.join(webRoot, "public", "data", "manifest.json"),
      JSON.stringify({ schema_version: "0.1.0" }),
    );
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/No ESV source text/);
  });

  it("exits 1 when an ESV sentinel phrase appears in the build output", async () => {
    await fs.writeFile(
      path.join(webRoot, ".next", "server", "leaked.js"),
      "const verse = 'Behold, I am making all things new';",
    );
    const result = runScript();
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Source-leakage check FAILED/);
    expect(result.stderr).toMatch(/leaked\.js/);
  });

  it("exits 1 when sentinel appears in public/data", async () => {
    await fs.writeFile(
      path.join(webRoot, "public", "data", "bad.json"),
      JSON.stringify({ verse: "made of pure gold, like clear glass" }),
    );
    const result = runScript();
    expect(result.status).toBe(1);
  });
});
