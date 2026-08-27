# WoW 12.x Opcode Subsystem — Design

**Date:** 2026-08-27
**Status:** Approved design, pending implementation plan
**Companion spec:** `2026-08-27-wow-12-1-build-foundation-design.md`

## 1. Context

`src/tools/opcode.ts` is **161 lines holding 8 opcodes**, hand-written in a pre-12.x naming style (`CMSG_CAST_SPELL`, `SMSG_SPELL_GO`) with descriptions and packet structures. It has no notion of the 12.x wire encoding. It backs the `get-opcode-info` tool registered at `src/tools/registry/game-data.ts:128`.

Modern WoW encodes opcodes as `(family << 16) | index`. WoW 12.1 shifted opcode **families** by +1 to +5 relative to 12.0.7, *and* inserted and deleted messages within families, shifting indices too:

```
client = ((catalog_family + family_shift) << 16) | (catalog_index + index_offset)
```

The current tool cannot express any of this. It is the single most stale component with respect to 12.1.

### Available evidence

The reverse-engineering workspace at `C:\dumps` already contains the finished derivation:

- `C:\dumps\wpp_tc\WowPacketParser\Enums\Version\V12_1_0_69214\Opcodes.cs` — a generated table of **2,384 entries** in the form `{ Opcode.CMSG_ACCEPT_GUILD_INVITE, 0x430029 }`, split across `ClientOpcodes` (from line 27), `ServerOpcodes` (from line 1022) and `MiscOpcodes`.
- `C:\dumps\wpp_tc\WowPacketParser\Enums\Version\V12_0_7_67808\Opcodes.cs` — the 12.0.7 catalog the 12.1 table was derived from.
- `C:\dumps\wow_family_shift_12_1.json` — 46 families with per-family shift and provenance, plus `index_offsets` for families `0x3A`, `0x3B`, `0x42`.
- `C:\dumps\BEFUND_wpp_12_1_und_qualitaetsvergleich.md` — the write-up of the derivation and its validation.

The derivation was validated two independent ways: a monotone, injective, direction-preserving assignment of **1,058,913 sniffed packets** across builds 69273/69299/69382 against the 12.0.7 table, and the client's own `WowGetRawTypeName<struct Jam...>` strings in 12.1.0.69382. The two methods agree on 16 of 16 observable families with zero divergence. Naming coverage reached 99.99% of packets; 88 packets across 10 opcodes remain unnamed.

Families `0x2E` and `0x35` were **deliberately excluded**: their shift is not uniquely determined. Some index ranges carry a `null` offset for the same reason.

## 2. Goals and non-goals

### Goals

1. A complete, build-keyed opcode table covering 12.0.7 and 12.1.
2. The 12.x family/index encoding made explicit and queryable.
3. Uncertainty in the source derivation preserved and surfaced, never flattened into false confidence.
4. Regeneration for a future build reduced to a single command.
5. The 8 existing hand-written annotations retained.

### Non-goals

- Reimplementing the family-shift derivation in TypeScript. It is proven where it lives; this spec consumes its output. See §3.1 for why.
- Packet payload parsing or wire-format decoding. This subsystem answers "what is this opcode", not "what do these bytes mean".
- Modifying the WowPacketParser fork.

## 3. Architecture

### 3.1 Why ingest rather than re-derive

Porting `client = ((family + shift) << 16) | (index + offset)` into TypeScript would duplicate logic that has already been validated against a million packets, and would require reimplementing its caveats too — the `null` index offsets and the two undetermined families are not incidental, they are load-bearing statements about what is *not* known. A reimplementation risks silently resolving an ambiguity the original author deliberately left open. The derivation stays in the RE workspace; we consume its result and carry its provenance.

### 3.2 Ingestion

```
node scripts/import-opcodes.js \
  --source "C:\dumps\wpp_tc\WowPacketParser\Enums\Version\V12_1_0_69214\Opcodes.cs" \
  --provenance "C:\dumps\wow_family_shift_12_1.json" \
  --build 12.1.0.69214 \
  --out data/opcodes/
```

The converter parses `{ Opcode.NAME, 0xVALUE }` entries within the three `BiDictionary` blocks, tolerating comments and trailing commas, and derives direction from which block an entry sits in.

Output `data/opcodes/<build>.json`:

