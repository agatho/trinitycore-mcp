# CASC TVFS Format Research - CascLib Implementation Analysis

## Executive Summary

This document contains comprehensive research on how **CascLib by Ladislav Zezula** handles World of Warcraft's TVFS (TACT VFS manifest) format, specifically focusing on FileDataID→EKey mapping and VFS table parsing.

**Source:** TrinityCore/TrinityCore repository (`dep/CascLib/src/CascRootFile_TVFS.cpp`)
**Author:** Ladislav Zezula (2018)
**Format:** TACT (Trusted Application Content Transfer) VFS manifest

---

## 1. TVFS Root File Handling

### 1.1 TVFS Header Structure

```cpp
struct TVFS_DIRECTORY_HEADER
{
    DWORD Signature;                    // Must be CASC_TVFS_ROOT_SIGNATURE
    BYTE  FormatVersion;                // Version of the format. Should be 1.
    BYTE  HeaderSize;                   // Size of the header, in bytes
    BYTE  EKeySize;                     // Size of an E-Key. TACT uses 9-byte E-keys
    BYTE  PatchKeySize;                 // Size of a patch key. TACT uses 9-byte P-keys
    DWORD Flags;                        // Flags. See TVFS_FLAG_XXX

    // Table offsets and sizes
    DWORD  PathTableOffset;             // Offset of the path table
    DWORD  PathTableSize;               // Size of the path table
    DWORD  VfsTableOffset;              // Offset of the VFS table
    DWORD  VfsTableSize;                // Size of the VFS table
    DWORD  CftTableOffset;              // Offset of the container file table
    DWORD  CftTableSize;                // Size of the container file table
    USHORT MaxDepth;                    // Maximum depth of the path prefix tree
    DWORD  EstTableOffset;              // Encoding specifier table offset (write support)
    DWORD  EstTableSize;                // Encoding specifier table size (write support)

    DWORD  CftOffsSize;                 // Byte length of offset in Container File Table
    DWORD  EstOffsSize;                 // Byte length of offset in Encoding Specifier Table
};
```

### 1.2 TVFS Flags

```cpp
#define TVFS_FLAG_INCLUDE_CKEY       0x0001  // Include C-key in content file record
#define TVFS_FLAG_WRITE_SUPPORT      0x0002  // Write support (includes encoding specifiers)
#define TVFS_FLAG_PATCH_SUPPORT      0x0004  // Patch support (includes patch records)
#define TVFS_FLAG_LOWERCASE_MANIFEST 0x0008  // All paths converted to ASCII lowercase
```

### 1.3 Header Parsing Implementation

```cpp
static DWORD CaptureDirectoryHeader(TVFS_DIRECTORY_HEADER & DirHeader, CASC_BLOB & Data)
{
    // Extract data from buffer
    DirHeader.Data.MoveFrom(Data);
    pbDataPtr = DirHeader.Data.pbData;
    pbDataEnd = DirHeader.Data.End();

    // Capture signature (must be CASC_TVFS_ROOT_SIGNATURE)
    pbDataPtr = CaptureInteger32(pbDataPtr, pbDataEnd, &DirHeader.Signature);
    if(pbDataPtr == NULL || DirHeader.Signature != CASC_TVFS_ROOT_SIGNATURE)
        return ERROR_BAD_FORMAT;

    // Capture format metadata
    pbDataPtr = CaptureByteArray(pbDataPtr, pbDataEnd, 4, &DirHeader.FormatVersion);
    if(pbDataPtr == NULL || DirHeader.FormatVersion != 1 ||
       DirHeader.EKeySize != 9 || DirHeader.PatchKeySize != 9)
        return ERROR_BAD_FORMAT;

    // Swap all values from big-endian to host byte order
    DirHeader.Flags = ConvertBytesToInteger_4_LE((LPBYTE)(&DirHeader.Flags));
    DirHeader.PathTableOffset = ConvertBytesToInteger_4((LPBYTE)(&DirHeader.PathTableOffset));
    DirHeader.VfsTableOffset  = ConvertBytesToInteger_4((LPBYTE)(&DirHeader.VfsTableOffset));
    // ... etc for all offset/size fields

    // Determine size of offset fields dynamically
    DirHeader.CftOffsSize = GetOffsetFieldSize(DirHeader.CftTableSize);
    DirHeader.EstOffsSize = GetOffsetFieldSize(DirHeader.EstTableSize);

    return ERROR_SUCCESS;
}
```

