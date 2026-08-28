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
