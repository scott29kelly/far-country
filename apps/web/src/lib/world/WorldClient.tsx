"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { ambience } from "./audio/ambience";
import { Compass } from "./hud/Compass";
import { DescriptorHud } from "./hud/DescriptorHud";
import { MiniMap } from "./hud/MiniMap";
import { useWorldStore } from "./state/worldStore";

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
  const phase = useWorldStore((s) => s.phase);
  return (
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#15110a]">
      <Scene />
      {phase === "intro" && <IntroOverlay />}
      {phase === "active" && (
        <>
          <Compass />
          <MiniMap />
          <DescriptorHud />
          <Crosshair />
          <SoundToggle />
        </>
      )}
      <Link
        href="/"
        className="pointer-events-auto absolute bottom-4 left-4 z-30 rounded-md border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md transition hover:bg-black/55 hover:text-white"
      >
        ← Far Country
      </Link>
    </div>
  );
}

/**
 * Title card shown over the establishing orbit. The button drops the user into
 * the city (the fly-in tween, then first-person controls).
 */
function IntroOverlay() {
  const enterCity = useWorldStore((s) => s.enterCity);
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-end pb-[12vh] text-center">
      <div className="pointer-events-auto mx-4 max-w-md rounded-xl border border-white/15 bg-black/35 px-6 py-5 backdrop-blur-md">
        <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">
          Far Country
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.6)]">
          The New Jerusalem
        </h1>
        <p className="mt-2 text-sm leading-snug text-white/75">
          A crystal step-mountain — twelve gates, twelve jewelled foundations,
          the throne of God at its summit.
        </p>
        <button
          type="button"
          onClick={() => {
            // Audio context must be created from a user gesture (autoplay policy).
            ambience.start();
            enterCity();
          }}
          className="mt-4 rounded-md bg-white/90 px-5 py-2 text-sm font-semibold text-black transition hover:bg-white"
        >
          Enter the city
        </button>
        <p className="mt-3 text-[11px] text-white/45">
          Revelation 21–22 · placeholder scale, not 12,000 stadia
        </p>
      </div>
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

function SoundToggle() {
  const [muted, setMuted] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !muted;
        setMuted(next);
        ambience.setMuted(next);
      }}
      className="pointer-events-auto absolute bottom-14 left-4 z-30 rounded-md border border-white/15 bg-black/35 px-3 py-1.5 text-xs text-white/70 backdrop-blur-md transition hover:bg-black/55 hover:text-white"
    >
      {muted ? "Sound off" : "Sound on"}
    </button>
  );
}
