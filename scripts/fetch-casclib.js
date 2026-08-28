#!/usr/bin/env node
/**
 * Fetch the vendored CascLib dependency at a pinned commit.
 *
 * WHY THIS IS PINNED
 * ------------------
 * The native addon (`build/Release/casc_native.node`) resolves WoW client files
 * by FileDataID through CascLib. A CascLib older than the installed WoW client
 * cannot index that client's TVFS root: `CascOpenStorage` still succeeds, but
 * every `CascOpenFile(..., CASC_OPEN_BY_FILEID, ...)` returns
 * ERROR_FILE_NOT_FOUND (2) because no file ids were ever registered.
 *
 * That failure is silent and easy to misdiagnose as a bad FileDataID. It was
 * observed against WoW 12.1.0.69497 with a CascLib from 2025-11: 0 of 13 probed
 * ids resolved, including ids that certainly exist. Upgrading to the commit
 * pinned below fixed it — `CascRootFile_TVFS.cpp` had grown 811 -> 997 lines,
 * while `CascRootFile_WoW.cpp` was byte-identical, so the fix was entirely in
 * TVFS handling.
 *
 * `dep/` is gitignored, so this script is what makes the native build
 * reproducible. If you bump the pin, re-run the probe in docs/NATIVE_BUILD.md
 * and confirm FileDataIDs still resolve before committing.
 *
 * Usage:
 *   node scripts/fetch-casclib.js            # fetch if missing
 *   node scripts/fetch-casclib.js --force    # re-fetch, replacing dep/CascLib
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REPO = "https://github.com/ladislav-zezula/CascLib.git";
/** Known-good commit: verified to resolve FileDataIDs against WoW 12.1.0.69497. */
const PINNED_COMMIT = "2a280f5a231966dc5d1b534978dd9f9f04a374cd";
const PINNED_DATE = "2026-08-22";

const DEST = path.join(__dirname, "..", "dep", "CascLib");
const force = process.argv.includes("--force");

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: "pipe", encoding: "utf8" }).trim();
}

function main() {
  if (fs.existsSync(DEST) && !force) {
    // Already present. Report whether it looks like the pinned version.
    const marker = path.join(DEST, "src", "CascRootFile_TVFS.cpp");
    if (fs.existsSync(marker)) {
      const lines = fs.readFileSync(marker, "utf8").split(/\r?\n/).length;
      console.log(`dep/CascLib already present (CascRootFile_TVFS.cpp: ${lines} lines).`);
      console.log(`Expected >= 997 lines for the pinned commit ${PINNED_COMMIT.slice(0, 7)}.`);
      if (lines < 997) {
        console.log("WARNING: this looks OLDER than the pinned commit. Re-run with --force.");
        process.exitCode = 1;
      }
    } else {
      console.log("dep/CascLib exists but looks incomplete. Re-run with --force.");
      process.exitCode = 1;
    }
    return;
  }

  const tmp = path.join(__dirname, "..", "dep", ".casclib-fetch-tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(tmp), { recursive: true });

  console.log(`Cloning CascLib at pinned commit ${PINNED_COMMIT.slice(0, 7)} (${PINNED_DATE})...`);
  run("git", ["clone", "--quiet", REPO, tmp]);
  run("git", ["checkout", "--quiet", PINNED_COMMIT], tmp);

  const actual = run("git", ["rev-parse", "HEAD"], tmp);
  if (actual !== PINNED_COMMIT) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw new Error(`Checkout mismatch: expected ${PINNED_COMMIT}, got ${actual}`);
  }

  fs.rmSync(path.join(tmp, ".git"), { recursive: true, force: true });
  fs.rmSync(DEST, { recursive: true, force: true });
  fs.renameSync(tmp, DEST);

  console.log(`dep/CascLib ready at ${PINNED_COMMIT.slice(0, 7)}.`);
  console.log("Next: npm run build:native");
}

main();
