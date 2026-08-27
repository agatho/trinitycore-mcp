# WoW 12.1 Build Foundation & Data Plane — Design

**Date:** 2026-08-27
**Status:** Approved design, pending implementation plan
**Companion spec:** `2026-08-27-wow-12-1-opcode-subsystem-design.md`

## 1. Context

The TrinityCore MCP Server (v0.9.0-RC1, 219 TypeScript files, ~179 registered tools) reads World of Warcraft client data — DB2/DBC tables, gametables, CASC assets — and serves it to bot development tooling. Every version-dependent fact in the codebase is currently hard-coded or duplicated as prose. There is no central record of which client build the server targets.

The installed client is now **12.1.0.69497**. The extracted data the server reads (`M:\Wplayerbot\data\dbc\enUS`, 1129 `.db2` files, all WDC5) was produced on **2025-12-22** from a 12.0.x client. The server is therefore serving 12.0 data while describing itself as current.

### Version coupling points

| # | Coupling point | Current state |
|---|---|---|
| 1 | Extracted client data (`DB2_PATH`, `DBC_PATH`, `GT_PATH`, `VMAP_PATH`, `MMAP_PATH`) | 12.0.x, extracted 2025-12-22 |
| 2 | Generated caches `data/cache/spell_data_cache.json` (29 MB), `spell_names_cache.json` (6.6 MB) | Built from 12.0 `SpellName.db2` |
| 3 | Hand-written schemas in `src/parsers/schemas/` | Hard-coded field indices, no build association |
| 4 | Format guards `isValidDB2Signature` (WDC3-6), `casc/DB2Reader.ts` (WDC5 only) | Adequate for WDC5; hard stop otherwise |
| 5 | Hand-authored data tagged `12.0.0` (`spell-attributes.ts`, `stat-priorities.ts`, `spell-ranges.ts`, `xp-per-level.ts`) | Stale content, ~25 files carry version prose |
| 6 | CASC layer (`product: 'wow'`, `.build.info` to build config to TVFS) | Build-agnostic; needs a fresh listfile per build |

### The failure mode this design targets

The schemas in `src/parsers/schemas/` (Spell, SpellEffect, Item, ItemSparse, ChrClasses, ChrClassesXPowerTypes, ChrRaces, CharBaseInfo, Talent) read fields by hard-coded index. When a DB2 layout changes between builds, these schemas do not fail — they return **wrong values**. A stale schema is indistinguishable from a correct one at the call site.

Converting that silent corruption into a loud, specific error is the primary goal of this spec. Supporting 12.1 is the occasion for it.

## 2. Goals and non-goals

### Goals

1. A single declared source of truth for client build data, supporting multiple builds side by side.
2. Detection — never silent acceptance — of schema, data and cache mismatches.
3. A repeatable, documented extraction path from an installed client to a populated build data directory.
4. 12.1.0.69497 available as the active build with verified schemas and regenerated caches.
5. Version facts sourced from the manifest rather than duplicated as literals.

### Non-goals

- Reimplementing TrinityCore's VMap/MMap extractors. The spec records the commands and expected output locations; the extractors remain TrinityCore's.
- Changing the DB2 binary parser (`src/parsers/db2/`). It is generic across WDC3-WDC6 and needs no change for 12.1, which remains WDC5.
- Removing the ~20 ad-hoc CASC/TVFS scripts in `scripts/`. They stay as debugging aids; they stop being the supported interface.
- Network protocol and opcodes. See the companion spec.

## 3. Architecture

### 3.1 Build manifest

New file `config/builds.json`, loaded through the existing `ConfigManager` (which already owns `config/trinity-mcp.json` and the flat `DataPathsConfig`):

