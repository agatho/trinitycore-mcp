# WoW 12.1 Migration — Decisions Made Autonomously

**Session:** overnight 2026-08-27/28, unattended.
**Branch:** `feature/wow-12-1-migration`, 29 commits from `e3d8a633`.
**Specs:** `specs/2026-08-27-wow-12-1-build-foundation-design.md`, `specs/2026-08-27-wow-12-1-opcode-subsystem-design.md`

Every decision below was made without human input. Each names what it costs if wrong.
Read this first; rework anything you disagree with.

## Outcome

| | Status |
|---|---|
| Build manifest, layout-hash gate, build-keyed caches | **Live.** Active build `12.0.x-20251222` (65390), 9/9 schemas verified. |
| 12.1 opcode subsystem | **Live.** 2384 opcodes, provenance-aware, replacing an 8-entry dictionary. |
| 12.1 client-data cutover | **PARKED** — blocked by two pre-existing CASC defects (see D16). |
| Stat priorities | Re-sourced 39/39 from live Icy Veins 12.1 guides; verified by an independent reviewer against 6 pages. |

## Structural decisions

**D1 — Feature branch, not a git worktree.** 30 source files are untracked and exist only in your working tree (incl. `src/scripts/generate-spell-cache.ts`, a task target, and `src/casc/CASCListFile.ts`, imported by tracked code). A clean worktree fails `tsc` immediately. *Cost:* your uncommitted edits shared the tree — mitigated by explicit-path-only commits; verified none were swept in.

**D2 — Task order: foundation 1-10 → opcode 1-7 → foundation 11-12.** Put the unbounded, irreversible work last so an overnight stall couldn't sink everything else. *Cost:* none material.

**D3 — Split Task 11 into 11a (manifest goes live) and 11b (extraction/cutover).** 11a is deterministic and had to land regardless. *Cost:* two commits instead of one.

**D4 — If extraction fails, park the cutover and keep the archived build active.** A manifest pointing at absent data breaks every data tool. *Cost:* the 12.1 data cutover waits for you — the safe direction.

## Corrections to my own plans

**D5 — Accessors fall back to env synthesis instead of throwing.** The plan had manifest accessors throw before load; that broke 4 existing test suites and violated the "nothing breaks without a manifest" constraint. *Cost:* a genuinely forgotten `loadBuildManifest()` degrades to env paths instead of erroring; mitigated by a one-time warning.

**D6 — Archived build numbered 65390 as an explicit floor marker.** The build behind your 2025-12-22 extraction is unrecoverable (client since updated; DB2 headers carry no build number). I refused to fabricate `66838`. *Cost:* if you later identify it, renumbering is one Map key per schema plus one manifest field.

**D7 — Build-unknown reports `unverified`, not `mismatch`.** A reviewer caught that a build-0 sentinel made all 9 schemas report "known broken" when the truth was "nothing to check against". Fix went in the reporting layer, not the gate. *Cost:* a genuinely out-of-range dataset understates rather than overstates a problem.

**D8 — Case-insensitive DB2 lookup.** `CASCListFile` lowercases paths, so extraction writes `spellname.db2` while validation looked for `SpellName.db2`. Windows hid it; Linux would report all 9 schemas missing. *Cost:* one extra directory read per validation.

**D9 — `SOURCE_BUILD` is a static constant, not `getActiveBuild()`.** "Which build is active" and "which patch this hand-authored data was researched against" are independent facts. *Cost:* manual update when content is re-sourced — correct, since re-sourcing is manual.

**D10 — `package.json` claims 12.x + 12.1 opcode tables, not 12.1 support.** The opcode work is live; the data cutover is not. *Cost:* undersells the opcode work.

**D11 — Regenerated the spell caches rather than stamping them.** I could not prove the existing 36MB caches (2026-02-13) came from the DB2 files on disk (2025-12-22); stamping would assert unverified provenance. *Cost:* one regeneration over 177,249 spells. **This also fixed a live regression** — both caches were being refused at runtime for lacking build metadata.

## Opcode subsystem — the hard ones

**D12 — Ingest the validated WPP table rather than re-derive the shift.** The derivation is proven against 1,058,913 sniffed packets; reimplementing it would duplicate its caveats too. *Cost:* we depend on a vendored artifact, now committed so it isn't a live path dependency.

**D13 — Annotation-only fallback for documented opcodes with no wire value.** 4 of your 8 hand-written annotations have no 12.1 counterpart (both `MESSAGECHAT` names were renamed; both `MSG_*` because `MiscOpcodes` is empty). They return documentation with a note instead of "not found". *Cost:* four opcodes report docs without a wire value — the true state of the evidence.

**D14 — Surface undetermined index ranges.** 187 catalog opcodes sit in ranges whose offset the derivation could not decide. *Cost:* an extra field; the alternative was silently reporting them as nonexistent.

**D15 — Catalog vs client namespaces made explicit.** `unmappedCatalogFamilies`/`unmappedCatalogIndexRanges` are 12.0.7 *catalog* identifiers; wire values decompose to *client* families. Conflating them was a real bug — it recurred twice, and the second instance gave 63% of opcodes a wrong confidence value. *Cost:* we can no longer attribute a specific miss to a specific gap — a claim that was never sound.

**D16 — Extraction parked; two pre-existing CASC defects surfaced.** The low-level pipeline works (16 index archives, 3.25M TVFS paths). File resolution fails: `CASCRootReader` FileDataID parsing yields garbage 2³³-range values, and vendored CascLib returns `ERROR_FILE_NOT_FOUND` for verified-stable FileDataID 1349477. **Neither is 12.1-specific.** These block any future extraction and are the top follow-up.

## Known gaps shipping as-is

- `verifyExtraction` never re-checks that listed files still exist, and doesn't verify the sha256 values it computes. Inert while 11b is parked.
- The catalog-space predicates have no production consumer — tested internal API only.
- 24 opcodes diverge from the provenance formula; the vendored table came from a later derivation. Recorded in the table's `_derivationNote` so nobody "corrects" it backwards.
- **Test baseline:** 15 suites fail, 14 of them fail to *compile* on pre-existing type errors. `npx tsc --noEmit` is clean only because test files sit outside `tsconfig` — don't trust it as a full gate.
