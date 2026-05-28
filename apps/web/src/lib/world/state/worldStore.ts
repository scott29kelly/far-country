import { create } from "zustand";

/**
 * Zustand store for the /world scene.
 *
 * The renderer is the producer (writes via setNearbyEntity from a useFrame
 * loop). The HUD is the consumer (subscribes via the hook). Keeping camera
 * position out of the store — every useFrame tick would re-render every
 * subscriber. Only POI entry/exit transitions are committed.
 */
export type WorldState = {
  nearbyEntitySlug: string | null;
  pointerLocked: boolean;
  /** Camera yaw in radians. 0 = facing -Z (north). Increases counter-clockwise from above. */
  cameraYaw: number;
  /** Bearing from camera to throne, in radians (same convention as cameraYaw). */
  throneBearing: number;
  setNearbyEntity: (slug: string | null) => void;
  setPointerLocked: (locked: boolean) => void;
  setCompass: (yaw: number, bearing: number) => void;
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

export const useWorldStore = create<WorldState>((set) => ({
  nearbyEntitySlug: null,
  pointerLocked: false,
  cameraYaw: 0,
  throneBearing: 0,
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
}));
