# MCP Server Test Plan

**Scope:** all 155 registered MCP tools, the DB2/DBC parsing layer beneath them, and the build-manifest machinery that decides which client data they read.

**Purpose:** two separate questions, tested separately.

1. **Does the tool work?** It accepts its inputs, rejects bad ones, returns a well-formed MCP response, and fails intelligibly.
2. **Is the data correct?** The values it returns match an independent source — the hotfixes database, the DB2 files, or the live game.

A tool can pass (1) and fail (2). That is the dangerous case, and most of this plan exists to catch it: a schema with the wrong field indices returns plausible numbers, not errors. Every data-correctness test below therefore names an **oracle** — something outside the code under test that already knows the answer.

**Version:** written against active build `12.1.0.69497` (Midnight, WDC5).

---

## 0. How to run

Tests are grouped so a run can stop early when the foundations fail. Run them in order; a failure in section A makes results in B and C meaningless.

```bash
npm run build                        # required: tools run from dist/
npx jest                             # unit + integration suites
node scripts/ensure-spell-cache.js --check   # cache state for the active build
```

Record each result as **PASS**, **FAIL**, or **BLOCKED** (a precondition failed) against its test ID. A FAIL must record the actual value, not just "wrong" — for data tests the actual value is usually the clue to which field index is off.

### Result template

| Test ID | Result | Actual | Notes |
|---------|--------|--------|-------|
| A1.1 | PASS | | |
| B2.3 | FAIL | itemLevel 0, expected 29 | ItemSparse field index? |

---

## 1. Preconditions (P)

Run these first. Every one is a hard gate: if a precondition fails, tests that depend on it are BLOCKED, not FAILED.

| ID | Check | Command | Expected |
|----|-------|---------|----------|
| P1 | Project builds | `npm run build` | exit 0, no TS errors |
| P2 | Active build is as expected | `list-builds` tool | `activeBuild` = `12.1.0.69497`, build 69497, expansion Midnight |
| P3 | All data paths exist | `list-builds` | `missingPaths` empty for the active build |
| P4 | Schemas match the client data | `validate-build-schemas` | `{ok: true, verified: 9, unverified: 0, mismatch: 0, missing: 0}` |
| P5 | Spell caches present and build-matched | `node scripts/ensure-spell-cache.js --check` | "present and current" |
| P6 | Hotfixes database reachable | any DB-backed tool | connects; note its `VerifiedBuild` (currently 67186) |
| P7 | No stray MCP servers | process list | one server per client; no orphan `node dist/index.js` |

**P6 matters more than it looks.** The hotfixes database is the oracle for most data tests, and it is currently populated from build **67186** while the DB2 files are **69497**. Differences between them are expected for content that changed between those builds. A data test that disagrees with the database is not automatically a failure — see §4.3.

---

## 2. Section A — Cross-cutting invariants (all 155 tools)

These apply to every tool. Automate them: they are mechanical, and hand-running 155 tools four times each is how coverage silently lapses.

### A1. Protocol compliance

| ID | Test | Pass criteria |
|----|------|---------------|
| A1.1 | Every tool appears in `ListTools` | 155 definitions, no duplicates by name |
| A1.2 | Every definition has a non-empty description | no tool ships undocumented |
| A1.3 | Every `inputSchema` is a valid JSON Schema object | `type: "object"`, `properties` present |
| A1.4 | Every declared `required` name exists in `properties` | no unsatisfiable schema |
| A1.5 | Every response is `{content: [{type, text}]}` | valid MCP tool result |
| A1.6 | Response `text` is valid JSON where the tool returns data | `JSON.parse` succeeds |

### A2. Input validation

For each tool, derived mechanically from its schema:

| ID | Test | Pass criteria |
|----|------|---------------|
| A2.1 | Omit a required parameter | rejected with a message naming the parameter; never a silent default |
| A2.2 | Wrong type for a parameter (string where number expected) | rejected, not coerced |
| A2.3 | Out-of-range numeric id (`-1`, `0`) | rejected as invalid, distinct from "not found" |
| A2.4 | Absurd id (`999999999`) | "not found", **not** an error and **not** fabricated data |
| A2.5 | Unknown extra parameter | ignored or rejected, never crashes |
| A2.6 | Injection-shaped string in a text parameter (`'; DROP TABLE x; --`) | parameterised query; no SQL error, no execution |

**A2.3 vs A2.4 is the distinction that matters.** "Invalid input" and "valid input, no such record" are different answers and must not collapse into one.

### A3. Failure behaviour

| ID | Test | Pass criteria |
|----|------|---------------|
| A3.1 | Database unreachable (stop MySQL) | tool reports the failure; does not hang, does not return empty-as-success |
| A3.2 | Data directory missing (point the build at a bad path) | names the missing path |
| A3.3 | Cache absent | tool says so, or degrades visibly; never silently returns "not found" for everything |
| A3.4 | Concurrent calls (20 parallel) | no interleaved corruption, no connection-pool exhaustion |

**A3.3 is a real regression risk.** Before the spell caches were provisioned automatically, every spell lookup answered `"Not Found"` — a valid-looking empty answer. Any tool that can be empty for an infrastructural reason must say which.

### A4. Stdout hygiene (protocol integrity)

| ID | Test | Pass criteria |
|----|------|---------------|
| A4.1 | Start the server, capture stdout separately from stderr | stdout contains **only** JSON-RPC. Zero bytes before the first request. |
| A4.2 | Exercise 20 tools; inspect stdout | no log lines, no banners, no progress output |
| A4.3 | Run with `NODE_ENV` unset | still clean (the winston Console transport must stay on stderr) |

A4 is non-negotiable: a single log line on stdout corrupts the client's message stream.

---

## 3. Section B — Data correctness by domain

This is the part that catches wrong field indices. Each test names its oracle.

### B1. Spells

Oracle: `hotfixes.spell_*` tables; `SpellName.db2`; in-game tooltips for spot checks.

| ID | Input | Expected | Oracle |
|----|-------|----------|--------|
| B1.1 | `get-spell-info 133` | name "Fireball" | DB2 + game |
| B1.2 | `get-spell-info 2061` | name "Flash Heal" | DB2 + game |
| B1.3 | `get-spell-info 116` | name "Frostbolt" | DB2 + game |
| B1.4 | `get-spell-info 8326` | name "Ghost" | DB2 + game |
| B1.5 | Spell cache entry count | 194,187 entries for build 69497 | `spell_names_cache.json.meta.json` |
| B1.6 | `get-spell-info` for 200 random ids | every name non-empty and matches `hotfixes.spell_name` | database |
| B1.7 | A spell with effects | effect fields match `hotfixes.spell_effect` on Effect, EffectAura, EffectIndex, DifficultyID, EffectChainTargets, EffectItemType, EffectMechanic, ScalingClass | database |

**B1.7 is the SpellEffect schema regression test.** The verified baseline is 394 of 395 effects matching on all eight columns, the single divergence being a hotfix override. A drop below that means the field indices moved.

### B2. Items

Oracle: `hotfixes.item` / `hotfixes.item_sparse`; `Item.db2` / `ItemSparse.db2`; Wowhead for spot checks.

| ID | Input | Expected | Oracle |
|----|-------|----------|--------|
| B2.1 | `get-item-info 25` | Worn Shortsword, COMMON, ilvl 1, class 2 / subclass 7, delay 2600 | DB2 + game |
| B2.2 | `get-item-info 19019` | Thunderfury, Blessed Blade of the Windseeker, LEGENDARY, ilvl 29, 4 stats | DB2 + game |
| B2.3 | `get-item-info 6948` | Hearthstone, class 15 / subclass 0, sellPrice 0 | DB2 + game |
| B2.4 | `get-item-info 128476` | Fangs of the Devourer, ARTIFACT, class 2 / subclass 15, delay 1800 | DB2 + game |
| B2.5 | Item.db2 record count | 59,675 | file header |
| B2.6 | ItemSparse catalog count | 175,059 ids (header recordCount 175,217) | file header + catalog |
| B2.7 | 400 items compared across 38 ItemSparse columns | ≥ 250 of 288 comparable rows match on every column | `hotfixes.item_sparse` |

