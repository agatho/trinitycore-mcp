#!/usr/bin/env node
/**
 * Ensure the active build's spell caches exist.
 *
 * Two modes, because installing and provisioning have different obligations:
 *
 *   --check  Report the state and exit. Used by `postinstall`, which must be
 *            fast and must never fail an install. Generation is left to
 *            `npm run setup` or to the server's first startup.
 *   (default) Generate the caches and wait for them. Used by `npm run setup`.
 *            Generation takes several minutes.
 *
 * Waiting is not optional in the generating mode: the generator runs as a child
 * of this process, so returning early would kill it and leave nothing behind.
 * Background generation belongs to the MCP server, which stays alive to host it.
 *
 * Exits non-zero only under --strict, so an install is never broken by a machine
 * that simply has no client data.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CHECK_ONLY = process.argv.includes("--check");
const STRICT = process.argv.includes("--strict");

function say(message) {
  process.stderr.write(`[spell-cache] ${message}\n`);
}

async function main() {
  const provisioner = path.join(ROOT, "dist", "version", "SpellCacheProvisioner.js");
  if (!fs.existsSync(provisioner)) {
    say("Project is not built yet, so the caches cannot be checked or generated now.");
    say("Run `npm run setup` to build and generate them, or start the server, which generates them itself.");
    return STRICT ? 1 : 0;
  }

  const { loadBuildManifest, getActiveBuild } = require(
    path.join(ROOT, "dist", "version", "BuildManifest.js")
  );
  const { inspectSpellCache, ensureSpellCache, isSpellCacheSourceAvailable } = require(provisioner);

  await loadBuildManifest();
  const build = getActiveBuild();
  say(`Active build ${build.id} (${build.build}).`);

  if (CHECK_ONLY) {
    const status = inspectSpellCache();
    say(status.detail);
    if (status.state !== "ready") {
      if (isSpellCacheSourceAvailable()) {
        say("Run `npm run setup` to generate them now; otherwise the server generates them on first start.");
      } else {
        say("The client data is not reachable from here, so they will be generated where it is.");
      }
    }
    return 0;
  }

  const result = await ensureSpellCache({ wait: true });
  say(result.detail);

  if (result.ready) {
    return 0;
  }
  if (result.initialState === "generating") {
    // Another process - usually a running server - is already producing them.
    // That is the requested outcome in progress, not a failure of this run.
    say("Another process is already generating them; they will be ready shortly.");
    return 0;
  }
  return STRICT ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    // Never fail an install over provisioning.
    say(`Skipped: ${error && error.message ? error.message : error}`);
    process.exit(STRICT ? 1 : 0);
  });
