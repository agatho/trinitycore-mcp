/**
 * SchemaFactory.ts
 *
 * Factory pattern for DB2 schema parsing with automatic schema selection.
 * Provides type-safe record parsing and extensible schema registration.
 *
 * Architecture:
 * - Registry maps DB2 file names and table hashes to schema parsers
 * - Factory methods provide type-safe parsing
 * - Supports both basic and sparse DB2 files (Item/ItemSparse pattern)
 *
 * Week 4: Phase 3.1 - Priority DB2 File Schemas
 */

import { DB2Record } from '../db2/DB2Record';
import { SpellSchema, SpellEntry } from './SpellSchema';
import { ItemSchema, ItemEntry, ItemSparseEntry, ItemTemplate } from './ItemSchema';
import { ChrClassesSchema, ChrClassesEntry, ChrClassesXPowerTypesSchema, ChrClassesXPowerTypesEntry } from './ChrClassesSchema';
import { ChrRacesSchema, ChrRacesEntry, CharBaseInfoSchema, CharBaseInfoEntry } from './ChrRacesSchema';
import { TalentSchema, TalentEntry } from './TalentSchema';
import { SpellEffectSchema, SpellEffectEntry } from './SpellEffectSchema';

/**
 * Schema Parser Interface
 * All schema parsers must implement this interface
 */
export interface ISchemaParser<T> {
  /**
   * Parse a DB2 record into a typed entry
   * @param record DB2 record to parse
   * @returns Typed entry object
   */
  parse(record: DB2Record): T;

  /**
   * Get the schema name (for debugging)
   */
  getSchemaName(): string;

  /**
   * Get the expected DB2 file name(s)
   */
  getFileNames(): string[];

  /**
   * Get known table hash(es) for this schema
   * Used for automatic schema selection
   */
  getTableHashes(): number[];
}

/**
 * Schema Parser Wrapper
 * Wraps static parser classes to implement ISchemaParser
 */
class SpellSchemaParser implements ISchemaParser<SpellEntry> {
  parse(record: DB2Record): SpellEntry {
    return SpellSchema.parse(record);
  }

  getSchemaName(): string {
    return 'Spell';
  }

  getFileNames(): string[] {
    return ['Spell.db2'];
  }

  getTableHashes(): number[] {
    // Known Spell.db2 table hashes for WoW 11.2
    return [
      0x8C2C0C55, // 11.2.0 Spell.db2
    ];
  }
}

/**
 * Item Basic Schema Parser
 * Parses Item.db2 (basic item data)
 */
class ItemBasicSchemaParser implements ISchemaParser<ItemEntry> {
  parse(record: DB2Record): ItemEntry {
    return ItemSchema.parseBasic(record);
  }

  getSchemaName(): string {
    return 'Item';
  }

  getFileNames(): string[] {
    return ['Item.db2'];
  }

  getTableHashes(): number[] {
    // Known Item.db2 table hashes for WoW 11.2
    return [
      0x50238EC2, // 11.2.0 Item.db2
    ];
  }
}

/**
 * Item Sparse Schema Parser
 * Parses ItemSparse.db2 (extended item data)
 */
class ItemSparseSchemaParser implements ISchemaParser<ItemSparseEntry> {
  parse(record: DB2Record): ItemSparseEntry {
    return ItemSchema.parseSparse(record);
  }

  getSchemaName(): string {
    return 'ItemSparse';
  }

  getFileNames(): string[] {
    return ['ItemSparse.db2'];
  }

  getTableHashes(): number[] {
    // Known ItemSparse.db2 table hashes for WoW 11.2
    return [
      0x919BE54E, // 11.2.0 ItemSparse.db2
    ];
  }
}

/**
 * ChrClasses Schema Parser
 * Parses ChrClasses.dbc (character class definitions)
 */
class ChrClassesSchemaParser implements ISchemaParser<ChrClassesEntry> {
  parse(record: DB2Record): ChrClassesEntry {
    return ChrClassesSchema.parse(record);
  }

  getSchemaName(): string {
    return 'ChrClasses';
  }

  getFileNames(): string[] {
    return ['ChrClasses.dbc', 'ChrClasses.db2'];
  }