```json
{
  "build": 69214,
  "version": "12.1.0",
  "source": {
    "file": "V12_1_0_69214/Opcodes.cs",
    "derivedFrom": "V12_0_7_67808",
    "method": "family-shift",
    "importedAt": "2026-08-27T00:00:00Z"
  },
  "unmappedFamilies": ["0x2E", "0x35"],
  "opcodes": [
    {
      "name": "CMSG_ACCEPT_GUILD_INVITE",
      "value": 4390953,
      "hex": "0x430029",
      "direction": "CMSG",
      "family": "0x43",
      "index": "0x029"
    }
  ]
}
```

Family and index are derived by decomposing the value (`family = value >>> 16`, `index = value & 0xFFFF`), making the 12.x wire encoding explicit rather than leaving it an opaque integer.

The converter runs for both `V12_0_7_67808` and `V12_1_0_69214`, producing two tables.

**Table selection.** Opcode tables are named by the build they were *generated for*, which is not necessarily the active client build: the 12.1 table was generated for 69214 and applies to the installed 69497. The companion spec's `BuildEntry` therefore carries an optional `opcodeTable` field naming which table that build uses, so `12.1.0.69497` points at `12.1.0.69214`. When `opcodeTable` is absent, `OpcodeTable` falls back to an exact build-id match and reports the standard "no opcode table for this build" error if none exists. Tables are never selected by proximity or guesswork.

### 3.3 Provenance

`wow_family_shift_12_1.json` imports alongside as `data/opcodes/<build>-provenance.json`, preserving each family's shift and its provenance code (`wire`, `jam`, `interp`, `ambiguous`) and the index-offset ranges **including their `null` entries**.

Every lookup result carries a `confidence` field derived from its family's provenance:

| Provenance | Meaning | Result confidence |
|---|---|---|
| `wire` | Established from sniffed packet assignment | `high` |
| `jam` | Established from client JAM type-name strings | `high` |
| `interp` | Forced: shift is monotone and both neighbouring families agree | `medium` |
| `ambiguous` | Two shifts remain possible; deliberately not mapped | family excluded from table |

Families `0x2E` and `0x35` are absent from the generated table. A query landing in one of them must return an explicit *undetermined family* response carrying the provenance note — never "unknown opcode". Collapsing that distinction would launder a known unknown into an apparent fact, which is exactly the error the source authors avoided.

### 3.4 Runtime model

`src/opcodes/OpcodeTable.ts` lazily loads the active build's JSON and builds three indices: by name, by value, and by `(family, index)`. At ~2,400 entries no caching machinery is warranted.

```ts
export interface OpcodeEntry {
  name: string;
  value: number;
  hex: string;
  direction: 'CMSG' | 'SMSG' | 'MSG';
  family: string;
  index: string;
  confidence: 'high' | 'medium';
  build: number;
}

export function lookupByName(name: string): OpcodeEntry | null;
export function lookupByValue(value: number): OpcodeEntry | null;
export function listFamily(family: string): OpcodeEntry[];
export function search(pattern: string, opts?: { direction?: string; limit?: number }): OpcodeEntry[];
export function isUnmappedFamily(family: string): boolean;
```

### 3.5 Tool surface

**`get-opcode-info`** keeps its name and its `opcode: string` signature, so nothing downstream breaks. It now accepts a name *or* a hex/decimal value, and returns name, value, hex, direction, family, index, confidence and source build.

The 8 existing hand-written descriptions and packet structures survive as an **annotation overlay** keyed by opcode name, merged onto the table result. Dropping them in exchange for a bigger but barer table would be a net regression; new annotations can be added without touching the generated table.

Two additions, both nearly free once two build tables exist:

- **`list-opcodes`** — filter by direction, family or name pattern; paginated.
- **`diff-opcodes`** — compare two builds, reporting added, removed and moved opcodes. This makes the 12.0 to 12.1 shift directly inspectable and is immediately useful to the TrinityCore side of the project.

### 3.6 Second consumer

`generate-packet-handler` (`src/tools/registry/knowledge-codegen.ts:173`) currently accepts any opcode string unvalidated and emits a handler around it. It gains a table lookup:

- Unknown opcode: refuse, with near-miss suggestions.
- Known opcode: the generated handler carries the correct 12.1 value and direction.

