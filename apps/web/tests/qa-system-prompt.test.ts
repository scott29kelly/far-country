/**
 * Test the frontmatter parser for the versioned system prompt.
 *
 * The real `system-prompt.md` ships with the build; here we use a
 * synthetic prompt file to exercise the parser without coupling these
 * tests to the prompt's actual wording (which is frozen by the
 * grounding-contract tests separately).
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  _resetSystemPromptCacheForTests,
  loadSystemPrompt,
} from "@/lib/qa";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "far-country-prompt-"));
  _resetSystemPromptCacheForTests();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  _resetSystemPromptCacheForTests();
});

async function write(filename: string, body: string): Promise<string> {
  const target = path.join(tmpDir, filename);
  await fs.writeFile(target, body, "utf-8");
  return target;
}

describe("loadSystemPrompt", () => {
  it("parses version + default_model + body", async () => {
    const promptPath = await write(
      "p.md",
      "---\nversion: 1.2.3\ndefault_model: claude-x-y\n---\n\nBody text here.",
    );
    const result = await loadSystemPrompt({ promptPath });
    expect(result.version).toBe("1.2.3");
    expect(result.defaultModel).toBe("claude-x-y");
    expect(result.body).toBe("Body text here.");
  });

  it("throws if frontmatter is missing", async () => {
    const promptPath = await write("p.md", "Just a body, no frontmatter.");
    await expect(loadSystemPrompt({ promptPath })).rejects.toThrow(
      /frontmatter/,
    );
  });

  it("throws if version or default_model is missing", async () => {
    const promptPath = await write(
      "p.md",
      "---\nversion: 1.0.0\n---\nbody",
    );
    await expect(loadSystemPrompt({ promptPath })).rejects.toThrow(
      /default_model/,
    );
  });

  it("works against the real system-prompt.md shipped in the package", async () => {
    // No promptPath → uses the bundled prompt. We assert only the shape
    // of the response, not the wording, so the test doesn't break every
    // time the prompt is iterated. Wording is frozen by the
    // grounding-contract tests separately.
    const result = await loadSystemPrompt();
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(result.defaultModel).toMatch(/claude/);
    expect(result.body.length).toBeGreaterThan(100);
  });
});
