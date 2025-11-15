# TVFS Parser Complete Fix Plan

## Problem Statement
FileDataID lookups fail (e.g., FileDataID 1579844 for Azeroth WDT) despite CASC loading 2.9M files successfully.

## Root Cause Analysis

### What Works
- ✅ Recursive TVFS parsing loads 2,913,181 files
- ✅ Listfile loads 2,095,687 entries from C:/temp/wow-listfile.csv
- ✅ TVFS structure correctly parsed (path table, VFS table, CFT table)
- ✅ Paths extracted: mix of real paths and $fid:{id} fallback format

### What Doesn't Work
- ❌ `entry.fileId` field is always `null` in CASCRootEntry
- ❌ FileDataID→Path lookups fail
- ❌ `cascReader.getFileByID(1579844)` throws "not found"

## Technical Understanding (From Research & Debugging)

### TVFS Structure
```
Path Table: Recursive tree structure
- Folder nodes: NodeValue with bit 31 set
  - dirLen = (NodeValue & 0x7FFFFFFF) - 4
  - Recurse into folder contents with boundary
- File nodes: NodeValue with bit 31 clear
  - NodeValue = VFS byte offset
  - Read VFS entry → get CFT offset → get EKey

VFS Table: Maps files to CFT entries
- Entry: spanCount (1 byte) + spans
- Span: fileOffset (4B BE) + spanLength (4B BE) + cftOffset (variable BE)

CFT Table: Contains EKeys and sizes
- Entry: EKey (9 bytes) + encodedSize (4B BE) + contentSize (4B BE)
```

### Path Building Algorithm
```typescript
function recursiveParse(offset: number, pathBuffer: string[], boundary: number) {
  while (offset < boundary) {
    entry = capturePathEntry(offset)

    // Add name to pathBuffer
    if (entry.hasPreSeparator) pathBuffer.push('/')
    if (entry.name) pathBuffer.push(entry.name)
    if (entry.hasPostSeparator) pathBuffer.push('/')

    if (entry.hasNodeValue) {
      if (entry.nodeValue & 0x80000000) {
        // FOLDER: recurse with dirLen boundary
        dirLen = (entry.nodeValue & 0x7FFFFFFF) - 4
        offset = recursiveParse(offset, pathBuffer, offset + dirLen)
      } else {
        // FILE: extract with full path
        fullPath = pathBuffer.join('')
        extractFile(fullPath, entry.nodeValue)  // nodeValue = VFS offset
      }
    }

    // Restore pathBuffer to current depth
    pathBuffer.length = savedDepth
  }
}
```

### FileDataID Extraction Problem
```typescript
// Current extractTVFSFile() logic (lines 647-691 in backup):
const fileDataId = CASCListFile.parseFileDataId(filePath)  // filePath is hex string

// CASCListFile.parseFileDataId() logic:
if (hexStr.length >= 52 && hexStr[12] === ':') {
  // Extract from WoW Generic Name format
  return parseInt(hexStr.substring(13, 21), 16)
}
// Fallback: parse entire hex string
return parseInt(hexStr, 16)  // ❌ WRONG for TVFS hex paths!

// TVFS hex paths are 35-43 chars, NOT 52-53 Generic Name format
// Examples:
// - "006F256F383433179DD5EDD57C179D43F4B4D2B" (43 chars)
// - "0B68755BA31A6287B7F3764D77D6205C7" (35 chars)

// Result: FileDataID extracted incorrectly → fileId field not populated
```

### CASCRootEntry fileId Population
```typescript
// Line 691 in backup:
fileId: filePath !== actualFilePath ? CASCListFile.parseFileDataId(filePath) : undefined

// Issue: parseFileDataId() returns wrong value for TVFS hex paths
// So fileId = undefined → lookups fail
```

## Solution Design

### Phase 1: Fix FileDataID Extraction from TVFS Hex Paths

**Problem**: TVFS hex paths are NOT WoW Generic Names. They're raw hex identifiers.

**Research Needed**:
- What do TVFS hex paths actually represent?
- Are they EKey hashes? Content hashes? Path hashes?
- How to map them to FileDataIDs?

**Options**:
1. TVFS hex paths ARE FileDataIDs encoded as hex → parse first N bytes as FileDataID
2. TVFS hex paths are content hashes → need separate FileDataID table (DB2 or listfile)
3. Give up on FileDataID extraction from paths → rely entirely on external listfile

**Chosen Approach**: Option 3 - Use external listfile ONLY
- Modern TVFS doesn't encode FileDataIDs in paths
- Listfile maps FileDataID → Path
- Build reverse index: Path → FileDataID
- When extracting file, look up path in reverse index to get FileDataID

### Phase 2: Rewrite CASCRootReader.extractTVFSFile()

