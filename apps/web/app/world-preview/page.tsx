import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "World (engine preview) — Far Country",
  description:
    "Preview of the vendored WebGPU world engine. Requires Chrome 113+ (WebGPU). Phase 3 migration, Stage 2.",
};

/**
 * Transitional preview of the vendored LAAS WebGPU engine (see ADR 0013).
 *
 * The engine is a standalone Vite app whose build output is emitted into
 * `public/laas/` by `npm run build:engine`. We host it here in a full-viewport
 * iframe so it runs untouched (its own canvas, boot UI, error hooks, and HUD),
 * isolated from the Next/React tree. This route coexists with the legacy R3F
 * `/world` until the engine reaches parity on the New Jerusalem core elements.
 *
 * Note: the iframe is empty until `npm run build:engine` has populated
 * `public/laas/`. WebGPU is required — the engine shows its own gate notice on
 * unsupported browsers.
 */
export default function WorldPreviewPage() {
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Link
        href="/world"
        className="absolute left-3 top-3 z-10 rounded bg-black/60 px-3 py-1 text-sm text-white/90 backdrop-blur hover:text-white"
      >
        ← Back
      </Link>
      <iframe
        src="/laas/index.html?scene=newjerusalem"
        title="Far Country world engine preview"
        className="h-full w-full border-0"
      />
    </div>
  );
}
