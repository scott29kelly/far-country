import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

// Load repo-root .env so OPENAI_API_KEY, ANTHROPIC_API_KEY, and ESV_API_KEY
// resolve in local dev (`next dev`) without a duplicate apps/web/.env.local.
// Existing-env vars take precedence, so Vercel-configured deploys are
// unaffected. Same pattern as scripts/build-index.ts.
function loadRepoRootEnv(): void {
  const candidate = path.resolve(process.cwd(), "..", "..", ".env");
  const fallback = path.resolve(process.cwd(), ".env");
  const envPath = existsSync(candidate)
    ? candidate
    : existsSync(fallback)
      ? fallback
      : null;
  if (envPath === null) return;
  for (const line of readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadRepoRootEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The WebGPU engine at /world-preview is the current front door. Send the
  // root and the legacy R3F /world route there so the production domain (and the
  // Vercel dashboard's Visit button) land on the engine, not the old scene.
  async redirects() {
    return [
      { source: "/", destination: "/world-preview", permanent: false },
      { source: "/world", destination: "/world-preview", permanent: false },
    ];
  },
};

export default nextConfig;
