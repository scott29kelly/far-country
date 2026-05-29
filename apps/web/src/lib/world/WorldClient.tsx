"use client";

import dynamic from "next/dynamic";

import { Compass } from "./hud/Compass";
import { DescriptorHud } from "./hud/DescriptorHud";
import { MiniMap } from "./hud/MiniMap";

/**
 * Client-only host for the /world experience.
 *
 * Why this exists: the R3F Canvas crashes on the server (no `window`,
 * no WebGL). Next 15 only allows `next/dynamic({ ssr: false })` from
 * within client components, so this wrapper carries the "use client"
 * boundary and lazy-loads the scene.
 */
const Scene = dynamic(
  () => import("./Scene").then((m) => m.Scene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[80vh] items-center justify-center text-(--color-fg-muted)">
        loading world…
      </div>
    ),
  },
);

export function WorldClient() {
  return (
    <div className="relative h-[calc(100vh-13rem)] min-h-[600px] w-full overflow-hidden bg-[#1a140a]">
      <Scene />
      <Compass />
      <MiniMap />
      <DescriptorHud />
      <Crosshair />
    </div>
  );
}

function Crosshair() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="h-2 w-2 rounded-full border border-white/50 bg-white/20" />
    </div>
  );
}
