/**
 * Distributions computed from the active build's client data.
 *
 * The analytics dashboard showed hardcoded figures - and a Math.random() series
 * - because the real numbers require scanning the client files: 417,632
 * SpellMisc rows for schools, 175,059 ItemSparse rows for qualities. That is
 * too much for a page load, but not for a cached computation: the scans take
 * well under a second each, and the answer only changes when the build does.
 *
 * Results are cached on disk under the active build's cache directory, so the
 * cost is paid once per build rather than once per request.
 *
 * @module tools/distributions
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { getActiveBuild, resolveDataPath } from '../version/BuildManifest';
import { DB2FileLoader } from '../parsers/db2/DB2FileLoader';
import { DB2FileSystemSource } from '../parsers/db2/DB2FileSource';
import { queryWorld } from '../database/connection';
import { SpellSchoolMask, describeSchoolMask } from '../parsers/schemas/SpellDetailSchemas';
// Imported for its side effect: it registers ItemSparse's field layout, without
// which a sparse read cannot locate anything.
import '../parsers/schemas/ItemSchema';

/** One bucket of a distribution. */
export interface DistributionBucket {
  name: string;
  value: number;
}

export interface Distributions {
  /** Build these figures describe. */
  build: number;
  /** When they were computed. */
  computedAt: string;
  /** Spells per school, from SpellMisc's base-difficulty rows. */
  spellSchools: DistributionBucket[];
  /** Items per quality tier, from ItemSparse. */
  itemQualities: DistributionBucket[];
  /**
   * Creatures per type, from the world database.
   *
   * Type rather than level: creatures scale to the player in this build, and
   * creature_template_difficulty carries only scaling deltas, so there is no
   * fixed level to bucket by. Charting one would mean inventing it.
   */
  creatureTypes: DistributionBucket[];
  /** Totals the buckets sum to, stated so a reader need not add them up. */
  totals: {
    spells: number;
    items: number;
    creatures: number;
  };
  /** How long the scan took, for the log and for the page to be honest about. */
  computeMs: number;
}

/** Quality ids as they appear in ItemSparse.OverallQualityID. */
const QUALITY_NAMES: Record<number, string> = {
  0: 'Poor',
  1: 'Common',
  2: 'Uncommon',
  3: 'Rare',
  4: 'Epic',
  5: 'Legendary',
  6: 'Artifact',
  7: 'Heirloom',
  8: 'WoW Token',
};

/** Creature type ids as they appear in creature_template.type. */
const CREATURE_TYPE_NAMES: Record<number, string> = {
  0: 'None',
  1: 'Beast',
  2: 'Dragonkin',
  3: 'Demon',
  4: 'Elemental',
  5: 'Giant',
  6: 'Undead',
  7: 'Humanoid',
  8: 'Critter',
  9: 'Mechanical',
  10: 'Not specified',
  11: 'Totem',
  12: 'Non-combat Pet',
  13: 'Gas Cloud',
  14: 'Wild Pet',
  15: 'Aberration',
};

/** Schools reported individually; anything else is grouped. */
const REPORTED_SCHOOLS: Array<[number, string]> = [
  [SpellSchoolMask.PHYSICAL, 'Physical'],
  [SpellSchoolMask.HOLY, 'Holy'],
  [SpellSchoolMask.FIRE, 'Fire'],
  [SpellSchoolMask.NATURE, 'Nature'],
  [SpellSchoolMask.FROST, 'Frost'],
  [SpellSchoolMask.SHADOW, 'Shadow'],
  [SpellSchoolMask.ARCANE, 'Arcane'],
];

function cacheFile(): string {
  return path.join(getActiveBuild().cacheDir, 'distributions.json');
}

/**
 * Count spells by school.
 *
 * Only base-difficulty rows are counted: a spell with per-difficulty variants
 * would otherwise be counted once per difficulty.
 */
function computeSpellSchools(db2Dir: string): { buckets: DistributionBucket[]; total: number } {
  const loader = new DB2FileLoader();
  loader.load(new DB2FileSystemSource(path.join(db2Dir, 'SpellMisc.db2')));

  const counts = new Map<number, number>();
  let total = 0;

  for (let index = 0; index < loader.getHeader().recordCount; index++) {
    const record = loader.getRecordByIndex(index);
    if (!record) {
      continue;
    }
    if (record.getUInt32(1) !== 0) {
      continue; // not the base difficulty
    }
    const mask = record.getUInt32(6);
    counts.set(mask, (counts.get(mask) || 0) + 1);
    total++;
  }

  const buckets: DistributionBucket[] = [];
  let multiSchool = 0;
  let none = 0;

  for (const [mask, count] of counts) {
    if (mask === 0) {
      none += count;
      continue;
    }
    const single = REPORTED_SCHOOLS.find(([bit]) => bit === mask);
    if (single) {
      continue; // counted below, in a stable order
    }
    multiSchool += count;
  }

  for (const [bit, name] of REPORTED_SCHOOLS) {
    buckets.push({ name, value: counts.get(bit) || 0 });
  }
  if (multiSchool > 0) {
    buckets.push({ name: 'Multi-school', value: multiSchool });
  }
  if (none > 0) {
    buckets.push({ name: 'None', value: none });
  }

  return { buckets, total };
}

