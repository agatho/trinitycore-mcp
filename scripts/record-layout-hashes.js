#!/usr/bin/env node
/**
 * Record DB2 layoutHash values for a build, so schemas can declare what they
 * were written against. Reads offset 156 of each DB2 header (see DB2Header.ts).
 *
 * Usage: node scripts/record-layout-hashes.js --build 69497 --dir "M:\\path\\to\\dbc\\enUS"
 */
const fs = require("fs");
const path = require("path");

const FILES = [
  ["SpellSchema", "SpellName.db2"],
  ["SpellEffectSchema", "SpellEffect.db2"],
  ["ItemSchema", "Item.db2"],
  ["ItemSparseSchema", "ItemSparse.db2"],
  ["ChrClassesSchema", "ChrClasses.db2"],
  ["ChrClassesXPowerTypesSchema", "ChrClassesXPowerTypes.db2"],
  ["ChrRacesSchema", "ChrRaces.db2"],
  ["CharBaseInfoSchema", "CharBaseInfo.db2"],
  ["TalentSchema", "Talent.db2"],
];

const args = process.argv.slice(2);
const build = Number(args[args.indexOf("--build") + 1]);
const dir = args[args.indexOf("--dir") + 1];

if (!build || !dir) {
  console.error("Usage: node scripts/record-layout-hashes.js --build <n> --dir <db2 dir>");
  process.exit(1);
}

for (const [schema, file] of FILES) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) {
    console.log(`// ${schema}: ${file} NOT FOUND at ${p}`);
    continue;
  }
  const fd = fs.openSync(p, "r");
  const buf = Buffer.alloc(160);
  fs.readSync(fd, buf, 0, 160, 0);
  fs.closeSync(fd);
  const signature = buf.toString("ascii", 0, 4);
  const layoutHash = buf.readUInt32LE(156);
  console.log(`// ${schema} (${file}, ${signature})`);
  console.log(`[${build}, 0x${layoutHash.toString(16).padStart(8, "0")}],`);
}