**Critical Detail:** Offset field size is variable-length (1-4 bytes) based on table size:

```cpp
static DWORD GetOffsetFieldSize(DWORD dwTableSize)
{
    if(dwTableSize > 0xffffff) return 4;
    if(dwTableSize > 0xffff)   return 3;
    if(dwTableSize > 0xff)     return 2;
    return 1;
}
```

---

## 2. FileDataID Mapping Structure (WoW-Specific)

### 2.1 TVFS WoW Entry Structure

```cpp
typedef struct _TVFS_WOW_ENTRY
{
    DWORD  LocaleFlags;                 // Locale flags
    USHORT ContentFlags;                // Content flags
    DWORD  FileDataId;                  // The actual FileDataID
    BYTE   ContentKey[MD5_HASH_SIZE];   // Content key (16 bytes)
} TVFS_WOW_ENTRY, *PTVFS_WOW_ENTRY;
```

### 2.2 WoW Generic Name Format

World of Warcraft uses a specific naming convention for TVFS entries:

```
Format: LLLLLLLLCCCC:IIIIIIIIKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK

L = LocaleFlags  (8 hex chars = 4 bytes)
C = ContentFlags (4 hex chars = 2 bytes)
I = FileDataId   (8 hex chars = 4 bytes)
K = ContentKey   (32 hex chars = 16 bytes)

Example: 000000020000:000C472F02BA924C604A670B253AA02DBCD9441C
         ^^^^^^^^^^  ^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
         LocaleFlags  FileID   ContentKey (CKey)
         ContentFlags
```

**Total Length:** 52-53 characters (53 is valid, 52 is legacy with missing CKey digit)

### 2.3 FileDataID Extraction Implementation

```cpp
DWORD CheckWoWGenericName(const CASC_PATH<char> & PathBuffer, TVFS_WOW_ENTRY & WowEntry)
{
    size_t nPathLength = PathBuffer.Length();
    BYTE BinaryBuffer[4+2+4+16];  // LocaleFlags + ContentFlags + FileDataId + ContentKey

    // Check format: must be 52 or 53 chars with colon at position 12
    if(nPathLength == 52 || nPathLength == 53)
    {
        if(PathBuffer[12] == ':')
        {
            // Convert first part (locale + content flags) from hex to binary
            if(BinaryFromString(&PathBuffer[00], 12, (LPBYTE)(&BinaryBuffer[0])) != ERROR_SUCCESS)
                return ERROR_REPARSE_ROOT;

            // Convert second part (FileDataId + ContentKey) from hex to binary
            if(BinaryFromString(&PathBuffer[13], 40, (LPBYTE)(&BinaryBuffer[6])) != ERROR_SUCCESS)
                return ERROR_REPARSE_ROOT;

            #ifdef TVFS_PARSE_WOW_ROOT
            // Only accept 53-char strings (complete CKey)
            if(nPathLength == 53)
            {
                WowEntry.LocaleFlags  = ConvertBytesToInteger_4(BinaryBuffer + 0x00);
                WowEntry.ContentFlags = ConvertBytesToInteger_2(BinaryBuffer + 0x04);
                WowEntry.FileDataId   = ConvertBytesToInteger_4(BinaryBuffer + 0x06);
                memcpy(WowEntry.ContentKey, BinaryBuffer + 0x0A, MD5_HASH_SIZE);
                return ERROR_SUCCESS;
            }
            #endif

            // Invalid entry - reparse to normal root
            return ERROR_REPARSE_ROOT;
        }
    }
    return ERROR_BAD_FORMAT;
}
```

**Binary Buffer Layout:**
```
Offset  Size  Field
------  ----  --------------
0x00    4     LocaleFlags
0x04    2     ContentFlags
0x06    4     FileDataId      <--- THE KEY MAPPING
0x0A    16    ContentKey (CKey)
```

