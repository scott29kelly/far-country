"use client";

/**
 * The inhabitants of the city — the great multitude and the angelic hosts.
 *
 * Citations:
 *   - Rev 7:9 — "a great multitude that no one could number, from every nation,
 *     from all tribes and peoples and languages, standing before the throne and
 *     before the Lamb, clothed in white robes, with palm branches in their
 *     hands."
 *   - Rev 5:11 — "the voice of many angels, numbering myriads of myriads and
 *     thousands of thousands, around the throne."
 *
 * Aniconic policy (ADR 0010) governs the DIVINE persons only — the throne is
 * abstract light. The redeemed and the angels are creatures, so they may be
 * shown; but they are rendered REVERENTLY and WITHOUT invented iconography: the
 * multitude as simplified white-robed figures with NO facial or identity detail
 * (the "every nation" diversity is implied by subtle tone variation, not
 * depicted as specific features), each holding a raised palm branch (Rev 7:9),
 * and the hosts as abstract vertical beings of light. See RENDERING-DECISIONS
 * entry #3.
 *
 * Performance: the multitude is three InstancedMeshes (robe + head + palm
 * sharing one transform set) so hundreds of figures cost ~three draw calls.
 */
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Color,
  Euler,
  type Group,
  type InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from "three";

import { CITY_HALF } from "../data/points-of-interest";
import { halfAtLevel, PYRAMID, SUMMIT_Y, topYAtLevel } from "../data/world-geometry";

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
const HEAD_R = 0.15;
const PALM_H = 1.1;

type Placement = {
  x: number;
  y: number;
  z: number;
  s: number;
  warm: number;
  tiltX: number;
  tiltZ: number;
};

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
        const lvl = 1 + Math.floor(r() * (PYRAMID.steps - 2));
        const outer = halfAtLevel(lvl) - 1.5;
        const inner = halfAtLevel(lvl + 1) + 1.5;
        if (outer <= inner) continue;
        const rr = inner + r() * (outer - inner);
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
        x = (r() * 2 - 1) * wallLim;
        z = (r() * 2 - 1) * wallLim;
        const m = Math.max(Math.abs(x), Math.abs(z));
        if (m < PYRAMID.baseHalf + 1.5 || m > wallLim) continue;
        y = 0;
      }
      out.push({
        x,
        y,
        z,
        s: 0.86 + r() * 0.3,
        warm: r() * 0.4,
        tiltX: (r() * 2 - 1) * 0.22,
        tiltZ: (r() * 2 - 1) * 0.22,
      });
    }
    return out;
  }, []);
}

export function Inhabitants() {
  const placements = useMultitude();
  const robes = useRef<InstancedMesh>(null!);
  const heads = useRef<InstancedMesh>(null!);
  const palms = useRef<InstancedMesh>(null!);

  useLayoutEffect(() => {
    const m = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const faceQuat = new Quaternion();
    const eul = new Euler();
    const scl = new Vector3();
    const robeCol = new Color();
    const skin = new Color();
    const up = new Vector3(0, 1, 0);
    placements.forEach((p, i) => {
      const s = p.s;
      // Face the throne (the city axis) so the assembly turns toward it.
      const yaw = Math.atan2(-p.x, -p.z);
      faceQuat.setFromAxisAngle(up, yaw);
      scl.set(s, s, s);

      // Robe.
      pos.set(p.x, p.y + (ROBE_H * s) / 2, p.z);
      m.compose(pos, faceQuat, scl);
      robes.current.setMatrixAt(i, m);
      robeCol.setRGB(1, 1 - p.warm * 0.06, 1 - p.warm * 0.16);
      robes.current.setColorAt(i, robeCol);

      // Head (small, low, no features).
      pos.set(p.x, p.y + ROBE_H * s + HEAD_R * s * 0.3, p.z);
      m.compose(pos, faceQuat, scl);
      heads.current.setMatrixAt(i, m);
      const tone = 0.5 + p.warm * 0.6;
      skin.setRGB(tone, tone * 0.85, tone * 0.74);
      heads.current.setColorAt(i, skin);

      // Raised palm branch, offset to the throne-facing side, slightly varied.
      const len = Math.hypot(p.x, p.z) || 1;
      const ox = (-p.x / len) * 0.3 * s;
      const oz = (-p.z / len) * 0.3 * s;
      pos.set(p.x + ox, p.y + ROBE_H * s * 0.62 + (PALM_H * s) / 2, p.z + oz);
      eul.set(p.tiltX, yaw, p.tiltZ);
      quat.setFromEuler(eul);
      m.compose(pos, quat, scl);
      palms.current.setMatrixAt(i, m);
    });
    robes.current.instanceMatrix.needsUpdate = true;
    heads.current.instanceMatrix.needsUpdate = true;
    palms.current.instanceMatrix.needsUpdate = true;
    if (robes.current.instanceColor) robes.current.instanceColor.needsUpdate = true;
    if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, [placements]);

  return (
    <group>
      {/* Robes — a tapering cone reads as a standing robed figure. */}
      <instancedMesh ref={robes} args={[undefined, undefined, MULTITUDE]} castShadow>
        <coneGeometry args={[0.3, ROBE_H, 8]} />
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
        <meshStandardMaterial color="#cdb19a" roughness={0.72} metalness={0} />
      </instancedMesh>
      {/* Palm branches (Rev 7:9) — a thin green frond, raised. */}
      <instancedMesh ref={palms} args={[undefined, undefined, MULTITUDE]}>
        <coneGeometry args={[0.07, PALM_H, 5]} />
        <meshStandardMaterial
          color="#4f9a3c"
          roughness={0.55}
          metalness={0}
          emissive="#2a4a1e"
          emissiveIntensity={0.25}
        />
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
        <group key={i} position={[h.x, h.baseY, h.z]} scale={[h.scale, h.scale, h.scale]}>
          <mesh>
            <capsuleGeometry args={[0.32, 5.0, 6, 12]} />
            <meshBasicMaterial color="#fff7e6" transparent opacity={0.55} toneMapped={false} />
          </mesh>
          <mesh>
            <capsuleGeometry args={[0.85, 6.2, 6, 12]} />
            <meshBasicMaterial color="#ffe9c0" transparent opacity={0.16} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