**B2.7 baseline:** 251 of 288 matched at the time of writing. The residual is build drift (oracle 67186 vs data 69497), not parser error — every difference was a coherent value on both sides, e.g. item 265790 is "Cache of Mistcrests" in one build and "Cache of Dawncrests" in the other. If the match rate drops sharply **and** the mismatches become incoherent (garbage strings, zero item levels), that is a parser regression.

### B3. DB2 / DBC layer

Oracle: the files themselves; WoWDBDefs for layout identification.

| ID | Test | Expected |
|----|------|----------|
| B3.1 | Table hashes are stable across builds | Item `0x50238EC2`, ItemSparse `0x919BE54E`, SpellEffect `0xF04238A5`, Spell `0xE111669E`, ChrClasses `0xF5889D8C`, ChrRaces `0x53F1783C`, CharBaseInfo `0x3067A8F8`, Talent `0xF9A4265F`, ChrClassesXPowerTypes `0xC0315ACF` |
| B3.2 | 12.1 layout hashes | Item `0x996192AA`, ItemSparse `0x1C17D17F`, SpellEffect `0x5362E3D4` |
| B3.3 | SpellEffect record count | 629,375 |
| B3.4 | Sparse walk consumes whole records | for 40,000 ItemSparse records, `ceil(walked/4)*4 == catalogSize` for every one |
| B3.5 | Wrong-build data is refused, not misread | loading 11.2.7 ItemSparse with the 12.1 layout throws "does not match this file" |
| B3.6 | `query-dbc` on a table with no schema | generic parse or explicit "no schema", never fabricated fields |

**B3.4 and B3.5 are the sparse-record guarantees.** B3.5 especially: the failure mode being prevented is a layout that happens not to overrun and therefore silently reads neighbouring bytes.

### B4. Gametables

Oracle: the `.txt` files in the build's `gt` directory.

| ID | Test | Expected |
|----|------|----------|
| B4.1 | `list-gametables` | 20 tables |
| B4.2 | `query-gametable xp.txt 70` | row present; 123 rows total; headers Total, PerKill, Junk, Stats, Divisor |
| B4.3 | `query-gametable` beyond the last level | "not found", not a clamped or extrapolated row |
| B4.4 | Spot-check 5 tables against their files | values identical to the file line |

### B5. Opcodes

Oracle: `data/opcodes/12.1.0.69214.json`; client captures where available.

| ID | Test | Expected |
|----|------|----------|
| B5.1 | Table size | 2,384 opcodes |
| B5.2 | `get-opcode-info CMSG_MOVE_JUMP` | value 4259846 |
| B5.3 | `get-opcode-info SMSG_SPELL_START` | value 6750253 |
| B5.4 | Family lookup is case-insensitive | `0x3d`, `0X3D`, `3D`, `0x03D` all resolve to the same family |
| B5.5 | Unmapped catalog families are reported as catalog-space | never described as client wire families |

**Known limitation:** the active build is 69497 but the opcode table is captured from 69214. Same patch, different build. Any test asserting an exact opcode for 69497 is asserting the approximation holds; treat a mismatch as "needs a 69497 capture", not a code defect.

### B6. Maps, VMaps, MMaps

Oracle: the extracted files.

| ID | Test | Expected |
|----|------|----------|
| B6.1 | `list-vmap-files` | 39,903 entries under the active build's vmap path |
| B6.2 | `list-mmap-files` | 763 `.mmap` files, 27,856 `.mmtile` |
| B6.3 | Map count | 1,079 maps extracted |
| B6.4 | `vmap-test-line-of-sight` through a known wall | blocked, with the blocking model named |
| B6.5 | `vmap-test-line-of-sight` across open ground | clear |
| B6.6 | `mmap-find-path` between two reachable points | path returned, waypoints on the navmesh |
| B6.7 | `mmap-is-on-navmesh` for a point inside geometry | false |