This removes a bug class rather than adding a feature — today the tool will happily generate a handler for a misspelled or 12.0-era opcode name.

## 4. Data flow

```
Opcodes.cs (WPP fork)  ─┐
                        ├──► scripts/import-opcodes.js ──► data/opcodes/<build>.json
wow_family_shift_12_1  ─┘                             └──► data/opcodes/<build>-provenance.json
                                                                     │
                                                                     ▼
                          BuildManifest.getActiveBuild() ──► OpcodeTable (3 indices)
                                                                     │
                        ┌────────────────────┬───────────────────────┼──────────────────┐
                        ▼                    ▼                       ▼                  ▼
                 get-opcode-info        list-opcodes            diff-opcodes    generate-packet-handler
                        │
                        ▼
              annotation overlay (8 hand-written entries)
```

## 5. Error handling

| Trigger | Behavior |
|---|---|
| Unknown opcode name | Structured error with near-miss suggestions from the name index (Levenshtein over names) |
| Value inside an unmapped family (`0x2E`, `0x35`) | Explicit undetermined-family response carrying the provenance note; not an "unknown opcode" error |
| Value in a mapped family with no matching index | "No opcode at this index for build X"; include the family's index-offset provenance when the range carries a `null` offset |
| No opcode table for the active build | Error naming the exact `import-opcodes.js` command |
| Malformed source file during import | Converter fails loudly with line number; never emits a partial table |

## 6. Testing

**Unit — converter.** Fixture `Opcodes.cs` covering both dictionaries, comments, trailing commas and a malformed entry. Asserts correct direction assignment per block, correct family/index decomposition, and hard failure on malformed input.

**Unit — table.** Name to value and value to name round-trips for a sample across both builds. Family decomposition correctness. `isUnmappedFamily` true for `0x2E` and `0x35`. Confidence propagated from provenance.

**Unit — error paths.** Each row of the §5 table.

**Regression.** All 8 legacy annotations still resolve through `get-opcode-info` and still carry their descriptions and structures.

**Integration.** Import the real `V12_1_0_69214/Opcodes.cs` and assert 2,384 entries with the CMSG/SMSG split matching the source blocks.

## 7. Rollout

1. Converter plus fixture tests. No runtime change.
2. Import both builds; commit the generated JSON.
3. `OpcodeTable` plus unit tests. Still no tool change.
4. `get-opcode-info` rewired onto the table with the annotation overlay; regression test proves the 8 legacy entries survive.
5. `list-opcodes` and `diff-opcodes` added.
6. `generate-packet-handler` validation wired in.

Steps 1-3 are inert with respect to existing behavior. Step 4 is the cutover for the existing tool; rollback is reverting one file.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The generated table is derived, not authoritative — a family shift could be wrong | Provenance is carried per family and surfaced as `confidence`. `interp` families are marked `medium`, ambiguous ones excluded entirely. Consumers can filter. |
| Installed client is 12.1.0.69497; the table is 12.1.0.69214 | Both are 12.1. The mapping is declared explicitly via `BuildEntry.opcodeTable` (§3.2) rather than inferred, so the substitution is visible rather than silent. `diff-opcodes` can compare once a 69497 table exists; re-import is one command. |
| `Opcodes.cs` format changes upstream | Converter fails loudly with a line number rather than emitting a partial table; the fixture test catches format drift. |
| Source path is on a machine-specific drive (`C:\dumps`) | The generated JSON is committed, so ingestion is a maintenance operation and not a runtime dependency. |
| 10 opcodes (88 packets) remain unnamed in the source derivation | Out of scope to resolve here; they are simply absent from the table and produce the standard "no opcode at this index" response. |

## 9. Acceptance criteria

1. `data/opcodes/12.1.0.69214.json` contains 2,384 entries with correct direction split.
2. `data/opcodes/12.0.7.67808.json` exists, enabling `diff-opcodes`.
3. `get-opcode-info` resolves by name and by hex/decimal value, and all 8 legacy annotations still return their descriptions and structures.
4. A query into family `0x2E` returns an undetermined-family response, not an unknown-opcode error.
5. `generate-packet-handler` refuses an unknown opcode name.
6. `npx tsc --noEmit` passes; `npm test` shows no new failures beyond the ~11 known pre-existing ones.