**CRITICAL:** By default, `TVFS_PARSE_WOW_ROOT` is **NOT** defined in CascLib, meaning TVFS WoW parsing is disabled! The code will return `ERROR_REPARSE_ROOT`, forcing fallback to legacy ROOT file format.

---

## 3. VFS Table Parsing

### 3.1 VFS Table Entry Structure

The VFS table contains **span entries** that describe file data locations:

```
Structure of a VFS span entry:
-------------------------------
4 bytes: Offset into the referenced file (big-endian)
4 bytes: Size of the span (big-endian)
? bytes: Offset into Container File Table (1-4 bytes, variable)
```

The offset field size is determined by `GetOffsetFieldSize(DirHeader.CftTableSize)`.

### 3.2 SpanCount Values

```cpp
// 1 - 224  = valid file entries
// 225-254  = other/special entries
// 255      = deleted file
```

### 3.3 VFS Parsing Algorithm

#### Step 1: Capture SpanCount

```cpp
LPBYTE CaptureVfsSpanCount(TVFS_DIRECTORY_HEADER & DirHeader, DWORD dwVfsOffset, DWORD & SpanCount)
{
    LPBYTE pbVfsFileTable = DirHeader.DataAt(DirHeader.VfsTableOffset);
    LPBYTE pbVfsFileEntry = pbVfsFileTable + dwVfsOffset;
    LPBYTE pbVfsFileEnd = pbVfsFileTable + DirHeader.VfsTableSize;

    // Validate offset is within VFS table bounds
    if(!(pbVfsFileTable <= pbVfsFileEntry && pbVfsFileEntry < pbVfsFileEnd))
        return NULL;

    // Read SpanCount (1 byte)
    SpanCount = *pbVfsFileEntry++;

    // Only accept valid file spans (1-224)
    return (1 <= SpanCount && SpanCount <= 224) ? pbVfsFileEntry : NULL;
}
```

#### Step 2: Capture VFS Span Entries

```cpp
LPBYTE CaptureVfsSpanEntries(TVFS_DIRECTORY_HEADER & DirHeader, LPBYTE pbVfsSpanEntry,
                             PCASC_CKEY_ENTRY PtrSpanEntry, size_t SpanCount)
{
    size_t ItemSize = sizeof(DWORD) + sizeof(DWORD) + DirHeader.CftOffsSize;

    // Convert all spans
    for(size_t i = 0; i < SpanCount; i++)
    {
        // Extract Container File Table offset (variable-length)
        DWORD dwCftOffset = ConvertBytesToInteger_X(
            pbVfsSpanEntry + sizeof(DWORD) + sizeof(DWORD),
            DirHeader.CftOffsSize
        );

        // Resolve Container File Table entry
        pbCftFileTable = DirHeader.DataAt(DirHeader.CftTableOffset);
        pbCftFileEntry = pbCftFileTable + dwCftOffset;
        pbCftFileEnd = pbCftFileTable + DirHeader.CftTableSize;

        // Capture EKey and file size from CFT entry
        CaptureEncodedKey(PtrSpanEntry->EKey, pbCftFileEntry, DirHeader.EKeySize);
        PtrSpanEntry->ContentSize = ConvertBytesToInteger_4(pbVfsSpanEntry + sizeof(DWORD));

        // Move to next span entry
        pbVfsSpanEntry += ItemSize;
        PtrSpanEntry++;
    }

    return pbVfsSpanEntry;
}
```

### 3.4 Container File Table (CFT)

The Container File Table stores the actual EKey and size information:

```
CFT Entry Structure:
--------------------
9 bytes:  EKey (Encoded Key)
4 bytes:  EncodedSize (big-endian)
4 bytes:  ContentSize (big-endian)
```

**EKey → CKey Mapping:** The EKey from CFT is used to look up the corresponding CKey (Content Key) in the ENCODING file, which then maps to the actual file data in the archive.

---

## 4. Path Table Parsing

### 4.1 Path Table Entry Structure