  getTableHashes(): number[] {
    // Known ChrClasses table hashes for WoW 11.2
    return [
      0x9871C02B, // 11.2.0 ChrClasses.db2
    ];
  }
}

/**
 * ChrClassesXPowerTypes Schema Parser
 * Parses ChrClasses_X_PowerTypes.db2 (class-power mappings)
 */
class ChrClassesXPowerTypesSchemaParser implements ISchemaParser<ChrClassesXPowerTypesEntry> {
  parse(record: DB2Record): ChrClassesXPowerTypesEntry {
    return ChrClassesXPowerTypesSchema.parse(record);
  }

  getSchemaName(): string {
    return 'ChrClassesXPowerTypes';
  }

  getFileNames(): string[] {
    return ['ChrClasses_X_PowerTypes.db2'];
  }

  getTableHashes(): number[] {
    // Known ChrClasses_X_PowerTypes table hashes for WoW 11.2
    return [
      0x224D3FB9, // 11.2.0 ChrClasses_X_PowerTypes.db2
    ];
  }
}

/**
 * ChrRaces Schema Parser
 * Parses ChrRaces.dbc (character race definitions)
 */
class ChrRacesSchemaParser implements ISchemaParser<ChrRacesEntry> {
  parse(record: DB2Record): ChrRacesEntry {
    return ChrRacesSchema.parse(record);
  }

  getSchemaName(): string {
    return 'ChrRaces';
  }

  getFileNames(): string[] {
    return ['ChrRaces.dbc', 'ChrRaces.db2'];
  }

  getTableHashes(): number[] {
    // Known ChrRaces table hashes for WoW 11.2
    return [
      0xA4A665B9, // 11.2.0 ChrRaces.db2
    ];
  }
}

/**
 * CharBaseInfo Schema Parser
 * Parses CharBaseInfo.db2 (race/class bonuses)
 */
class CharBaseInfoSchemaParser implements ISchemaParser<CharBaseInfoEntry> {
  parse(record: DB2Record): CharBaseInfoEntry {
    return CharBaseInfoSchema.parse(record);
  }

  getSchemaName(): string {
    return 'CharBaseInfo';
  }

  getFileNames(): string[] {
    return ['CharBaseInfo.db2'];
  }

  getTableHashes(): number[] {
    // Known CharBaseInfo table hashes for WoW 11.2
    return [
      0xE63CAE82, // 11.2.0 CharBaseInfo.db2
    ];
  }
}

/**
 * Talent Schema Parser
 * Parses Talent.db2 (LEGACY talent system)
 */
class TalentSchemaParser implements ISchemaParser<TalentEntry> {
  parse(record: DB2Record): TalentEntry {
    return TalentSchema.parse(record);
  }

  getSchemaName(): string {
    return 'Talent';
  }

  getFileNames(): string[] {
    return ['Talent.db2'];
  }

  getTableHashes(): number[] {
    // Known Talent.db2 table hashes for WoW 11.2
    return [
      0x147B0045, // 11.2.0 Talent.db2 (LEGACY)
    ];
  }
}

/**
 * SpellEffect Schema Parser
 * Parses SpellEffect.db2 (spell effect definitions)
 */
class SpellEffectSchemaParser implements ISchemaParser<SpellEffectEntry> {
  parse(record: DB2Record): SpellEffectEntry {
    return SpellEffectSchema.parse(record);
  }

  getSchemaName(): string {
    return 'SpellEffect';
  }

  getFileNames(): string[] {
    return ['SpellEffect.db2'];
  }

  getTableHashes(): number[] {
    // Known SpellEffect.db2 table hashes for WoW 11.2
    return [
      0x239B1B53, // 11.2.0 SpellEffect.db2
    ];
  }
}

/**
 * Schema Registry
 * Central registry for all DB2 schema parsers
 */
export class SchemaRegistry {
  private static fileNameMap: Map<string, ISchemaParser<any>> = new Map();
  private static tableHashMap: Map<number, ISchemaParser<any>> = new Map();
  private static initialized: boolean = false;

