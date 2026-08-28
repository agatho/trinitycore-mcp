/**
 * Tests for src/data version labelling ("content sweep").
 *
 * Verifies:
 * - Every hand-authored src/data module exports a static SOURCE_BUILD
 *   constant recording the game patch its values were actually sourced
 *   against (not a dynamic lookup against the active client build - see
 *   Task 12 Ruling 1).
 * - spell-attributes.ts, spell-ranges.ts, and xp-per-level.ts no longer
 *   carry the old "12.0.0" literal anywhere in the file.
 * - stat-priorities.ts is handled differently: because some specs could
 *   not be genuinely re-sourced against a newer patch, any entry that still
 *   carries `patch: '12.0.0'` MUST also carry `staleForBuild: true` so the
 *   gap is visible. Relabelling an un-re-sourced entry to a newer patch
 *   string without doing the work is exactly the failure this migration
 *   exists to prevent, so this test does not blanket-forbid the "12.0.0"
 *   literal in that file - it forbids an *unmarked* one.
 * - package.json no longer describes the project as WoW 12.0.
 *
 * @module tests/data/source-build
 */

import * as fs from "fs";
import * as path from "path";

const DATA_FILES = [
  "spell-attributes.ts",
  "spell-ranges.ts",
  "stat-priorities.ts",
  "xp-per-level.ts",
];

// Files whose content is NOT re-sourced per-entry, so a bare "12.0.0" (or
// similar) literal anywhere in the file would always be a stale/false claim.
const STRICT_NO_LEGACY_PATCH_FILES = [
  "spell-attributes.ts",
  "spell-ranges.ts",
  "xp-per-level.ts",
];

function readDataFile(fileName: string): string {
  return fs.readFileSync(path.join("src", "data", fileName), "utf8");
}

describe("src/data version labelling", () => {
  it("exports SOURCE_BUILD from every data module", () => {
    for (const f of DATA_FILES) {
      const src = readDataFile(f);
      expect(src).toMatch(/export const SOURCE_BUILD/);
    }
  });

  it("SOURCE_BUILD is a static string constant, not a dynamic lookup", () => {
    for (const f of DATA_FILES) {
      const src = readDataFile(f);
      const match = src.match(/export const SOURCE_BUILD\s*=\s*(.+?);/);
      expect(match).not.toBeNull();
      // Must be a quoted string literal, e.g. "12.1.0" or "12.0.x-20251222" -
      // never a function/arrow (`(): string => ...`) or a call expression
      // pulling from getActiveBuild().
      expect(match![1].trim()).toMatch(/^["'][^"']+["']$/);
      expect(src).not.toMatch(/SOURCE_BUILD\s*=\s*\(\)/);
      expect(src).not.toMatch(/getActiveBuild/);
    }
  });

  it("contains no hard-coded 12.0.0 patch literal in the non-content-swept files", () => {
    for (const f of STRICT_NO_LEGACY_PATCH_FILES) {
      const src = readDataFile(f);
      expect(src).not.toMatch(/["']12\.0\.0["']/);
    }
  });

  it("stat-priorities.ts: every entry still on patch 12.0.0 is explicitly marked staleForBuild", () => {
    const src = readDataFile("stat-priorities.ts");

    // The interface must declare the escape hatch used to mark un-re-sourced
    // entries, so a future entry can't silently omit it.
    expect(src).toMatch(/staleForBuild\?\s*:\s*boolean/);

    // Split into individual `{ ... }` StatPriority object literals within
    // the STAT_PRIORITIES array and check each one that still declares
    // patch: '12.0.0'.
    const entryBlocks = src.split(/\{\s*\n\s*classId:/).slice(1);
    expect(entryBlocks.length).toBeGreaterThan(0);

    for (const block of entryBlocks) {
      const isLegacyPatch = /patch:\s*['"]12\.0\.0['"]/.test(block);
      if (isLegacyPatch) {
        expect(block).toMatch(/staleForBuild:\s*true/);
      }
    }
  });

  it("no longer describes the package as WoW 12.0", () => {
    const pkg = fs.readFileSync("package.json", "utf8");
    expect(pkg).not.toMatch(/12\.0 \(Midnight\)/);
  });

  it("does not overclaim full WoW 12.1 support in package.json", () => {
    const pkg = fs.readFileSync("package.json", "utf8");
    const parsed = JSON.parse(pkg) as { description?: string };
    const description = parsed.description ?? "";

    // The client-data cutover to 12.1 is parked - the server still serves
    // 12.0.x DB2/DBC data - so the description must not claim the project
    // targets/supports "World of Warcraft 12.1" outright (mentioning 12.1
    // opcode tables specifically is fine and expected).
    expect(description).not.toMatch(/World of Warcraft 12\.1\b/);
    expect(description).not.toMatch(/WoW 12\.1 \(Midnight\)/);
  });
});
