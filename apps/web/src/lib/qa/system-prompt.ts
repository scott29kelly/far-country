/**
 * Versioned system prompt loader.
 *
 * Reads `system-prompt.md` at request time (cached after first read) and
 * parses its frontmatter (`version`, `default_model`) plus the prose body.
 * The version + model identifier travel through every grounded answer so
 * the UI can show which prompt produced an answer (per spec §6).
 *
 * Bumping the prompt is intentional: any meaningful wording change should
 * also bump `version` in the frontmatter, and the grounding-contract
 * tests freeze on the wording after a review.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

export type SystemPrompt = {
  /** Semver string from frontmatter. */
  version: string;
  /** Default Claude model the orchestrator uses unless overridden. */
  defaultModel: string;
  /** The prose body after frontmatter — what is sent to Claude. */
  body: string;
};

let cached: SystemPrompt | null = null;

// Resolve relative to the Next.js project root (process.cwd()) so the
// markdown stays a normal source asset rather than something webpack
// has to bundle. Matches the resolution `lib/data/load.ts` uses for
// canonical-export fixtures.
const PROMPT_FILE_RELATIVE = path.join(
  "src",
  "lib",
  "qa",
  "system-prompt.md",
);

// Tolerate CRLF as well as LF — the file is committed with LF, but
// git's default `core.autocrlf=true` on Windows checkouts converts line
// endings on read. Without this the parser breaks on Windows dev boxes
// even though CI (Linux) stays green.
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

function parseFrontmatter(raw: string): SystemPrompt {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error(
      "system-prompt.md is missing its YAML frontmatter — expected '---\\nversion: ...\\ndefault_model: ...\\n---'",
    );
  }
  const [, yaml, body] = match;
  const fields: Record<string, string> = {};
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    fields[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }

  const version = fields.version;
  const defaultModel = fields.default_model;
  if (!version || !defaultModel) {
    throw new Error(
      "system-prompt.md frontmatter must define both `version` and `default_model`.",
    );
  }

  return { version, defaultModel, body: body.trim() };
}

export async function loadSystemPrompt(
  options: { promptPath?: string } = {},
): Promise<SystemPrompt> {
  if (cached && !options.promptPath) return cached;
  const target =
    options.promptPath ?? path.join(process.cwd(), PROMPT_FILE_RELATIVE);
  const raw = await fs.readFile(target, "utf-8");
  const parsed = parseFrontmatter(raw);
  if (!options.promptPath) cached = parsed;
  return parsed;
}

export function _resetSystemPromptCacheForTests(): void {
  cached = null;
}
