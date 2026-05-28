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
  setNearbyEntity: (slug: string | null) => void;
  setPointerLocked: (locked: boolean) => void;
};

export const useWorldStore = create<WorldState>((set) => ({
  nearbyEntitySlug: null,
  pointerLocked: false,
  setNearbyEntity: (slug) =>
    set((s) => (s.nearbyEntitySlug === slug ? s : { nearbyEntitySlug: slug })),
  setPointerLocked: (locked) => set({ pointerLocked: locked }),
}));
