#!/usr/bin/env node
/**
 * Guard: no ESV or Willis source text in the build output.
 *
 * Per ADR 0006 + spec §7, the deployed bundle and the data directory must
 * never carry ESV verse text or Willis prose in bulk. ESV reaches users
 * only through the /api/esv proxy at view time. This script scans:
 *
 *   - apps/web/.next/server/   (server bundle)
 *   - apps/web/.next/static/   (client bundle)
 *   - apps/web/public/data/    (shipped data)
 *
 * for sentinel phrases lifted verbatim from the ESV. The sentinels are
 * distinctive enough that incidental occurrences in code or fixture text
 * are highly unlikely. If any sentinel is found in a scanned file, exit 1.
 *
 * Fixture / dev-only paths under public/data are intentionally not in the
 * fixture set today; if that changes, narrow the scan to exclude them.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");

const SCAN_DIRS = [
  path.join(WEB_ROOT, ".next", "server"),
  path.join(WEB_ROOT, ".next", "static"),
  path.join(WEB_ROOT, "public", "data"),
];

// Distinctive ESV phrasings. Each must be specific enough that a chance
// match in source code is implausible. Update as the corpus expands.
const SENTINELS = [
  "Behold, I am making all things new",        // Rev 21:5 ESV
  "And I heard a loud voice from the throne",  // Rev 21:3 ESV
  "made of pure gold, like clear glass",       // Rev 21:18 ESV
];

const SCAN_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".html",
  ".css",
  ".txt",
  ".map",
]);

/** @returns {AsyncGenerator<string>} */
async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function main() {
  const findings = [];
  for (const dir of SCAN_DIRS) {
    for await (const file of walk(dir)) {
      if (!SCAN_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
      const content = await fs.readFile(file, "utf-8").catch(() => "");
      for (const sentinel of SENTINELS) {
        if (content.includes(sentinel)) {
          findings.push({ file: path.relative(WEB_ROOT, file), sentinel });
        }
      }
    }
  }

  if (findings.length > 0) {
    console.error(
      "✗ Source-leakage check FAILED — ESV sentinel phrase found in build output.",
    );
    console.error("  ADR 0006 forbids shipping ESV verse text in the bundle.");
    for (const f of findings) {
      console.error(`    ${f.file}  →  "${f.sentinel}"`);
    }
    process.exit(1);
  }

  console.log("✓ No ESV source text found in build output.");
}

main().catch((err) => {
  console.error("Source-leakage check errored:", err);
  process.exit(2);
});
