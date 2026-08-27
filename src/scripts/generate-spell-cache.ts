#!/usr/bin/env ts-node
/**
 * Generate Complete Spell Names Cache from SpellName.db2
 *
 * This script reads SpellName.db2 (WDC5/WDC6 format) and generates a complete JSON cache file
 * for fast spell name lookups. It extracts ALL ~177,000 spells from the DB2 file.
 *
 * Usage: npx ts-node src/scripts/generate-spell-cache.ts
 *        or: npm run build && node dist/scripts/generate-spell-cache.js
 *
 * Environment Variables:
 *   DB2_PATH - Path to DB2 files (default: from .env)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import { DB2FileLoader } from '../parsers/db2/DB2FileLoader';
import { DB2FileSystemSource } from '../parsers/db2/DB2FileSource';
import { loadBuildManifest, getActiveBuild, resolveDataPath } from '../version/BuildManifest';
import { cachePathFor, writeCacheMetadata } from '../utils/cache-metadata';

// Configuration
const SPELL_NAME_DB2 = 'SpellName.db2';

// Progress reporting interval (log every N spells)
const PROGRESS_INTERVAL = 10000;

interface SpellDataEntry {
  ID: number;
  Name_lang: string;
  NameSubtext_lang: string;
  Description_lang: string;
  AuraDescription_lang: string;
}

/**
 * Main spell cache generator
 */
