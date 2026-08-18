/**
 * Wild-ring terrain — the walkable wilderness south of the Holy Allotment.
 *
 * DEFAULT: variant 3 "canyonlands" (Scott's pick, 2026-08-17, from the
 * five-framing still review in shots/wip/wildring/). `?wildring=1|2` keep
 * the other candidates bootable for A/B; `?wildring=0` restores the
 * pre-variant look (base hills only).
 *
 * WHY THIS EXISTS: makeMacroParams() authors its anchors in the wild demo
 * scenes' 4 km coordinates. The New Jerusalem scene runs a 12.3 km domain,
 * so those anchors all land inside ~±2.6 km — under the Holy Allotment
 * plateau, which composites LAST and overrides them. The walkable wild land
 * beyond the mesa rim was left with base hills only (~480 m maxH vs the
 * world scene's ~1860).
 *
 * GEOMETRY REALITY (rimModel.ts, ADR 0015): the Allotment footprint spans
 * x ±7600, z −11200..+4400 — it overruns the ±6144 detailed domain on the
 * north, east and west. The only walkable wilderness is therefore the
 * SOUTHERN BAND: z ≈ 4400 (rim lip) … 6144 (world edge), full 12.3 km wide —
 * an area comparable to the entire ?scene=world domain. Each variant fills
 * that band; massifs centered at/beyond the south edge continue seamlessly
 * into the analytic far shell (same math, same mp) as backdrop.
 *
 * BAND CONSTANTS (derived from RIM/RIM_CLIFF, wobble ±70):
 *   rim SDF 0 at z ≈ 4400 → wall foot ≈ 4570 → talus tail ends ≈ 5120.
 *   Valley spines stay z ≥ 5250 so the carve (+ warp ±100) clears the talus
 *   blend, which would otherwise override the carve near the wall.
 *
 * DRAINAGE LAWS (paid for in MacroMap): every valley spline runs THROUGH its
 * lake and off the map edge with monotonically descending floors; the global
 * tilt term drains the band toward the spine; lakes sit at floor ≈ 141
 * (LAKE_LEVEL 142) so shore cosmetics keyed to that level engage.
 *
 * KNOWN TRAIT (v3, surfaced at the pick): the karst walls trap a ~39 m deep
 * pocket lake at (2330, 5730), surface ≈ 514 m — kept deliberately as a
 * cenote-style karst lake nested in the towers. Drain it by routing a trib
 * branch through that pocket if it ever reads as flooding.
 *
 * Anchors are FIXED numbers (no seed jitter): the wired look must match the
 * stills the pick was made from.
 */

import type { MacroParams } from '../world/MacroMap';

export type WildRingVariant = 0 | 1 | 2 | 3;

/** Absent/invalid ?wildring → the wired default (3, canyonlands).
 *  NOTE Number(null) === 0: the absent case must be tested BEFORE coercion
 *  or a bare URL silently boots the legacy look. */
export function parseWildRing(q: URLSearchParams): WildRingVariant {
  const raw = q.get('wildring');
  if (raw === null) return 3;
  const n = Number(raw);
  return n === 0 || n === 1 || n === 2 || n === 3 ? n : 3;
}

/** Park the karst zone (and its tributary) far outside the domain: its mask
 *  falls to zero everywhere walkable, so no towers and no trib carve. */
function parkKarst(mp: MacroParams): void {
  mp.karstC = [10000, 10000];
  mp.karstR = 600;
  mp.trib = [
    [10300, 10200],
    [10100, 10100],
    [9800, 9900],
    [9500, 9700],
  ];
  mp.tribFloors = [300, 280, 260, 240];
  mp.tribWidth = 120;
}

export function applyWildRing(mp: MacroParams, v: WildRingVariant): void {
  if (v === 0) {
    return; // pre-variant look: anchors stay under the plateau override
  }
  if (v === 1) {
    // ---- 1 "ALPINE CROWN" ---------------------------------------------------
    // One grand massif SE beyond the world edge (peaks ~1600-1850 m at the
    // domain rim, flanks walkable a full kilometre in); a glacial valley
    // descends its west flank and runs the band westward into a big lake,
    // exiting the west edge.
    mp.alpC = [3600, 7000];
    mp.alpR = 3400;
    mp.valley = [
      [5300, 6050],
      [3900, 5700],
      [2100, 5450],
      [200, 5400],
      [-1900, 5550],
      [-3700, 5650],
      [-5200, 5750],
      [-6800, 5850],
    ];
    mp.valleyFloors = [640, 430, 300, 230, 180, 141, 132, 120];
    mp.valleyWidth = 380;
    mp.lakeC = [-3700, 5650];
    mp.lakeR = 540;
    parkKarst(mp);
    delete mp.alp2;
  } else if (v === 2) {
    // ---- 2 "TWIN RANGES & GORGE" -------------------------------------------
    // Two ranges — west and east — with a green vale between them; the river
    // gathers in the vale, pools in a lake, then breaks WEST THROUGH the
    // west range in a deep gorge to the map edge.
    mp.alpC = [-4700, 6800];
    mp.alpR = 2900;
    mp.alp2 = { c: [4900, 6600], r: 2600 };
    mp.valley = [
      [5700, 5900],
      [4100, 5500],
      [2300, 5350],
      [400, 5400],
      [-1300, 5500],
      [-2700, 5600],
      [-4300, 5800],
      [-5500, 5950],
      [-6800, 6050],
    ];
    mp.valleyFloors = [560, 380, 270, 210, 165, 141, 133, 126, 115];
    mp.valleyWidth = 340;
    mp.lakeC = [-2700, 5600];
    mp.lakeR = 480;
    parkKarst(mp);
  } else {
    // ---- 3 "CANYONLANDS" ----------------------------------------------------
    // Karst tablelands (base 380 m) with tower-walled ravines in the east of
    // the band; a narrow deep canyon carries the river west through them to
    // a small lake; a snowy backdrop range rises beyond the SW edge.
    mp.karstC = [2500, 5600];
    mp.karstR = 1150;
    mp.karstRot = 0.55;
    mp.trib = [
      [3800, 6100],
      [3000, 5750],
      [2300, 5450],
      [1300, 5350],
    ];
    mp.tribFloors = [320, 268, 222, 186];
    mp.tribWidth = 150;
    mp.valley = [
      [5900, 5800],
      [4300, 5450],
      [2900, 5300],
      [1300, 5350],
      [-500, 5450],
      [-2200, 5550],
      [-4000, 5700],
      [-6800, 5900],
    ];
    mp.valleyFloors = [420, 310, 240, 186, 162, 141, 130, 116];
    mp.valleyWidth = 260;
    mp.lakeC = [-2200, 5550];
    mp.lakeR = 400;
    mp.alpC = [-4300, 7400];
    mp.alpR = 2600;
    delete mp.alp2;
  }
}
