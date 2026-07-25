/**
 * CPU probe: the `?stages=` parser contract (src/nj/stages.ts — plan doc
 * Phase C, staged assembly). Imports the REAL parser, no mirrored copy.
 *
 *   npx tsx tools/probe-stages.ts
 */

import { NJ_STAGES, parseStages } from '../src/nj/stages';
import { makeChecker } from './check';

const c = makeChecker();

const names = (s: ReadonlySet<string>): string => [...s].sort().join(',');
const expect = (want: readonly string[]): string => [...want].sort().join(',');

// A — default-on semantics
c.check('A1 absent param enables all stages', names(parseStages(null)) === expect(NJ_STAGES));
c.check('A2 empty param enables all stages', names(parseStages('')) === expect(NJ_STAGES));
c.check(
  'A3 whitespace-only param enables all stages',
  names(parseStages('  ')) === expect(NJ_STAGES),
);

// B — inclusion lists
c.check(
  'B1 bare names form an inclusion set',
  names(parseStages('city,river')) === expect(['city', 'river']),
);
c.check(
  'B2 tokens tolerate whitespace',
  names(parseStages(' city , river ')) === expect(['city', 'river']),
);
c.check(
  'B3 unknown names are ignored',
  names(parseStages('city,glory')) === expect(['city']),
  `got ${names(parseStages('city,glory'))}`,
);

// C — exclusion lists
c.check(
  'C1 -name removes from the full set',
  names(parseStages('-population')) === expect(NJ_STAGES.filter((s) => s !== 'population')),
);
c.check(
  'C2 multiple exclusions stack',
  names(parseStages('-city,-river')) ===
    expect(NJ_STAGES.filter((s) => s !== 'city' && s !== 'river')),
);
c.check(
  'C3 unknown exclusion is a no-op',
  names(parseStages('-glory')) === expect(NJ_STAGES),
);

// D — mixed lists: inclusions seed the set, exclusions prune it
c.check('D1 exclusion beats its own inclusion', parseStages('city,-city').size === 0);
c.check(
  'D2 inclusion set pruned by exclusion',
  names(parseStages('city,river,-river')) === expect(['city']),
);
c.check(
  'D3 empty tokens are skipped',
  names(parseStages(',city,,river,')) === expect(['city', 'river']),
);

// E — the `arcade` detail stage (relief filigree inside the city massing)
c.check('E1 arcade is a known stage', (NJ_STAGES as readonly string[]).includes('arcade'));
c.check('E2 arcade is on by default', parseStages(null).has('arcade'));
c.check(
  'E3 -arcade strips ornament but keeps the city',
  !parseStages('-arcade').has('arcade') && parseStages('-arcade').has('city'),
);
c.check(
  'E4 -city does not implicitly disable arcade',
  // The flag stays set; nothing calls the massing builder, so no relief
  // builds either way. Keeping the parser dumb here means one rule, not a
  // dependency graph — the sub-stage relationship lives in the builder.
  parseStages('-city').has('arcade'),
);
c.check(
  'E5 arcade alone renders no city (inclusion semantics, documented)',
  parseStages('arcade').has('arcade') && !parseStages('arcade').has('city'),
);

c.finish();
