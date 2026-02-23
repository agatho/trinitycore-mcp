/**
 * TVFS (TACT Virtual File System) Structure Definitions
 *
 * Based on TrinityCore's CascLib implementation for WoW 11.x/12.x+ TVFS format.
 *
 * TVFS Structure Overview:
 * ┌─────────────────────────────────────────┐
 * │ TVFS Directory Header                    │
 * │ - Signature: "TVFS"                      │
 * │ - Format Version: 1 or 2                 │
 * │ - EKey Size: 9 or 16 bytes               │
 * │ - Table Offsets and Sizes                │
 * ├─────────────────────────────────────────┤
 * │ Path Table                               │
 * │ - Hierarchical path structure            │
 * │ - Name fragments                         │
 * │ - Node values (FileDataID for files)     │
 * ├─────────────────────────────────────────┤
 * │ VFS (Virtual File System) Table          │
 * │ - File offset spans                      │
 * │ - CFT offset references                  │
 * ├─────────────────────────────────────────┤
 * │ CFT (Container File Table)               │
 * │ - EKey (Encoded Key)                     │
 * │ - Encoded Size                           │
 * │ - Content Size                           │
 * └─────────────────────────────────────────┘
 *
 * @see CascLib TVFS implementation in TrinityCore
 */

/**
 * TVFS Directory Header
 *
 * Located at the beginning of each TVFS root file.
 * Contains format metadata and table offsets.
 */
export interface TVFSDirectoryHeader {
  /** Magic signature: "TVFS" (0x53465654) */
  signature: string;

  /** Format version (1 or 2 for WoW 11.x/12.x) */
  formatVersion: number;

  /** Size of EKey in bytes (9 or 16) */
  eKeySize: number;

  /** Header size in bytes (usually 28) */
  headerSize: number;

  /** Offset to Path Table from start of file */
  pathTableOffset: number;

  /** Size of Path Table in bytes */
  pathTableSize: number;

  /** Offset to VFS Table from start of file */
  vfsTableOffset: number;

  /** Size of VFS Table in bytes */
  vfsTableSize: number;

  /** Offset to Container File Table from start of file */
  cftTableOffset: number;

  /** Size of Container File Table in bytes */
  cftTableSize: number;
}

/**
 * Path Table Entry Flags
 *
 * Bitflags indicating the type and properties of a path entry.
 */
export enum TVFSPathEntryFlags {
  /** No flags */
  NONE = 0x00,

  /** Entry has a prefix separator (0x00 byte before name) */
  PATH_SEPARATOR_PRE = 0x01,

  /** Entry has a postfix separator (0x00 byte after name) */
  PATH_SEPARATOR_POST = 0x02,

  /** Entry has a node value (FileDataID for files, folder ID for directories) */
  NODE_VALUE = 0x04,

  /** Entry is a file node (leaf) */
  IS_FILE = 0x08,

  /** Entry is a folder node (can have children) */
  IS_FOLDER = 0x10,
}

/**
 * Path Table Entry
 *
 * Represents a single node in the hierarchical path structure.
 * Can be a folder (internal node) or file (leaf node).
 *
 * Format:
 * - [optional] 0x00 separator (prefix)
 * - name length (1 byte)
 * - name fragment (variable length)
 * - [optional] 0x00 separator (postfix)
 * - [optional] 0xFF marker + node value (4 bytes)
 */
export interface PathTableEntry {
  /** Name fragment (not full path) */
  nameFragment: string;

  /** Node value (FileDataID for files, folder ID for folders) */
  nodeValue: number;

  /** Entry flags (combination of TVFSPathEntryFlags) */
  nodeFlags: TVFSPathEntryFlags;

  /** Full reconstructed path (for debugging/logging) */
  fullPath?: string;

  /** Parent entry index (for tree reconstruction) */
  parentIndex?: number;

  /** Child entry indices (for folders) */
  childIndices?: number[];
}

/**
 * Computed Path Entry
 *
 * Result of path table parsing with resolved FileDataID.
 */
export interface ComputedPathEntry {
  /** Full file path or identifier */
  path: string;

  /** FileDataID (for file entries only) */
  fileDataId: number;