async function main(): Promise<void> {
  console.log('============================================================');
  console.log('  FULL SPELL NAMES CACHE GENERATOR');
  console.log('  Extracting ALL spells from SpellName.db2');
  console.log('============================================================\n');

  const startTime = Date.now();

  // Resolve the active build and its data/cache paths before any path use
  await loadBuildManifest();
  const activeBuild = getActiveBuild();
  const DB2_PATH = resolveDataPath('db2');
  const SPELL_NAMES_CACHE_PATH = cachePathFor('spell_names_cache.json');
  const SPELL_DATA_CACHE_PATH = cachePathFor('spell_data_cache.json');
  fs.mkdirSync(path.dirname(SPELL_NAMES_CACHE_PATH), { recursive: true });

  // Check DB2 path
  const spellNamePath = path.join(DB2_PATH, SPELL_NAME_DB2);
  console.log(`Active build: ${activeBuild.id} (${activeBuild.build})`);
  console.log(`DB2 Path: ${DB2_PATH}`);
  console.log(`SpellName.db2: ${spellNamePath}`);

  if (!fs.existsSync(spellNamePath)) {
    console.error(`\nERROR: SpellName.db2 not found at: ${spellNamePath}`);
    console.log('\nPlease ensure DB2_PATH environment variable points to your DBC/DB2 directory.');
    console.log('Example: DB2_PATH=M:\\Wplayerbot\\data\\dbc\\enUS');
    process.exit(1);
  }

  const stats = fs.statSync(spellNamePath);
  console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB\n`);

  // Load SpellName.db2
  console.log('Loading SpellName.db2...');
  const loader = new DB2FileLoader();
  const source = new DB2FileSystemSource(spellNamePath);

  try {
    loader.load(source);
    const header = loader.getHeader();
    const sectionManager = loader.getSectionManager();

    console.log(`\nDB2 Header Info:`);
    console.log(`  Signature: ${header.signature}`);
    console.log(`  Record Count: ${header.recordCount}`);
    console.log(`  Field Count: ${header.fieldCount}`);
    console.log(`  Record Size: ${header.recordSize}`);
    console.log(`  Min ID: ${header.minId}`);
    console.log(`  Max ID: ${header.maxId}`);
    console.log(`  Section Count: ${header.sectionCount}`);

    // Get all spell IDs
    const allIds = sectionManager.getAllIds();
    const totalSpells = allIds.length;

    console.log(`\nFound ${totalSpells.toLocaleString()} spell IDs to extract\n`);

    // Extract spell names
    const spellNames: Record<number, string> = {};
    const spellData: Record<number, SpellDataEntry> = {};
    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: number; error: string }> = [];

    console.log('Extracting spell names...\n');

    for (let i = 0; i < allIds.length; i++) {
      const spellId = allIds[i];

      try {
        // Get record for this spell ID
        const record = loader.getRecord(spellId);

        // SpellName.db2 structure (WDC5 inline file):
        //   ID comes from ID list (not stored in record)
        //   Field 0: Name_lang (string offset - 4 bytes)
        // Total record size: 4 bytes
        const name = record.getString(0, 0);

        if (name && name.trim() !== '') {
          spellNames[spellId] = name;
          spellData[spellId] = {
            ID: spellId,
            Name_lang: name,
            NameSubtext_lang: '',
            Description_lang: '',
            AuraDescription_lang: ''
          };
          successCount++;
        } else {
          // Empty name - still track it but skip
          errorCount++;
          if (errors.length < 100) {
            errors.push({ id: spellId, error: 'Empty spell name' });
          }
        }
      } catch (error) {
        errorCount++;
        if (errors.length < 100) {
          errors.push({ id: spellId, error: (error as Error).message });
        }
      }

      // Progress reporting
      if ((i + 1) % PROGRESS_INTERVAL === 0 || i === allIds.length - 1) {
        const pct = ((i + 1) / totalSpells * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`\r  Progress: ${(i + 1).toLocaleString()} / ${totalSpells.toLocaleString()} (${pct}%) - ${successCount.toLocaleString()} extracted - ${elapsed}s elapsed`);
      }
    }

    console.log('\n\n');

    // Cache metadata shared by both sidecar files: which build and DB2 layout
    // produced this cache, so consumers can refuse a stale/mismatched cache.
    const layoutHash = loader.getLayoutHash();
    const sourceLayoutHash = `0x${layoutHash.toString(16).padStart(8, '0')}`;
    const generatedAt = new Date().toISOString();

    // Write spell names cache
    console.log('Writing spell_names_cache.json...');
    fs.writeFileSync(SPELL_NAMES_CACHE_PATH, JSON.stringify(spellNames, null, 2));
    writeCacheMetadata(SPELL_NAMES_CACHE_PATH, {
      build: activeBuild.build,
      generatedAt,
      sourceFile: SPELL_NAME_DB2,
      sourceLayoutHash,
      recordCount: successCount,
    });
    console.log(`  Saved: ${SPELL_NAMES_CACHE_PATH}`);
    console.log(`  Entries: ${successCount.toLocaleString()}`);
    console.log(`  Size: ${(fs.statSync(SPELL_NAMES_CACHE_PATH).size / 1024 / 1024).toFixed(2)} MB\n`);

    // Write spell data cache
    console.log('Writing spell_data_cache.json...');
    fs.writeFileSync(SPELL_DATA_CACHE_PATH, JSON.stringify(spellData, null, 2));
    writeCacheMetadata(SPELL_DATA_CACHE_PATH, {
      build: activeBuild.build,
      generatedAt,
      sourceFile: SPELL_NAME_DB2,
      sourceLayoutHash,
      recordCount: successCount,
    });
    console.log(`  Saved: ${SPELL_DATA_CACHE_PATH}`);
    console.log(`  Entries: ${successCount.toLocaleString()}`);
    console.log(`  Size: ${(fs.statSync(SPELL_DATA_CACHE_PATH).size / 1024 / 1024).toFixed(2)} MB\n`);

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('============================================================');
    console.log('  EXTRACTION COMPLETE');
    console.log('============================================================');
    console.log(`  Total IDs processed: ${totalSpells.toLocaleString()}`);
    console.log(`  Successfully extracted: ${successCount.toLocaleString()}`);
    console.log(`  Errors/Empty names: ${errorCount.toLocaleString()}`);
    console.log(`  Total time: ${totalTime} seconds`);
    console.log(`  Rate: ${(totalSpells / parseFloat(totalTime)).toFixed(0)} spells/second`);

    if (errors.length > 0) {
      console.log(`\n  First ${Math.min(errors.length, 10)} errors:`);
      for (let i = 0; i < Math.min(errors.length, 10); i++) {
        console.log(`    Spell ${errors[i].id}: ${errors[i].error}`);
      }
      if (errors.length > 10) {
        console.log(`    ... and ${errors.length - 10} more`);
      }
    }

    console.log('\n============================================================\n');

  } catch (error) {
    console.error('\nFATAL ERROR:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  } finally {
    source.close();
  }
}

// Run the generator
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
