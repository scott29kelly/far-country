/**
 * Export the figure archetype table (figureModel.ts — the single source of
 * truth for crowd identity) to JSON for the offline Anny pipeline
 * (pipeline/figures, ADR 0020). The pipeline must never hand-mirror these
 * numbers; it consumes this file, and this file is regenerated from the
 * table — the shared-table discipline across the language boundary.
 *
 *   npx tsx tools/export-archetypes.ts
 *
 * Writes ../../pipeline/figures/archetypes.gen.json (committed).
 */

export {};

Object.defineProperty(globalThis, 'window', {
  value: { location: { search: '' }, addEventListener() {} },
  configurable: true,
});

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const { FIGURE_ARCHETYPES } = await import('../src/nj/figureModel');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', '..', 'pipeline', 'figures', 'archetypes.gen.json');

writeFileSync(
  out,
  JSON.stringify(
    {
      generated: 'tools/export-archetypes.ts — DO NOT EDIT; regenerate from figureModel.ts',
      archetypes: FIGURE_ARCHETYPES,
    },
    null,
    2,
  ) + '\n',
);
console.log(`[export-archetypes] wrote ${out} (${FIGURE_ARCHETYPES.length} archetypes)`);