  /**
   * Initialize the registry with all known schemas
   * Called automatically on first use
   */
  private static initialize(): void {
    if (this.initialized) {
      return;
    }

    // Register Spell schema
    const spellParser = new SpellSchemaParser();
    this.registerParser(spellParser);

    // Register Item schemas
    const itemBasicParser = new ItemBasicSchemaParser();
    this.registerParser(itemBasicParser);

    const itemSparseParser = new ItemSparseSchemaParser();
    this.registerParser(itemSparseParser);

    // Register ChrClasses schemas (Week 5)
    const chrClassesParser = new ChrClassesSchemaParser();
    this.registerParser(chrClassesParser);

    const chrClassesXPowerTypesParser = new ChrClassesXPowerTypesSchemaParser();
    this.registerParser(chrClassesXPowerTypesParser);

    // Register ChrRaces schemas (Week 5)
    const chrRacesParser = new ChrRacesSchemaParser();
    this.registerParser(chrRacesParser);

    const charBaseInfoParser = new CharBaseInfoSchemaParser();
    this.registerParser(charBaseInfoParser);

    // Register Talent schema (Week 5 - LEGACY)
    const talentParser = new TalentSchemaParser();
    this.registerParser(talentParser);

    // Register SpellEffect schema (Week 5)
    const spellEffectParser = new SpellEffectSchemaParser();
    this.registerParser(spellEffectParser);

    this.initialized = true;
  }

  /**
   * Register a schema parser
   * @param parser Schema parser to register
   */
  private static registerParser(parser: ISchemaParser<any>): void {
    // Register by file names
    for (const fileName of parser.getFileNames()) {
      const normalizedName = fileName.toLowerCase();
      this.fileNameMap.set(normalizedName, parser);
    }

    // Register by table hashes
    for (const tableHash of parser.getTableHashes()) {
      this.tableHashMap.set(tableHash, parser);
    }
  }

  /**
   * Get parser by DB2 file name
   * @param fileName DB2 file name (case-insensitive)
   * @returns Schema parser or null if not found
   */
  public static getParserByFileName(fileName: string): ISchemaParser<any> | null {
    this.initialize();
    const normalizedName = fileName.toLowerCase();
    return this.fileNameMap.get(normalizedName) || null;
  }

  /**
   * Get parser by DB2 table hash
   * @param tableHash DB2 table hash (from header)
   * @returns Schema parser or null if not found
   */
  public static getParserByTableHash(tableHash: number): ISchemaParser<any> | null {
    this.initialize();
    return this.tableHashMap.get(tableHash) || null;
  }

  /**
   * Check if a schema exists for the given file name
   * @param fileName DB2 file name
   */
  public static hasSchemaForFile(fileName: string): boolean {
    this.initialize();
    const normalizedName = fileName.toLowerCase();
    return this.fileNameMap.has(normalizedName);
  }

  /**
   * Check if a schema exists for the given table hash
   * @param tableHash DB2 table hash
   */
  public static hasSchemaForHash(tableHash: number): boolean {
    this.initialize();
    return this.tableHashMap.has(tableHash);
  }

  /**
   * Get all registered file names
   */
  public static getRegisteredFileNames(): string[] {
    this.initialize();
    return Array.from(this.fileNameMap.keys());
  }

  /**
   * Get all registered table hashes
   */
  public static getRegisteredTableHashes(): number[] {
    this.initialize();
    return Array.from(this.tableHashMap.keys());
  }

  /**
   * Get parser information for debugging
   * @param parser Schema parser
   */
  public static getParserInfo(parser: ISchemaParser<any>): {
    name: string;
    fileNames: string[];
    tableHashes: string[];
  } {
    return {
      name: parser.getSchemaName(),
      fileNames: parser.getFileNames(),
      tableHashes: parser.getTableHashes().map((hash) => `0x${hash.toString(16).toUpperCase()}`),
    };
  }
}

/**
 * Schema Factory
 * Provides type-safe factory methods for parsing DB2 records
 */
export class SchemaFactory {
  /**
   * Parse a DB2 record using automatic schema detection by file name
   * @param fileName DB2 file name
   * @param record DB2 record to parse
   * @returns Parsed entry or null if no schema found
   */
  public static parseByFileName<T>(fileName: string, record: DB2Record): T | null {
    const parser = SchemaRegistry.getParserByFileName(fileName);
    if (!parser) {
      return null;
    }
    return parser.parse(record) as T;
  }

