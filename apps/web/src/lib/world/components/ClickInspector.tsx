"use client";

/**
 * Click-to-inspect. Aim the crosshair at any element — a gate, a foundation
 * gem, a tree, the throne — and click to PIN its descriptor + citation in the
 * HUD (it stays until you unpin, unlike the proximity readout). This turns the
 * beauty into a teaching surface: every element footnotes itself on demand.
 *
 * Implementation: on a canvas click we raycast from screen centre (the
 * crosshair) and find the nearest point-of-interest to the hit point, then pin
 * that entity. Reusing POIS means no per-mesh tagging is needed; aiming at the
 * mountain body (no specific POI) falls back to the city itself.
 */
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Vector2 } from "three";

import { POIS } from "../data/points-of-interest";
import { useWorldStore } from "../state/worldStore";

const CENTER = new Vector2(0, 0);

export function ClickInspector() {
  const camera = useThree((s) => s.camera);
  const scene = useThree((s) => s.scene);
  const raycaster = useThree((s) => s.raycaster);
  const gl = useThree((s) => s.gl);
  const setPinned = useWorldStore((s) => s.setPinnedEntity);

  useEffect(() => {
    const el = gl.domElement;
    const onClick = () => {
      raycaster.setFromCamera(CENTER, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const hit = hits.find((h) => h.distance > 0.4 && h.object.visible);
      if (!hit) return;
      const p = hit.point;
      let best: string | null = null;
      let bestScore = Infinity;
      for (const poi of POIS) {
        if (poi.global) continue;
        const dx = poi.position[0] - p.x;
        const dy = poi.position[1] - p.y;
        const dz = poi.position[2] - p.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        const tol = poi.radius * 2.2;
        if (d2 < bestScore && d2 <= tol * tol) {
          bestScore = d2;
          best = poi.slug;
        }
      }
      // Fall back to the city itself when nothing specific was aimed at.
      setPinned(best ?? "new-jerusalem");
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [camera, scene, raycaster, gl, setPinned]);

  return null;
}
