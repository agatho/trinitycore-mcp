#!/usr/bin/env node
/**
 * Enumerate what CASC actually indexes for the installed client.
 *
 * This reads the storage's own index, independent of any community listfile.
 * It answers two questions a listfile-driven extraction cannot:
 *   1. How many files does this build contain, named or not?
 *   2. Which FileDataIDs exist that the listfile never mentions?
 *
 * Usage:
 *   node scripts/casc-enumerate.js               # summary
 *   node scripts/casc-enumerate.js --out ids.json
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config();

const addonPath = path.join(__dirname, "..", "build", "Release", "casc_native.node");
const addon = require(addonPath);

const wowPath = process.env.WOW_PATH || "M:\\World of Warcraft";
const outArg = process.argv.indexOf("--out");
const outPath = outArg !== -1 ? process.argv[outArg + 1] : null;

const storage = new addon.CASCStorage(wowPath, 0, false);
if (!storage.isOpen()) {
  console.error("Failed to open CASC storage at", wowPath);
  process.exit(1);
}

console.log("Enumerating CASC index (this reads the storage, not a listfile)...");
const entries = storage.enumerateFiles("*", 5000000);

let withId = 0;
let minId = Infinity;
let maxId = -Infinity;
let totalBytes = 0;
const ids = [];

for (const e of entries) {
  totalBytes += e.size;
  if (e.fileDataId !== null && e.fileDataId !== undefined) {
    withId++;
    if (e.fileDataId < minId) minId = e.fileDataId;
    if (e.fileDataId > maxId) maxId = e.fileDataId;
    ids.push(e.fileDataId);
  }
}

console.log("");
console.log("total entries indexed :", entries.length.toLocaleString());
console.log("entries with FileDataID:", withId.toLocaleString());
console.log("FileDataID range       :", minId === Infinity ? "n/a" : `${minId} .. ${maxId}`);
console.log("total indexed size     :", (totalBytes / 1073741824).toFixed(2), "GB");
console.log("");
console.log("sample entries:");
for (const e of entries.slice(0, 5)) {
  console.log("  ", JSON.stringify(e.name), "fdid=" + e.fileDataId, "size=" + e.size);
}

if (outPath) {
  fs.writeFileSync(outPath, JSON.stringify(ids));
  console.log("");
  console.log("wrote", ids.length.toLocaleString(), "FileDataIDs to", outPath);
}

storage.close();