B6.4–B6.7 need hand-picked coordinates; record them in the results so the test is repeatable. Pick one indoor and one outdoor case per continent.

### B7. Creatures and quests

Oracle: `world` database; game.

| ID | Test | Expected |
|----|------|----------|
| B7.1 | `get-creature-full-info` for a known NPC | name, level range, faction match the database row |
| B7.2 | `search-creatures` by name substring | every result contains the substring; count matches a direct SQL count |
| B7.3 | `get-quest-info` for a known quest | title, objectives, rewards match the database |
| B7.4 | Creature with no template row | "not found", not a partially-filled object |

### B8. Derived and computed tools

These compute rather than look up, so the oracle is a formula or a reference implementation.

| ID | Test | Expected |
|----|------|----------|
| B8.1 | `get-combat-rating` at several levels | matches the CombatRatings gametable arithmetic |
| B8.2 | `get-character-stats` for level 1 and max level | matches the base-stat tables |
| B8.3 | `calculate-melee-damage` | reproducible; documented formula; no negative damage |
| B8.4 | `calculate-armor-mitigation` | 0 ≤ mitigation < 1 for all inputs; monotonic in armor |
| B8.5 | `simulate-scaling` across levels | no discontinuities; no negative values |

**B8.4's bounds check is the useful part**: a mitigation above 1 or below 0 is a sign-error, and those survive plausibility checks that only look at "does it return a number".

---

## 4. Section C — Build awareness

This section exists because a build cutover silently changed what tools should read while several of them kept reading the old data.

| ID | Test | Expected |
|----|------|----------|
| C1 | `list-builds` reports the manifest | active build, every declared path, existence flags |
| C2 | Every DB2 read resolves through the manifest | no module reads `process.env.DB2_PATH` for a data path |
| C3 | Stale env vars do not win | set `DB2_PATH`/`VMAP_PATH` to junk; tools still read the active build; startup warns about both |
| C4 | Explicit build id overrides | `validate-build-schemas {buildId: "11.2.7.65299"}` validates the archived build |
| C5 | Caches are build-keyed | `data/cache/<build>/` — an archived build's cache is never served for the active build |
| C6 | Cache with wrong build metadata is refused | tamper with a `.meta.json` build number; loader refuses and says so |
| C7 | Cutover rehearsal | flip `activeBuild` to the archived build; every path, cache and schema result follows; flip back |

**C7 is the test that would have caught this session's defects.** Run it after any change to path resolution.

---

## 5. Section D — Performance

Target from the project standards: **<100 ms for the 95th percentile**, <50 MB resident.

| ID | Test | Target |
|----|------|--------|
| D1 | Cached spell lookup | <10 ms |
| D2 | Cold spell lookup (cache miss) | <100 ms |
| D3 | Item lookup (two DB2 files + DB) | <100 ms; measured 438 ms cold on first import, so measure warm |
| D4 | 1,000 sequential lookups | p95 <100 ms, no upward drift (leak) |
| D5 | Tool registration at startup | <500 ms for all 155 |
| D6 | Memory after 10,000 lookups | <50 MB growth |
| D7 | Spell cache generation | 6–9 minutes; must not block server startup |

Record the machine and whether the run was warm. D4's drift check matters more than its absolute number: a slow leak shows up as p95 rising across the run.

---

## 6. Section E — Regression suite

Specific defects fixed in this codebase. Each one earned its place by having shipped.