```json
{
  "manifestVersion": 1,
  "activeBuild": "12.1.0.69497",
  "builds": {
    "12.0.5.66838": {
      "build": 66838,
      "product": "wow",
      "expansion": "Midnight",
      "status": "archived",
      "db2Format": "WDC5",
      "dataPaths": {
        "db2": "M:\\Wplayerbot\\data\\66838\\dbc\\enUS",
        "dbc": "M:\\Wplayerbot\\data\\66838\\dbc\\enUS",
        "gt": "M:\\Wplayerbot\\data\\66838\\gt",
        "vmap": "M:\\Wplayerbot\\data\\66838\\vmaps",
        "mmap": "M:\\Wplayerbot\\data\\66838\\mmaps",
        "listfile": "data/listfile/66838.csv"
      },
      "cacheDir": "data/cache/66838"
    },
    "12.1.0.69497": {
      "build": 69497,
      "product": "wow",
      "expansion": "Midnight",
      "status": "active",
      "db2Format": "WDC5",
      "dataPaths": { "...": "..." },
      "cacheDir": "data/cache/69497"
    }
  }
}
```

**Conventions.** The build key is the full version string; the `build` number is the ordering key. `status` is one of `active`, `archived`, `candidate`, and exactly one build carries `active`. Each build owns its data paths and cache directory, so two builds never collide on disk.

### 3.2 Manifest loader

`src/version/BuildManifest.ts`:

```ts
export interface BuildDataPaths {
  db2: string; dbc: string; gt: string;
  vmap: string; mmap: string; listfile: string;
}

export interface BuildEntry {
  id: string;
  build: number;
  product: string;
  expansion: string;
  status: 'active' | 'archived' | 'candidate';
  db2Format: 'WDC3' | 'WDC4' | 'WDC5' | 'WDC6';
  dataPaths: BuildDataPaths;
  cacheDir: string;
  /** Opcode table id from the companion spec. May name a different build:
   *  the 12.1 opcode table was generated for 69214 and applies to 69497. */
  opcodeTable?: string;
  synthesized?: boolean;
}

export function loadBuildManifest(path?: string): Promise<BuildManifest>;
export function getActiveBuild(): BuildEntry;
export function getBuild(id: string): BuildEntry | null;
export function listBuilds(): BuildEntry[];
export function resolveDataPath(kind: keyof BuildDataPaths, buildId?: string): string;
export function resolveClientBuild(wowPath: string): Promise<string>;
```

**Load-time validation.** Exactly one build has `status: 'active'` — zero or two is a hard error. Build numbers are unique. Declared data paths are checked for existence and produce a warning, not a failure, when absent: an archived build whose data has been deleted is legitimate.

**Backward compatibility.** When `config/builds.json` is absent, the loader synthesizes a single-build manifest from the existing `.env` values (`DB2_PATH`, `DBC_PATH`, `GT_PATH`, `VMAP_PATH`, `MMAP_PATH`), keyed `unknown` and flagged `synthesized: true`.

This is required, not a nicety: 179 registered tools currently reach for `process.env.DB2_PATH` and equivalents directly, and none may break on the day the manifest lands.

**Drift detection.** `resolveClientBuild(wowPath)` parses the active row of the client's `.build.info` (pipe-delimited, `Version` column). Verified to return `12.1.0.69497` against the installed client. When the manifest's active build disagrees with the installed client, the server logs a warning naming both at startup, and `validate-build-schemas` reports it.

### 3.3 Schema validity declarations

Every schema in `src/parsers/schemas/` gains:

```ts
static readonly VALID_BUILDS = { from: 65390, to: null };   // null = open-ended
static readonly LAYOUT_HASHES = new Map<number, number>([
  [66838, 0x00000000],   // filled from real files during implementation
  [69497, 0x00000000],
]);
```

`DB2FileLoader` already exposes `getLayoutHash()` (line 280) and `getTableHash()` (line 272), so the gate costs one comparison at open time:

| Condition | Behavior |
|---|---|
| File layout hash matches the schema's entry for the active build | Proceed |
| Schema has an entry for this build and it differs | **Refuse**, naming schema, expected hash, actual hash, build |
| Schema has no entry for this build | Warn once per schema per process; proceed; mark results `unverified` |

The third row is a deliberate compromise. Refusing outright on an unknown build would make the server unusable the moment a new client ships, before anyone has recorded hashes. Marking results `unverified` keeps the server working while making the uncertainty visible in the payload.

### 3.4 Data path resolution

