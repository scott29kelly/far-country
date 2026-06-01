"use client";

import { useMemo } from "react";
import { BackSide, Color, ShaderMaterial } from "three";

/**
 * "No sun, no moon, no night" sky. Rev 21:23 — "And the city has no need
 * of sun or moon to shine on it, for the glory of God gives it light";
 * Rev 22:5 — "And night will be no more."
 *
 * Implementation: a large inverted sphere with a warm vertical gradient and a
 * bright, sourceless horizon glow — no sun disc, no moon, no stars. The glow
 * band sits just above the horizon all around, so light reads as ambient and
 * directionless (the glory, not a sun), and it is bright enough for the bloom
 * pass to catch, giving the sky luminous depth instead of a flat fill.
 *
 * Lighting in the scene comes from the environment + the throne's point light
 * (which is theologically the actual light source).
 */
const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vDir;
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uGlow;
  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);
    // Base vertical gradient: warm horizon up to a deeper, calmer high sky.
    vec3 col = mix(uHorizon, uZenith, smoothstep(-0.05, 0.6, h));
    // Sourceless glory band hugging the horizon (peaks just above it).
    float band = exp(-pow((h - 0.03) * 7.0, 2.0));
    col += uGlow * band * 0.28;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Skybox() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uHorizon: { value: new Color("#f4dca0") },
          uZenith: { value: new Color("#8c7a5a") },
          uGlow: { value: new Color("#ffeec0") },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [],
  );

  return (
    <mesh material={material} frustumCulled={false}>
      <sphereGeometry args={[800, 48, 24]} />
    </mesh>
  );
}
