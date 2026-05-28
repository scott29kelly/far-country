"use client";

import { useWorldStore } from "../state/worldStore";

/**
 * Top-right compass HUD.
 *
 * Angle convention (matches Scene.tsx ProximityWatcher):
 *   - 0 radians = facing world north (-Z direction)
 *   - positive = clockwise viewed from above (like a real compass bearing)
 *
 * Ring rotates by `-yaw` so world-N stays world-N on screen. The throne
 * pointer rotates by `throneBearing - yaw` so it points to where the
 * throne is relative to the camera's view (0 = straight ahead).
 */
export function Compass() {
  const yaw = useWorldStore((s) => s.cameraYaw);
  const throneBearing = useWorldStore((s) => s.throneBearing);

  const ringRotDeg = (-yaw * 180) / Math.PI;
  const arrowRotDeg = ((throneBearing - yaw) * 180) / Math.PI;

  return (
    <div className="pointer-events-none fixed right-4 top-20 z-10 select-none">
      <div className="relative h-24 w-24">
        {/* Background plate */}
        <div className="absolute inset-0 rounded-full border border-(--color-border) bg-(--color-card)/85 shadow-md backdrop-blur-sm" />

        {/* Rotating cardinal ring */}
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${ringRotDeg}deg)` }}
        >
          <Cardinal label="N" angleDeg={0} color="text-(--color-tier-debated)" />
          <Cardinal label="E" angleDeg={90} />
          <Cardinal label="S" angleDeg={180} />
          <Cardinal label="W" angleDeg={270} />
        </div>

        {/* Throne pointer — rotates with view-relative bearing */}
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${arrowRotDeg}deg)` }}
        >
          <div
            className="absolute left-1/2 top-1.5 -translate-x-1/2"
            aria-label="Direction to throne"
          >
            <ThroneArrow />
          </div>
        </div>

        {/* Center dot */}
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--color-fg-muted)" />
      </div>
      <p className="mt-1 text-center text-[10px] uppercase tracking-wider text-(--color-fg-muted)">
        throne
      </p>
    </div>
  );
}

function Cardinal({
  label,
  angleDeg,
  color,
}: {
  label: string;
  angleDeg: number;
  color?: string;
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2"
      style={{ transform: `translate(-50%, -50%) rotate(${angleDeg}deg)` }}
    >
      <span
        className={`absolute left-1/2 top-1 -translate-x-1/2 text-[11px] font-semibold ${color ?? "text-(--color-fg-muted)"}`}
        style={{ transform: `translate(-50%, 0) rotate(${-angleDeg}deg)` }}
      >
        {label}
      </span>
    </div>
  );
}

function ThroneArrow() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" aria-hidden>
      <path
        d="M5 0 L10 10 L5 7 L0 10 Z"
        fill="var(--color-tier-symbolic)"
        stroke="var(--color-fg)"
        strokeWidth="0.5"
      />
    </svg>
  );
}