| ID | Regression | Test |
|----|-----------|------|
| E1 | SpellEffect read every field one index too high (`ID` is `$noninline$`) | B1.7 baseline holds |
| E2 | Array columns read as consecutive fields instead of `(field, arrayIndex)` | `effectMiscValue`, `effectRadiusIndex`, `effectSpellClassMask`, `implicitTarget` all correct |
| E3 | `SchemaFactory` returned layout hashes as table hashes | B3.1 |
| E4 | ItemSparse unreadable — catalog offset computed then discarded | B2.7 |
| E5 | Sparse fields read through the dense compression path | 4-byte int columns correct, not just strings and narrow ints |
| E6 | `item.ts` captured `DB2_PATH` at import | C2, C3 |
| E7 | VMap/MMap env vars outranked the manifest | C3 |
| E8 | winston Console transport wrote to stdout | A4.1–A4.3 |
| E9 | Profile-loader banner written to stdout | A4.2 |
| E10 | Spell cache generator orphaned when its host exited | kill the server mid-generation: no surviving generator, no stale lock |
| E11 | Spell caches missing after cutover, every lookup "Not Found" | P5, A3.3 |

---

## 7. Appendix — Full tool inventory

Tools by category, generated from the registry. Parameters marked `*` are required. Every **registered** tool is covered by the Section A baseline; tools named in Sections B-E additionally have data-correctness cases.

**155 tools are registered and callable. 166 are defined.** The 11 `marketplace-*` tools in `src/tools/registry/marketplace-tools.ts` are exported but never imported by `src/tools/registry/index.ts`, so they are not in the registry and cannot be called. They are listed below for completeness and are **out of scope** for this plan: testing an unreachable tool proves nothing, and wiring them up would expose 11 untested tools. Decide whether they are wanted before testing them.

### bot-analysis (5 tools)

| Tool | Parameters |
|------|------------|
| `analyze-bot-ai` | filePath*, outputFormat, detectIssues, generateOptimizations |
| `analyze-bot-combat-log` | logFile, logText, botName, encounter, startTime, endTime, compareWithTheoretical, outputFormat |
| `analyze-combat-log-comprehensive` | logFile, logText, botName*, className, spec, level, includeML, includeRecommendations, outputFormat |
| `debug-bot-behavior` | botId*, action*, duration, breakpointCondition, timelineId |
| `simulate-game-mechanics` | simulationType*, playerStats*, targetStats, rotation, duration, scenario |

### code-analysis (12 tools)

| Tool | Parameters |
|------|------------|
| `analyze-memory-leaks` | directory, filePath, checkTypes |
| `analyze-thread-safety` | directory, filePath, severity, checkTypes |
| `check-code-style` | filePath, directory, autoFix |
| `format-code` | filePath*, autoFix |
| `generate-code-review-report` | violations*, reportPath*, format, projectRoot, compilerType |
| `get-code-completion-context` | partialCode*, filePath, cursorPosition, maxSuggestions |
| `get-code-review-stats` | (none) |
| `migrate-trinity-api` | directory*, fromVersion*, toVersion*, autoFix, modernize |
| `review-code-file` | filePath*, enableAI, llmProvider, llmModel, severityFilter, categoryFilter, minConfidence, projectRoot, compilerType, verbose |
| `review-code-files` | files*, enableAI, llmProvider, llmModel, severityFilter, categoryFilter, minConfidence, projectRoot, compilerType, verbose |
| `review-code-pattern` | patterns*, excludePatterns, enableAI, llmProvider, llmModel, severityFilter, categoryFilter, minConfidence, projectRoot, compilerType, verbose |
| `review-code-project` | projectRoot*, patterns, excludePatterns, enableAI, llmProvider, llmModel, severityFilter, categoryFilter, minConfidence, compilerType, reportPath, reportFormat, verbose |

### combat-strategy (13 tools)

