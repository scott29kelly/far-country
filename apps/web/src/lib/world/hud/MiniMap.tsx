"use client";

/**
 * Top-down mini-map of the pyramid-city.
 *
 * Shows the nested terrace contours (the step pyramid seen from above), the
 * twelve gates, the summit throne, and the two trees of life, plus a live
 * player marker. Every landmark is click-to-teleport: clicking requests a
 * teleport (consumed by FirstPersonControls), dropping the camera onto the
 * terrain at that spot.
 *
 * Screen mapping: world +X → right, world +Z → down (south). World north (-Z)
 * is therefore up, matching the compass.
 */
import {
  CITY_HALF,
  GATES,
  SIDE_COMPASS,
  SUMMIT_Y,
  type GateDef,
} from "../data/points-of-interest";
import { groundHeightAt, TERRACES, TREE_POSITIONS } from "../data/world-geometry";
import { useWorldStore } from "../state/worldStore";

const SIZE = 168;
const PAD = 8;
const SPAN = 2 * CITY_HALF;
const SCALE = (SIZE - PAD * 2) / SPAN;
const EYE = 1.6;

/** Map world X → svg x. */
function sx(x: number): number {
  return PAD + (x + CITY_HALF) * SCALE;
}
/** Map world Z → svg y. */
function sy(z: number): number {
  return PAD + (z + CITY_HALF) * SCALE;
}

/**
 * Teleport target a few metres inside the wall from a gate. Kept under the
 * ~11.7m plaza ring so the player lands on the base plaza (y=0), not up on the
 * first 12m terrace step (whose south rim is at z≈88).
 */
function gateTarget(gate: GateDef): { x: number; y: number; z: number } {
  const inset = 7;
  const [x, , z] = gate.position;
  let tx = x;
  let tz = z;
  if (gate.side === "north") tz = z + inset;
  else if (gate.side === "south") tz = z - inset;
  else if (gate.side === "east") tx = x - inset;
  else tx = x + inset;
  return { x: tx, y: groundHeightAt(tx, tz) + EYE, z: tz };
}

export function MiniMap() {
  const cameraX = useWorldStore((s) => s.cameraX);
  const cameraZ = useWorldStore((s) => s.cameraZ);
  const requestTeleport = useWorldStore((s) => s.requestTeleport);

  return (
    <div className="pointer-events-none fixed left-4 top-20 z-10 select-none">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="pointer-events-auto rounded-lg border border-(--color-border) bg-(--color-card)/85 shadow-md backdrop-blur-sm"
      >
        {/* Terrace contours, base (outermost) first. */}
        {[CITY_HALF, ...TERRACES.map((t) => t.half)].map((half, i) => (
          <rect
            key={i}
            x={sx(-half)}
            y={sy(-half)}
            width={half * 2 * SCALE}
            height={half * 2 * SCALE}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={i === 0 ? 1.4 : 0.7}
            opacity={i === 0 ? 0.9 : 0.5}
          />
        ))}

        {/* Gates — click to teleport just inside that gate. */}
        {GATES.map((gate) => {
          const t = gateTarget(gate);
          return (
            <g key={`${gate.side}-${gate.tribe}`}>
              <title>{`${gate.tribe} Gate (${SIDE_COMPASS[gate.side]})`}</title>
              <circle
                cx={sx(gate.position[0])}
                cy={sy(gate.position[2])}
                r={3.2}
                fill="var(--color-tier-symbolic)"
                stroke="var(--color-fg)"
                strokeWidth={0.5}
                style={{ cursor: "pointer" }}
                onClick={() => requestTeleport(t)}
              />
            </g>
          );
        })}

        {/* Trees of life. */}
        {TREE_POSITIONS.map(([tx, tz], i) => (
          <circle
            key={`tree-${i}`}
            cx={sx(tx)}
            cy={sy(tz)}
            r={2.4}
            fill="var(--color-tier-clear)"
            style={{ cursor: "pointer" }}
            onClick={() =>
              requestTeleport({ x: tx, y: groundHeightAt(tx, tz) + EYE, z: tz + 3 })
            }
          >
            <title>Tree of Life</title>
          </circle>
        ))}

        {/* Summit throne — diamond at the centre. */}
        <rect
          x={sx(0) - 4}
          y={sy(0) - 4}
          width={8}
          height={8}
          transform={`rotate(45 ${sx(0)} ${sy(0)})`}
          fill="#fff1c8"
          stroke="var(--color-fg)"
          strokeWidth={0.6}
          style={{ cursor: "pointer" }}
          onClick={() => requestTeleport({ x: 0, y: SUMMIT_Y + EYE, z: 13 })}
        >
          <title>Summit — Throne</title>
        </rect>

        {/* Player marker. */}
        <circle
          cx={sx(cameraX)}
          cy={sy(cameraZ)}
          r={2.6}
          fill="#ffffff"
          stroke="#000"
          strokeWidth={0.6}
        />

        {/* Cardinal letter — N at top. */}
        <text
          x={SIZE / 2}
          y={PAD + 7}
          textAnchor="middle"
          className="fill-(--color-tier-debated)"
          style={{ fontSize: 9, fontWeight: 600 }}
        >
          N
        </text>
      </svg>
    </div>
  );
}
