# Build Data Extraction

This document describes the single, supported way to pull WoW client data for
a declared build (see `config/builds.json`, `src/version/BuildManifest.ts`)
out of a local client installation and into the directories that build's
`dataPaths` say they belong in.

It replaces the ~20 ad-hoc CASC/TVFS debug scripts (`scripts/debug-*.js`,
`scripts/test-*.js`, `scripts/extract-casc-*.js`, `scripts/dump-*.js`, etc.)
that accumulated while reverse-engineering the CASC/TVFS layer. Those scripts
remain in the repo as historical debugging aids, but they are not the
supported extraction path and should not be used to populate a build's data
directories going forward.

## What produces the data

- **`scripts/extract-build.js`** — orchestrates extraction of DB2, DBC, and
  GameTable files, plus the CASC listfile, directly from the local client via
  `CASCReader`. This is the "produce" path.
- **TrinityCore's own extractor tools** (`vmap4extractor`, `vmap4assembler`,
  `mmaps_generator`, built from the TrinityCore source tree) — produce VMap
  and MMap (navmesh) data. This project deliberately does **not**
  reimplement them; `extract-build.js --only vmap` / `--only mmap` only
  **verifies** that TrinityCore's output is present and records its hashes.
- **`src/version/ExtractionManifest.ts`** — owns the manifest *format*
  (`extraction-manifest.json`, written to the build's `cacheDir`) that
  records what was produced/verified, when, and with what hashes. This is
  the part with unit tests (`tests/version/extraction-manifest.test.ts`).

## Prerequisites

1. Build the project so the orchestrator can run against compiled output:
   ```
   npm run build
   ```
2. The target build must already have an entry in `config/builds.json` with
   a full `dataPaths` block (`db2`, `dbc`, `gt`, `vmap`, `mmap`, `listfile`)
   and a `cacheDir`. `extract-build.js` fills directories the manifest
   declares; it does not invent them. Add a `"status": "candidate"` entry
   before extracting a new build, and only flip it to `"active"` once
   extraction and validation (below) are complete.
3. The client must be installed locally and its installed build (read from
   `.build.info`) must match the `--build` you pass, unless you pass
   `--force`.

## Invocation

```
node scripts/extract-build.js --build <id> [--only <kind>] [--dry-run] [--force] [--wow-path <path>]
```

| Flag | Meaning |
|---|---|
| `--build <id>` | Required. Build id exactly as declared in `config/builds.json`, e.g. `12.1.0.69497`. |
| `--only <kind>` | `all` (default), `db2`, `dbc`, `gt`, `listfile`, `vmap`, `mmap`. `all` extracts `listfile` + `db2` + `dbc` + `gt`. `vmap`/`mmap` are verify-only and must be requested explicitly — they are never included in `all`. |
| `--dry-run` | Parses arguments, loads the manifest, and prints the resolved plan (target directories, kinds, WoW path). Opens no CASC storage, downloads nothing, writes nothing. Safe to run at any time. |
| `--force` | Proceeds even if the installed client's `.build.info` build does not match `--build`. Only affects that one check — a CASC initialization failure or a missing manifest entry always aborts, `--force` or not. |
| `--wow-path <path>` | Overrides the WoW installation root. Defaults to `WOW_PATH` from the environment, falling back to `M:\World of Warcraft`. |

### Per-kind examples

```bash
# Resolve directories and sanity-check arguments only; touches nothing.
node scripts/extract-build.js --build 12.1.0.69497 --dry-run

# Full DB2 + DBC + GameTable + listfile extraction.
node scripts/extract-build.js --build 12.1.0.69497

# Just the DB2 files (dbfilesclient/*.db2 in CASC).
node scripts/extract-build.js --build 12.1.0.69497 --only db2

# Just the legacy-extension DBC files (dbfilesclient/*.dbc in CASC — rare on
# modern clients, all data is .db2 by 12.x, but the path exists for builds
# that still ship a handful of .dbc files).
node scripts/extract-build.js --build 12.1.0.69497 --only dbc

# Just GameTables (gametables/*.txt in CASC — CombatRatings.txt, xp.txt, ...).
node scripts/extract-build.js --build 12.1.0.69497 --only gt

# Just the CASC listfile (FileDataID -> path mapping), fetched from the
# community listfile project if not already present.
node scripts/extract-build.js --build 12.1.0.69497 --only listfile

# Verify (not produce) already-generated VMap/MMap data — see below.
node scripts/extract-build.js --build 12.1.0.69497 --only vmap
node scripts/extract-build.js --build 12.1.0.69497 --only mmap
```

Each invocation merges into the same `extraction-manifest.json` in the
build's `cacheDir`: running `--only db2` and later `--only gt` accumulates
both into one manifest rather than the second run erasing the first. If any
file fails during a run, **no manifest is written at all** for that run —
a manifest is a claim that extraction succeeded, and writing one after a
partial failure would be worse than writing none. The previous good
manifest (if any) is left untouched.

## VMap / MMap: TrinityCore's extractors, not ours

VMap (line-of-sight collision) and MMap (navmesh) data are generated by
TrinityCore's own tools, built from the TrinityCore source tree
(`tools/vmap4_extractor`, `tools/vmap4_assembler`, `tools/mmaps_generator`
in a TrinityCore checkout). Reimplementing them is explicitly out of scope
for this project. Run them from a built TrinityCore tools directory, pointed
at the same client installation as the build you are extracting:

```bash
# 1. Extract raw VMap geometry (WMO/M2 collision data) from the client.
#    Run from the tools directory with the client's Data folder alongside it
#    (or pointed at via the tool's own path argument — see its --help).
./vmap4extractor
#    Produces: ./Buildings/  (raw, intermediate — not consumed directly)

# 2. Assemble the raw geometry into the final VMap tree/tile files.
./vmap4assembler Buildings vmaps
#    Produces: ./vmaps/*.vmtree, ./vmaps/*.vmtile

# 3. Generate navmeshes. Requires the client's extracted terrain (.map files,
#    produced by TrinityCore's mapextractor — not produced by this project)
#    and the assembled vmaps/ output from step 2.
./mmaps_generator
#    Produces: ./mmaps/*.mmap, ./mmaps/*.mmtile
```

Copy (or point the build's manifest at) the resulting `vmaps/` and `mmaps/`
directories so they match `dataPaths.vmap` and `dataPaths.mmap` for the
build in `config/builds.json`. Then run:

```bash
node scripts/extract-build.js --build <id> --only vmap
node scripts/extract-build.js --build <id> --only mmap
```

These calls hash every file already present under `dataPaths.vmap` /
`dataPaths.mmap` and record them in the extraction manifest. They fail
loudly (and write no manifest) if the directory is missing or empty —
`extract-build.js` cannot verify data that was never produced.

## Required order of operations

Extracting a new build and cutting it over is a strict pipeline. Each step
depends on the previous one's output:

1. **Extract** — `node scripts/extract-build.js --build <id>` (DB2/DBC/GT/listfile),
   plus TrinityCore's `vmap4extractor` → `vmap4assembler` → `mmaps_generator`
   and `--only vmap` / `--only mmap` to verify them, as above.
2. **`node scripts/record-layout-hashes.js --build <buildNumber> --dir <db2 dir>`** —
   reads the `layoutHash` (DB2 header offset 156) out of the newly extracted
   DB2 files for every hand-written schema in `src/parsers/schemas/`, so each
   schema's `LAYOUT_HASHES` map can be updated for the new build. This must
   run against the *extracted* files from step 1, not a guess.
3. **`validate-build-schemas`** — the schema/build validation tool
   (`src/version/SchemaBuildGate.ts`) checks every `BuildAwareSchema`'s
   recorded `LAYOUT_HASHES` for the new build against the actual files, so a
   stale hand-written field-offset schema is caught as a named error instead
   of silently returning wrong values. Do this only after step 2 has
   recorded hashes for the new build — otherwise every schema reports
   "unverified" for it.
4. **`npm run generate:spell-cache`** — rebuilds `data/cache/spell_names_cache.json`
   and `data/cache/spell_data_cache.json` from the newly extracted
   `SpellName.db2` (and friends). Run after steps 1-3 so the cache is built
   from data that has already been confirmed to parse correctly.
5. **Flip `activeBuild`** — only once steps 1-4 are clean, change
   `config/builds.json`'s `activeBuild` to the new build id and its `status`
   from `"candidate"` to `"active"` (demoting the previous active build to
   `"archived"`). This is the actual cutover: every tool that calls
   `getActiveBuild()` / `resolveDataPath()` without an explicit build id
   starts reading the new build's data the moment this file changes.

Do not reorder these steps. Flipping `activeBuild` before the schema and
spell-cache steps points every tool at data that has not been validated;
running `record-layout-hashes.js` before extraction reads stale files from
whatever build's data happened to be on disk previously.
