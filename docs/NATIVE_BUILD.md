# Native CASC Addon — Build and Troubleshooting

The native addon `build/Release/casc_native.node` resolves WoW client files by
FileDataID using [CascLib](https://github.com/ladislav-zezula/CascLib). It is
what makes client-data extraction possible.

Both `dep/` and `build/` are gitignored, so **nothing about this build lives in
git except `binding.gyp` and `scripts/fetch-casclib.js`.** Those two files are
what make it reproducible.

## Building

```bash
node scripts/fetch-casclib.js      # or: npm run fetch:casclib
npm run build:native
```

Requirements: Node 18+, Python 3, and a C++ toolchain (MSVC on Windows).

### If the build fails with `EPERM: operation not permitted, unlink ...casc_native.node`

A running process has the addon loaded — usually the MCP server itself
(`node dist/index.js`). You do **not** need to stop it. Windows allows renaming
a loaded module even though deleting it fails, and `node-gyp rebuild` cleans the
whole output directory, so move the file out of `build/` entirely:

```bash
mv build/Release/casc_native.node /tmp/casc_native.node.inuse
npm run build:native
```

The running server keeps its in-memory copy and picks up the new addon on its
next restart.

## Verifying the addon actually works

A successful build proves nothing about whether FileDataIDs resolve. Probe it:

```bash
node -e "
const addon = require('./build/Release/casc_native.node');
const s = new addon.CASCStorage(process.env.WOW_PATH);
for (const id of [1349477, 1375801, 1267351]) {
  try { const b = s.extractFileByID(id); console.log(id, b.length, b.slice(0,4).toString('ascii')); }
  catch (e) { console.log(id, 'FAIL', e.message); }
}
s.close();
"
```

Expected: `1349477` returns ~135 KB with magic `WDC5` (that is `Map.db2`).

## The failure mode this pin exists to prevent

**Symptom:** `CascOpenStorage` succeeds, `isOpen()` is true, and then *every*
FileDataID lookup returns `Error code 2` (`ERROR_FILE_NOT_FOUND`) — including
ids that certainly exist.

**Cause:** a CascLib older than the installed WoW client cannot index that
client's TVFS root. It registers zero file ids, so every lookup misses. Nothing
in the API reports this; the storage looks healthy.

**Diagnostic that distinguishes it from a genuinely wrong id:** probe several
ids at once. One bad id is a bad id; *zero of many* resolving means the index is
empty and the library is too old.

**Observed instance:** WoW 12.1.0.69497 against CascLib vendored 2025-11 —
0 of 13 ids resolved. After upgrading to the pinned commit
`2a280f5a231966dc5d1b534978dd9f9f04a374cd` (2026-08-22), the same probe resolved
correctly. The relevant change was entirely in TVFS handling
(`CascRootFile_TVFS.cpp` grew 811 → 997 lines); `CascRootFile_WoW.cpp` was
byte-identical between the two versions, so root *format version* was never the
issue.

**If this recurs after a WoW patch:** bump `PINNED_COMMIT` in
`scripts/fetch-casclib.js`, re-fetch, rebuild, and re-run the probe above before
committing the new pin.

## A different error worth recognising

`Failed to read file data` is **not** the same failure. It means the file *is*
indexed but its data is not present in the local archives — WoW installs are
partial. Those files need CascLib's CDN/online mode, not a rebuild.

## Related known issue

`src/casc/CASCRootReader.ts` parses TVFS entry names as though they carry
FileDataIDs (`LLLLLLLLCCCC:IIIIIIII…`, 52–53 chars). Against 12.1.0.69497 the
TVFS yields only 16-char container-node names such as `0000000200000000`, which
fall through to a `parseInt(entireString, 16)` fallback and produce meaningless
values in the 2³³ range. CascLib handles this correctly by reparsing to the WoW
root; the TypeScript reader has no equivalent step. Prefer the native addon for
FileDataID resolution.

## Why the CDN does not help (measured, 12.1.0.69497)

CDN fallback was implemented and tested. **It does not recover any additional
DB2, and the reason is worth recording so nobody rebuilds it.**

Every one of the 320 DB2s a listfile-driven extraction failed to produce was
categorised by actual cause:

| Cause | Count |
|---|---|
| Encrypted — CascLib has no TACT key | **152** |
| Not present in this build at all | **168** |
| Would succeed on retry | 0 |
| Other | 0 |

- The **168** are tables the community listfile names from *older* builds. They
  do not exist in 12.1, so no CDN has them for this build.
- The **152** are already on disk. `Failed to read file data` was our own
  generic message hiding the real cause: reads fail on the *last chunk*
  (e.g. `SpellName` read 8,104,618 of 8,110,370 bytes) with Windows error
  **6002 = ERROR_FILE_ENCRYPTED**. Re-downloading identical encrypted bytes
  changes nothing.

**24 distinct TACT keys** block those 152 files. The five tables blocking the
12.1 schema cutover need three of them:

| Key | Blocks |
|---|---|
| `14F4B11D7B067AA2` | SpellName, SpellEffect |
| `055C2C56039A6E5E` | Item, ItemSparse |
| `2555AE20C2538D36` | ChrRaces |

Blizzard ships unreleased content encrypted and publishes keys when it goes
live; CascLib bundles 468 known keys, but not these. The real blocker is key
availability, not bandwidth.

To supply keys once they are known, CascLib already exposes:

```c
CascAddStringEncryptionKey(hStorage, KeyName, szKey);
CascImportKeysFromFile(hStorage, szFileName);   // community TACT key lists
CascGetNotFoundEncryptionKey(hStorage, &KeyName);  // what the addon now reports
```

Online mode remains available (`new CASCStorage(path, locale, true, cacheDir, "wow")`)
for content genuinely absent from a partial install, but it is **not** the fix
for encrypted DB2s.

## Enumerating the storage

`scripts/casc-enumerate.js` reads CASC's own index rather than a listfile:

```
total entries indexed  : 3,237,741
entries with FileDataID: 1,930,527
FileDataID range       : 21 .. 8,345,033
total indexed size     : 313.10 GB
```

Compared against the community listfile: **23,400 files exist in this build that
the listfile never names**, and 303,134 listfile entries refer to builds other
than this one. Entry names are synthesised (`FILE00000015.dat`) because this
root is FileDataID-based — names come from listfiles, not from CASC.

## DB2 record access: what works and what does not (12.1)

Two distinct record layouts exist, and only one is fully implemented.

**Dense records** (fixed size, ids in an ID table) work, including all WDC3+
compressed storage modes. `Item.db2` decodes correctly and was verified against
`hotfixes.item`.

**Sparse records** (variable size, catalog/offset map, `flags & 0x1`) do NOT.
`ItemSparse.db2` is the significant one. Its field offsets cannot be static:
strings are stored inline and null-terminated, so every field after a string
shifts by that string's length, per record. `DB2Record.getFieldOffset()` returns
a fixed offset per field, which is correct for dense records and wrong here.

Measured against `hotfixes.item_sparse` over 288 items with the correct 12.1
column mapping applied: `ItemLevel` 0/288, `OverallQualityID` 0/288,
`SheatheType` 175/288. Names come back as fragments (`"ord"`), which is the
same symptom seen from the string side.

**Why this is a design decision rather than a fix.** Computing sparse offsets
requires walking each record field by field, which requires knowing which
fields are strings. That type information is not in the DB2 file. TrinityCore
solves it by carrying hardcoded per-table structures (`DB2Metadata.h`). Options
here are to generate equivalent metadata from WoWDBDefs `.dbd` files, hand-write
it for the handful of tables actually used, or route sparse tables through the
native CascLib-backed path instead. That choice should be made deliberately.

The correct 12.1 `ItemSparse` column mapping (layout `0x1C17D17F`) has been
derived and is straightforward to reapply once sparse access works: ID is
`$noninline$`, so field index equals the WoWDBDefs column index minus one, with
array columns addressed via `arrayIndex` rather than expanded into consecutive
fields.

## Correction: dense ID-list loading is not broken

An earlier commit message on the decoder fix claimed "dense ID-list loading
still yields 1 entry". That is wrong. `Item.db2` has 41 sections; section 0
loads all 59,549 ids correctly, and the single-entry log line belonged to one of
the 40 small hotfix sections that follow it.

The apparent shortfall during verification had a different cause:
`hotfixes.item` holds 290 rows, not the file's 59,675 - it is a hotfix-override
table, not a full import. Items in it that are absent from the client file are
server-side additions, and the one `Material` divergence observed is an override
doing exactly what that table exists to do.