| Tool | Parameters |
|------|------------|
| `analyze-arena-composition` | bracket*, team*, rating* |
| `analyze-group-composition` | bots* |
| `calculate-armor-mitigation` | rawDamage*, armor*, attackerLevel* |
| `calculate-melee-damage` | weaponDPS*, attackSpeed*, attackPower*, critRating*, level* |
| `coordinate-cooldowns` | bots*, encounterDuration* |
| `generate-dungeon-strategy` | dungeonMapId*, groupLevel, groupSize, packRadius, outputFormat |
| `get-battleground-strategy` | bgId* |
| `get-boss-mechanics` | bossCreatureId* |
| `get-buff-recommendations` | role*, classId*, budget, contentType |
| `get-class-specializations` | classId* |
| `get-mythic-plus-strategy` | keystoneLevel*, affixes* |
| `get-pvp-talent-build` | specId*, bracket* |
| `get-talent-build` | specId*, purpose*, playerLevel* |

### config-management (10 tools)

| Tool | Parameters |
|------|------------|
| `config-export` | outputPath*, format, includeSecrets |
| `config-get` | section |
| `config-reset` | section, createBackup |
| `config-update` | section*, config*, persist |
| `config-validate` | config* |
| `mcp-get-registry-status` | (none) |
| `mcp-get-tool-stats` | maxRecommendations |
| `mcp-load-tool` | toolName* |
| `mcp-switch-profile` | profile* |
| `mcp-unload-tool` | toolName* |

### cpp-test-tools (3 tools)

| Tool | Parameters |
|------|------------|
| `analyze-cpp-source` | source*, filePath* |
| `generate-cpp-test-report` | source*, filePath*, includeEdgeCases, includeNullChecks |
| `generate-cpp-tests` | source*, filePath*, includeEdgeCases, includeNullChecks, includeExceptionTests, includeMocks, testFramework, cmakeProject, outputDir |

### creatures (7 tools)

| Tool | Parameters |
|------|------------|
| `get-all-trainers` | limit |
| `get-all-vendors` | limit |
| `get-creature-full-info` | entry*, includeLoot |
| `get-creature-statistics` | type, faction, expansion |
| `get-creatures-by-faction` | faction*, limit |
| `get-creatures-by-type` | creatureType*, limit |
| `search-creatures` | name, type, family, classification, faction, expansion, isBoss, isElite, isVendor, isTrainer, limit |

### database-ops (10 tools)

| Tool | Parameters |
|------|------------|
| `backup-database` | host*, port, user*, password*, database*, backupDir* |
| `compare-databases` | sourceHost*, sourcePort, sourceUser*, sourcePassword*, sourceDatabase*, targetHost*, targetPort, targetUser*, targetPassword*, targetDatabase* |
| `database-health-check-and-fix` | host*, port, user*, password*, database* |
| `database-health-check-full` | host*, port, user*, password*, database* |
| `database-health-check-quick` | host*, port, user*, password*, database* |
| `export-database` | host*, port, user*, password*, outputDir*, format |
| `export-database-tables` | host*, port, user*, password*, database*, tables*, outputDir*, format |
| `import-database-from-directory` | host*, port, user*, password*, database*, directory*, format |
| `import-database-from-file` | host*, port, user*, password*, database*, filepath*, dropExisting |
| `restore-database` | host*, port, user*, password*, database*, backup*, dropExisting |

### economy-questing (9 tools)

| Tool | Parameters |
|------|------------|
| `find-missing-collectibles` | type*, minRarity |
| `get-collection-status` | type* |
| `get-farming-route` | collectibleId*, type* |
| `get-gold-making-strategies` | playerLevel*, professions* |
| `get-item-pricing` | itemId* |
| `get-leveling-path` | startLevel*, targetLevel*, faction* |
| `get-reputation-grind-path` | factionId*, factionName*, currentRep*, targetStanding* |
| `get-reputation-standing` | factionId*, factionName*, currentReputation* |
| `optimize-quest-route` | zoneId*, playerLevel*, maxQuests |

### economy-simulation-tools (5 tools)

| Tool | Parameters |
|------|------------|
| `economy-forecast-price` | itemId*, simulationTicks, forecastTicks, seed |
| `economy-market-dynamics` | itemId*, simulationTicks, seed |
| `economy-simulate` | totalTicks, enableRandomEvents, auctionHouseCut, seed |
| `economy-simulate-event` | eventType*, targetItemId*, magnitude, durationTicks, seed |
| `economy-simulation-report` | totalTicks, seed |

