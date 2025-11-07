/**
 * Test Utilities
 *
 * Comprehensive utilities and mock generators for testing TrinityCore MCP.
 *
 * @module test-utilities
 */

import type { DatabaseConfig } from "../types/database";
import type { SOAPConnectionConfig } from "../types/soap";

// ============================================================================
// Mock Data Generators
// ============================================================================

/**
 * Generate mock database config
 */
export function mockDatabaseConfig(overrides: Partial<DatabaseConfig> = {}): DatabaseConfig {
  return {
    host: "localhost",
    port: 3306,
    database: "world",
    user: "trinity",
    password: "trinity",
    ...overrides,
  };
}

/**
 * Generate mock SOAP config
 */
export function mockSOAPConfig(overrides: Partial<SOAPConnectionConfig> = {}): SOAPConnectionConfig {
  return {
    host: "localhost",
    port: 7878,
    username: "admin",
    password: "admin",
    ...overrides,
  };
}

/**
 * Generate random string
 */
export function randomString(length: number = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random number
 */
export function randomNumber(min: number = 0, max: number = 100): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random boolean
 */
export function randomBoolean(): boolean {
  return Math.random() >= 0.5;
}

/**
 * Generate random date
 */
export function randomDate(start?: Date, end?: Date): Date {
  const startTime = start?.getTime() || Date.now() - 365 * 24 * 60 * 60 * 1000;
  const endTime = end?.getTime() || Date.now();
  return new Date(startTime + Math.random() * (endTime - startTime));
}

/**
 * Generate random array
 */
export function randomArray<T>(generator: () => T, length?: number): T[] {
  const size = length || randomNumber(1, 10);
  return Array.from({ length: size }, generator);
}

/**
 * Generate mock creature data
 */
export function mockCreature(overrides: Partial<any> = {}) {
  return {
    entry: randomNumber(1, 100000),
    name: `Creature_${randomString(8)}`,
    subname: randomString(10),
    minlevel: randomNumber(1, 80),
    maxlevel: randomNumber(1, 80),
    faction: randomNumber(1, 2000),
    npcflag: randomNumber(0, 1000),
    speed_walk: 1.0,
    speed_run: 1.14286,
    scale: 1.0,
    rank: randomNumber(0, 4),
    dmgschool: 0,
    BaseAttackTime: 2000,
    RangeAttackTime: 2000,
    unit_class: randomNumber(1, 4),
    unit_flags: 0,
    dynamicflags: 0,
    family: 0,
    trainer_type: 0,
    trainer_spell: 0,
    trainer_class: 0,
    trainer_race: 0,
    type: randomNumber(0, 12),
    type_flags: 0,
    lootid: randomNumber(0, 100000),
    pickpocketloot: 0,
    skinloot: 0,
    AIName: "SmartAI",
    MovementType: randomNumber(0, 2),
    HoverHeight: 1,
    HealthModifier: 1.0,
    ManaModifier: 1.0,
    ArmorModifier: 1.0,
    DamageModifier: 1.0,
    ExperienceModifier: 1.0,
    RacialLeader: 0,
    movementId: 0,
    RegenHealth: 1,
    mechanic_immune_mask: 0,
    spell_school_immune_mask: 0,
    flags_extra: 0,
    ScriptName: "",
    ...overrides,
  };
}

/**
 * Generate mock gameobject data
 */
export function mockGameObject(overrides: Partial<any> = {}) {
  return {
    entry: randomNumber(1, 100000),
    type: randomNumber(0, 50),
    displayId: randomNumber(1, 20000),
    name: `GameObject_${randomString(8)}`,
    IconName: "",
    castBarCaption: "",
    unk1: "",
    size: 1.0,
    Data0: 0,
    Data1: 0,
    Data2: 0,
    Data3: 0,
    Data4: 0,
    Data5: 0,
    Data6: 0,
    Data7: 0,
    Data8: 0,
    Data9: 0,
    Data10: 0,
    Data11: 0,
    Data12: 0,
    Data13: 0,
    Data14: 0,
    Data15: 0,
    Data16: 0,
    Data17: 0,
    Data18: 0,
    Data19: 0,
    Data20: 0,
    Data21: 0,
    Data22: 0,
    Data23: 0,
    AIName: "SmartGameObjectAI",
    ScriptName: "",
    ...overrides,
  };
}

/**
 * Generate mock spawn position
 */
export function mockPosition(overrides: Partial<any> = {}) {
  return {
    x: randomNumber(-10000, 10000),
    y: randomNumber(-10000, 10000),
    z: randomNumber(-500, 500),
    orientation: Math.random() * 2 * Math.PI,
    mapId: randomNumber(0, 1),
    ...overrides,
  };
}

/**
 * Generate mock player data
 */
export function mockPlayer(overrides: Partial<any> = {}) {
  return {
    guid: randomNumber(1, 1000000),
    account: randomNumber(1, 10000),
    name: `Player_${randomString(8)}`,
    race: randomNumber(1, 11),
    class: randomNumber(1, 11),
    gender: randomNumber(0, 1),
    level: randomNumber(1, 80),
    xp: randomNumber(0, 1000000),
    money: randomNumber(0, 1000000),
    playerBytes: 0,
    playerBytes2: 0,
    playerFlags: 0,
    position_x: randomNumber(-10000, 10000),
    position_y: randomNumber(-10000, 10000),
    position_z: randomNumber(-500, 500),
    map: randomNumber(0, 1),
    orientation: Math.random() * 2 * Math.PI,
    online: randomBoolean(),
    ...overrides,
  };
}

/**
 * Generate mock item data
 */
export function mockItem(overrides: Partial<any> = {}) {
  return {
    entry: randomNumber(1, 100000),
    class: randomNumber(0, 15),
    subclass: randomNumber(0, 20),
    name: `Item_${randomString(8)}`,
    displayid: randomNumber(1, 70000),
    Quality: randomNumber(0, 6),
    Flags: 0,
    BuyCount: 1,
    BuyPrice: randomNumber(0, 1000000),
    SellPrice: randomNumber(0, 500000),
    InventoryType: randomNumber(0, 26),
    AllowableClass: -1,
    AllowableRace: -1,
    ItemLevel: randomNumber(1, 80),
    RequiredLevel: randomNumber(1, 80),
    RequiredSkill: 0,
    RequiredSkillRank: 0,
    maxcount: 0,
    stackable: randomNumber(1, 200),
    ContainerSlots: 0,
    bonding: randomNumber(0, 4),
    description: `Description for ${randomString(10)}`,
    PageText: 0,
    LanguageID: 0,
    PageMaterial: 0,
    startquest: 0,
    lockid: 0,
    Material: randomNumber(0, 8),
    sheath: randomNumber(0, 7),
    RandomProperty: 0,
    RandomSuffix: 0,
    block: 0,
    itemset: 0,
    MaxDurability: randomNumber(0, 100),
    area: 0,
    Map: 0,
    BagFamily: 0,
    TotemCategory: 0,
    socketColor_1: 0,
    socketContent_1: 0,
    socketColor_2: 0,
    socketContent_2: 0,
    socketColor_3: 0,
    socketContent_3: 0,
    socketBonus: 0,
    GemProperties: 0,
    RequiredDisenchantSkill: -1,
    ArmorDamageModifier: 0,
    ScriptName: "",
    DisenchantID: 0,
    FoodType: 0,
    minMoneyLoot: 0,
    maxMoneyLoot: 0,
    ...overrides,
  };
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Delay for async tests
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function until success
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 100,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Measure execution time
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
}

/**
 * Create spy function
 */
export function createSpy<T extends (...args: any[]) => any>() {
  const calls: Array<{ args: any[]; result?: any; error?: Error; timestamp: number }> = [];

  const spy = ((...args: Parameters<T>) => {
    const call: { args: any[]; result?: any; error?: Error; timestamp: number } = {
      args,
      timestamp: Date.now(),
      result: undefined,
      error: undefined,
    };

    try {
      // Store call
      calls.push(call);
      return call.result;
    } catch (error) {
      call.error = error as Error;
      throw error;
    }
  }) as T & {
    calls: typeof calls;
    callCount: () => number;
    calledWith: (...args: any[]) => boolean;
    reset: () => void;
  };

  spy.calls = calls;
  spy.callCount = () => calls.length;
  spy.calledWith = (...args: any[]) => calls.some((c) => JSON.stringify(c.args) === JSON.stringify(args));
  spy.reset = () => calls.splice(0, calls.length);

  return spy;
}

/**
 * Create mock object
 */
export function createMock<T extends object>(implementation?: Partial<T>): T {
  return new Proxy({} as T, {
    get(target, prop) {
      if (implementation && prop in implementation) {
        return implementation[prop as keyof T];
      }

      // Return spy function for function properties
      if (typeof prop === "string") {
        return createSpy();
      }

      return undefined;
    },
  });
}

/**
 * Create test context
 */
export class TestContext {
  private cleanup: Array<() => Promise<void> | void> = [];

  /**
   * Register cleanup function
   */
  public onCleanup(fn: () => Promise<void> | void): void {
    this.cleanup.push(fn);
  }

  /**
   * Run all cleanup functions
   */
  public async runCleanup(): Promise<void> {
    for (const fn of this.cleanup.reverse()) {
      await fn();
    }
    this.cleanup = [];
  }

  /**
   * Create temporary directory
   */
  public async createTempDir(): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");
    const os = await import("os");

    const tempDir = path.join(os.tmpdir(), `trinity-test-${randomString(8)}`);
    await fs.mkdir(tempDir, { recursive: true });

    this.onCleanup(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    return tempDir;
  }

  /**
   * Create temporary file
   */
  public async createTempFile(content: string, ext: string = ".txt"): Promise<string> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const tempDir = await this.createTempDir();
    const tempFile = path.join(tempDir, `test-file-${randomString(8)}${ext}`);
    await fs.writeFile(tempFile, content);

    return tempFile;
  }
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert array contains
 */
export function assertArrayContains<T>(array: T[], item: T): void {
  if (!array.includes(item)) {
    throw new Error(`Array does not contain ${item}`);
  }
}

/**
 * Assert array length
 */
export function assertArrayLength<T>(array: T[], expectedLength: number): void {
  if (array.length !== expectedLength) {
    throw new Error(`Expected array length ${expectedLength} but got ${array.length}`);
  }
}

/**
 * Assert object has property
 */
export function assertHasProperty<T extends object>(obj: T, prop: string): void {
  if (!(prop in obj)) {
    throw new Error(`Object does not have property ${prop}`);
  }
}

/**
 * Assert is typeof
 */
export function assertTypeOf(value: any, expectedType: string): void {
  if (typeof value !== expectedType) {
    throw new Error(`Expected type ${expectedType} but got ${typeof value}`);
  }
}

/**
 * Assert matches regex
 */
export function assertMatches(value: string, pattern: RegExp): void {
  if (!pattern.test(value)) {
    throw new Error(`Value "${value}" does not match pattern ${pattern}`);
  }
}

/**
 * Assert throws
 */
export function assertThrows(fn: () => void, expectedError?: string): void {
  try {
    fn();
    throw new Error("Expected function to throw");
  } catch (error) {
    if (expectedError && (error as Error).message !== expectedError) {
      throw new Error(
        `Expected error "${expectedError}" but got "${(error as Error).message}"`,
      );
    }
  }
}

/**
 * Assert async throws
 */
export async function assertAsyncThrows(
  fn: () => Promise<void>,
  expectedError?: string,
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected function to throw");
  } catch (error) {
    if (expectedError && (error as Error).message !== expectedError) {
      throw new Error(
        `Expected error "${expectedError}" but got "${(error as Error).message}"`,
      );
    }
  }
}

