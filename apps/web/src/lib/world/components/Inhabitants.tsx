"use client";

/**
 * The inhabitants of the city — the great multitude and the angelic hosts.
 *
 * Citations:
 *   - Rev 7:9 — "a great multitude that no one could number, from every nation,
 *     from all tribes and peoples and languages, standing before the throne and
 *     before the Lamb, clothed in white robes."
 *   - Rev 5:11 — "the voice of many angels, numbering myriads of myriads and
 *     thousands of thousands, around the throne."
 *
 * Aniconic policy (ADR 0010) governs the DIVINE persons only — the throne is
 * abstract light. The redeemed and the angels are creatures, so they may be
 * shown; but they are rendered REVERENTLY and WITHOUT invented iconography:
 * the multitude as simplified white-robed luminous figures with NO facial or
 * identity detail (the "every nation" diversity is implied, not depicted as
 * specific features), and the hosts as abstract vertical beings of light rather
 * than winged figures (Scripture does not fix the hosts' appearance here, so we
 * do not invent it). See RENDERING-DECISIONS.md entry #3.
 *
 * Performance: the multitude is two InstancedMeshes (robe + head sharing one
 * transform set) so hundreds of figures cost ~two draw calls — enough to read
 * as an uncountable throng without a per-figure scene-graph cost.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  type Group,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import { CITY_HALF } from "../data/points-of-interest";
import { halfAtLevel, PYRAMID, SUMMIT_Y, topYAtLevel } from "../data/world-geometry";

/** Deterministic PRNG so the throng is stable frame-to-frame and on resume. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MULTITUDE = 760;
const ROBE_H = 1.5;
const HEAD_R = 0.17;

type Placement = { x: number; y: number; z: number; s: number; warm: number };

/**
 * Place the multitude: most fill the street-of-gold plaza ring before the
 * mountain (a great assembly looking up to the throne), the rest stand on the
 * lower terrace courses ascending toward the summit.
 */
function useMultitude(): Placement[] {
  return useMemo(() => {
    const r = mulberry32(0x6a17c0de);
    const out: Placement[] = [];
    const wallLim = CITY_HALF - 4;
    let guard = 0;
    while (out.length < MULTITUDE && guard < MULTITUDE * 40) {
      guard++;
      const onTerrace = r() < 0.26;
      let x: number;
      let y: number;
      let z: number;
      if (onTerrace) {
        // Stand on a lower/middle terrace's walkable ring.
        const lvl = 1 + Math.floor(r() * (PYRAMID.steps - 2));
        const outer = halfAtLevel(lvl) - 1.5;
        const inner = halfAtLevel(lvl + 1) + 1.5;
        if (outer <= inner) continue;
        const rr = inner + r() * (outer - inner);
        // Square ring: pick a side, then a position along it at radius rr.
        const along = (r() * 2 - 1) * rr;
        if (r() < 0.5) {
          x = along;
          z = (r() < 0.5 ? -1 : 1) * rr;
        } else {
          x = (r() < 0.5 ? -1 : 1) * rr;
          z = along;
        }
        y = topYAtLevel(lvl);
      } else {
        // Plaza ring between the mountain foot and the walls.
        x = (r() * 2 - 1) * wallLim;
        z = (r() * 2 - 1) * wallLim;
        const m = Math.max(Math.abs(x), Math.abs(z));
        if (m < PYRAMID.baseHalf + 1.5 || m > wallLim) continue; // off the mountain, inside walls
        y = 0;
      }
      out.push({
        x,
        y,
        z,
        s: 0.86 + r() * 0.3,
        warm: r() * 0.4, // 0..0.4 toward warm white
      });
    }
    return out;
  }, []);
}

export function Inhabitants() {
  const placements = useMultitude();
  const robes = useRef<InstancedMesh>(null!);
  const heads = useRef<InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    const robeCol = new Color();
    const skin = new Color();
    placements.forEach((p, i) => {
      // Robe.
      pos.set(p.x, p.y + (ROBE_H * p.s) / 2, p.z);
      scl.set(p.s, p.s, p.s);
      m.compose(pos, quat, scl);
      robes.current.setMatrixAt(i, m);
      robeCol.setRGB(1, 1 - p.warm * 0.06, 1 - p.warm * 0.16); // white -> warm white
      robes.current.setColorAt(i, robeCol);
      // Head (sits atop the robe).
      pos.set(p.x, p.y + ROBE_H * p.s + HEAD_R * p.s * 0.4, p.z);
      m.compose(pos, quat, scl);
      heads.current.setMatrixAt(i, m);
      // A whisper of skin-tone variety for the "every nation" throng — kept
      // subtle and non-identifying (no features, just a warm range).
      const tone = 0.55 + p.warm * 0.8;
      skin.setRGB(tone, tone * 0.82, tone * 0.7);
      heads.current.setColorAt(i, skin);
    });
    robes.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    if (robes.current.instanceColor) robes.current.instanceColor.needsUpdate = true;
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [placements]);

  return (
    <group>
      {/* Robes — a tapering cone reads as a standing robed figure at distance. */}
      <instancedMesh ref={robes} args={[undefined, undefined, MULTITUDE]} castShadow>
        <coneGeometry args={[0.34, ROBE_H, 7]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.62}
          metalness={0}
          emissive="#fff3e2"
          emissiveIntensity={0.22}
        />
      </instancedMesh>
      {/* Heads — small spheres, no features. */}
      <instancedMesh ref={heads} args={[undefined, undefined, MULTITUDE]}>
        <sphereGeometry args={[HEAD_R, 10, 8]} />
        <meshStandardMaterial color="#d9b79a" roughness={0.7} metalness={0} />
      </instancedMesh>

      <AngelicHosts />
    </group>
  );
}

const HOST_COUNT = 40;

/**
 * The angelic hosts "around the throne" (Rev 5:11) — abstract vertical beings
 * of light ringing the summit, slowly rising and falling. No wings or figures
 * (not fixed by the text here); rendered as luminous forms only.
 */
function AngelicHosts() {
  const group = useRef<Group>(null!);
  const hosts = useMemo(() => {
    const r = mulberry32(0x12345);
    return Array.from({ length: HOST_COUNT }, (_, i) => {
      const ang = (i / HOST_COUNT) * Math.PI * 2 + r() * 0.1;
      const ring = 24 + r() * 14;
      return {
        x: Math.cos(ang) * ring,
        z: Math.sin(ang) * ring,
        baseY: SUMMIT_Y - 2 + r() * 26,
        bob: 1.5 + r() * 2.5,
        phase: r() * Math.PI * 2,
        scale: 0.7 + r() * 0.7,
      };
    });
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    group.current.children.forEach((child, i) => {
      const h = hosts[i];
      child.position.y = h.baseY + Math.sin(t * 0.5 + h.phase) * h.bob;
    });
  });

  return (
    <group ref={group}>
      {hosts.map((h, i) => (
        <mesh key={i} position={[h.x, h.baseY, h.z]} scale={[h.scale, h.scale, h.scale]}>
          {/* A soft vertical ovoid of light. */}
          <capsuleGeometry args={[0.8, 3.2, 6, 12]} />
          <meshBasicMaterial color="#fff0c8" transparent opacity={0.42} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
