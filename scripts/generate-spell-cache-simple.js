#!/usr/bin/env node
/**
 * Simple Spell Names Cache Generator
 *
 * Directly parses SpellName.db2 (WDC5 format) without complex abstractions.
 * Based on WoWDev wiki WDC5 specification.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

const DB2_PATH = process.env.DB2_PATH || 'M:\\Wplayerbot\\data\\dbc\\enUS';
const SPELL_NAME_DB2 = path.join(DB2_PATH, 'SpellName.db2');
const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const SPELL_NAMES_CACHE_PATH = path.join(CACHE_DIR, 'spell_names_cache.json');
const SPELL_DATA_CACHE_PATH = path.join(CACHE_DIR, 'spell_data_cache.json');

async function main() {
  console.log('============================================================');
  console.log('  SPELL NAMES CACHE GENERATOR (Simple Parser)');
  console.log('============================================================\n');

  const startTime = Date.now();

  if (!fs.existsSync(SPELL_NAME_DB2)) {
    console.error('ERROR: SpellName.db2 not found at:', SPELL_NAME_DB2);
    process.exit(1);
  }

  const buffer = fs.readFileSync(SPELL_NAME_DB2);
  console.log(`File: ${SPELL_NAME_DB2}`);
  console.log(`Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB\n`);

  // Parse WDC5 header
  const magic = buffer.toString('ascii', 0, 4);
  if (magic !== 'WDC5' && magic !== 'WDC6') {
    console.error(`ERROR: Unsupported format: ${magic}`);
    process.exit(1);
  }

  console.log(`Format: ${magic}`);

  // WDC5 Header (based on WoWDev wiki)
  // Offset 4: version (uint32)
  // Offset 8: schemaString (128 bytes, null-terminated)
  // Offset 136: recordCount (uint32)
  // Offset 140: fieldCount (uint32)
  // Offset 144: recordSize (uint32)
  // Offset 148: stringTableSize (uint32)
  // etc...

  const version = buffer.readUInt32LE(4);
  const recordCount = buffer.readUInt32LE(136);
  const fieldCount = buffer.readUInt32LE(140);
  const recordSize = buffer.readUInt32LE(144);
  const stringTableSize = buffer.readUInt32LE(148);
  const tableHash = buffer.readUInt32LE(152);
  const layoutHash = buffer.readUInt32LE(156);
  const minId = buffer.readUInt32LE(160);
  const maxId = buffer.readUInt32LE(164);
  const locale = buffer.readUInt32LE(168);
  const flags = buffer.readUInt16LE(172);
  const idIndex = buffer.readUInt16LE(174);
  const totalFieldCount = buffer.readUInt32LE(176);
  const packedDataOffset = buffer.readUInt32LE(180);
  const parentLookupCount = buffer.readUInt32LE(184);
  const columnMetaSize = buffer.readUInt32LE(188);
  const commonDataSize = buffer.readUInt32LE(192);
  const palletDataSize = buffer.readUInt32LE(196);
  const sectionCount = buffer.readUInt32LE(200);

  console.log(`Version: ${version}`);
  console.log(`Record Count: ${recordCount}`);
  console.log(`Field Count: ${fieldCount}`);
  console.log(`Record Size: ${recordSize}`);
  console.log(`String Table Size: ${stringTableSize}`);
  console.log(`ID Range: ${minId} - ${maxId}`);
  console.log(`Section Count: ${sectionCount}`);
  console.log(`Flags: 0x${flags.toString(16)}`);
  console.log();

  // Parse section headers (40 bytes each, after the 204-byte main header)
  const HEADER_SIZE = 204;
  const sections = [];
  let sectionOffset = HEADER_SIZE;

  // WDC5 Section Header (40 bytes):
  // 0: tact_key_hash (8 bytes)
  // 8: file_offset (4 bytes)
  // 12: record_count (4 bytes)
  // 16: string_table_size (4 bytes)
  // 20: offset_records_end (4 bytes) - for sparse, where variable-size records end
  // 24: id_list_size (4 bytes) - SIZE of ID list in bytes (count * 4)
  // 28: relationship_data_size (4 bytes)
  // 32: offset_map_id_count (4 bytes) - number of sparse/offset map entries
  // 36: copy_table_count (4 bytes)
  for (let i = 0; i < sectionCount; i++) {
    const section = {
      tactKeyHash: buffer.readBigUInt64LE(sectionOffset),
      fileOffset: buffer.readUInt32LE(sectionOffset + 8),
      recordCount: buffer.readUInt32LE(sectionOffset + 12),
      stringTableSize: buffer.readUInt32LE(sectionOffset + 16),
      offsetRecordsEnd: buffer.readUInt32LE(sectionOffset + 20),
      idListSize: buffer.readUInt32LE(sectionOffset + 24),  // SIZE in bytes!
      relationshipDataSize: buffer.readUInt32LE(sectionOffset + 28),
      offsetMapIdCount: buffer.readUInt32LE(sectionOffset + 32),
      copyTableCount: buffer.readUInt32LE(sectionOffset + 36),
    };
    sections.push(section);
    sectionOffset += 40;
  }

  console.log(`Parsed ${sections.length} section headers`);
  console.log(`Section 0: ${sections[0].recordCount} records, fileOffset=${sections[0].fileOffset}, stringTableSize=${sections[0].stringTableSize}, idListSize=${sections[0].idListSize}`);

  // Skip column metadata (after section headers)
  let dataOffset = sectionOffset + columnMetaSize;
  console.log(`Column meta size: ${columnMetaSize}`);
  console.log(`Data starts at offset: ${dataOffset}`);

  // For SpellName.db2:
  // - Record size is 4 bytes (just a string offset)
  // - ID comes from ID list, not from record
  // - Records are followed by string table, then ID list

  // WDC5 String Offset Resolution (based on TrinityCore DB2FileLoaderRegularImpl)
  //
  // TrinityCore builds a combined buffer: [All Records from all sections][All Strings from all sections]
  //   - Records start at offset 0, string table starts at header.recordCount * recordSize
  //   - String offsets in records are relative to (record position + field offset) in this buffer
  //   - Formula: stringPtr = record + fieldOffset + rawOffset
  //
  // Our per-section approach loads each section separately, so we compute a correction:
  //   correction = (sectionRecordCount - headerRecordCount) * recordSize
  //              + sectionRecordStartOffset - sectionStringTableStartOffset
  //
  // For section s, record i: stringTableIndex = i * recordSize + rawOffset + correction
  // Then read string at (sectionRecordDataSize + stringTableIndex) in per-section buffer.

  // Precompute cumulative offsets for each section (for multi-section string offset correction)
  const sectionRecordStartOffsets = [0]; // Cumulative record data sizes before each section
  const sectionStringTableStartOffsets = [0]; // Cumulative string table sizes before each section
  for (let s = 1; s < sections.length; s++) {
    sectionRecordStartOffsets[s] = sectionRecordStartOffsets[s - 1] + sections[s - 1].recordCount * recordSize;
    sectionStringTableStartOffsets[s] = sectionStringTableStartOffsets[s - 1] + sections[s - 1].stringTableSize;
  }

  /**
   * Compute string offset correction for a given section.
   * Translates TrinityCore combined-buffer raw offsets to per-section buffer positions.
   */
  function getStringOffsetCorrection(sectionIndex) {
    return (sections[sectionIndex].recordCount - recordCount) * recordSize
      + sectionRecordStartOffsets[sectionIndex]
      - sectionStringTableStartOffsets[sectionIndex];
  }

  /**
   * Read a null-terminated string from a section's string table in the file buffer.
   * @param {number} sectionIndex - Section index
   * @param {number} localRecordIndex - Record index within this section
   * @param {number} rawOffset - Raw uint32 offset value from the record
   * @returns {string} The decoded string, or '' if invalid
   */
  function readSectionString(sectionIndex, localRecordIndex, rawOffset) {
    if (rawOffset === 0) return '';

    const section = sections[sectionIndex];
    const correction = getStringOffsetCorrection(sectionIndex);
    const sectionRecordDataSize = section.recordCount * recordSize;

    // TrinityCore formula (adapted for per-section buffer):
    // bufferPosition = recordIndex * recordSize + fieldOffset(0) + rawOffset + correction
    // This gives a position in the per-section combined buffer [records][strings]
    const bufferPosition = localRecordIndex * recordSize + rawOffset + correction;

    // Convert buffer position to string table index by subtracting records area size
    const stringTableIndex = bufferPosition - sectionRecordDataSize;

    // stringTableIndex should be non-negative and within section's string table
    if (stringTableIndex < 0 || stringTableIndex >= section.stringTableSize) {
      return '';
    }

    // In the file, section's string table starts at section.fileOffset + sectionRecordDataSize
    const fileStringTableStart = section.fileOffset + sectionRecordDataSize;
    const filePos = fileStringTableStart + stringTableIndex;

    // Read null-terminated string from file buffer
    let end = filePos;
    while (end < buffer.length && buffer[end] !== 0) {
      end++;
    }
    return buffer.toString('utf8', filePos, end);
  }

  // Process section 0 (main section)
  const section0 = sections[0];
  const recordDataSize = section0.recordCount * recordSize;
  const recordsStart = section0.fileOffset;
  const stringTableStart = recordsStart + recordDataSize;
  const idTableStart = stringTableStart + section0.stringTableSize;

  console.log(`\nSection 0 layout:`);
  console.log(`  Records: ${recordsStart} - ${recordsStart + recordDataSize} (${recordDataSize} bytes)`);
  console.log(`  String Table: ${stringTableStart} - ${stringTableStart + section0.stringTableSize} (${section0.stringTableSize} bytes)`);
  console.log(`  ID List: ${idTableStart} - ${idTableStart + section0.idListSize} (${section0.idListSize} bytes)`);
  console.log(`  String offset correction (section 0): ${getStringOffsetCorrection(0)}`);

  // Read ID list (located after string table)
  const idList = [];
  const idCount = section0.idListSize / 4;  // Each ID is 4 bytes
  for (let i = 0; i < idCount; i++) {
    const id = buffer.readUInt32LE(idTableStart + i * 4);
    idList.push(id);
  }

  console.log(`\nLoaded ${idList.length} IDs`);
  console.log(`First 10 IDs: ${idList.slice(0, 10).join(', ')}`);

  // Extract spell names
  const spellNames = {};
  const spellData = {};
  let successCount = 0;
  let errorCount = 0;

  console.log('\nExtracting spell names...\n');

  // We need min(recordCount, idCount) because some records may not have IDs
  const extractCount = Math.min(section0.recordCount, idCount);
  for (let i = 0; i < extractCount; i++) {
    const spellId = idList[i];

    // Skip ID 0 (invalid)
    if (spellId === 0) {
      errorCount++;
      continue;
    }

    // Read raw string offset from record
    const recordOffset = recordsStart + i * recordSize;
    const rawOffset = buffer.readUInt32LE(recordOffset);

    // Resolve string using TrinityCore-compatible formula
    const name = readSectionString(0, i, rawOffset);

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
      errorCount++;
    }

    // Progress
    if ((i + 1) % 20000 === 0) {
      const pct = ((i + 1) / extractCount * 100).toFixed(1);
      console.log(`  Progress: ${(i + 1).toLocaleString()} / ${extractCount.toLocaleString()} (${pct}%)`);
    }
  }

  console.log(`\n  Final: ${successCount.toLocaleString()} extracted, ${errorCount.toLocaleString()} errors/empty\n`);

  // Process other sections (smaller, mostly locale-specific)
  for (let s = 1; s < sections.length; s++) {
    const section = sections[s];
    if (section.recordCount === 0 || section.idListSize === 0) continue;

    const sRecordsStart = section.fileOffset;
    const sRecordDataSize = section.recordCount * recordSize;
    const sStringTableStart = sRecordsStart + sRecordDataSize;
    const sIdTableStart = sStringTableStart + section.stringTableSize;

    // Read IDs
    const sIdList = [];
    const sIdCount = section.idListSize / 4;
    for (let i = 0; i < sIdCount; i++) {
      const id = buffer.readUInt32LE(sIdTableStart + i * 4);
      sIdList.push(id);
    }

    // Extract names using corrected string offset formula
    let sectionSuccess = 0;
    for (let i = 0; i < section.recordCount; i++) {
      const spellId = sIdList[i];
      if (spellId === 0 || spellNames[spellId]) continue; // Skip if already have it

      const recordOffset = sRecordsStart + i * recordSize;
      const rawOffset = buffer.readUInt32LE(recordOffset);
      const name = readSectionString(s, i, rawOffset);

      if (name && name.trim() !== '') {
        spellNames[spellId] = name;
        spellData[spellId] = {
          ID: spellId,
          Name_lang: name,
          NameSubtext_lang: '',
          Description_lang: '',
          AuraDescription_lang: ''
        };
        sectionSuccess++;
        successCount++;
      }
    }

    if (sectionSuccess > 0) {
      console.log(`  Section ${s}: added ${sectionSuccess} spells`);
    }
  }

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Write caches
  console.log('\nWriting spell_names_cache.json...');
  fs.writeFileSync(SPELL_NAMES_CACHE_PATH, JSON.stringify(spellNames, null, 2));
  console.log(`  Saved: ${Object.keys(spellNames).length.toLocaleString()} entries`);

  console.log('\nWriting spell_data_cache.json...');
  fs.writeFileSync(SPELL_DATA_CACHE_PATH, JSON.stringify(spellData, null, 2));
  console.log(`  Saved: ${Object.keys(spellData).length.toLocaleString()} entries`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n============================================================`);
  console.log(`  COMPLETE`);
  console.log(`  Total spells: ${Object.keys(spellNames).length.toLocaleString()}`);
  console.log(`  Time: ${elapsed} seconds`);
  console.log(`============================================================\n`);

  // Verify some known spells (IDs that exist in current WoW version)
  console.log('Verification of known spells:');
  const knownSpells = {
    1: 'Word of Recall (OLD)',
    17: 'Power Word: Shield',
    100: 'Charge',
    116: 'Frostbolt',
    133: 'Fireball',
    139: 'Renew',
    585: 'Smite',
    686: 'Shadow Bolt',
    2825: 'Bloodlust',
    6603: 'Auto Attack',
    8326: 'Ghost',
  };

  for (const [id, expected] of Object.entries(knownSpells)) {
    const actual = spellNames[id] || '(not found)';
    const match = actual === expected ? '✓' : '✗';
    console.log(`  ${match} Spell ${id}: "${actual}" (expected: "${expected}")`);
  }
}

main().catch(console.error);
