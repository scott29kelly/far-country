/** Frame-content gate: decode a captured PNG and refuse frames that are
 *  structurally valid but visually empty. A screenshot pipeline that never
 *  looks at its own pixels will happily deliver an all-black frame with a
 *  cheerful "wrote ..." — the exact failure the F1-film render farm shipped
 *  (structurally perfect PNG, mean 0.0: "every check verified the file was
 *  intact; nothing looked at the picture"). See DEFECTS.md FC-0004; this
 *  machine's GPU history (Code 43, createBuffer boot failures) makes the
 *  black-frame case live, not theoretical.
 *
 *  Threshold provenance: conservative PHYSICAL bounds, not tuned from any
 *  particular still — a tonemapped render of a lit scene cannot be uniformly
 *  near-0 or near-255, and any real framing has nonzero contrast. They are
 *  deliberately loose so they can only catch empty/flat frames, never a dark
 *  but real one (night sky stills measure mean well above 2.5 with stars and
 *  atmosphere). GA-2 may tighten them from the known-good reference set —
 *  record the derivation here if so; do NOT tune them from the first frame
 *  the gate happens to reject (that is calibrating the instrument against
 *  the artefact it judges).
 *
 *  Bypass for deliberately-empty captures: SHOOT_ALLOW_BLANK=1 env var —
 *  the verdict is still printed, the file is kept un-renamed, exit stays 0.
 */

import { renameSync } from 'node:fs';
import sharp from 'sharp';

export interface FrameVerdict {
  ok: boolean;
  reason: string;
  mean: number;
  maxStdev: number;
}

const MEAN_BLACK = 2.5; // 0..255; uniformly darker than any lit render
const MEAN_WHITE = 252.5; // uniformly brighter than any tonemapped render
const STDEV_FLAT = 1.5; // max per-channel stdev below this = one flat color

export async function inspectFrame(path: string): Promise<FrameVerdict> {
  const st = await sharp(path).stats();
  const rgb = st.channels.slice(0, 3);
  const mean = rgb.reduce((a, c) => a + c.mean, 0) / rgb.length;
  const maxStdev = Math.max(...rgb.map((c) => c.stdev));
  if (mean < MEAN_BLACK) return { ok: false, reason: `all-black (mean ${mean.toFixed(2)})`, mean, maxStdev };
  if (mean > MEAN_WHITE) return { ok: false, reason: `all-white (mean ${mean.toFixed(2)})`, mean, maxStdev };
  if (maxStdev < STDEV_FLAT)
    return { ok: false, reason: `flat frame (max channel stdev ${maxStdev.toFixed(2)})`, mean, maxStdev };
  return { ok: true, reason: `content present (mean ${mean.toFixed(1)}, stdev ${maxStdev.toFixed(1)})`, mean, maxStdev };
}

/** Gate one captured frame. On failure: renames it to *-SUSPECT.png so a
 *  later step cannot mistake it for a delivered still, and returns false
 *  (caller decides the exit code). SHOOT_ALLOW_BLANK=1 downgrades to a
 *  warning. */
export async function gateFrame(path: string, label = 'framegate'): Promise<boolean> {
  const v = await inspectFrame(path);
  if (v.ok) {
    console.log(`[${label}] ${path}: ${v.reason}`);
    return true;
  }
  if (process.env['SHOOT_ALLOW_BLANK'] === '1') {
    console.warn(`[${label}] ${path}: ${v.reason} — allowed by SHOOT_ALLOW_BLANK=1`);
    return true;
  }
  const suspect = path.replace(/\.png$/i, '-SUSPECT.png');
  renameSync(path, suspect);
  console.error(`[${label}] SUSPECT FRAME: ${v.reason} — renamed to ${suspect}`);
  return false;
}
