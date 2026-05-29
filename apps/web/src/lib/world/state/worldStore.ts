import { create } from "zustand";

/**
 * Zustand store for the /world scene.
 *
 * The renderer is the producer (writes via setNearbyEntity / setCompass /
 * setCameraPos from the throttled proximity loop). The HUD and MiniMap are the
 * consumers. Camera position is committed only in coarse buckets so the
 * MiniMap re-renders a few times a second, not 60×.
 *
 * Teleport is a one-shot request: the MiniMap sets `teleportTo`, the controls
 * loop consumes it on the next frame and clears it.
 */
export type Teleport = { x: number; y: number; z: number };

/**
 * Intro flow:
 *   - `intro`    — elevated cinematic orbit of the mountain behind a title card.
 *   - `entering` — smooth fly-in tween from the orbit down to the plaza spawn.
 *   - `active`   — normal first-person exploration (controls + HUD mounted).
 */
export type WorldPhase = "intro" | "entering" | "active";

export type WorldState = {
  phase: WorldPhase;
  nearbyEntitySlug: string | null;
  pointerLocked: boolean;
  /** Camera yaw in radians. 0 = facing -Z (north). Increases counter-clockwise from above. */
  cameraYaw: number;
  /** Bearing from camera to throne, in radians (same convention as cameraYaw). */
  throneBearing: number;
  /** Coarse-bucketed camera X/Z for the mini-map marker. */
  cameraX: number;
  cameraZ: number;
  /** Pending teleport request, consumed and cleared by the controls loop. */
  teleportTo: Teleport | null;
  /** intro → entering (begin the fly-in). */
  enterCity: () => void;
  /** entering → active (fly-in complete, hand over to first-person controls). */
  activate: () => void;
  setNearbyEntity: (slug: string | null) => void;
  setPointerLocked: (locked: boolean) => void;
  setCompass: (yaw: number, bearing: number) => void;
  setCameraPos: (x: number, z: number) => void;
  requestTeleport: (t: Teleport) => void;
  clearTeleport: () => void;
};

/**
 * Compass values are rounded to ~3-degree buckets before triggering a
 * re-render. Otherwise every frame's tiny float jitter would re-render
 * the HUD at 60Hz.
 */
const COMPASS_BUCKET = (Math.PI / 180) * 3;

function bucketed(v: number): number {
  return Math.round(v / COMPASS_BUCKET) * COMPASS_BUCKET;
}

/** Camera position is bucketed to whole metres for the mini-map. */
function bucketMetres(v: number): number {
  return Math.round(v);
}

export const useWorldStore = create<WorldState>((set) => ({
  phase: "intro",
  nearbyEntitySlug: null,
  pointerLocked: false,
  cameraYaw: 0,
  throneBearing: 0,
  cameraX: 0,
  cameraZ: 0,
  teleportTo: null,
  enterCity: () => set((s) => (s.phase === "intro" ? { phase: "entering" } : s)),
  activate: () => set((s) => (s.phase === "active" ? s : { phase: "active" })),
  setNearbyEntity: (slug) =>
    set((s) => (s.nearbyEntitySlug === slug ? s : { nearbyEntitySlug: slug })),
  setPointerLocked: (locked) => set({ pointerLocked: locked }),
  setCompass: (yaw, bearing) =>
    set((s) => {
      const y = bucketed(yaw);
      const b = bucketed(bearing);
      if (s.cameraYaw === y && s.throneBearing === b) return s;
      return { cameraYaw: y, throneBearing: b };
    }),
  setCameraPos: (x, z) =>
    set((s) => {
      const bx = bucketMetres(x);
      const bz = bucketMetres(z);
      if (s.cameraX === bx && s.cameraZ === bz) return s;
      return { cameraX: bx, cameraZ: bz };
    }),
  requestTeleport: (t) => set({ teleportTo: t }),
  clearTeleport: () => set((s) => (s.teleportTo === null ? s : { teleportTo: null })),
}));
