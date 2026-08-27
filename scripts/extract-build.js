#!/usr/bin/env node
/**
 * Build extraction orchestrator.
 *
 * The single, supported way to pull DB2/DBC/GameTable data (and the CASC
 * listfile) for a declared WoW client build out of a local installation and
 * into the directories the build manifest (config/builds.json) says they
 * belong in. VMap/MMap data is never produced here -- TrinityCore's own
 * vmap4extractor / mmaps_generator make that data; this script only verifies
 * it is present for the build and records its hashes.
 *
 * This file is a plain orchestrator (not unit tested). The manifest FORMAT
 * it writes -- what "an extraction happened and here is what it produced"
 * means -- lives in src/version/ExtractionManifest.ts, which is unit tested.
 *
 * Usage:
 *   node scripts/extract-build.js --build 12.1.0.69497
 *   node scripts/extract-build.js --build 12.1.0.69497 --only db2
 *   node scripts/extract-build.js --build 12.1.0.69497 --only vmap
 *   node scripts/extract-build.js --build 12.1.0.69497 --dry-run
 *   node scripts/extract-build.js --build 12.1.0.69497 --force
 *
 * Flags:
 *   --build <id>      Required. Build id as declared in config/builds.json
 *                      (e.g. "12.1.0.69497"). Must already have an entry
 *                      with dataPaths -- this script fills declared
 *                      directories, it does not invent them.
 *   --only <kind>      One of: all (default), db2, dbc, gt, listfile, vmap, mmap.
 *                      "all" extracts listfile + db2 + dbc + gt.
 *                      vmap/mmap are verify-only (see above).
 *   --dry-run          Parse args, load the manifest, resolve target
 *                      directories, and print the plan. Touches no client
 *                      data, opens no CASC storage, downloads nothing,
 *                      writes nothing.
 *   --force            Proceed even if the installed client's .build.info
 *                      build does not match --build. Only affects that one
 *                      check; CASC/init failures always abort.
 *   --wow-path <path>  Override the WoW installation root. Defaults to
 *                      WOW_PATH from the environment, falling back to
 *                      "M:\\World of Warcraft".
 *
 * Requires the project to be built first (`npm run build`), since this
 * script runs against the compiled dist/ output -- same convention as
 * scripts/generate-spell-cache.js.
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const readline = require("readline");

const LISTFILE_URL =
  "https://github.com/wowdev/wow-listfile/releases/latest/download/community-listfile.csv";

const ALL_ONLY_VALUES = ["all", "db2", "dbc", "gt", "listfile", "vmap", "mmap"];
/** Kinds "--only all" produces. vmap/mmap are deliberately excluded -- they
 * are verify-only and must be requested explicitly. */
const PRODUCE_KINDS_FOR_ALL = ["listfile", "db2", "dbc", "gt"];

function printUsageAndExit(message) {
  if (message) {
    console.error(`ERROR: ${message}\n`);
  }
  console.error(
    [
      "Usage: node scripts/extract-build.js --build <id> [--only <kind>] [--dry-run] [--force] [--wow-path <path>]",
      "",
      "  --build <id>      Required. e.g. 12.1.0.69497",
      "  --only <kind>     all (default) | db2 | dbc | gt | listfile | vmap | mmap",
      "  --dry-run         Resolve and print the plan; touch no client data",
      "  --force           Proceed despite a client build mismatch",
      "  --wow-path <path> Override WOW_PATH",
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { only: "all", dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--build":
        args.build = argv[++i];
        break;
      case "--only":
        args.only = argv[++i];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--force":
        args.force = true;
        break;
      case "--wow-path":
        args.wowPath = argv[++i];
        break;
      case "-h":
      case "--help":
        printUsageAndExit();
        break;
      default:
        printUsageAndExit(`Unrecognized argument: ${a}`);
    }
  }

  if (!args.build) {
    printUsageAndExit("--build is required");
  }
  if (!ALL_ONLY_VALUES.includes(args.only)) {
    printUsageAndExit(`--only must be one of ${ALL_ONLY_VALUES.join(", ")}; got "${args.only}"`);
  }

  return args;
}

function kindsFor(only) {
  return only === "all" ? PRODUCE_KINDS_FOR_ALL.slice() : [only];
}

/** sha256 of a file, streamed so multi-megabyte DB2s and the 29MB spell
 * cache never have to be read fully into memory. */
function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    let bytes = 0;
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => {
      bytes += chunk.length;
      hash.update(chunk);
    });
    stream.on("error", reject);
    stream.on("end", () => resolve({ bytes, sha256: hash.digest("hex") }));
  });
}

