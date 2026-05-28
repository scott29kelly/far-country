"use client";

import { BackSide } from "three";

/**
 * "No sun, no moon, no night" sky. Rev 21:23 — "And the city has no need
 * of sun or moon to shine on it, for the glory of God gives it light";
 * Rev 22:5 — "And night will be no more. They will need no light of lamp
 * or sun."
 *
 * Implementation: a large inverted sphere with a warm, even glow — no sun
 * disc, no moon, no stars. Just luminous warmth. Lighting in the scene
 * comes from a hemisphere light + the throne's point light (which is
 * theologically the actual light source).
 */
export function Skybox() {
  return (
    <mesh>
      <sphereGeometry args={[800, 32, 16]} />
      <meshBasicMaterial color="#f9e8c8" side={BackSide} fog={false} />
    </mesh>
  );
}