```cpp
typedef struct _TVFS_PATH_TABLE_ENTRY
{
    char * m_pNamePtr;                  // Pointer to begin of node name
    char * m_pNameEnd;                  // Pointer to end of file name
    DWORD NodeFlags;                    // TVFS_PTE_XXX flags
    DWORD NodeValue;                    // Node value (folder size or VFS offset)
} TVFS_PATH_TABLE_ENTRY;
```

### 4.2 Path Table Entry Format

```
Entry Format (variable-length):
--------------------------------
(1 byte)  0x00 (optional)      - Prefix path separator flag
(1 byte)  Name length
(N bytes) Name fragment
(1 byte)  0x00 (optional)      - Postfix path separator flag
(1 byte)  0xFF (optional)      - Node value identifier
(4 bytes) NodeValue (if 0xFF present, big-endian)
```

### 4.3 Node Flags

```cpp
#define TVFS_PTE_PATH_SEPARATOR_PRE  0x0001  // Path separator before name
#define TVFS_PTE_PATH_SEPARATOR_POST 0x0002  // Path separator after name
#define TVFS_PTE_NODE_VALUE          0x0004  // NodeValue is valid
```

### 4.4 Node Value Interpretation

```cpp
#define TVFS_FOLDER_NODE             0x80000000  // Highest bit = folder
#define TVFS_FOLDER_SIZE_MASK        0x7FFFFFFF  // Lower 31 bits = size

// If highest bit is set:
if(PathEntry.NodeValue & TVFS_FOLDER_NODE)
{
    // It's a folder/directory - lower 31 bits contain directory size
    DWORD folderSize = PathEntry.NodeValue & TVFS_FOLDER_SIZE_MASK;
    // Directory data immediately follows path node
}
else
{
    // It's a file - NodeValue is offset into VFS table
    DWORD vfsOffset = PathEntry.NodeValue;
}
```

### 4.5 Path Table Parsing Algorithm

```cpp
LPBYTE CapturePathEntry(TVFS_PATH_TABLE_ENTRY & PathEntry, LPBYTE pbPathTablePtr, LPBYTE pbPathTableEnd)
{
    // Reset entry
    PathEntry.m_pNamePtr = (char *)(pbPathTablePtr);
    PathEntry.m_pNameEnd = (char *)(pbPathTablePtr);
    PathEntry.NodeFlags = 0;
    PathEntry.NodeValue = 0;

    // Check for prefix separator (0x00)
    if(pbPathTablePtr < pbPathTableEnd && pbPathTablePtr[0] == 0)
    {
        PathEntry.NodeFlags |= TVFS_PTE_PATH_SEPARATOR_PRE;
        pbPathTablePtr++;
    }

    // Capture name length and name fragment
    if(pbPathTablePtr < pbPathTableEnd && pbPathTablePtr[0] != 0xFF)
    {
        size_t nLength = *pbPathTablePtr++;
        PathEntry.m_pNamePtr = (char *)(pbPathTablePtr);
        PathEntry.m_pNameEnd = (char *)(pbPathTablePtr + nLength);
        pbPathTablePtr += nLength;
    }

    // Check for postfix separator (0x00)
    if(pbPathTablePtr < pbPathTableEnd && pbPathTablePtr[0] == 0)
    {
        PathEntry.NodeFlags |= TVFS_PTE_PATH_SEPARATOR_POST;
        pbPathTablePtr++;
    }

    // Check for node value (0xFF marker)
    if(pbPathTablePtr < pbPathTableEnd)
    {
        if(pbPathTablePtr[0] == 0xFF)
        {
            // Read 4-byte NodeValue (big-endian)
            PathEntry.NodeValue = ConvertBytesToInteger_4(pbPathTablePtr + 1);
            PathEntry.NodeFlags |= TVFS_PTE_NODE_VALUE;
            pbPathTablePtr = pbPathTablePtr + 1 + sizeof(DWORD);
        }
        else
        {
            // Non-0xFF after name means postfix separator
            PathEntry.NodeFlags |= TVFS_PTE_PATH_SEPARATOR_POST;
        }
    }

    return pbPathTablePtr;
}
```

### 4.6 Recursive Directory Parsing