/** Download a URL to a file, following redirects (GitHub release assets
 * redirect to a CDN). Used only for the listfile; never invoked by --dry-run. */
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const tmpPath = `${destPath}.download`;

    function get(currentUrl, redirectsLeft) {
      https
        .get(currentUrl, { headers: { "User-Agent": "trinitycore-mcp-extract-build" } }, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            res.resume();
            get(res.headers.location, redirectsLeft - 1);
            return;
          }
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`GET ${currentUrl} failed: HTTP ${res.statusCode}`));
            return;
          }
          const out = fs.createWriteStream(tmpPath);
          res.pipe(out);
          out.on("finish", () => {
            out.close((err) => {
              if (err) {
                reject(err);
                return;
              }
              fs.renameSync(tmpPath, destPath);
              resolve();
            });
          });
          out.on("error", reject);
        })
        .on("error", reject);
    }

    get(url, maxRedirects);
  });
}

/**
 * Ensure the build's listfile exists at `listfilePath`, downloading it from
 * the community listfile project when absent. Reused as-is when present --
 * extraction of a previously-extracted build should not require network
 * access at all.
 */
async function ensureListfile(listfilePath, dryRun) {
  if (fs.existsSync(listfilePath)) {
    console.log(`Listfile present, reusing: ${listfilePath}`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] Would download listfile to: ${listfilePath}`);
    return;
  }
  console.log(`Listfile not found at ${listfilePath}; downloading from ${LISTFILE_URL} ...`);
  await downloadFile(LISTFILE_URL, listfilePath);
  console.log("Listfile downloaded.");
}

/**
 * Stream-parse the listfile CSV (format: "FileDataID;path", one per line,
 * paths lowercase and forward-slashed) into arrays of {fileDataId, filePath}
 * bucketed by kind, without holding the whole multi-million-row file as a
 * single string.
 */
async function loadListfileBuckets(listfilePath) {
  const buckets = { db2: [], dbc: [], gt: [] };
  const rl = readline.createInterface({
    input: fs.createReadStream(listfilePath, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  for await (const rawLine of rl) {
    const line = rawLine.trim();
    if (!line) continue;
    const sep = line.indexOf(";");
    if (sep === -1) continue;
    const idStr = line.slice(0, sep);
    const filePath = line.slice(sep + 1).toLowerCase();
    const fileDataId = Number(idStr);
    if (!Number.isFinite(fileDataId) || fileDataId <= 0) continue;

    if (filePath.startsWith("dbfilesclient/") && filePath.endsWith(".db2")) {
      buckets.db2.push({ fileDataId, filePath });
    } else if (filePath.startsWith("dbfilesclient/") && filePath.endsWith(".dbc")) {
      buckets.dbc.push({ fileDataId, filePath });
    } else if (filePath.startsWith("gametables/") && filePath.endsWith(".txt")) {
      buckets.gt.push({ fileDataId, filePath });
    }
  }

  return buckets;
}

function recursiveListFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...recursiveListFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Export every file in a listfile bucket via CASCReader, hashing each as it
 * lands on disk. Returns { records, failures } -- a partial success is still
 * reported in full, but the caller must not write a manifest when failures
 * is non-empty (a manifest is a claim of success).
 */
async function extractBucket(cascReader, kind, entries, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  const records = [];
  const failures = [];

  console.log(`Extracting ${entries.length} ${kind} file(s) into ${destDir} ...`);
  let done = 0;
  for (const { fileDataId, filePath } of entries) {
    const baseName = path.basename(filePath);
    const destPath = path.join(destDir, baseName);
    try {
      const buffer = await cascReader.getFileByID(fileDataId);
      fs.writeFileSync(destPath, buffer);
      const { bytes, sha256 } = await hashFile(destPath);
      records.push({ path: `${kind}/${baseName}`, bytes, sha256 });
    } catch (error) {
      failures.push({ kind, fileDataId, filePath, error: error instanceof Error ? error.message : String(error) });
    }
    done++;
    if (done % 200 === 0 || done === entries.length) {
      console.log(`  ${kind}: ${done}/${entries.length}`);
    }
  }

  return { records, failures };
}

/** Verify (never produce) an already-extracted directory: hash every file
 * found under it. Used for --only vmap and --only mmap. */
async function verifyDirectory(kind, destDir) {
  const files = recursiveListFiles(destDir);
  if (files.length === 0) {
    throw new Error(
      `No ${kind} data found under ${destDir}. This script does not produce ${kind} data -- ` +
        `run TrinityCore's own extractor first (see docs/BUILD_EXTRACTION.md).`
    );
  }

  console.log(`Verifying ${files.length} existing ${kind} file(s) under ${destDir} ...`);
  const records = [];
  for (const filePath of files) {
    const { bytes, sha256 } = await hashFile(filePath);
    const relPath = `${kind}/${path.relative(destDir, filePath).split(path.sep).join("/")}`;
    records.push({ path: relPath, bytes, sha256 });
  }
  return records;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const kinds = kindsFor(args.only);
  const wowPath = args.wowPath || process.env.WOW_PATH || "M:\\World of Warcraft";

  console.log("========================================");
  console.log("TrinityCore MCP - Build Extraction");
  console.log("========================================");
  console.log(`Build:     ${args.build}`);
  console.log(`Only:      ${args.only} -> kinds [${kinds.join(", ")}]`);
  console.log(`WoW path:  ${wowPath}`);
  console.log(`Dry run:   ${args.dryRun}`);
  console.log(`Force:     ${args.force}`);
  console.log("");

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { loadBuildManifest, getBuild } = require("../dist/version/BuildManifest");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { resolveClientBuild } = require("../dist/version/ClientBuildInfo");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { writeExtractionManifest, readExtractionManifest } = require("../dist/version/ExtractionManifest");

  await loadBuildManifest();
  const entry = getBuild(args.build);
  if (!entry) {
    console.error(
      `ERROR: Build "${args.build}" is not declared in config/builds.json. ` +
        `Add a candidate entry with dataPaths (db2, dbc, gt, vmap, mmap, listfile, cacheDir) before extracting.`
    );
    process.exit(1);
  }

  console.log("Resolved target directories:");
  console.log(`  db2:      ${entry.dataPaths.db2}`);
  console.log(`  dbc:      ${entry.dataPaths.dbc}`);
  console.log(`  gt:       ${entry.dataPaths.gt}`);
  console.log(`  vmap:     ${entry.dataPaths.vmap}`);
  console.log(`  mmap:     ${entry.dataPaths.mmap}`);
  console.log(`  listfile: ${entry.dataPaths.listfile}`);
  console.log(`  cacheDir: ${entry.cacheDir} (extraction manifest lives here)`);
  console.log("");

  if (args.dryRun) {
    console.log("[dry-run] Plan resolved successfully. No client data was touched, no files were written.");
    return;
  }

  let clientBuild;
  try {
    clientBuild = await resolveClientBuild(wowPath);
  } catch (error) {
    console.error(`ERROR: Could not determine installed client build: ${error.message}`);
    console.error("No extraction manifest was written.");
    process.exit(1);
  }

  if (clientBuild !== args.build) {
    if (!args.force) {
      console.error(
        `ERROR: Installed client at ${wowPath} is build ${clientBuild}, but --build requested ${args.build}. ` +
          `Refusing to extract a mismatched build. Pass --force to override.`
      );
      console.error("No extraction manifest was written.");
      process.exit(1);
    }
    console.warn(
      `WARNING: --force set. Installed client is ${clientBuild} but extracting as ${args.build} anyway.`
    );
  }

  const needsCASC = kinds.some((k) => k === "db2" || k === "dbc" || k === "gt");
  const needsListfile = kinds.some((k) => k === "listfile" || k === "db2" || k === "dbc" || k === "gt");

  let cascReader = null;
  if (needsCASC) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { CASCReader } = require("../dist/casc/CASCReader");
    cascReader = new CASCReader({ wowPath, locale: "enUS", product: "wow", enableCDN: false });
    try {
      await cascReader.initialize();
    } catch (error) {
      console.error(`ERROR: Failed to initialize CASC storage at ${wowPath}: ${error.message}`);
      console.error("No extraction manifest was written.");
      process.exit(1);
    }
  }

  if (needsListfile) {
    try {
      await ensureListfile(entry.dataPaths.listfile, false);
    } catch (error) {
      console.error(`ERROR: Failed to fetch listfile: ${error.message}`);
      console.error("No extraction manifest was written.");
      process.exit(1);
    }
  }

  const allRecords = [];
  const allFailures = [];
  const runCounts = {};

  if (kinds.includes("listfile")) {
    const { bytes, sha256 } = await hashFile(entry.dataPaths.listfile);
    allRecords.push({ path: `listfile/${path.basename(entry.dataPaths.listfile)}`, bytes, sha256 });
    runCounts.listfile = 1;
  }

  if (kinds.includes("db2") || kinds.includes("dbc") || kinds.includes("gt")) {
    const buckets = await loadListfileBuckets(entry.dataPaths.listfile);

    for (const kind of ["db2", "dbc", "gt"]) {
      if (!kinds.includes(kind)) continue;
      const destDir = entry.dataPaths[kind];
      const { records, failures } = await extractBucket(cascReader, kind, buckets[kind], destDir);
      allRecords.push(...records);
      allFailures.push(...failures);
      runCounts[kind] = records.length;
    }
  }

  for (const kind of ["vmap", "mmap"]) {
    if (!kinds.includes(kind)) continue;
    try {
      const records = await verifyDirectory(kind, entry.dataPaths[kind]);
      allRecords.push(...records);
      runCounts[kind] = records.length;
    } catch (error) {
      console.error(`ERROR: ${error.message}`);
      allFailures.push({ kind, error: error.message });
    }
  }

  if (allFailures.length > 0) {
    console.error("");
    console.error(`ERROR: ${allFailures.length} file(s) failed during this run:`);
    for (const f of allFailures.slice(0, 50)) {
      console.error(`  [${f.kind}] ${f.filePath || ""} ${f.fileDataId !== undefined ? `(FileDataID ${f.fileDataId})` : ""} - ${f.error}`);
    }
    if (allFailures.length > 50) {
      console.error(`  ... and ${allFailures.length - 50} more`);
    }
    console.error("No extraction manifest was written; a partial extraction must not be trusted.");
    process.exit(1);
  }

  // Merge with any existing manifest for this build so that running with
  // different --only values over time accumulates into one record, instead
  // of each invocation erasing what a previous invocation produced.
  const existing = readExtractionManifest(entry.cacheDir);
  const mergedFilesByPath = new Map();
  const mergedCounts = {};

  if (existing && existing.build === args.build) {
    for (const f of existing.files) mergedFilesByPath.set(f.path, f);
    Object.assign(mergedCounts, existing.counts);
  }
  for (const f of allRecords) mergedFilesByPath.set(f.path, f);
  Object.assign(mergedCounts, runCounts);

  const manifest = {
    build: args.build,
    buildNumber: entry.build,
    extractedAt: new Date().toISOString(),
    files: Array.from(mergedFilesByPath.values()),
    counts: mergedCounts,
  };

  writeExtractionManifest(entry.cacheDir, manifest);

  console.log("");
  console.log("========================================");
  console.log(`Extraction complete for build ${args.build}`);
  console.log(`  Files this run: ${allRecords.length}`);
  console.log(`  Files total (all kinds ever extracted for this build): ${manifest.files.length}`);
  console.log(`  Counts: ${JSON.stringify(manifest.counts)}`);
  console.log(`  Manifest: ${path.join(entry.cacheDir, "extraction-manifest.json")}`);
  console.log("========================================");
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});