`src/tools/dbc.ts` (`process.env.DBC_PATH || "./data/dbc"`, lines 11-12) and `src/tools/gametable.ts` (`process.env.GT_PATH || "./data/gt"`, line 9) switch to `resolveDataPath(kind, buildId?)`, defaulting to the active build. The environment variables remain as the input to the synthesized manifest, so the existing `.env` continues to work unchanged.

### 3.5 Extraction pipeline

One supported entry point:

```
node scripts/extract-build.js --build 12.1.0.69497 [--only db2,gt] [--dry-run]
```

Steps, in order:

1. Resolve the client through the existing `CASCReader` (`product: 'wow'`, already build-agnostic). Assert the client's `.build.info` build matches `--build`; refuse on mismatch unless `--force`.
2. Fetch or reuse a community listfile matching the build; write it to the build's `dataPaths.listfile`.
3. Export DB2/DBC tables and gametables into the build's data directories.
4. Write `extraction-manifest.json` into the build data root recording source build, timestamp, per-file count, and a content hash per exported file.

VMap/MMap remain TrinityCore's extractors. The spec records the invocation and the expected output paths so `extract-build.js --only vmap` can verify presence and record hashes without producing the data itself.

### 3.6 Cache keying

`data/cache/` becomes `data/cache/<build>/`. `JsonCacheLoader` (`src/utils/json-cache-loader.ts`) resolves the active build's `cacheDir`; `src/tools/spell.ts` (lines 97-98) and `src/tools/dungeonstrategygenerator.ts` (line 242) change only in how they name the file.

Every cache gains a sidecar header:

```json
{ "build": 69497, "generatedAt": "...", "sourceFile": "SpellName.db2",
  "sourceLayoutHash": "0x...", "recordCount": 177309 }
```

The loader **refuses** a cache whose `build` differs from the active build, naming the regeneration command. Serving 12.0 spell names to a 12.1 query is precisely the class of silent error this design exists to prevent.

`src/scripts/generate-spell-cache.ts` writes into the active build's cache directory and stamps the header.

## 4. Data flow

```
.build.info ──► resolveClientBuild() ──► drift check ──┐
                                                       ▼
config/builds.json ──► loadBuildManifest() ──► getActiveBuild()
                                                       │
                     ┌─────────────────────────────────┼──────────────────┐
                     ▼                                 ▼                  ▼
            resolveDataPath()                  schema layout gate      cacheDir
                     │                                 │                  │
                     ▼                                 ▼                  ▼
        dbc.ts / gametable.ts        DB2FileLoader.getLayoutHash()  JsonCacheLoader
                     │                                 │                  │
                     └───────────────► tool result ◄───┴──────────────────┘
                                  (+ verified | unverified)
```

## 5. Error handling

Three failure classes, each with defined behavior. No silent fallback to another build's data under any of them.

| Class | Trigger | Behavior |
|---|---|---|
| Build not extracted | Data path missing for the active build | Structured error naming build, data kind and expected path. Never a bare `ENOENT`. |
| Layout mismatch | File layout hash differs from the schema's hash for this build | Refuse the parse; name schema, expected hash, actual hash, build. |
| Cache/build mismatch | Cache header build differs from active build | Refuse the load; name the regeneration command. |

Unknown-build parses proceed with a one-time warning and an `unverified` marker on results, as described in §3.3.

## 6. Content sweep

Mechanical, and gated behind the manifest so it stays checkable.

- `src/data/spell-attributes.ts`, `spell-ranges.ts`, `stat-priorities.ts`, `xp-per-level.ts`: replace `"12.0.0"` string literals with a `SOURCE_BUILD` constant resolved against the manifest.
- `src/data/stat-priorities.ts` additionally requires **content** work: its values cite "Icy Veins 12.0.0" and must be re-sourced for 12.1. This is tracked as an explicit content task with a per-spec checklist. Relabeling 12.0 values as 12.1 without re-sourcing them is forbidden.
- Version prose across ~25 files plus `package.json` `description` and `README.md`: one pass, driven by the grep list in §9.

## 7. Testing