```cpp
DWORD ParsePathFileTable(TCascStorage * hs, TVFS_DIRECTORY_HEADER & DirHeader,
                         CASC_PATH<char> & PathBuffer, LPBYTE pbPathTablePtr, LPBYTE pbPathTableEnd)
{
    while(pbPathTablePtr < pbPathTableEnd)
    {
        // Capture path entry
        pbPathTablePtr = CapturePathEntry(PathEntry, pbPathTablePtr, pbPathTableEnd);

        // Append node name to path buffer
        PathBuffer_AppendNode(PathBuffer, PathEntry);

        // Check if it's a folder or file
        if(PathEntry.NodeFlags & TVFS_PTE_NODE_VALUE)
        {
            if(PathEntry.NodeValue & TVFS_FOLDER_NODE)
            {
                // FOLDER: Recursively parse subdirectory
                LPBYTE pbDirectoryEnd = pbPathTablePtr + (PathEntry.NodeValue & TVFS_FOLDER_SIZE_MASK) - sizeof(DWORD);
                dwErrCode = ParsePathFileTable(hs, DirHeader, PathBuffer, pbPathTablePtr, pbDirectoryEnd);
                pbPathTablePtr = pbDirectoryEnd;
            }
            else
            {
                // FILE: Parse VFS entry at offset NodeValue
                pbVfsSpanEntry = CaptureVfsSpanCount(DirHeader, PathEntry.NodeValue, dwSpanCount);

                if(dwSpanCount == 1)
                {
                    // Single-span file: could be regular file or TVFS subdirectory
                    CaptureVfsSpanEntries(DirHeader, pbVfsSpanEntry, &SpanEntry, 1);
                    pCKeyEntry = FindCKeyEntry_EKey(hs, SpanEntry.EKey);

                    // Check if it's a nested TVFS directory
                    if(IsVfsSubDirectory(hs, DirHeader, SubHeader, SpanEntry.EKey, SpanEntry.ContentSize) == ERROR_SUCCESS)
                    {
                        // Recursively parse nested TVFS
                        ParseDirectoryData(hs, SubHeader, PathBuffer);
                    }
                    else
                    {
                        // Regular file: check for WoW generic name
                        if(CheckWoWGenericName(PathBuffer, WowEntry) == ERROR_SUCCESS)
                        {
                            // Insert with FileDataID metadata
                            FileTree.InsertByName(pCKeyEntry, PathBuffer, WowEntry.FileDataId,
                                                 WowEntry.LocaleFlags, WowEntry.ContentFlags);
                        }
                        else
                        {
                            // Insert without metadata
                            FileTree.InsertByName(pCKeyEntry, PathBuffer);
                        }
                    }
                }
                else
                {
                    // Multi-span file (e.g., >4GB files split across multiple archives)
                    // Allocate span array and capture all spans
                    pSpanEntries = (PCASC_CKEY_ENTRY)SpanArray.Insert(dwSpanCount);
                    CaptureVfsSpanEntries(DirHeader, pbVfsSpanEntry, pSpanEntries, dwSpanCount);

                    // Insert file node with span array pointer
                    pFileNode = FileTree.InsertByName(pSpanEntries, PathBuffer);
                }
            }
        }
    }

    return ERROR_SUCCESS;
}
```

---

## 5. Complete Parsing Workflow

### 5.1 High-Level Process

```
1. Load TVFS root file from CASC storage
   ↓
2. Parse TVFS_DIRECTORY_HEADER
   - Validate signature, version, key sizes
   - Extract table offsets (Path, VFS, CFT)
   - Calculate dynamic offset field sizes
   ↓
3. Parse Path Table (recursive tree traversal)
   - Read path entries (name fragments + flags)
   - Build full file paths by concatenating fragments
   - For each path entry:
     * If FOLDER: Recursively parse subdirectory
     * If FILE: Read NodeValue as VFS table offset
   ↓
4. Parse VFS Table Entry
   - Read SpanCount (1-224 = valid file)
   - For each span:
     * Read file offset + size
     * Read CFT offset (variable-length)
     * Look up CFT entry to get EKey
   ↓
5. Parse Container File Table Entry
   - Extract 9-byte EKey
   - Extract EncodedSize + ContentSize
   ↓
6. Map to CKey and Insert to FileTree
   - Use EKey to find CKey entry in ENCODING table
   - Check if path matches WoW generic name format
   - If yes: Extract FileDataID + metadata
   - Insert into FileTree with or without FileDataID
```

