#!/bin/sh
# GA-3 round cams — the five canonical wild-ring framings, shot every round
# so critics always judge the same view (Claude-of-Duty deterministic-shot
# rule). Coordinate provenance: gate/aerial/lake from the 2026-08-17 pick
# review's redo-batch.sh (the FINAL coords the v3 verdict stills used);
# rim/valley from shoot-batch.sh (never re-shot, so those coords stand).
# Aerial takes --cov 0 (cloud cover off) per the original review.
# Usage (from apps/world-engine): sh tools/ga3-cams.sh <round-dir>
cd "$(dirname "$0")/.."
R="shots/wip/ga3/$1"
mkdir -p "$R"
npx tsx tools/shoot.ts --scene newjerusalem --cam "0,495,2900,3.1416,-0.05,60"    --out "$R/gate.png"
npx tsx tools/shoot.ts --scene newjerusalem --cam "600,510,4300,3.1416,-0.35,62"  --out "$R/rim.png"
npx tsx tools/shoot.ts --scene newjerusalem --cam "-2000,400,5500,-1.5708,-0.05,62" --out "$R/valley.png"
npx tsx tools/shoot.ts --scene newjerusalem --cam "0,3400,7600,0,-0.52,62"        --out "$R/aerial.png" --cov 0
npx tsx tools/shoot.ts --scene newjerusalem --cam "-1200,520,5100,1.9,-0.18,62"   --out "$R/lake.png"
# RimFalls cams — one per emergent site from probe-rimfalls (2026-08-19 scan,
# identical to the verify branch's: lips at x 339 / -1305 / -3561, z 4400,
# ~250 m drops). Eye stands in the band south of each foot, looking north.
npx tsx tools/shoot.ts --scene newjerusalem --cam "339,340,5000,0,0.05,55"    --out "$R/falls-e339.png"
npx tsx tools/shoot.ts --scene newjerusalem --cam "-1305,340,5000,0,0.05,55"  --out "$R/falls-w1305.png"
npx tsx tools/shoot.ts --scene newjerusalem --cam "-3561,340,5000,0,0.05,55"  --out "$R/falls-w3561.png"