### game-data (10 tools)

| Tool | Parameters |
|------|------------|
| `diff-opcodes` | fromBuild*, toBuild* |
| `get-item-info` | itemId* |
| `get-opcode-info` | opcode* |
| `get-quest-info` | questId* |
| `get-spell-info` | spellId* |
| `get-trinity-api` | className*, methodName |
| `list-builds` | (none) |
| `list-opcodes` | pattern, direction, family, offset, limit |
| `query-dbc` | dbcFile*, recordId* |
| `validate-build-schemas` | buildId |

### gametables (4 tools)

| Tool | Parameters |
|------|------------|
| `get-character-stats` | level*, className |
| `get-combat-rating` | level*, statName* |
| `list-gametables` | (none) |
| `query-gametable` | tableName*, rowId, maxRows |

### knowledge-codegen (14 tools)

| Tool | Parameters |
|------|------------|
| `db2-schema-diff` | mode*, fileA*, fileB, fileFilter |
| `game-master` | command*, dryRun |
| `generate-bot-component` | componentType*, className*, description, role, outputPath, namespace, includeTests |
| `generate-cmake-integration` | projectName*, sourceFiles*, headerFiles*, testFiles, isLibrary, dependencies, outputPath |
| `generate-packet-handler` | handlerName*, opcode*, direction*, fields*, outputPath, namespace |
| `generate-scaffold` | type*, name*, description*, features, databaseTables, db2Files, parameters, includeTests, category |
| `get-api-reference` | className* |
| `get-implementation-guide` | guideId* |
| `get-playerbot-pattern` | patternId* |
| `get-troubleshooting-guide` | query* |
| `list-documentation-categories` | (none) |
| `list-scaffold-types` | (none) |
| `search-playerbot-wiki` | query*, category, difficulty, limit |
| `validate-generated-code` | filePath*, checkCompilation, checkStyle |

### learning-systems (12 tools)

| Tool | Parameters |
|------|------------|
| `add-knowledge-relation` | fromSubject*, toSubject*, relation*, weight, bidirectional |
| `export-knowledge-graph` | (none) |
| `get-best-approach` | category*, subject*, minConfidence |
| `get-knowledge-node` | nodeId* |
| `get-knowledge-report` | category, limit |
| `get-knowledge-stats` | (none) |
| `import-knowledge-graph` | nodes*, edges* |
| `query-knowledge-graph` | category, subject, predicate, object, tags, botId, minConfidence, mapId, zoneId, limit, includeRelated |
| `record-combat-experience` | botId*, botName*, creatureEntry*, outcome*, spellsUsed, damageDealt, damageTaken, duration, mapId, zoneId, notes |
| `record-economy-observation` | botId*, botName*, itemName*, action*, price*, quantity, vendorName, mapId, zoneId |
| `record-exploration-discovery` | botId*, botName*, discovery*, locationType*, x*, y*, z*, mapId*, zoneId, notes |
| `record-quest-experience` | botId*, botName*, questId*, outcome*, timeSpent, difficulty, tips, mapId, zoneId |

### map-tools (12 tools)

| Tool | Parameters |
|------|------------|
| `clear-minimap-cache` | mapId |
| `get-map-minimap` | mapId* |
| `get-minimap-tile` | fileDataId*, forceRefresh |
| `get-minimap-tiles-batch` | fileDataIds, mapId, startFileDataId, count |
| `get-mmap-file-info` | mmapFile* |
| `get-vmap-file-info` | vmapFile* |
| `list-mmap-files` | mmapDir |
| `list-vmap-files` | vmapDir |
| `mmap-find-path` | mmapDir*, mapId*, startX*, startY*, startZ*, goalX*, goalY*, goalZ* |
| `mmap-is-on-navmesh` | mmapDir*, mapId*, posX*, posY*, posZ* |
| `vmap-find-spawns-in-radius` | vmapDir*, mapId*, centerX*, centerY*, centerZ*, radius* |
| `vmap-test-line-of-sight` | vmapDir*, mapId*, startX*, startY*, startZ*, endX*, endY*, endZ* |

