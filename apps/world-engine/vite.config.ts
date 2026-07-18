import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 4096,
  },
  // dev only: serve apps/web/public so the EntityHud's same-origin
  // /data/entities/*.json fetches work standalone (prod is served by
  // apps/web itself, which owns /data). Disabled for build — the bundle
  // must not ingest apps/web's public tree.
  publicDir: command === "build" ? false : resolve(__dirname, "../web/public"),
  server: {
    port: 5173,
    strictPort: true,
    // tool-driven file writes are missed by fsevents on this setup; poll so
    // the module graph never serves stale code (cost: dev-only CPU)
    watch: { usePolling: true, interval: 200 },
  },
  esbuild: {
    target: "esnext",
  },
  base: command === "build" ? "/laas/" : "/",
}));