### 5.2 FileDataID→EKey Mapping Flow

```
TVFS Path Entry Name:
"000000020000:000C472F02BA924C604A670B253AA02DBCD9441C"
         ↓
CheckWoWGenericName() parses:
  LocaleFlags  = 0x00000002
  ContentFlags = 0x0000
  FileDataId   = 0x000C472F  ← THE KEY MAPPING!
  ContentKey   = 02BA924C604A670B253AA02DBCD9441C
         ↓
NodeValue in Path Entry = VFS Table Offset
         ↓
VFS Table Entry contains:
  SpanCount + [FileOffset, SpanSize, CftOffset]
         ↓
CFT Entry at CftOffset contains:
  EKey (9 bytes) + EncodedSize + ContentSize
         ↓
EKey maps to CKey via ENCODING table
         ↓
CKey maps to archive data file
         ↓
FileTree.InsertByName(CKeyEntry, Path, FileDataId, LocaleFlags, ContentFlags)
```

---

## 6. Known Issues and Considerations

### 6.1 WoW 11.x / 11.2.5 Compatibility

**Current Status:**
- TVFS parsing is fully implemented in CascLib
- **However:** `TVFS_PARSE_WOW_ROOT` is **disabled by default** (commented out)
- Reason: "Significantly slower than using the legacy ROOT file"
- When disabled, WoW TVFS names trigger `ERROR_REPARSE_ROOT`, falling back to classic ROOT file format

**Impact:**
- FileDataID extraction from TVFS works, but is not used by default
- Legacy ROOT file is preferred for WoW
- For WoW 11.2.5, verify if legacy ROOT file is still present or if TVFS is mandatory

### 6.2 FileDataID Opening Issues (Issue #45)

**Problem:** Opening files by FileDataID didn't work correctly initially.

**Cause:** Mismatch between CascLib's FileDataID calculation and WoW client's method.

**Resolution:** Fixed in Pull Request #46 ("Fixed opening files by FileDataId (WoW only)")

**Current State:** FileDataID opening works correctly when using legacy ROOT file format.

### 6.3 Unknown FileDataID Issues (Issue #136)

**Problem:** Files without listfile entries had `FileDataId = CASC_INVALID_ID`, even though FileDataID was stored in FileTree.

**Cause:** Deduplication logic removed entries during iteration.

**Resolution:** Commit `b7ab31b` reverted deduplication to preserve all file entries.

**WoW 8.2+ Impact:** Many files lack filename hashes entirely, requiring proper FileDataID handling.

### 6.4 Variable-Length Offset Fields

**Critical Detail:** Offset field sizes in VFS table entries are **NOT** fixed!

```cpp
// Example calculations:
CftTableSize = 0x1234     → CftOffsSize = 2 bytes
CftTableSize = 0x123456   → CftOffsSize = 3 bytes
CftTableSize = 0x12345678 → CftOffsSize = 4 bytes
```

**Implication:** Must calculate `GetOffsetFieldSize()` before parsing VFS entries.

### 6.5 Multi-Span Files

Large files (>4GB) are split across multiple spans:

**Example:** Call of Duty: Black Ops 4, file "zone/base.xpak"
- 0x16 (22) spans
- Total size: >15 GB

**Handling:**
- First span: `SpanCount` set, `RefCount++`
- Subsequent spans: `CASC_CE_FILE_SPAN` flag set
- File node contains pointer to span array

### 6.6 Nested TVFS Directories

TVFS supports virtual subdirectories that are themselves TVFS manifests:

```cpp
bool IsVfsSubDirectory(TCascStorage * hs, TVFS_DIRECTORY_HEADER & DirHeader,
                       TVFS_DIRECTORY_HEADER & SubHeader, LPBYTE EKey, DWORD dwFileSize)
{
    // Check if EKey is in VfsRootList
    if(IsVfsFileEKey(hs, EKey, DirHeader.EKeySize))
    {
        // Load entire file into memory
        LoadInternalFileToMemory(hs, pCKeyEntry, VfsData);

        // Try to parse as TVFS header
        if(CaptureDirectoryHeader(SubHeader, VfsData) == ERROR_SUCCESS)
            return true;
    }
    return false;
}
```