/** Count items by quality tier. */
function computeItemQualities(db2Dir: string): { buckets: DistributionBucket[]; total: number } {
  const loader = new DB2FileLoader();
  loader.load(new DB2FileSystemSource(path.join(db2Dir, 'ItemSparse.db2')));

  const counts = new Map<number, number>();
  let total = 0;

  for (const id of loader.getSectionManager().getAllIds()) {
    try {
      const quality = loader.getRecord(id).getInt8(66);
      counts.set(quality, (counts.get(quality) || 0) + 1);
      total++;
    } catch {
      // A record the catalog names but the layout cannot walk is skipped rather
      // than losing the whole distribution.
    }
  }

  const buckets = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([quality, value]) => ({
      name: QUALITY_NAMES[quality] || `Quality ${quality}`,
      value,
    }));

  return { buckets, total };
}

/**
 * Compute the distributions, scanning the client data.
 *
 * @returns Freshly computed distributions
 * @throws {Error} If the build's DB2 files cannot be read
 */
export async function computeDistributions(): Promise<Distributions> {
  const started = Date.now();
  const db2Dir = resolveDataPath('db2');

  const spells = computeSpellSchools(db2Dir);
  const items = computeItemQualities(db2Dir);
  const creatures = await computeCreatureTypes();

  return {
    build: getActiveBuild().build,
    computedAt: new Date().toISOString(),
    spellSchools: spells.buckets,
    itemQualities: items.buckets,
    creatureTypes: creatures.buckets,
    totals: { spells: spells.total, items: items.total, creatures: creatures.total },
    computeMs: Date.now() - started,
  };
}

/**
 * Count creatures by type, from the world database.
 *
 * @returns Buckets and their total; empty when the database is unreachable,
 *   since one missing distribution should not lose the other two
 */
async function computeCreatureTypes(): Promise<{ buckets: DistributionBucket[]; total: number }> {
  try {
    const rows = (await queryWorld(
      'SELECT type, COUNT(*) as n FROM creature_template GROUP BY type ORDER BY n DESC'
    )) as Array<{ type: number; n: number }>;

    let total = 0;
    const buckets = rows.map((row) => {
      total += Number(row.n);
      return {
        name: CREATURE_TYPE_NAMES[row.type] || `Type ${row.type}`,
        value: Number(row.n),
      };
    });
    return { buckets, total };
  } catch (error) {
    logger.warn(`Could not count creature types: ${error}`);
    return { buckets: [], total: 0 };
  }
}

/**
 * Distributions for the active build, computed once and cached on disk.
 *
 * @param forceRefresh Recompute even when a cached answer exists
 * @returns The distributions, and whether they came from the cache
 *
 * @example
 * ```typescript
 * const { distributions, cached } = getDistributions();
 * // distributions.spellSchools -> [{ name: "Physical", value: 315931 }, ...]
 * ```
 */
export async function getDistributions(forceRefresh = false): Promise<{
  distributions: Distributions;
  cached: boolean;
}> {
  const file = cacheFile();
  const build = getActiveBuild().build;

  if (!forceRefresh) {
    try {
      if (fs.existsSync(file)) {
        const cached = JSON.parse(fs.readFileSync(file, 'utf8')) as Distributions;
        // A cache from another build describes different data, so it is not an
        // answer to this question.
        if (cached.build === build) {
          return { distributions: cached, cached: true };
        }
        logger.info(
          `Distributions cache is for build ${cached.build}, not ${build}; recomputing`
        );
      }
    } catch (error) {
      logger.warn(`Could not read the distributions cache, recomputing: ${error}`);
    }
  }

  const distributions = await computeDistributions();

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(distributions, null, 2), 'utf8');
  } catch (error) {
    // Failing to cache costs time on the next call, nothing more.
    logger.warn(`Could not write the distributions cache: ${error}`);
  }

  logger.info(
    `Computed distributions for build ${build} in ${distributions.computeMs} ms ` +
      `(${distributions.totals.spells} spells, ${distributions.totals.items} items, ` +
      `${distributions.totals.creatures} creatures)`
  );

  return { distributions, cached: false };
}

/** Re-export so callers can name a school without importing the schema module. */
export { describeSchoolMask };