```typescript
// NEW IMPLEMENTATION:
private extractTVFSFile(filePath: string, vfsTable: Buffer, cftTable: Buffer, header: any, vfsOffset: number): void {
  // 1. Extract EKey from VFS/CFT tables (existing logic - works)
  const eKey = extractEKeyFromVFS(vfsOffset, vfsTable, cftTable, header)

  // 2. Look up FileDataID from listfile (NEW)
  let fileDataId: number | undefined
  let actualFilePath = filePath

  if (this.listFile && this.listFile.isLoaded()) {
    // Normalize path
    const normalizedPath = filePath.toLowerCase()

    // Look up in listfile reverse index: Path → FileDataID
    fileDataId = this.listFile.getFileDataId(normalizedPath)

    if (fileDataId) {
      // Found in listfile - use human-readable path
      actualFilePath = this.listFile.getPath(fileDataId) || filePath
    } else {
      // Not in listfile - keep hex path, no FileDataID
      fileDataId = undefined
    }
  }

  // 3. Create CASCRootEntry with proper fileId
  const entry: CASCRootEntry = {
    filePath: this.normalizePath(actualFilePath),
    contentKey: eKey,
    localeFlags: LocaleFlag.ALL,
    contentFlags: ContentFlag.NONE,
    fileId: fileDataId  // ✅ Properly populated!
  }

  this.addEntry(entry)
}
```

### Phase 3: Ensure CASCListFile Has Reverse Index

```typescript
// In CASCListFile.ts - ensure reverse index exists:
export class CASCListFile {
  private fileDataToPath: Map<number, string> = new Map()
  private pathToFileData: Map<string, number> = new Map()  // ✅ Already exists!

  async loadListFile(listFilePath: string): Promise<void> {
    // ... existing load logic ...

    // Ensure both indexes are populated:
    this.fileDataToPath.set(fileDataId, filePath)
    this.pathToFileData.set(filePath.toLowerCase(), fileDataId)  // ✅ Already done!
  }

  getFileDataId(filePath: string): number | null {
    return this.pathToFileData.get(filePath.toLowerCase()) || null  // ✅ Already exists!
  }
}
```

### Phase 4: Fix FileDataID Lookup in CASCRootReader

```typescript
// Ensure fileIdMap is properly populated:
private addEntry(entry: CASCRootEntry): void {
  this.entries.set(entry.filePath, entry)

  // ✅ Add to fileIdMap if fileId exists
  if (entry.fileId !== undefined && entry.fileId > 0) {
    this.fileIdMap.set(entry.fileId, entry)
  }

  this.totalEntries++
}

// Then getFileByID() should work:
getFileByID(fileDataId: number): Buffer {
  const entry = this.fileIdMap.get(fileDataId)  // ✅ Should find it now!
  if (!entry) {
    throw new Error(`FileDataID ${fileDataId} not found`)
  }
  return this.getFileByEntry(entry)
}
```

## Implementation Steps

### Step 1: Remove CASCListFile.parseFileDataId() Usage
- ❌ Remove reliance on parseFileDataId() for TVFS paths
- ✅ Use getFileDataId(path) reverse lookup instead

### Step 2: Update extractTVFSFile()
- Implement new logic from Phase 2 above
- Test with sample paths

### Step 3: Verify fileIdMap Population
- Add debug logging to addEntry()
- Confirm fileId field is non-null for files in listfile

### Step 4: Test FileDataID Lookup
- Test: `cascReader.getFileByID(1579844)`
- Should find file if 1579844 is in listfile

### Step 5: Handle Missing FileDataIDs
- If 1579844 not in listfile → need better listfile source
- Check WoW version compatibility (listfile may be for different patch)

## Known Issues to Address

### Issue 1: Listfile May Be Outdated
```
FileDataID 1579844 in listfile: creature/felseagiant2/seagiant2_fel_effect.blp
User expects 1579844 to be: Azeroth WDT from Map.db2
```

**Resolution**:
- Listfile is for different WoW patch/version
- Need to either:
  a) Get correct listfile for WoW 11.x (current build)
  b) Read Map.db2 directly to get WDT FileDataIDs
  c) Use different test FileDataIDs that are known to exist

### Issue 2: Map.db2 Reading Not Implemented
- DB2 infrastructure exists but Map table not defined
- Need Map.db2 structure:
  ```
  - ID (record ID)
  - Directory (string)
  - MapName (string)
  - WdtFileDataID (uint32)  ← THIS IS WHAT WE NEED!
  - ... other fields ...
  ```

**Resolution**: Implement Map.db2 reading as separate task AFTER basic FileDataID lookup works

## Success Criteria

1. ✅ CASC loads 2.9M+ files (already works)
2. ✅ Listfile loads 2M+ entries (already works)
3. ✅ FileDataID field populated in CASCRootEntry for files in listfile
4. ✅ fileIdMap correctly indexed
5. ✅ cascReader.getFileByID(X) works for FileDataIDs in listfile
6. ✅ Test with known-good FileDataID from listfile
7. 🔄 Test with Map.db2 FileDataIDs (requires Map.db2 reading - Phase 2)

## Time Estimate
- Step 1-4: 30 minutes (fix FileDataID population)
- Step 5: 15 minutes (testing)
- Map.db2 reading: 2 hours (separate task)

## Risk Mitigation
- Keep backup of current working code
- Test incrementally at each step
- Verify 2.9M files still load after each change
- Add comprehensive logging for debugging