**Example:** WoW uses nested TVFS for DLC/patch content.

---

## 7. Code Patterns for Implementation

### 7.1 Opening Storage and Querying FileDataID

```cpp
// Open CASC storage
HANDLE hStorage;
if(!CascOpenStorage("C:\\World of Warcraft\\_retail_", 0, &hStorage))
    return false;

// Open file by FileDataID
HANDLE hFile;
DWORD dwFileDataId = 123456;
if(!CascOpenFile(hStorage, CASC_FILE_DATA_ID(dwFileDataId), 0, CASC_OPEN_BY_FILEID, &hFile))
    return false;

// Read file content
DWORD dwBytesRead;
BYTE buffer[4096];
CascReadFile(hFile, buffer, sizeof(buffer), &dwBytesRead);
CascCloseFile(hFile);

CascCloseStorage(hStorage);
```

### 7.2 Enumerating Files with FileDataID

```cpp
CASC_FIND_DATA FindData;
HANDLE hFind = CascFindFirstFile(hStorage, "*", &FindData, NULL);
if(hFind != INVALID_HANDLE_VALUE)
{
    do
    {
        // Get file information including FileDataID
        DWORD dwFileDataId = 0;
        CascGetFileInfo(hFind, CASC_FILE_DATA_ID_INFO, &dwFileDataId, sizeof(dwFileDataId), NULL);

        printf("File: %s, FileDataID: %u\n", FindData.szFileName, dwFileDataId);

    } while(CascFindNextFile(hFind, &FindData));

    CascFindClose(hFind);
}
```

### 7.3 Custom TVFS Parsing (for extraction tools)

```cpp
// Load TVFS root file
CASC_BLOB rootBlob;
LoadRootFile(hStorage, rootBlob);

// Parse header
TVFS_DIRECTORY_HEADER header;
CaptureDirectoryHeader(header, rootBlob);

// Iterate path table
LPBYTE pbPathPtr = header.DataAt(header.PathTableOffset);
LPBYTE pbPathEnd = pbPathPtr + header.PathTableSize;

while(pbPathPtr < pbPathEnd)
{
    TVFS_PATH_TABLE_ENTRY entry;
    pbPathPtr = CapturePathEntry(entry, pbPathPtr, pbPathEnd);

    if(entry.NodeFlags & TVFS_PTE_NODE_VALUE)
    {
        if(!(entry.NodeValue & TVFS_FOLDER_NODE))
        {
            // It's a file - parse VFS entry
            DWORD spanCount;
            LPBYTE pbVfsEntry = CaptureVfsSpanCount(header, entry.NodeValue, spanCount);

            if(spanCount == 1)
            {
                CASC_CKEY_ENTRY spanEntry;
                CaptureVfsSpanEntries(header, pbVfsEntry, &spanEntry, 1);

                // Extract EKey and size
                // spanEntry.EKey → 9-byte encoded key
                // spanEntry.ContentSize → uncompressed size
            }
        }
    }
}
```

---

## 8. Recommendations for TrinityCore Implementation

### 8.1 TVFS vs Legacy ROOT

**For WoW 11.2.5:**
1. Check if legacy ROOT file still exists in build config
2. If yes: Continue using `CascOpenStorage()` with default settings
3. If no: Enable TVFS parsing by defining `TVFS_PARSE_WOW_ROOT`

### 8.2 FileDataID Extraction

**Current CascLib behavior:**
- TVFS WoW parsing is **disabled** by default
- Legacy ROOT file provides FileDataID mapping
- `CascOpenFile()` with `CASC_OPEN_BY_FILEID` works correctly

**Recommendation:**
- Use CascLib's public API (`CASC_OPEN_BY_FILEID`)
- Don't reimplement TVFS parsing unless legacy ROOT is removed
- Monitor CascLib updates for WoW 11.x compatibility