**Unit — manifest loader.** Valid manifest loads. Missing file synthesizes from `.env` and sets `synthesized: true`. Two `active` builds is rejected. Zero `active` builds is rejected. Duplicate build numbers rejected. Unknown build id returns `null`. Missing declared path warns without failing.

**Unit — layout gate.** Fixture headers exercising all three rows of the §3.3 table: match proceeds; known-mismatch refuses with both hashes in the message; unknown build proceeds and marks `unverified`.

**Unit — cache header.** Matching build loads. Mismatched build refuses, with the regeneration command in the message. Missing header treated as mismatch.

**Integration.** For each registered schema, open the real 12.1 DB2 and assert field count and a known record's values. Requires extracted 12.1 data; skipped with an explicit message when absent rather than silently passing.

**Regression.** A 12.0 cache under an active 12.1 build is rejected.

## 8. Rollout

1. Manifest, loader and synthesized fallback. No behavior change; everything still resolves through `.env`.
2. Layout gate added with hashes recorded for the current 12.0 data. Existing parses continue; the gate is proven against a known-good build.
3. Extraction of 12.1.0.69497 into its own build directory. 12.0 untouched.
4. Record 12.1 layout hashes; run `validate-build-schemas`; repair schemas that report mismatches. This is where real 12.1 breakage surfaces.
5. Regenerate caches under the 12.1 build directory.
6. Flip `activeBuild` to 12.1.0.69497.
7. Content sweep (§6).

Steps 1-3 are reversible without touching 12.0 data. Step 6 is the cutover; rollback is flipping `activeBuild` back.

## 9. Version-prose grep list

```
grep -rniE "12\.0 \(Midnight\)|WoW 12\.0|Icy Veins 12\.0" --include='*.ts' --include='*.tsx' \
  --include='*.json' --include='*.md' src web-ui/app web-ui/components web-ui/lib README.md package.json
```

Known hits at time of writing, by file: `src/data/xp-per-level.ts` (17), `src/tools/combatmechanics.ts` (10), `src/parsers/schemas/SchemaFactory.ts` (9), `src/tools/questroute.ts` (4), `src/tools/coordination.ts` (4), `web-ui/lib/three/time-of-day-system.ts` (3), `web-ui/lib/map-editor.ts` (3), `src/tools/reputation.ts` (3), `src/tools/gearoptimizer.ts` (3), `src/parsers/schemas/TalentSchema.ts` (3), `src/parsers/schemas/SpellEffectSchema.ts` (3), `src/data/stat-priorities.ts` (3), `src/data/spell-ranges.ts` (3), plus 12 files with one or two each.

## 10. Risks

| Risk | Mitigation |
|---|---|
| 12.1 changes a DB2 layout a schema depends on | Expected. The layout gate makes it visible at rollout step 4 rather than as wrong numbers in production. Schema repair is planned work, not a surprise. |
| No full 12.1 DB2 metadata dump exists (`wow_db2_metadata_69382.json` holds 11 tables vs 608 for 66838) | Hashes are recorded from the real extracted files, not from the binary dump. The dump is not on the critical path. |
| 179 tools read env vars directly | The synthesized-manifest fallback (§3.2) means none change behavior until explicitly migrated. |
| Extraction produces a partial tree | `extraction-manifest.json` records per-file hashes and counts; `validate-build-schemas` reports missing tables before the cutover. |
| Client updates past 69497 mid-migration | Drift detection warns; the manifest accommodates a new build entry without disturbing in-progress work. |

## 11. Acceptance criteria

1. `config/builds.json` exists with the existing 12.0.x data archived under its determined build id, and 12.1.0.69497 active. (The exact build of the 2025-12-22 extraction is established during rollout step 1 by reading a DB2 header and the `.build.info` of the client it came from; it is not assumed.)
2. Deleting `config/builds.json` leaves every existing tool working via the synthesized manifest.
3. `validate-build-schemas` reports every registered schema as verified against extracted 12.1 data, or names the specific mismatch.
4. A 12.0 cache under an active 12.1 build is refused with an actionable message.
5. `npx tsc --noEmit` passes; `npm test` shows no new failures beyond the ~11 known pre-existing ones.
6. No `"12.0.0"` version literal remains outside the manifest and its documentation.