// ============================================================================
// Snapshot Testing
// ============================================================================

export class SnapshotManager {
  private snapshots: Map<string, any> = new Map();
  private snapshotPath: string;

  constructor(snapshotPath: string) {
    this.snapshotPath = snapshotPath;
  }

  /**
   * Load snapshots
   */
  public async load(): Promise<void> {
    try {
      const fs = await import("fs/promises");
      const content = await fs.readFile(this.snapshotPath, "utf-8");
      const data = JSON.parse(content);

      for (const [key, value] of Object.entries(data)) {
        this.snapshots.set(key, value);
      }
    } catch {
      // No snapshots file yet
    }
  }

  /**
   * Save snapshots
   */
  public async save(): Promise<void> {
    const fs = await import("fs/promises");
    const path = await import("path");

    const data: Record<string, any> = {};
    for (const [key, value] of this.snapshots.entries()) {
      data[key] = value;
    }

    await fs.mkdir(path.dirname(this.snapshotPath), { recursive: true });
    await fs.writeFile(this.snapshotPath, JSON.stringify(data, null, 2));
  }

  /**
   * Match snapshot
   */
  public match(testName: string, value: any): void {
    const serialized = JSON.stringify(value, null, 2);

    if (!this.snapshots.has(testName)) {
      // Create new snapshot
      this.snapshots.set(testName, serialized);
    } else {
      // Compare with existing
      const existing = this.snapshots.get(testName);
      if (existing !== serialized) {
        throw new Error(`Snapshot mismatch for ${testName}`);
      }
    }
  }
}
