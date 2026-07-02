/** Scene registry — `?scene=` selects the boot scene (world | sanity | terrain | gallery …). */

import type { Engine } from '../core/Engine';
import type { LaasHooks } from '../core/Hooks';
import type { LaasParams } from '../core/Params';
import type { WorldSeed } from '../core/Seed';
import type { MacroParams } from '../world/MacroMap';

export interface WorldContext {
  engine: Engine;
  params: LaasParams;
  seed: WorldSeed;
  hooks: LaasHooks;
  /** report build progress 0..1 */
  progress: (p: number, msg: string) => void;
  /**
   * Optional world-space keep-out rects [x0, x1, z0, z1] for procedural
   * scatter (trees/understory/rocks). Scenes that place built geometry on the
   * terrain (e.g. the New Jerusalem city forecourt, dwelling grid) list their
   * footprints so vegetation doesn't grow through them.
   */
  scatterExclude?: readonly (readonly [number, number, number, number])[];
  /**
   * Optional patch applied to the seeded MacroParams before world-gen —
   * scenes inject authored geography (e.g. the Holy Allotment plateau rise,
   * ADR 0015) that the heightfield bake and the analytic far shell then
   * share.
   */
  macroPatch?: (mp: MacroParams) => void;
}

export type SceneBuilder = (ctx: WorldContext) => Promise<void>;

const registry = new Map<string, SceneBuilder>();

export function registerScene(name: string, builder: SceneBuilder): void {
  registry.set(name, builder);
}

export async function buildScene(name: string, ctx: WorldContext): Promise<void> {
  const builder = registry.get(name);
  if (!builder) {
    const known = [...registry.keys()].join(', ');
    throw new Error(`Unknown scene "${name}". Known scenes: ${known}`);
  }
  await builder(ctx);
}

export function sceneNames(): string[] {
  return [...registry.keys()];
}
