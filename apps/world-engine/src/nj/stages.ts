/**
 * Named build stages of the New Jerusalem scene (plan doc Phase C — staged
 * assembly). `?stages=` selects which CONTENT stages build:
 *
 *   ?stages=city,river        only the named stages
 *   ?stages=-population       every stage except the named ones
 *   (absent / empty)          all stages
 *
 * Bare names form an inclusion set (when any are present); `-name` tokens are
 * then removed from it. Unknown names are ignored. Pure parser — shared with
 * tools/probe-stages.ts so the semantics cannot drift.
 *
 * A stage owns its geometry AND the probe hooks derived from it: river off
 * drops the river water-claim wrap, city off drops wall collision and the
 * city walk floors, dwellings off drops the far-ground wrap. Geometry-only
 * ablation that leaves stale probes behind is exactly the desync the shared-
 * table discipline exists to prevent. Terrain (macroPatch, scatterExclude)
 * is NOT staged — the landscape must bake identically regardless of which
 * content stands on it. Entity picks / key markers / navigation stay
 * installed (analytic, harmless without their geometry).
 *
 * `?resizeprobe=` (tools/probe-resize.ts) is a SEPARATE diagnostic contract
 * for bisecting render-target-lifetime regressions; both gates apply.
 *
 * Debugging today; the bones of a "city assembles itself" arrival sequence
 * later.
 */

export const NJ_STAGES = [
  'city',
  'river',
  'trees',
  'temple',
  'dwellings',
  'population',
  'falls',
] as const;

export type NjStage = (typeof NJ_STAGES)[number];

/** Parse a `?stages=` parameter value into the enabled-stage set. */
export function parseStages(param: string | null | undefined): Set<NjStage> {
  const all = new Set<NjStage>(NJ_STAGES);
  if (param === null || param === undefined || param.trim() === '') return all;
  const includes: NjStage[] = [];
  const excludes: NjStage[] = [];
  for (const raw of param.split(',')) {
    const tok = raw.trim();
    if (tok === '') continue;
    const neg = tok.startsWith('-');
    const name = neg ? tok.slice(1) : tok;
    if (!(NJ_STAGES as readonly string[]).includes(name)) continue;
    (neg ? excludes : includes).push(name as NjStage);
  }
  const set = includes.length > 0 ? new Set<NjStage>(includes) : all;
  for (const e of excludes) set.delete(e);
  return set;
}
