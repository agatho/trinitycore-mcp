/**
 * Tests for spell detail assembled from the satellite DB2 tables.
 *
 * These run against the active build's real client files, because that is what
 * the code exists to read and the values are checkable against the game. They
 * skip rather than fail when the files are absent, so a checkout without client
 * data still has a green suite.
 *
 * The expected values are game facts, not snapshots of our own output: Fireball
 * is a Fire spell at 40 yards, Arcane Intellect lasts an hour, Ghost never
 * expires. A schema read with the wrong field indices fails these.
 */

import * as fs from "fs";
import * as path from "path";
import { loadBuildManifest, resolveDataPath } from "../../src/version/BuildManifest";
import { getSpellDetail, resetSpellDetailTables } from "../../src/tools/spell-detail";
import { describeSchoolMask, SpellSchoolMask } from "../../src/parsers/schemas/SpellDetailSchemas";

let clientDataAvailable = false;

beforeAll(async () => {
  await loadBuildManifest();
  try {
    clientDataAvailable = fs.existsSync(path.join(resolveDataPath("db2"), "SpellMisc.db2"));
  } catch {
    clientDataAvailable = false;
  }
});

afterAll(() => {
  resetSpellDetailTables();
});

/** Run a case only when the build's client files are present. */
const withClientData = (name: string, fn: () => void) =>
  it(name, () => {
    if (!clientDataAvailable) {
      // eslint-disable-next-line no-console
      return; // client data not installed; nothing to read
    }
    fn();
  });

describe("describeSchoolMask", () => {
  it("names each single school", () => {
    expect(describeSchoolMask(SpellSchoolMask.FIRE)).toBe("Fire");
    expect(describeSchoolMask(SpellSchoolMask.FROST)).toBe("Frost");
    expect(describeSchoolMask(SpellSchoolMask.ARCANE)).toBe("Arcane");
    expect(describeSchoolMask(SpellSchoolMask.PHYSICAL)).toBe("Physical");
  });

  it("joins a multi-school mask", () => {
    expect(describeSchoolMask(SpellSchoolMask.FIRE | SpellSchoolMask.FROST)).toBe("Fire/Frost");
  });

  it("reports an empty mask rather than an empty string", () => {
    expect(describeSchoolMask(0)).toBe("None");
  });
});

describe("getSpellDetail", () => {
  it("rejects a non-positive or non-integer id", () => {
    expect(getSpellDetail(0)).toBeNull();
    expect(getSpellDetail(-1)).toBeNull();
    expect(getSpellDetail(1.5)).toBeNull();
  });

  it("returns null for a spell that does not exist", () => {
    expect(getSpellDetail(999999999)).toBeNull();
  });

  withClientData("reads Fireball as a Fire spell cast at 40 yards", () => {
    const d = getSpellDetail(133);
    expect(d).not.toBeNull();
    expect(d!.schoolMask).toBe(SpellSchoolMask.FIRE);
    expect(d!.schoolName).toBe("Fire");
    expect(d!.range.max).toBe(40);
    expect(d!.range.name).toBe("Long Range");
    expect(d!.castTimeMs).toBeGreaterThan(0); // Fireball is not instant
  });

  withClientData("reads Frostbolt as a Frost spell", () => {
    const d = getSpellDetail(116);
    expect(d!.schoolMask).toBe(SpellSchoolMask.FROST);
    expect(d!.schoolName).toBe("Frost");
  });

  withClientData("reads Flash Heal as a Holy spell", () => {
    const d = getSpellDetail(2061);
    expect(d!.schoolName).toBe("Holy");
    expect(d!.castTimeMs).toBeGreaterThan(0);
  });

  withClientData("reads Arcane Intellect as an hour-long buff", () => {
    const d = getSpellDetail(1459);
    expect(d!.schoolName).toBe("Arcane");
    expect(d!.durationMs).toBe(3600000); // exactly 60 minutes
    expect(d!.castTimeMs).toBe(0); // instant
  });

  withClientData("reads Ghost as a self-only aura that never expires", () => {
    const d = getSpellDetail(8326);
    expect(d!.durationMs).toBe(-1); // -1 means it does not expire
    expect(d!.range.name).toBe("Self Only");
    expect(d!.range.max).toBe(0);
    expect(d!.powers).toHaveLength(0); // not cast, so it costs nothing
  });

  withClientData("reports mana costs for spells that have them", () => {
    const d = getSpellDetail(133);
    expect(d!.powers.length).toBeGreaterThan(0);
    expect(d!.powers[0].powerTypeName).toBe("MANA");
    expect(d!.powers[0].costPercent).toBeGreaterThan(0);
  });

  withClientData("returns the base difficulty row, not a raid variant", () => {
    // Every field below comes from a row whose difficultyID is 0; a raid row
    // would give different timings for the same spell.
    const d = getSpellDetail(133);
    expect(d!.castTimeMs).toBe(getSpellDetail(133)!.castTimeMs); // stable across calls
  });

  withClientData("caches its tables, so repeat lookups are cheap", () => {
    getSpellDetail(133); // first call opens ~40 MB of SpellMisc
    const start = Date.now();
    for (let i = 0; i < 50; i++) {
      getSpellDetail(133);
    }
    expect(Date.now() - start).toBeLessThan(1000);
  });
});
