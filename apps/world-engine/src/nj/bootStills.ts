/**
 * Boot-rite stills manifest — self-produced captures of THIS engine's output
 * (ADR 0019). Regenerate via `npx tsx tools/regen-boot-stills.ts` whenever
 * the world's look materially changes: the rite must show the CURRENT world.
 *
 * Imported statically by core/BootUI, but the JPEG fetches only happen when
 * the rite actually presents a still (background-image set at runtime), so
 * wild-scene boots never load New Jerusalem imagery.
 */

import still1 from './boot-stills/still-1-spawn-hero.jpg';
import still2 from './boot-stills/still-2-south-establishing.jpg';
import still3 from './boot-stills/still-3-gate-level.jpg';
import still4 from './boot-stills/still-4-summit.jpg';
import still5 from './boot-stills/still-5-temple-wide.jpg';
import still6 from './boot-stills/still-6-campus-aerial.jpg';

export interface BootStill {
  url: string;
  /** small descriptive label, same voice as the stage lines */
  caption: string;
}

/** Presentation order: approach the city, rise to the crown, then north to
 *  the sanctuary and the dwellings — the walk the user is about to take. */
export const BOOT_STILLS: BootStill[] = [
  { url: still1, caption: 'the meadow before the city' },
  { url: still2, caption: 'the city on the holy allotment' },
  { url: still3, caption: 'the gates of the south wall' },
  { url: still4, caption: 'the crown of the mountain' },
  { url: still5, caption: 'the sanctuary on the north plain' },
  { url: still6, caption: 'the courts of the priests' },
];
