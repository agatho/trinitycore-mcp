# DB2 Schema Usage Guide

Complete guide for using the DB2 schema system in the TrinityCore MCP Server.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Schema Types](#schema-types)
4. [SchemaFactory API](#schemafactory-api)
5. [Schema-Specific Usage](#schema-specific-usage)
6. [Type Guards](#type-guards)
7. [Helper Methods](#helper-methods)
8. [Advanced Usage](#advanced-usage)
9. [Best Practices](#best-practices)

---

## Overview

The schema system provides TypeScript interfaces and parsing logic for World of Warcraft 11.2 (The War Within) DB2 files. It offers:

- **Type-safe parsing** of binary DB2 records
- **Automatic schema selection** by file name or table hash
- **Helper methods** for common operations
- **Type guards** for runtime validation
- **Extensible registration system** for future schemas

### Supported Schemas

| Schema | DB2 File | Fields | Description |
|--------|----------|--------|-------------|
| **SpellSchema** | Spell.db2 | 107 | Complete spell data with attributes, power costs, scaling |
| **ItemSchema** | Item.db2 + ItemSparse.db2 | 147 | Complete item data with stats, sockets, spells |

---

## Quick Start

### Basic Parsing

```typescript
import { SchemaFactory } from './parsers/schemas/SchemaFactory';
import { DB2FileLoader } from './parsers/db2/DB2FileLoader';

// Load DB2 file
const loader = DB2FileLoader.load('Spell.db2');

// Parse a record
const record = loader.getRecord(8326); // Ghost spell
const spell = SchemaFactory.parseSpell(record);

console.log(spell.id); // 8326
console.log(spell.attributes); // Spell attributes
console.log(spell.schoolMask); // 64 (Shadow school)
```

### Automatic Schema Detection

```typescript
// Parse by file name
const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', record);

// Parse by table hash (from DB2 header)
const spell = SchemaFactory.parseByTableHash<SpellEntry>(0x8C2C0C55, record);

// Check if schema exists
if (SchemaFactory.hasSchema('Spell.db2')) {
  // Parse safely
}
```

---

## Schema Types

### SpellEntry

Complete spell data structure with 107 fields:

```typescript
interface SpellEntry {
  // Core identification
  id: number;
  difficulty: number;

  // Attributes (16 flags)
  attributes: number;      // SPELL_ATTR0_*
  attributesEx: number;    // SPELL_ATTR1_*
  attributesEx2: number;   // SPELL_ATTR2_*
  // ... through attributesEx15

  // Targeting
  targets: number;
  targetCreatureType: number;
  stances: bigint;
  stancesNot: bigint;

  // Costs and cooldowns
  powerCosts: SpellPowerCost[];
  castTimeIndex: number;
  cooldown: number;
  categoryCooldown: number;

  // Schools and mechanics
  schoolMask: number;
  mechanic: number;
  dispel: number;

  // Reagents
  reagent: number[];       // 8 slots
  reagentCount: number[];  // 8 slots

  // Scaling
  scaling: SpellScalingInfo;

  // And 80+ more fields...
}
```

### ItemEntry (Item.db2 Basic Data)

Core item identification:

```typescript
interface ItemEntry {
  id: number;
  classId: number;        // ItemClass enum
  subclassId: number;
  material: number;
  soundOverrideSubclassId: number;
  iconFileDataId: number;
  itemGroupSoundsId: number;
  contentTuningId: number;
  modifiedCraftingReagentItemId: number;
  coincidesWithOppositeMinorPatch: number;
  expansionId: number;
}
```

### ItemSparseEntry (ItemSparse.db2 Extended Data)

Complete item data with 136 fields:

```typescript
interface ItemSparseEntry {
  id: number;

  // Display
  name: string;
  description: string;
  display: string;

  // Pricing
  buyPrice: bigint;       // Can exceed 2^31
  sellPrice: number;

  // Quality and level
  overallQualityId: number;  // ItemQuality enum
  inventoryType: number;      // InventoryType enum
  itemLevel: number;
  requiredLevel: number;

  // Stats (up to 10)
  stats: ItemStat[];

  // Sockets (up to 3)
  sockets: ItemSocket[];

  // Damage (up to 5 entries)
  damages: ItemDamage[];

  // Spells (up to 5)
  spells: ItemSpell[];

  // Resistances
  armor: number;
  holyResistance: number;
  fireResistance: number;
  natureResistance: number;
  frostResistance: number;
  shadowResistance: number;
  arcaneResistance: number;

  // And 100+ more fields...
}
```

### ItemTemplate (Combined Item Data)

```typescript
interface ItemTemplate {
  basic: ItemEntry;        // From Item.db2
  extended: ItemSparseEntry;  // From ItemSparse.db2
}
```

---

## SchemaFactory API

### Core Methods

#### `parseByFileName<T>(fileName: string, record: DB2Record): T | null`

Automatically detect and parse by DB2 file name (case-insensitive):

```typescript
const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', record);
const item = SchemaFactory.parseByFileName<ItemEntry>('Item.db2', record);
const sparse = SchemaFactory.parseByFileName<ItemSparseEntry>('ItemSparse.db2', record);
```

#### `parseByTableHash<T>(tableHash: number, record: DB2Record): T | null`

Parse by DB2 table hash from header:

```typescript
const header = loader.getHeader();
const spell = SchemaFactory.parseByTableHash<SpellEntry>(header.tableHash, record);
```

**Known Table Hashes:**
- Spell.db2: `0x8C2C0C55`
- Item.db2: `0x50238EC2`
- ItemSparse.db2: `0x919BE54E`

### Type-Safe Parsing Methods

#### `parseSpell(record: DB2Record): SpellEntry`

Type-safe spell parsing:

```typescript
const spell = SchemaFactory.parseSpell(record);
// Returns SpellEntry (never null)
```

#### `parseItemBasic(record: DB2Record): ItemEntry`

Parse Item.db2 basic data:

```typescript
const item = SchemaFactory.parseItemBasic(record);
```

#### `parseItemSparse(record: DB2Record): ItemSparseEntry`

Parse ItemSparse.db2 extended data:

```typescript
const sparse = SchemaFactory.parseItemSparse(record);
```

#### `parseItemTemplate(basicRecord: DB2Record, sparseRecord: DB2Record): ItemTemplate`

Combine Item.db2 and ItemSparse.db2:

```typescript
const itemLoader = DB2FileLoader.load('Item.db2');
const sparseLoader = DB2FileLoader.load('ItemSparse.db2');

const basicRecord = itemLoader.getRecord(25);
const sparseRecord = sparseLoader.getRecord(25);

const template = SchemaFactory.parseItemTemplate(basicRecord, sparseRecord);

console.log(template.basic.classId);  // From Item.db2
console.log(template.extended.name);  // From ItemSparse.db2
```

### Utility Methods

#### `hasSchema(fileName: string): boolean`

Check if schema exists for file:

```typescript
if (SchemaFactory.hasSchema('Spell.db2')) {
  // Parse safely
}
```

#### `getSupportedFiles(): string[]`

Get all registered schemas:

```typescript
const files = SchemaFactory.getSupportedFiles();
// Returns: ['spell.db2', 'item.db2', 'itemsparse.db2']
```

#### `getSchemaInfo(fileName: string): SchemaInfo | null`

Get schema metadata:

```typescript
const info = SchemaFactory.getSchemaInfo('Spell.db2');
console.log(info.name);        // 'Spell'
console.log(info.fileNames);   // ['Spell.db2']
console.log(info.tableHashes); // ['0x8C2C0C55']
```

---

## Schema-Specific Usage

### SpellSchema

#### Parsing

```typescript
import { SpellSchema } from './parsers/schemas/SpellSchema';

const spell = SpellSchema.parse(record);
```

#### Helper Methods

**`hasAttribute(spell: SpellEntry, attributeIndex: number, flag: number): boolean`**

Check if spell has specific attribute:

```typescript
// Check SPELL_ATTR0_PASSIVE (0x00000040)
if (SpellSchema.hasAttribute(spell, 0, 0x00000040)) {
  console.log('Spell is passive');
}

// Check SPELL_ATTR2_CANT_CRIT (0x00000002)
if (SpellSchema.hasAttribute(spell, 2, 0x00000002)) {
  console.log('Spell cannot crit');
}
```

**`getSchoolNames(schoolMask: number): string[]`**

Get school names from bitmask:

```typescript
const schools = SpellSchema.getSchoolNames(spell.schoolMask);
// Returns: ['Physical', 'Holy', 'Fire', etc.]
```

**`isPassive(spell: SpellEntry): boolean`**

Check if spell is passive:

```typescript
if (SpellSchema.isPassive(spell)) {
  console.log('Passive ability');
}
```

**`canCrit(spell: SpellEntry): boolean`**

Check if spell can crit:

```typescript
if (SpellSchema.canCrit(spell)) {
  console.log('Can critically strike');
}
```

**`getCastTime(spell: SpellEntry): number`**

Get cast time index:

```typescript
const castTimeIndex = SpellSchema.getCastTime(spell);
// Requires SpellCastTimes.db2 lookup for actual milliseconds
```

#### Common Spell Attributes

```typescript
// SPELL_ATTR0
const SPELL_ATTR0_PASSIVE = 0x00000040;
const SPELL_ATTR0_HIDDEN_CLIENTSIDE = 0x00000080;
const SPELL_ATTR0_CANT_CANCEL = 0x00040000;

// SPELL_ATTR1
const SPELL_ATTR1_CANT_BE_REFLECTED = 0x00000002;
const SPELL_ATTR1_CANT_BE_REDIRECTED = 0x00000004;

// SPELL_ATTR2
const SPELL_ATTR2_CANT_CRIT = 0x00000002;
const SPELL_ATTR2_IGNORE_LOS = 0x00000004;

// Check attribute
if (spell.attributes & SPELL_ATTR0_PASSIVE) {
  console.log('Passive spell');
}
```

#### Power Costs

```typescript
if (spell.powerCosts.length > 0) {
  const powerCost = spell.powerCosts[0];
  console.log(`Power type: ${powerCost.power}`);  // 0 = Mana, 1 = Rage, etc.
  console.log(`Amount: ${powerCost.amount}`);
}
```

#### Spell Family Flags

```typescript
// Check if spell belongs to Mage family
if (spell.spellFamilyName === 3) {  // SPELLFAMILY_MAGE
  const flags = spell.spellFamilyFlags;
  console.log(`Family flags: ${flags[0]}, ${flags[1]}, ${flags[2]}, ${flags[3]}`);
}
```

---

### ItemSchema

#### Parsing

```typescript
import { ItemSchema } from './parsers/schemas/ItemSchema';

// Parse basic
const item = ItemSchema.parseBasic(record);

// Parse sparse
const sparse = ItemSchema.parseSparse(record);

// Combine
const template = ItemSchema.combine(item, sparse);
```

#### Helper Methods

**`combine(basic: ItemEntry, sparse: ItemSparseEntry): ItemTemplate`**

Merge basic and sparse data:

```typescript
const template = ItemSchema.combine(basicEntry, sparseEntry);
```

**`isEquippable(item: ItemTemplate): boolean`**

Check if item can be equipped:

```typescript
if (ItemSchema.isEquippable(template)) {
  console.log('Can equip this item');
}
```

**`isWeapon(item: ItemTemplate): boolean`**

Check if item is a weapon:

```typescript
if (ItemSchema.isWeapon(template)) {
  const dps = ItemSchema.getWeaponDPS(template);
  console.log(`Weapon DPS: ${dps}`);
}
```

**`isArmor(item: ItemTemplate): boolean`**

Check if item is armor:

```typescript
if (ItemSchema.isArmor(template)) {
  console.log(`Armor: ${template.extended.armor}`);
}
```

**`isConsumable(item: ItemTemplate): boolean`**

Check if item is consumable:

```typescript
if (ItemSchema.isConsumable(template)) {
  console.log('Consumable item');
}
```

**`getQualityName(quality: ItemQuality): string`**

Get quality name:

```typescript
const name = ItemSchema.getQualityName(template.extended.overallQualityId);
// Returns: 'Poor', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'
```

**`getQualityColor(quality: ItemQuality): string`**

Get quality color hex code:

```typescript
const color = ItemSchema.getQualityColor(template.extended.overallQualityId);
// Returns: '#9d9d9d' (Poor), '#ffffff' (Common), '#0070dd' (Rare), etc.
```

**`canSellToVendor(item: ItemTemplate): boolean`**

Check if item can be sold:

```typescript
if (ItemSchema.canSellToVendor(template)) {
  console.log(`Sell price: ${template.extended.sellPrice} copper`);
}
```

**`isSoulbound(item: ItemTemplate): boolean`**

Check if item is soulbound:

```typescript
if (ItemSchema.isSoulbound(template)) {
  console.log('Soulbound item');
}
```

**`getPrimaryStatValue(item: ItemTemplate): number`**

Get primary stat value (first stat):

```typescript
const primaryStat = ItemSchema.getPrimaryStatValue(template);
console.log(`Primary stat: +${primaryStat}`);
```

**`getWeaponDPS(item: ItemTemplate): number`**

Calculate weapon DPS:

```typescript
if (ItemSchema.isWeapon(template)) {
  const dps = ItemSchema.getWeaponDPS(template);
  console.log(`DPS: ${dps.toFixed(2)}`);
}
```

#### Item Enumerations

**ItemQuality**

```typescript
enum ItemQuality {
  POOR = 0,         // Gray
  COMMON = 1,       // White
  UNCOMMON = 2,     // Green
  RARE = 3,         // Blue
  EPIC = 4,         // Purple
  LEGENDARY = 5,    // Orange
  ARTIFACT = 6,     // Light Gold
  HEIRLOOM = 7,     // Gold
  WOW_TOKEN = 8,    // Token
}
```

**ItemClass**

```typescript
enum ItemClass {
  CONSUMABLE = 0,
  CONTAINER = 1,
  WEAPON = 2,
  GEM = 3,
  ARMOR = 4,
  REAGENT = 5,
  PROJECTILE = 6,
  TRADE_GOODS = 7,
  // ... 20 total classes
}
```

**InventoryType**

```typescript
enum InventoryType {
  NON_EQUIP = 0,
  HEAD = 1,
  NECK = 2,
  SHOULDERS = 3,
  BODY = 4,
  CHEST = 5,
  WAIST = 6,
  LEGS = 7,
  FEET = 8,
  WRISTS = 9,
  HANDS = 10,
  FINGER = 11,
  TRINKET = 12,
  WEAPON = 13,
  SHIELD = 14,
  // ... more slots
}
```

#### Item Stats

```typescript
const stats = template.extended.stats;
stats.forEach(stat => {
  console.log(`${ItemModType[stat.type]}: +${stat.value}`);
});

// Example output:
// STRENGTH: +10
// STAMINA: +15
// CRIT_MELEE_RATING: +20
```

#### Item Sockets

```typescript
const sockets = template.extended.sockets;
sockets.forEach(socket => {
  console.log(`Socket color: ${socket.color}`);  // 1=Meta, 2=Red, 4=Yellow, 8=Blue
});
```

#### Item Spells

```typescript
const spells = template.extended.spells;
spells.forEach(spell => {
  console.log(`Spell ${spell.spellId}: Trigger ${spell.trigger}`);
  // trigger: 0=ON_USE, 1=ON_EQUIP, 2=CHANCE_ON_HIT, etc.
});
```

---

## Type Guards

### Purpose

Type guards provide runtime validation and type narrowing:

```typescript
import {
  isSpellEntry,
  isItemEntry,
  isItemSparseEntry,
  isItemTemplate
} from './parsers/schemas/SchemaFactory';
```

### Usage

```typescript
// Parse with unknown schema
const parsed = SchemaFactory.parseByTableHash(tableHash, record);

if (isSpellEntry(parsed)) {
  // TypeScript knows parsed is SpellEntry
  console.log(parsed.attributes);
}

if (isItemTemplate(parsed)) {
  // TypeScript knows parsed is ItemTemplate
  console.log(parsed.basic.id, parsed.extended.name);
}
```

### Safe Parsing

```typescript
function processParsedData(data: any) {
  if (isSpellEntry(data)) {
    // Safe to access spell fields
    if (SpellSchema.isPassive(data)) {
      console.log('Passive spell');
    }
    return;
  }

  if (isItemTemplate(data)) {
    // Safe to access item fields
    if (ItemSchema.isWeapon(data)) {
      console.log('Weapon item');
    }
    return;
  }

  console.log('Unknown data type');
}
```

---

## Helper Methods

### Spell Helpers

| Method | Returns | Description |
|--------|---------|-------------|
| `hasAttribute()` | boolean | Check attribute flag |
| `getSchoolNames()` | string[] | Get school names from mask |
| `isPassive()` | boolean | Check if passive spell |
| `canCrit()` | boolean | Check if spell can crit |
| `getCastTime()` | number | Get cast time index |

### Item Helpers

| Method | Returns | Description |
|--------|---------|-------------|
| `combine()` | ItemTemplate | Merge basic + sparse |
| `isEquippable()` | boolean | Check if equippable |
| `isWeapon()` | boolean | Check if weapon |
| `isArmor()` | boolean | Check if armor |
| `isConsumable()` | boolean | Check if consumable |
| `getQualityName()` | string | Get quality name |
| `getQualityColor()` | string | Get quality hex color |
| `canSellToVendor()` | boolean | Check if sellable |
| `isSoulbound()` | boolean | Check if soulbound |
| `getPrimaryStatValue()` | number | Get first stat value |
| `getWeaponDPS()` | number | Calculate weapon DPS |

---

## Advanced Usage

### Custom Schema Registration

To add new schemas, extend the registry system:

```typescript
// Create schema parser
class MyCustomParser implements ISchemaParser<MyEntry> {
  parse(record: DB2Record): MyEntry {
    return {
      id: record.getUInt32(0),
      // ... parse fields
    };
  }

  getSchemaName(): string {
    return 'MyCustom';
  }

  getFileNames(): string[] {
    return ['MyCustom.db2'];
  }

  getTableHashes(): number[] {
    return [0xDEADBEEF];
  }
}

// Register in SchemaRegistry.initialize()
```

### Batch Processing

```typescript
// Process all spells
const spellLoader = DB2FileLoader.load('Spell.db2');
const spellCount = spellLoader.getRecordCount();

for (let i = 0; i < spellCount; i++) {
  const record = spellLoader.getRecord(i);
  if (record) {
    const spell = SchemaFactory.parseSpell(record);

    // Process spell
    if (SpellSchema.isPassive(spell)) {
      passiveSpells.push(spell);
    }
  }
}
```

### Performance Optimization

```typescript
// Cache parsed entries
const spellCache = new Map<number, SpellEntry>();

function getSpell(id: number): SpellEntry {
  if (spellCache.has(id)) {
    return spellCache.get(id)!;
  }

  const record = spellLoader.getRecord(id);
  const spell = SchemaFactory.parseSpell(record);
  spellCache.set(id, spell);

  return spell;
}
```

---

## Best Practices

### 1. Use Type-Safe Methods

**Good:**
```typescript
const spell = SchemaFactory.parseSpell(record);
const item = SchemaFactory.parseItemBasic(record);
```

**Avoid:**
```typescript
const spell = SchemaFactory.parseByFileName('Spell.db2', record);  // Can return null
```

### 2. Validate Before Access

**Good:**
```typescript
if (SchemaFactory.hasSchema('Spell.db2')) {
  const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', record);
  if (spell) {
    console.log(spell.id);
  }
}
```

**Avoid:**
```typescript
const spell = SchemaFactory.parseByFileName<SpellEntry>('Spell.db2', record);
console.log(spell!.id);  // Assumes non-null
```

### 3. Use Helper Methods

**Good:**
```typescript
if (SpellSchema.isPassive(spell)) {
  // Passive spell logic
}
```

**Avoid:**
```typescript
if (spell.attributes & 0x00000040) {  // Magic number
  // Passive spell logic
}
```

### 4. Combine Item Data Properly

**Good:**
```typescript
const template = SchemaFactory.parseItemTemplate(basicRecord, sparseRecord);
console.log(template.extended.name);
```

**Avoid:**
```typescript
const basic = ItemSchema.parseBasic(basicRecord);
const sparse = ItemSchema.parseSparse(sparseRecord);
// Accessing basic and sparse separately is error-prone
```

### 5. Use Type Guards

**Good:**
```typescript
if (isSpellEntry(parsed)) {
  // TypeScript knows type
  console.log(parsed.attributes);
}
```

**Avoid:**
```typescript
console.log((parsed as SpellEntry).attributes);  // Unsafe cast
```

---

## Summary

The DB2 schema system provides:

- ✅ **Type-safe parsing** of WoW 11.2 DB2 files
- ✅ **Automatic schema selection** by name or hash
- ✅ **107 spell fields** + **147 item fields**
- ✅ **Helper methods** for common operations
- ✅ **Type guards** for runtime validation
- ✅ **Extensible** registration system

Use `SchemaFactory` for all parsing operations and leverage helper methods for cleaner, more maintainable code.

For more information, see:
- [SpellSchema.ts](../src/parsers/schemas/SpellSchema.ts)
- [ItemSchema.ts](../src/parsers/schemas/ItemSchema.ts)
- [SchemaFactory.ts](../src/parsers/schemas/SchemaFactory.ts)