  /** Whether this is a file (true) or folder (false) */
  isFile: boolean;

  /** VFS Table index (for content lookup) */
  vfsIndex?: number;
}

/**
 * VFS Span
 *
 * Represents a contiguous range of data in the CFT.
 */
export interface VFSSpan {
  /** Starting offset in CFT */
  startOffset: number;

  /** Ending offset in CFT */
  endOffset: number;

  /** Size of span in bytes */
  size: number;
}

/**
 * VFS Table Entry
 *
 * Maps file content to one or more spans in the CFT.
 * Multi-span entries indicate files split across multiple containers.
 */
export interface VFSTableEntry {
  /** Number of spans (1 for single-container files, 2+ for split files) */
  spanCount: number;

  /** Array of data spans */
  spans: VFSSpan[];

  /** Total content size (sum of all span sizes) */
  totalSize: number;
}

/**
 * Container File Table Entry
 *
 * Contains the EKey and size information for retrieving actual file data.
 */
export interface CFTEntry {
  /** Encoded Key (9 or 16 bytes) for data lookup in index files */
  eKey: Buffer;

  /** Size of encoded (compressed) data */
  encodedSize: number;

  /** Size of decoded (decompressed) content */
  contentSize: number;

  /** EKey as hex string (for debugging/logging) */
  eKeyHex?: string;
}

/**
 * WoW Generic Name Format
 *
 * Modern WoW (11.x+) uses this encoded name format:
 * LLLLLLLLCCCC:IIIIIIIIKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
 *
 * Structure:
 * - Positions 0-7:   LocaleFlags (8 hex chars)
 * - Positions 8-11:  ContentFlags (4 hex chars)
 * - Position 12:     Colon separator ':'
 * - Positions 13-20: FileDataID (8 hex chars) ⭐ KEY!
 * - Positions 21-52: ContentKey (32 hex chars)
 *
 * Total length: 53 characters
 */
export interface WoWGenericName {
  /** Full encoded name (53 characters) */
  fullName: string;

  /** Locale flags (positions 0-7) */
  localeFlags: string;

  /** Content flags (positions 8-11) */
  contentFlags: string;

  /** FileDataID extracted from positions 13-20 */
  fileDataId: number;

  /** Content key (positions 21-52) */
  contentKey: string;
}

/**
 * FileDataID to EKey Mapping
 *
 * Final result of TVFS parsing: maps FileDataID to storage location.
 */
export interface FileDataMapping {
  /** FileDataID (unique file identifier) */
  fileDataId: number;

  /** Full path (if available from path table) */
  path?: string;

  /** EKey for data retrieval */
  eKey: Buffer;

  /** Content size in bytes */
  contentSize: number;

  /** Encoded (compressed) size in bytes */
  encodedSize: number;

  /** EKey as hex string */
  eKeyHex: string;
}

/**
 * TVFS Parsing Result
 *
 * Complete result of parsing a TVFS root file.
 */
export interface TVFSParsingResult {
  /** Header information */
  header: TVFSDirectoryHeader;

  /** All file data mappings (FileDataID → EKey) */
  fileMappings: Map<number, FileDataMapping>;

  /** Path to FileDataID mapping (if paths available) */
  pathMappings: Map<string, number>;

  /** Total number of files parsed */
  totalFiles: number;

  /** Total number of folders parsed */
  totalFolders: number;

  /** Parsing errors (non-fatal) */
  errors: string[];

  /** Parsing warnings */
  warnings: string[];
}

/**
 * TVFS Parser Options
 */
export interface TVFSParserOptions {
  /** Enable verbose logging */
  verbose?: boolean;

  /** Skip path table parsing (faster, but no path information) */
  skipPathTable?: boolean;

  /** Maximum path depth to prevent infinite recursion */
  maxPathDepth?: number;

  /** Validate all offsets and sizes */
  validateStructure?: boolean;
}

/**
 * TVFS Parsing Error
 */
export class TVFSParsingError extends Error {
  constructor(
    message: string,
    public readonly offset?: number,
    public readonly context?: string
  ) {
    super(message);
    this.name = 'TVFSParsingError';
  }
}