### marketplace-tools (11 tools - DEFINED BUT NOT REGISTERED, not callable)

| Tool | Parameters |
|------|------------|
| `marketplace-configure-plugin` | pluginId*, config* |
| `marketplace-disable` | pluginId* |
| `marketplace-enable` | pluginId* |
| `marketplace-events` | limit |
| `marketplace-get-plugin` | pluginId* |
| `marketplace-install` | pluginId*, version, autoEnable, installDependencies |
| `marketplace-list-installed` | status |
| `marketplace-search` | query, category, tags, author, sortBy, verifiedOnly, minRating, page, pageSize |
| `marketplace-stats` | (none) |
| `marketplace-uninstall` | pluginId* |
| `marketplace-validate-manifest` | manifest* |

### monitoring-production (9 tools)

| Tool | Parameters |
|------|------------|
| `get-health-status` | (none) |
| `get-log-file-location` | (none) |
| `get-metrics-snapshot` | includeHistory, metricTypes |
| `get-monitoring-status` | (none) |
| `get-security-status` | (none) |
| `list-backups` | (none) |
| `query-logs` | level*, component, search, startTime, endTime, limit |
| `trigger-backup` | type, description |
| `verify-backup` | backupId* |

### performance-testing (10 tools)

| Tool | Parameters |
|------|------------|
| `analyze-bot-performance` | mode*, metrics, duration, interval, exportCSV |
| `analyze-coverage` | coverageData, coverageFile, include, exclude, thresholds, format, outputPath, findUncovered, showDetails |
| `generate-test-report` | testResults, testResultsFile, format*, outputPath*, includePassedTests, includeSkippedTests, includeCharts, title, metadata |
| `generate-tests-ai` | sourceFile*, testType, includeEdgeCases, mockDependencies |
| `generate-tests-directory` | directory*, outputDir, pattern, testType |
| `get-optimization-suggestions` | performanceReport, performanceReportFile, filters, includeQuickWins |
| `run-load-test` | testName*, targetFunction*, concurrentUsers, duration, rampUp |
| `run-performance-test` | testName*, iterations, warmupIterations, targetFunction*, params |
| `run-tests` | pattern, rootDir, testNamePattern, tags, parallel, maxWorkers, timeout, retries, verbose, silent, outputFormat, generateReport |
| `simulate-scaling` | minBots*, maxBots*, stepSize, profile*, baseline*, scalingFactors, limits |

### replay-tools (10 tools)

| Tool | Parameters |
|------|------------|
| `replay-analyze-session` | sessionId*, outputFormat |
| `replay-compare-sessions` | sessionIdA*, sessionIdB*, outputFormat |
| `replay-delete-session` | sessionId* |
| `replay-list-sessions` | (none) |
| `replay-playback-control` | command*, value |
| `replay-playback-status` | (none) |
| `replay-recording-status` | (none) |
| `replay-start-playback` | sessionId*, speed, startTime, endTime, loop, eventTypes |
| `replay-start-recording` | name*, description, tags |
| `replay-stop-recording` | (none) |


---

## 8. What this plan does not cover

Stated so the gaps are known rather than assumed away:

- **Opcode values for build 69497** — no client capture exists; the table is 69214's.
- **`WOW_PATH`** — the client install root is not declared in the manifest, so CASC and minimap extraction still read it from the environment.
- **Terrain `.map` files** — not declared in the manifest either.
- **Tools whose output is advisory** (strategy generators, code review, scaffolding) — testable for shape and determinism, but "correct" is a judgement, not an oracle. Test that they run, validate inputs, and produce stable output for stable input.
- **The archived 11.2.7 build** — kept reachable by build id, but its schemas are not maintained against current code.