  /**
   * Parse a DB2 record using automatic schema detection by table hash
   * @param tableHash DB2 table hash (from header)
   * @param record DB2 record to parse
   * @returns Parsed entry or null if no schema found
   */
  public static parseByTableHash<T>(tableHash: number, record: DB2Record): T | null {
    const parser = SchemaRegistry.getParserByTableHash(tableHash);
    if (!parser) {
      return null;
    }
    return parser.parse(record) as T;
  }

  /**
   * Parse a Spell.db2 record (type-safe)
   * @param record DB2 record to parse
   * @returns Parsed SpellEntry
   */
  public static parseSpell(record: DB2Record): SpellEntry {
    return SpellSchema.parse(record);
  }

  /**
   * Parse an Item.db2 record (type-safe)
   * @param record DB2 record to parse
   * @returns Parsed ItemEntry
   */
  public static parseItemBasic(record: DB2Record): ItemEntry {
    return ItemSchema.parseBasic(record);
  }

  /**
   * Parse an ItemSparse.db2 record (type-safe)
   * @param record DB2 record to parse
   * @returns Parsed ItemSparseEntry
   */
  public static parseItemSparse(record: DB2Record): ItemSparseEntry {
    return ItemSchema.parseSparse(record);
  }

  /**
   * Combine Item.db2 and ItemSparse.db2 records into ItemTemplate
   * @param basicRecord Item.db2 record
   * @param sparseRecord ItemSparse.db2 record
   * @returns Combined ItemTemplate
   */
  public static parseItemTemplate(
    basicRecord: DB2Record,
    sparseRecord: DB2Record
  ): ItemTemplate {
    const basic = ItemSchema.parseBasic(basicRecord);
    const sparse = ItemSchema.parseSparse(sparseRecord);
    return ItemSchema.combine(basic, sparse);
  }

  /**
   * Get schema information for a DB2 file
   * @param fileName DB2 file name
   * @returns Schema info or null if not found
   */
  public static getSchemaInfo(fileName: string): {
    name: string;
    fileNames: string[];
    tableHashes: string[];
  } | null {
    const parser = SchemaRegistry.getParserByFileName(fileName);
    if (!parser) {
      return null;
    }
    return SchemaRegistry.getParserInfo(parser);
  }

  /**
   * Check if a schema exists for the given file name
   * @param fileName DB2 file name
   */
  public static hasSchema(fileName: string): boolean {
    return SchemaRegistry.hasSchemaForFile(fileName);
  }

  /**
   * Get all supported DB2 file names
   */
  public static getSupportedFiles(): string[] {
    return SchemaRegistry.getRegisteredFileNames();
  }
}

/**
 * Export helper types for type-safe parsing
 */
export type SchemaType<T extends string> = T extends 'Spell'
  ? SpellEntry
  : T extends 'Item'
  ? ItemEntry
  : T extends 'ItemSparse'
  ? ItemSparseEntry
  : never;

/**
 * Type guard for SpellEntry
 */
export function isSpellEntry(entry: any): entry is SpellEntry {
  return !!(entry && typeof entry === 'object' && typeof entry.id === 'number' && 'attributes' in entry);
}

/**
 * Type guard for ItemEntry
 */
export function isItemEntry(entry: any): entry is ItemEntry {
  return !!(entry && typeof entry === 'object' && typeof entry.id === 'number' && 'classId' in entry);
}

/**
 * Type guard for ItemSparseEntry
 */
export function isItemSparseEntry(entry: any): entry is ItemSparseEntry {
  return !!(
    entry &&
    typeof entry === 'object' &&
    typeof entry.id === 'number' &&
    typeof entry.name === 'string' &&
    'stats' in entry
  );
}

/**
 * Type guard for ItemTemplate
 */
export function isItemTemplate(entry: any): entry is ItemTemplate {
  return !!(
    entry &&
    typeof entry === 'object' &&
    isItemEntry(entry.basic) &&
    isItemSparseEntry(entry.extended)
  );
}
