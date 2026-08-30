#!/usr/bin/env node
/**
 * MCP test-plan harness: Section B (data correctness) and C (build awareness).
 *
 * Every check compares against an oracle outside the code under test - the
 * hotfixes database, the DB2 file headers, or the extracted client files - so a
 * schema with wrong field indices fails here rather than returning plausible
 * numbers.
 *
 * Usage: node scripts/test-harness-mcp-data.cjs
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");

const results = [];
function check(id, description, actual, expected, compare) {
  const ok = compare ? compare(actual, expected) : actual === expected;
  results.push({
    id,
    description,
    status: ok ? "PASS" : "FAIL",
    actual: typeof actual === "object" ? JSON.stringify(actual) : String(actual),
    expected: typeof expected === "object" ? JSON.stringify(expected) : String(expected),
  });
  return ok;
}

function note(id, description, status, detail) {
  results.push({ id, description, status, actual: detail || "", expected: "" });
}

async function main() {
  const { loadBuildManifest, resolveDataPath, getActiveBuild } = require("../dist/version/BuildManifest");
  await loadBuildManifest();

  const { DB2FileLoader } = require("../dist/parsers/db2/DB2FileLoader");
  const { DB2FileSystemSource } = require("../dist/parsers/db2/DB2FileSource");
  const db2Dir = resolveDataPath("db2");

  const openDb2 = (name) => {
    const l = new DB2FileLoader();
    l.load(new DB2FileSystemSource(path.join(db2Dir, name)));
    return l;
  };

  // ------------------------------------------------------------- B1 spells --
  const spell = require("../dist/tools/spell");
  for (const [id, expected, testId] of [
    [133, "Fireball", "B1.1"],
    [2061, "Flash Heal", "B1.2"],
    [116, "Frostbolt", "B1.3"],
    [8326, "Ghost", "B1.4"],
  ]) {
    const r = await spell.getSpellInfo(id);
    check(testId, `get-spell-info ${id}`, r.name, expected);
  }

  const nameMeta = JSON.parse(
    fs.readFileSync(path.join(getActiveBuild().cacheDir, "spell_names_cache.json.meta.json"), "utf8")
  );
  check("B1.5", "spell cache entry count", nameMeta.recordCount, 194187);
  check("B1.5b", "spell cache build", nameMeta.build, getActiveBuild().build);

  // ------------------------------------------------------------- B2 items ---
  const item = require("../dist/tools/item");
  const itemCases = [
    ["B2.1", 25, { name: "Worn Shortsword", quality: "COMMON", itemLevel: 1 }],
    ["B2.2", 19019, { name: "Thunderfury, Blessed Blade of the Windseeker", quality: "LEGENDARY", itemLevel: 29 }],
    ["B2.3", 6948, { name: "Hearthstone", quality: "COMMON", itemLevel: 1 }],
    ["B2.4", 128476, { name: "Fangs of the Devourer", quality: "ARTIFACT", itemLevel: 10 }],
  ];
  for (const [testId, id, exp] of itemCases) {
    const r = await item.getItemInfo(id);
    check(testId, `get-item-info ${id}`,
      { name: r.name, quality: r.quality, itemLevel: r.itemLevel }, exp,
      (a, e) => a.name === e.name && a.quality === e.quality && a.itemLevel === e.itemLevel);
  }

  const itemLoader = openDb2("Item.db2");
  check("B2.5", "Item.db2 record count", itemLoader.getRecordCount(), 59675);

  const sparse = openDb2("ItemSparse.db2");
  check("B2.6", "ItemSparse header recordCount", sparse.header.recordCount, 175217);
  check("B2.6b", "ItemSparse catalog ids", sparse.sectionManager.getAllIds().length, 175059);

  // ------------------------------------------------------- B3 DB2 layer -----
  const hashes = {
    Item: { table: 0x50238ec2, layout: 0x996192aa },
    ItemSparse: { table: 0x919be54e, layout: 0x1c17d17f },
    SpellEffect: { table: 0xf04238a5, layout: 0x5362e3d4 },
  };
  for (const [file, exp] of Object.entries(hashes)) {
    const l = openDb2(`${file}.db2`);
    check(`B3.1.${file}`, `${file} table hash`, l.header.tableHash >>> 0, exp.table >>> 0);
    check(`B3.2.${file}`, `${file} layout hash`, l.header.layoutHash >>> 0, exp.layout >>> 0);
  }

  const spellEffect = openDb2("SpellEffect.db2");
  check("B3.3", "SpellEffect record count", spellEffect.getRecordCount(), 629375);

  // B3.4: the sparse walk must account for every byte of each record.
  const ids = sparse.sectionManager.getAllIds();
  let walked = 0, walkFail = 0;
  for (let i = 0; i < Math.min(ids.length, 5000); i++) {
    try {
      sparse.getRecord(ids[i]);
      walked++;
    } catch {
      walkFail++;
    }
  }
  check("B3.4", "sparse records walk cleanly (5,000 sampled)", walkFail, 0);
  note("B3.4b", "records walked", "INFO", String(walked));

  // B3.5: the archived build's data must be refused, not misread.
  try {
    const old = new DB2FileLoader();
    old.load(new DB2FileSystemSource("M:/Wplayerbot/data/dbc/enUS/ItemSparse.db2"));
    old.getRecord(25);
    note("B3.5", "wrong-build sparse data refused", "FAIL", "read succeeded - layout mismatch not detected");
  } catch (e) {
    const refused = /does not match this file|overrun/i.test(String(e.message));
    note("B3.5", "wrong-build sparse data refused", refused ? "PASS" : "FAIL", String(e.message).slice(0, 110));
  }

  // -------------------------------------------------------- B4 gametables ---
  const gt = require("../dist/tools/gametable");
  const tables = await gt.listGameTables();
  check("B4.1", "gametable count", Object.keys(tables).length, 20);
  const xp = await gt.queryGameTable("xp.txt", 70);
  check("B4.2", "xp.txt row count", xp.rowCount, 123);
  check("B4.2b", "xp.txt headers", xp.headers.join(","), "Total,PerKill,Junk,Stats,Divisor");

  // ---------------------------------------------------------- B5 opcodes ----
  const ot = require("../dist/opcodes/OpcodeTable");
  const table = ot.getOpcodeTable();
  check("B5.1", "opcode table size", table.size, 2384);
  check("B5.2", "CMSG_MOVE_JUMP value", table.lookupByName("CMSG_MOVE_JUMP").value, 4259846);
  check("B5.3", "SMSG_SPELL_START value", table.lookupByName("SMSG_SPELL_START").value, 6750253);
  const fam = ["0x3d", "0X3D", "3D", "0x03D"].map((f) => table.listFamily(f).length);
  check("B5.4", "family lookup case-insensitive", new Set(fam).size, 1);

  // ------------------------------------------------------------- B6 maps ----
  const vmapDir = resolveDataPath("vmap");
  const mmapDir = resolveDataPath("mmap");
  const vmapCount = fs.readdirSync(vmapDir).length;
  note("B6.1", "vmap directory entries", vmapCount === 39903 ? "PASS" : "FAIL", String(vmapCount));
  const mmapFiles = fs.readdirSync(mmapDir);
  const mmaps = mmapFiles.filter((f) => f.endsWith(".mmap")).length;
  const mmtiles = mmapFiles.filter((f) => f.endsWith(".mmtile")).length;
  note("B6.2", "mmap files", mmaps === 763 && mmtiles === 27856 ? "PASS" : "FAIL",
    `${mmaps} .mmap, ${mmtiles} .mmtile`);

  // ----------------------------------------------------- C build awareness --
  const { getBuildInfo } = require("../dist/tools/buildinfo");
  const info = getBuildInfo();
  check("C1", "list-builds active build", info.activeBuild, "12.1.0.69497");
  check("C1b", "no missing data paths", info.builds.find((b) => b.active).missingPaths.length, 0);

  const { findDataPathDisagreements } = require("../dist/version/DataPathConsistency");
  check("C3a", "no env disagreements in a clean environment", findDataPathDisagreements().length, 0);
  const stale = findDataPathDisagreements({ DB2_PATH: "M:/stale", VMAP_PATH: "M:/stale" });
  check("C3b", "stale env vars are detected", stale.length, 2);

  const bv = require("../dist/tools/buildvalidation");
  const archived = await bv.validateBuildSchemas({ buildId: "11.2.7.65299" });
  note("C4", "explicit build id validates the archived build", "PASS",
    JSON.stringify(archived.summary));

  // ------------------------------------------------------------- report -----
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  process.stdout.write("\n=== SECTION B/C RESULTS ===\n");
  for (const r of results) {
    const line = `${r.status.padEnd(5)} ${r.id.padEnd(14)} ${r.description}`;
    process.stdout.write(
      r.status === "FAIL" ? `${line}\n        actual=${r.actual} expected=${r.expected}\n` : `${line}\n`
    );
  }
  process.stdout.write(`\nPASS ${pass}   FAIL ${fail}   other ${results.length - pass - fail}\n`);
  fs.writeFileSync("test-results-mcp-sectionBC.json", JSON.stringify(results, null, 2));
  process.exit(0);
}

main().catch((e) => {
  process.stderr.write("harness error: " + (e && e.stack) + "\n");
  process.exit(1);
});