### 8.3 Performance Considerations

**CascLib maintainer's note:**
> "TVFS parsing is significantly slower than using the legacy ROOT file"

**Implication:**
- Only use TVFS parsing if absolutely necessary
- Cache FileDataID→EKey mappings if parsing TVFS directly
- Prefer CascLib's built-in ROOT file handling

### 8.4 Multi-Span File Handling

If implementing custom extraction:
- Detect `SpanCount > 1`
- Allocate span array: `CASC_CKEY_ENTRY[SpanCount]`
- Read all span entries sequentially
- Concatenate span data in correct order when reading file

### 8.5 Error Handling

**Key validation points:**
1. Header signature must be `CASC_TVFS_ROOT_SIGNATURE`
2. FormatVersion must be `1`
3. EKeySize must be `9`, PatchKeySize must be `9`
4. SpanCount must be `1-224` (valid file range)
5. All table offsets must be within bounds
6. Variable-length offset fields calculated correctly

---

## 9. WoW 11.2.5 Specific Considerations

### 9.1 Current State (as of January 2025)

**Known facts:**
- CascLib supports TVFS format (implemented 2018)
- TVFS WoW parsing exists but is disabled by default
- No specific WoW 11.x issues reported in CascLib GitHub

**Unknown factors:**
- Whether WoW 11.2.5 still provides legacy ROOT file
- Whether Blizzard changed TVFS format in 11.x
- Whether FileDataID format changed (still 32-bit DWORD?)

### 9.2 Testing Approach

**Recommended tests:**
1. Open WoW 11.2.5 storage with CascLib
2. Query build configuration for `vfs-*` keys
3. Check if `root` file still exists (legacy ROOT)
4. Attempt `CascOpenFile()` with known FileDataID
5. Enumerate files and verify FileDataID values

### 9.3 Potential Issues

**Scenario A:** Legacy ROOT removed
- **Solution:** Enable `TVFS_PARSE_WOW_ROOT` in CascLib
- **Impact:** Slower initial parsing, but FileDataID extraction works

**Scenario B:** TVFS format changed
- **Solution:** Update CascLib to latest version from GitHub
- **Fallback:** Contact Ladislav Zezula or TrinityCore team

**Scenario C:** FileDataID structure changed
- **Solution:** Analyze new WoW generic name format
- **Update:** Modify `CheckWoWGenericName()` accordingly

---

## 10. Summary

### Key Takeaways

1. **TVFS is fully supported** by CascLib, but WoW-specific parsing is disabled by default
2. **FileDataID extraction works** via hex-encoded path names in TVFS entries
3. **Legacy ROOT file is preferred** for performance reasons
4. **Variable-length offset fields** are critical for correct VFS parsing
5. **Multi-span files** and **nested TVFS directories** add complexity
6. **CascLib public API** (`CASC_OPEN_BY_FILEID`) is the recommended approach

### Correct Parsing Approach

**For TrinityCore WoW 11.2.5:**

1. Use CascLib
 (TrinityCore already includes it in `dep/CascLib/`)
2. Open storage with `CascOpenStorage()`
3. Query files by FileDataID using `CascOpenFile(..., CASC_OPEN_BY_FILEID)`
4. If legacy ROOT missing, enable TVFS parsing in CascLib build

**Do NOT:**
- Reimplement TVFS parsing from scratch
- Bypass CascLib's FileDataID handling
- Assume fixed offset field sizes in VFS table

**Do:**
- Use CascLib's public API
- Keep CascLib dependency updated
- Test with actual WoW 11.2.5 client data
- Monitor CascLib GitHub for WoW 11.x updates

---

## References

- **CascLib GitHub:** https://github.com/ladislav-zezula/CascLib
- **TrinityCore CascLib:** https://github.com/TrinityCore/TrinityCore/tree/master/dep/CascLib
- **TVFS Documentation:** https://wowdev.wiki/TVFS
- **CASC Overview:** https://wowdev.wiki/CASC
- **CascLib API:** http://www.zezula.net/en/casc/casclib.html

---

**Document Version:** 1.0
**Date:** 2025-01-12
**Author:** Research compiled from CascLib source code analysis
