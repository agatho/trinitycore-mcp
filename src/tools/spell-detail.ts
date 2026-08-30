/**
 * Spell detail assembled from the satellite DB2 tables.
 *
 * A spell's own record carries little beyond its name. Its school, cast time,
 * cooldown, duration, range, level requirement and power cost live in separate
 * tables that reference it through a `$noninline,relation$SpellID` column, or
 * in lookup tables addressed by an index held on SpellMisc.
 *
 * Before this, get-spell-info answered with a name and zeros, which reads as
 * "instant, free, no range" rather than as "not loaded".
 *
 * Everything is loaded lazily and kept for the process: the tables are opened
 * on first use, and each spell's rows are found through the relationship data
 * the files already carry.
 *
 * @module tools/spell-detail
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { resolveDataPath } from '../version/BuildManifest';
import { DB2FileLoader } from '../parsers/db2/DB2FileLoader';
import { DB2FileSystemSource } from '../parsers/db2/DB2FileSource';
import {
  SpellMiscSchema,
  SpellMiscEntry,
  SpellCastTimesSchema,
  SpellDurationSchema,
  SpellRangeSchema,
  SpellCategoriesSchema,
  SpellCooldownsSchema,
  SpellLevelsSchema,
  SpellPowerSchema,
  SpellPowerEntry,
  describeSchoolMask,
  describePowerType,
} from '../parsers/schemas/SpellDetailSchemas';

/** Everything the satellite tables know about one spell. */
export interface SpellDetail {
  /** School bitmask, and its readable form. */
  schoolMask: number;
  schoolName: string;
  attributes: number[];
  /** Base cast time in milliseconds; 0 is instant. */
  castTimeMs: number;
  /** Floor the cast time cannot be hasted below. */
  minCastTimeMs: number;
  /** Duration in milliseconds; -1 does not expire; 0 has no duration. */
  durationMs: number;
  maxDurationMs: number;
  /** The spell's own cooldown in milliseconds. */
  cooldownMs: number;
  categoryCooldownMs: number;
  globalCooldownMs: number;
  range: {
    min: number;
    max: number;
    /** e.g. "Long Range", "Self Only". */
    name: string;
  };
  /** Projectile speed in yards per second; 0 applies instantly. */
  speed: number;
  category: number;
  dispelType: number;
  mechanic: number;
  /** Level required to use the spell. */
  spellLevel: number;
  baseLevel: number;
  maxLevel: number;
  /** One entry per power the spell costs; most spells have zero or one. */
  powers: Array<{
    powerType: number;
    powerTypeName: string;
    cost: number;
    costPercent: number;
    costPerSecond: number;
  }>;
}

/** A loaded table, with the source it holds open. */
interface LoadedTable {
  loader: DB2FileLoader;
  /** Kept so the file handle can be released; see resetSpellDetailTables. */
  source: DB2FileSystemSource;
}

/** Tables opened on first use and kept for the process. */
const tables = new Map<string, LoadedTable | null>();

/**
 * Open a DB2 from the active build, once.
 *
 * @param fileName File to open, e.g. "SpellMisc.db2"
 * @returns The loaded table, or null when the file is absent or unreadable
 */
function openTable(fileName: string): LoadedTable | null {
  if (tables.has(fileName)) {
    return tables.get(fileName) as LoadedTable | null;
  }

  let loaded: LoadedTable | null = null;
  try {
    const filePath = path.join(resolveDataPath('db2'), fileName);
    if (fs.existsSync(filePath)) {
      const source = new DB2FileSystemSource(filePath);
      const loader = new DB2FileLoader();
      loader.load(source);
      loaded = { loader, source };
    } else {
      logger.warn(`Spell detail: ${fileName} not found in the active build's DB2 directory`);
    }
  } catch (error) {
    logger.warn(`Spell detail: failed to open ${fileName}: ${error}`);
  }

  tables.set(fileName, loaded);
  return loaded;
}

/**
 * Find the rows of a related table belonging to a spell.
 *
 * The relationship block maps a SpellID to record *indices*; the id list turns
 * an index into the record id that getRecord() takes.
 *
 * @param table Table to search
 * @param spellId Spell whose rows are wanted
 * @returns Parsed records, in file order
 */
function relatedRecords(table: LoadedTable | null, spellId: number) {
  if (!table) {
    return [];
  }

  const lookup = table.loader.getParentLookupTable();
  if (!lookup) {
    return [];
  }

  const records = [];
  for (const index of lookup.getChildren(spellId)) {
    try {
      // The relationship block addresses rows by position, and reading by
      // position also works for tables whose id column is inline - those have
      // no id list at all, so an id-based read finds nothing in them.
      const record = table.loader.getRecordByIndex(index);
      if (record) {
        records.push(record);
      }
    } catch {
      // One unreadable row should not lose the rest.
    }
  }
  return records;
}

/** Read one row of a lookup table by its id, or null when absent. */
function lookupRow(table: LoadedTable | null, id: number) {
  if (!table || id <= 0) {
    return null;
  }
  try {
    return table.loader.getRecord(id);
  } catch {
    return null;
  }
}

/**
 * Assemble everything the satellite tables know about a spell.
 *
 * Rows carrying a `difficultyID` are filtered to the base row (0): a raid
 * difficulty's numbers are not what a caller asking about "the spell" means.
 *
 * @param spellId Spell to describe
 * @returns The spell's detail, or null when it has no SpellMisc row - which is
 *   how a spell id that does not exist presents
 *
 * @example
 * ```typescript
 * const detail = getSpellDetail(133);
 * // schoolName "Fire", castTimeMs 1750, range { min: 0, max: 40, name: "Long Range" }
 * ```
 */
