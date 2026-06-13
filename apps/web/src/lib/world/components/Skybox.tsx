"use client";

import { useMemo } from "react";
import { BackSide, Color, ShaderMaterial } from "three";

/**
 * "No sun, no moon, no night" sky. Rev 21:23 — "And the city has no need
 * of sun or moon to shine on it, for the glory of God gives it light";
 * Rev 22:5 — "And night will be no more."
 *
 * Implementation: a large inverted sphere with a multi-stop vertical gradient
 * (luminous warm horizon → amber mid-sky → a calm, faintly cool high sky for
 * tonal contrast) plus a bright, sourceless glory band hugging the horizon and
 * a soft overhead radiance. No sun disc, no moon, no stars. The glow is bright
 * enough for the bloom pass to catch, giving the sky luminous depth rather than
 * a flat fill, and a little ordered dither kills the gradient banding that
 * 8-bit framebuffers show on smooth skies.
 *
 * Lighting in the scene comes from the environment + the throne's glory (which
 * is theologically the actual light source).
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
  uniform vec3 uMid;
  uniform vec3 uZenith;
  uniform vec3 uGlow;

  // Cheap ordered dither to break up 8-bit gradient banding.
  float dither(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  }

  void main() {
    float h = clamp(vDir.y, -1.0, 1.0);

    // Two-segment vertical gradient: warm luminous horizon up through an amber
    // mid-sky into a calmer, slightly cool high sky.
    vec3 lower = mix(uHorizon, uMid, smoothstep(-0.04, 0.32, h));
    vec3 col = mix(lower, uZenith, smoothstep(0.28, 0.92, h));

    // Sourceless glory band hugging the horizon (peaks just above it).
    float band = exp(-pow((h - 0.025) * 6.5, 2.0));
    col += uGlow * band * 0.26;

    // Soft overhead radiance so the dome above the city glows faintly rather
    // than darkening — light is everywhere, with no single source.
    float crown = smoothstep(0.55, 1.0, h);
    col += uGlow * crown * 0.06;

    // Dither (±1.5/255) to defeat banding on the smooth gradient.
    col += dither(gl_FragCoord.xy) * (1.5 / 255.0);

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
          uHorizon: { value: new Color("#ffe0a2") },
          uMid: { value: new Color("#d9a558") },
          uZenith: { value: new Color("#5c5e74") },
          uGlow: { value: new Color("#fff3d2") },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [],
  );

  return (
    <mesh material={material} frustumCulled={false}>
      <sphereGeometry args={[800, 64, 32]} />
    </mesh>
  );
}