export function getSpellDetail(spellId: number): SpellDetail | null {
  if (!Number.isInteger(spellId) || spellId <= 0) {
    return null;
  }

  const misc = openTable('SpellMisc.db2');
  const miscRecords = relatedRecords(misc, spellId);
  if (miscRecords.length === 0) {
    return null;
  }

  // Prefer the base difficulty row; fall back to the first if none is marked.
  let miscEntry: SpellMiscEntry | null = null;
  for (const record of miscRecords) {
    const parsed = SpellMiscSchema.parse(record);
    if (parsed.difficultyID === 0) {
      miscEntry = parsed;
      break;
    }
    if (!miscEntry) {
      miscEntry = parsed;
    }
  }
  if (!miscEntry) {
    return null;
  }

  const castRow = lookupRow(openTable('SpellCastTimes.db2'), miscEntry.castingTimeIndex);
  const castTimes = castRow ? SpellCastTimesSchema.parse(castRow) : { base: 0, minimum: 0 };

  const durationRow = lookupRow(openTable('SpellDuration.db2'), miscEntry.durationIndex);
  const duration = durationRow
    ? SpellDurationSchema.parse(durationRow)
    : { duration: 0, maxDuration: 0, durationPerResource: 0 };

  const rangeRow = lookupRow(openTable('SpellRange.db2'), miscEntry.rangeIndex);
  const rangeEntry = rangeRow ? SpellRangeSchema.parse(rangeRow) : null;

  const categoryRecords = relatedRecords(openTable('SpellCategories.db2'), spellId);
  const categories = categoryRecords
    .map((r) => SpellCategoriesSchema.parse(r))
    .find((c) => c.difficultyID === 0) ||
    (categoryRecords.length > 0 ? SpellCategoriesSchema.parse(categoryRecords[0]) : null);

  const cooldownRecords = relatedRecords(openTable('SpellCooldowns.db2'), spellId);
  const cooldowns = cooldownRecords
    .map((r) => SpellCooldownsSchema.parse(r))
    .find((c) => c.difficultyID === 0) ||
    (cooldownRecords.length > 0 ? SpellCooldownsSchema.parse(cooldownRecords[0]) : null);

  const levelRecords = relatedRecords(openTable('SpellLevels.db2'), spellId);
  const levels = levelRecords
    .map((r) => SpellLevelsSchema.parse(r))
    .find((l) => l.difficultyID === 0) ||
    (levelRecords.length > 0 ? SpellLevelsSchema.parse(levelRecords[0]) : null);

  const powerEntries: SpellPowerEntry[] = relatedRecords(openTable('SpellPower.db2'), spellId).map(
    (r) => SpellPowerSchema.parse(r)
  );

  return {
    schoolMask: miscEntry.schoolMask,
    schoolName: describeSchoolMask(miscEntry.schoolMask),
    attributes: miscEntry.attributes,
    castTimeMs: castTimes.base,
    minCastTimeMs: castTimes.minimum,
    durationMs: duration.duration,
    maxDurationMs: duration.maxDuration,
    cooldownMs: cooldowns ? cooldowns.recoveryTime : 0,
    categoryCooldownMs: cooldowns ? cooldowns.categoryRecoveryTime : 0,
    globalCooldownMs: cooldowns ? cooldowns.startRecoveryTime : 0,
    range: {
      min: rangeEntry ? rangeEntry.rangeMin[0] : 0,
      max: rangeEntry ? rangeEntry.rangeMax[0] : 0,
      name: rangeEntry ? rangeEntry.displayName : 'Unknown',
    },
    speed: miscEntry.speed,
    category: categories ? categories.category : 0,
    dispelType: categories ? categories.dispelType : 0,
    mechanic: categories ? categories.mechanic : 0,
    spellLevel: levels ? levels.spellLevel : 0,
    baseLevel: levels ? levels.baseLevel : 0,
    maxLevel: levels ? levels.maxLevel : 0,
    powers: powerEntries
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((p) => ({
        powerType: p.powerType,
        powerTypeName: describePowerType(p.powerType),
        cost: p.manaCost,
        costPercent: p.powerCostPct,
        costPerSecond: p.manaPerSecond,
      })),
  };
}

/**
 * Open the spell detail tables now, rather than on the first lookup.
 *
 * SpellMisc alone is 40 MB, so the first request that needs detail would
 * otherwise pay to open it. Called from startup, off the request path.
 *
 * @returns Whether SpellMisc - the table everything else hangs off - is loaded
 */
export function warmSpellDetailTables(): boolean {
  const files = [
    'SpellMisc.db2',
    'SpellCastTimes.db2',
    'SpellDuration.db2',
    'SpellRange.db2',
    'SpellCategories.db2',
    'SpellCooldowns.db2',
    'SpellLevels.db2',
    'SpellPower.db2',
  ];
  for (const file of files) {
    openTable(file);
  }
  return tables.get('SpellMisc.db2') !== null;
}

/**
 * Drop the loaded tables and release their file handles.
 *
 * Closing matters as much as clearing: the loaders hold eight files open, and a
 * process that only cleared the map would keep those descriptors until it
 * exited - which is enough to stop a test runner from finishing.
 */
export function resetSpellDetailTables(): void {
  for (const table of tables.values()) {
    try {
      table?.source.close();
    } catch {
      // Already closed, or never opened.
    }
  }
  tables.clear();
}
