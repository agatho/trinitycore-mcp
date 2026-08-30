/**
 * TVFS (TACT Virtual File System) Parser
 *
 * Complete implementation following TrinityCore's CascLib approach.
 *
 * Parsing Pipeline:
 * 1. Parse TVFS directory header
 * 2. Parse path table → extract file/folder nodes
 * 3. Parse VFS table → map content to CFT offsets
 * 4. Parse CFT table → extract EKeys and sizes
 * 5. Build FileDataID → EKey mappings
 *
 * @see CascLib RootHandler_TVFS.cpp in TrinityCore
 */

import {
  TVFSDirectoryHeader,
  TVFSPathEntryFlags,
  PathTableEntry,
  ComputedPathEntry,
  VFSTableEntry,
  VFSSpan,
  CFTEntry,
  FileDataMapping,
  TVFSParsingResult,
  TVFSParserOptions,
  TVFSParsingError,
  WoWGenericName,
} from './TVFSStructures';

export class TVFSParser {
  private data: Buffer;
  private offset: number = 0;
  private header!: TVFSDirectoryHeader;
  private pathEntries: PathTableEntry[] = [];
  private computedPaths: ComputedPathEntry[] = [];
  private vfsEntries: VFSTableEntry[] = [];
  private cftEntries: CFTEntry[] = [];
  private fileMappings: Map<number, FileDataMapping> = new Map();
  private pathMappings: Map<string, number> = new Map();
  private errors: string[] = [];
  private warnings: string[] = [];
  private options: Required<TVFSParserOptions>;

  constructor(data: Buffer, options: TVFSParserOptions = {}) {
    this.data = data;
    this.options = {
      verbose: options.verbose ?? false,
      skipPathTable: options.skipPathTable ?? false,
      maxPathDepth: options.maxPathDepth ?? 256,
      validateStructure: options.validateStructure ?? true,
    };
  }

  /**
   * Main parsing entry point
   *
   * @returns Complete TVFS parsing result
   * @throws TVFSParsingError on fatal parsing errors
   */
  public parse(): TVFSParsingResult {
    try {
      this.log('Starting TVFS parsing...');

      // Step 1: Parse header
      this.header = this.parseHeader();
      this.log(`TVFS version ${this.header.formatVersion}, EKey size: ${this.header.eKeySize}`);

      // Step 2: Parse path table (if not skipped)
      if (!this.options.skipPathTable) {
        this.parsePathTable();
        this.log(`Path table: ${this.pathEntries.length} entries`);
      }

      // Step 3: Parse VFS table
      this.parseVFSTable();
      this.log(`VFS table: ${this.vfsEntries.length} entries`);

      // Step 4: Parse CFT table
      this.parseCFTTable();
      this.log(`CFT table: ${this.cftEntries.length} entries`);

      // Step 5: Build FileDataID → EKey mappings
      this.buildFileMappings();
      this.log(`Built ${this.fileMappings.size} file mappings`);

      // Count files vs folders
      const totalFiles = Array.from(this.fileMappings.values()).length;
      const totalFolders = this.pathEntries.filter(
        (e) => e.nodeFlags & TVFSPathEntryFlags.IS_FOLDER
      ).length;

      return {
        header: this.header,
        fileMappings: this.fileMappings,
        pathMappings: this.pathMappings,
        totalFiles,
        totalFolders,
        errors: this.errors,
        warnings: this.warnings,
      };
    } catch (error) {
      if (error instanceof TVFSParsingError) {
        throw error;
      }
      throw new TVFSParsingError(
        `TVFS parsing failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Parse TVFS Directory Header
   *
   * CORRECT Header format (from TrinityCore CascLib):
   * - 4 bytes: Signature "TVFS" (little-endian: 0x53465654)
   * - 1 byte:  Format version (1 or 2)
   * - 1 byte:  Header size
   * - 1 byte:  EKey size (9 or 16)
   * - 1 byte:  Patch key size
   * - 4 bytes: Flags (big-endian)
   * - 4 bytes: Path table offset (big-endian)
   * - 4 bytes: Path table size (big-endian)
   * - 4 bytes: VFS table offset (big-endian)
   * - 4 bytes: VFS table size (big-endian)
   * - 4 bytes: CFT table offset (big-endian)
   * - 4 bytes: CFT table size (big-endian)
   * - 2 bytes: Max depth (big-endian)
   * - 4 bytes: EST table offset (big-endian)
   * - 4 bytes: EST table size (big-endian)
   */
  private parseHeader(): TVFSDirectoryHeader {
    if (this.data.length < 8) {
      throw new TVFSParsingError('Buffer too small for TVFS header');
    }

    let offset = 0;

    // Read signature (little-endian)
    const signature = this.data.toString('ascii', offset, offset + 4);
    offset += 4;

    if (signature !== 'TVFS') {
      throw new TVFSParsingError(`Invalid TVFS signature: ${signature}`);
    }

    // Read version bytes (single bytes, not 32-bit integers!)
    const formatVersion = this.data.readUInt8(offset++);
    const headerSizeFromFile = this.data.readUInt8(offset++);
    const eKeySize = this.data.readUInt8(offset++);
    const patchKeySize = this.data.readUInt8(offset++);

    // Read flags (big-endian, 4 bytes)
    const flags = this.data.readInt32BE(offset);
    offset += 4;

    // Read table offsets and sizes (all big-endian!)
    const pathTableOffset = this.data.readInt32BE(offset);
    offset += 4;

    const pathTableSize = this.data.readInt32BE(offset);
    offset += 4;

    const vfsTableOffset = this.data.readInt32BE(offset);
    offset += 4;

    const vfsTableSize = this.data.readInt32BE(offset);
    offset += 4;

    const cftTableOffset = this.data.readInt32BE(offset);
    offset += 4;

    const cftTableSize = this.data.readInt32BE(offset);
    offset += 4;

    // Optional additional header fields (if header is larger)
    let maxDepth = 0;
    let estTableOffset = 0;
    let estTableSize = 0;

    if (offset + 2 <= this.data.length) {
      maxDepth = this.data.readUInt16BE(offset);
      offset += 2;
    }

    if (offset + 4 <= this.data.length) {
      estTableOffset = this.data.readInt32BE(offset);
      offset += 4;
    }

    if (offset + 4 <= this.data.length) {
      estTableSize = this.data.readInt32BE(offset);
      offset += 4;
    }

    const header: TVFSDirectoryHeader = {
      signature,
      formatVersion,
      eKeySize,
      headerSize: headerSizeFromFile,
      pathTableOffset,
      pathTableSize,
      vfsTableOffset,
      vfsTableSize,
      cftTableOffset,
      cftTableSize,
    };

    // Validate header
    if (this.options.validateStructure) {
      this.validateHeader(header);
    }

    return header;
  }

  /**
   * Validate header offsets and sizes
   */
  private validateHeader(header: TVFSDirectoryHeader): void {
    const checks = [
      { name: 'EKey size', value: header.eKeySize, valid: [9, 16] },
      { name: 'Format version', value: header.formatVersion, min: 1, max: 2 },
    ];

    for (const check of checks) {
      if ('valid' in check && check.valid) {
        if (!check.valid.includes(check.value)) {
          this.warnings.push(`Unusual ${check.name}: ${check.value}`);
        }
      }
      if ('min' in check && check.min !== undefined && check.value < check.min) {
        throw new TVFSParsingError(`Invalid ${check.name}: ${check.value} < ${check.min}`);
      }
      if ('max' in check && check.max !== undefined && check.value > check.max) {
        this.warnings.push(`Unusual ${check.name}: ${check.value} > ${check.max}`);
      }
    }

    // Validate table boundaries
    const endOffset = Math.max(
      header.pathTableOffset + header.pathTableSize,
      header.vfsTableOffset + header.vfsTableSize,
      header.cftTableOffset + header.cftTableSize
    );

    if (endOffset > this.data.length) {
      throw new TVFSParsingError(
        `Table extends beyond buffer: ${endOffset} > ${this.data.length}`
      );
    }
  }

  /**
   * Parse Path Table
   *
   * Path table contains hierarchical file/folder structure.
   * Each entry has:
   * - Optional prefix separator (0x00)
   * - Name length (1 byte)
   * - Name fragment
   * - Optional postfix separator (0x00)
   * - Optional node value (0xFF marker + 4 bytes)
   */
  private parsePathTable(): void {
    let offset = this.header.pathTableOffset;
    const endOffset = offset + this.header.pathTableSize;
    let entryIndex = 0;

    while (offset < endOffset) {
      try {
        const [entry, nextOffset] = this.capturePathEntry(offset, endOffset, entryIndex);
        this.pathEntries.push(entry);
        offset = nextOffset;
        entryIndex++;
      } catch (error) {
        this.errors.push(`Path entry ${entryIndex} parse error: ${error}`);
        break;
      }
    }
  }

  /**
   * Capture a single path table entry
   *
   * Following CascLib's CapturePathEntry logic
   *
   * @param offset Current offset in buffer
   * @param endOffset End of path table
   * @param entryIndex Entry index (for debugging)
   * @returns [entry, nextOffset]
   */
  private capturePathEntry(
    offset: number,
    endOffset: number,
    entryIndex: number
  ): [PathTableEntry, number] {
    if (offset >= endOffset) {
      throw new TVFSParsingError('Offset beyond path table end', offset);
    }

    const entry: PathTableEntry = {
      nameFragment: '',
      nodeValue: 0,
      nodeFlags: TVFSPathEntryFlags.NONE,
      childIndices: [],
    };

    // Check for prefix separator
    if (this.data[offset] === 0x00) {
      entry.nodeFlags |= TVFSPathEntryFlags.PATH_SEPARATOR_PRE;
      offset++;
    }

    // Check for node value marker (0xFF) BEFORE reading name
    // Some entries have only node values without names
    if (offset < endOffset && this.data[offset] === 0xFF) {
      offset++; // Skip marker
      if (offset + 4 > endOffset) {
        throw new TVFSParsingError('Incomplete node value', offset);
      }
      entry.nodeValue = this.data.readInt32BE(offset); // Big-endian, matching TVFS format
      entry.nodeFlags |= TVFSPathEntryFlags.NODE_VALUE;
      offset += 4;

      // Determine if file or folder using bit 31 check (TrinityCore logic)
      // If bit 31 set (0x80000000): FOLDER, lower 31 bits = folder data size
      // If bit 31 clear: FILE, value = VFS byte offset
      const isFolder = (entry.nodeValue & 0x80000000) !== 0;
      if (isFolder) {
        entry.nodeFlags |= TVFSPathEntryFlags.IS_FOLDER;
      } else {
        entry.nodeFlags |= TVFSPathEntryFlags.IS_FILE;
      }

      if (this.options.verbose) {
        this.log(
          `  Entry ${entryIndex}: nodeValue=0x${entry.nodeValue.toString(16)} (${entry.nodeValue}), ` +
          `isFolder=${isFolder}, name="${entry.nameFragment}"`
        );
      }

      // Entry has node value but no name
      return [entry, offset];
    }

    // Read name length
    if (offset >= endOffset) {
      throw new TVFSParsingError('Unexpected end while reading name length', offset);
    }
    const nameLength = this.data[offset++];

    // Handle empty name
    if (nameLength === 0) {
      // Entry with empty name, just return
      return [entry, offset];
    }

    // Read name fragment
    if (offset + nameLength > endOffset) {
      throw new TVFSParsingError(
        `Name extends beyond table: length ${nameLength} at offset ${offset}`,
        offset
      );
    }
    entry.nameFragment = this.data.toString('utf8', offset, offset + nameLength);
    offset += nameLength;

    // Check for postfix separator
    if (offset < endOffset && this.data[offset] === 0x00) {
      entry.nodeFlags |= TVFSPathEntryFlags.PATH_SEPARATOR_POST;
      offset++;
    }

    // Check for node value (0xFF marker) after name
    if (offset < endOffset && this.data[offset] === 0xFF) {
      offset++; // Skip marker
      if (offset + 4 > endOffset) {
        throw new TVFSParsingError('Incomplete node value', offset);
      }
      entry.nodeValue = this.data.readInt32BE(offset); // Big-endian, matching TVFS format
      entry.nodeFlags |= TVFSPathEntryFlags.NODE_VALUE;
      offset += 4;

      // Determine if file or folder using bit 31 check (TrinityCore logic)
      // If bit 31 set (0x80000000): FOLDER, lower 31 bits = folder data size
      // If bit 31 clear: FILE, value = VFS byte offset
      const isFolder = (entry.nodeValue & 0x80000000) !== 0;
      if (isFolder) {
        entry.nodeFlags |= TVFSPathEntryFlags.IS_FOLDER;
      } else {
        entry.nodeFlags |= TVFSPathEntryFlags.IS_FILE;
      }

      if (this.options.verbose) {
        this.log(
          `  Entry ${entryIndex}: nodeValue=0x${entry.nodeValue.toString(16)} (${entry.nodeValue}), ` +
          `isFolder=${isFolder}, name="${entry.nameFragment}"`
        );
      }
    }

    return [entry, offset];
  }


  /**
   * Parse VFS (Virtual File System) Table
   *
   * VFS table maps files to CFT entries.
   * Each entry contains:
   * - Span count (variable-length integer)
   * - Array of spans (start/end offsets)
   */
  private parseVFSTable(): void {
    let offset = this.header.vfsTableOffset;
    const endOffset = offset + this.header.vfsTableSize;
    let entryIndex = 0;

    while (offset < endOffset) {
      try {
        const [entry, nextOffset] = this.captureVFSEntry(offset, endOffset);
        this.vfsEntries.push(entry);
        offset = nextOffset;
        entryIndex++;
      } catch (error) {
        this.errors.push(`VFS entry ${entryIndex} parse error: ${error}`);
        break;
      }
    }
  }

  /**
   * Capture a single VFS table entry
   *
   * @param offset Current offset in buffer
   * @param endOffset End of VFS table
   * @returns [entry, nextOffset]
   */
  private captureVFSEntry(offset: number, endOffset: number): [VFSTableEntry, number] {
    // Read span count (variable-length integer)
    const [spanCount, nextOffset] = this.readVariableLengthInteger(offset, endOffset);
    offset = nextOffset;

    const spans: VFSSpan[] = [];
    let totalSize = 0;

    // Read each span
    for (let i = 0; i < spanCount; i++) {
      if (offset + 8 > endOffset) {
        throw new TVFSParsingError(`VFS span ${i} extends beyond table`, offset);
      }

      const startOffset = this.data.readUInt32LE(offset);
      const endSpanOffset = this.data.readUInt32LE(offset + 4);
      offset += 8;

      const size = endSpanOffset - startOffset;
      totalSize += size;

      spans.push({
        startOffset,
        endOffset: endSpanOffset,
        size,
      });
    }

    return [
      {
        spanCount,
        spans,
        totalSize,
      },
      offset,
    ];
  }

  /**
   * Parse CFT (Container File Table)
   *
   * CFT contains EKeys and file sizes.
   * Each entry:
   * - EKey (9 or 16 bytes)
   * - Encoded size (4 bytes)
   * - Content size (4 bytes) [optional]
   */
  private parseCFTTable(): void {
    let offset = this.header.cftTableOffset;
    const endOffset = offset + this.header.cftTableSize;
    const eKeySize = this.header.eKeySize;
    const entrySize = eKeySize + 8; // EKey + encoded size + content size
    let entryIndex = 0;

    while (offset + entrySize <= endOffset) {
      try {
        const eKey = Buffer.from(this.data.slice(offset, offset + eKeySize));
        const encodedSize = this.data.readUInt32LE(offset + eKeySize);
        const contentSize = this.data.readUInt32LE(offset + eKeySize + 4);

        this.cftEntries.push({
          eKey,
          encodedSize,
          contentSize,
          eKeyHex: eKey.toString('hex'),
        });

        offset += entrySize;
        entryIndex++;
      } catch (error) {
        this.errors.push(`CFT entry ${entryIndex} parse error: ${error}`);
        break;
      }
    }
  }

  /**
   * Calculate CFT offset field size based on table size
   *
   * Following TrinityCore's GetOffsetFieldSize logic
   */
  private getCftOffsetFieldSize(): number {
    const cftSize = this.header.cftTableSize;
    if (cftSize > 0xFFFFFF) return 4;
    if (cftSize > 0xFFFF) return 3;
    if (cftSize > 0xFF) return 2;
    return 1;
  }

  /**
   * Build FileDataID → EKey mappings
   *
   * CORRECTED: Following TrinityCore's exact implementation.
   *
   * Key points:
   * - NodeValue for files is a BYTE OFFSET into VFS table (not an index!)
   * - VFS entry contains CFT offsets (variable-sized: 1-4 bytes)
   * - CFT offset points to CFT entry which contains the EKey
   */
  private buildFileMappings(): void {
    const cftOffsetSize = this.getCftOffsetFieldSize();
    this.log(`CFT offset field size: ${cftOffsetSize} bytes`);

    // Iterate through path entries to find files
    for (let i = 0; i < this.pathEntries.length; i++) {
      const pathEntry = this.pathEntries[i];

      // Check if this is a file entry (not a folder)
      if (
        (pathEntry.nodeFlags & TVFSPathEntryFlags.IS_FILE) &&
        (pathEntry.nodeFlags & TVFSPathEntryFlags.NODE_VALUE)
      ) {
        const vfsOffset = pathEntry.nodeValue; // VFS BYTE OFFSET!

        try {
          // Read VFS entry at byte offset
          const vfsBuffer = this.data.slice(
            this.header.vfsTableOffset,
            this.header.vfsTableOffset + this.header.vfsTableSize
          );

          if (vfsOffset >= vfsBuffer.length) {
            this.errors.push(`VFS offset ${vfsOffset} exceeds VFS table size ${vfsBuffer.length}`);
            continue;
          }

          // Read span count (1 byte)
          let vfsPos = vfsOffset;
          const spanCount = vfsBuffer[vfsPos++];

          if (spanCount < 1 || spanCount > 224) {
            // Invalid span count
            continue;
          }

          // For now, handle only single-span files (most common)
          if (spanCount !== 1) {
            this.log(`Skipping multi-span file (${spanCount} spans) at VFS offset ${vfsOffset}`);
            continue;
          }

          // Read span entry:
          // - 4 bytes: FileOffset (big-endian)
          // - 4 bytes: SpanLength (big-endian)
          // - N bytes: CftOffset (variable size, big-endian)
          if (vfsPos + 8 + cftOffsetSize > vfsBuffer.length) {
            this.errors.push(`VFS span at offset ${vfsOffset} extends beyond table`);
            continue;
          }

          const fileOffset = vfsBuffer.readInt32BE(vfsPos);
          vfsPos += 4;
          const spanLength = vfsBuffer.readInt32BE(vfsPos);
          vfsPos += 4;

          // Read CFT offset (variable-sized)
          const cftOffset = this.readVariableInt(vfsBuffer, vfsPos, cftOffsetSize);

          // Read CFT entry at offset
          const cftBuffer = this.data.slice(
            this.header.cftTableOffset,
            this.header.cftTableOffset + this.header.cftTableSize
          );

          if (cftOffset + this.header.eKeySize + 8 > cftBuffer.length) {
            this.errors.push(`CFT offset ${cftOffset} exceeds CFT table size`);
            continue;
          }

          // Read CFT entry:
          // - EKeySize bytes: EKey
          // - 4 bytes: EncodedSize (big-endian)
          // - 4 bytes: ContentSize (big-endian)
          const eKey = Buffer.from(cftBuffer.slice(cftOffset, cftOffset + this.header.eKeySize));
          const encodedSize = cftBuffer.readInt32BE(cftOffset + this.header.eKeySize);
          const contentSize = cftBuffer.readInt32BE(cftOffset + this.header.eKeySize + 4);

          // Try to extract FileDataID from path (WoW Generic Name)
          const fileDataId = this.extractFileDataIdFromPath(pathEntry.nameFragment);

          if (fileDataId > 0) {
            // Create file mapping
            const mapping: FileDataMapping = {
              fileDataId,
              path: pathEntry.fullPath || `$fid:${fileDataId}`,
              eKey,
              contentSize,
              encodedSize,
              eKeyHex: eKey.toString('hex'),
            };

            this.fileMappings.set(fileDataId, mapping);

            if (pathEntry.fullPath) {
              this.pathMappings.set(pathEntry.fullPath, fileDataId);
            }
          }
        } catch (error) {
          this.errors.push(`Error processing file at VFS offset ${vfsOffset}: ${error}`);
        }
      }
    }

    this.log(`Built ${this.fileMappings.size} file mappings from path table`);
  }

  /**
   * Extract FileDataID from WoW Generic Name
   *
   * Format: LLLLLLLLCCCC:IIIIIIIIKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
   * FileDataID is at positions 13-20 (8 hex chars)
   */
  private extractFileDataIdFromPath(name: string): number {
    // Check for 53-char WoW Generic Name
    if (name.length === 53 && name[12] === ':') {
      try {
        // Extract FileDataID hex (positions 13-20, 8 chars)
        const fileDataIdHex = name.substring(13, 21);
        const fileDataId = parseInt(fileDataIdHex, 16);

        if (!isNaN(fileDataId) && fileDataId > 0) {
          return fileDataId;
        }
      } catch (e) {
        // Invalid hex
      }
    }

    return 0;
  }

  /**
   * Extract FileDataIDs from WoW Generic Names
   *
   * Format: LLLLLLLLCCCC:IIIIIIIIKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK
   * FileDataID is at positions 13-20 (8 hex characters)
   */
  private extractGenericNames(): void {
    for (let i = 0; i < this.pathEntries.length; i++) {
      const pathEntry = this.pathEntries[i];
      const name = pathEntry.nameFragment;

      // Check if this matches WoW Generic Name format (52-53 chars, has colon at pos 12)
      if ((name.length === 52 || name.length === 53) && name[12] === ':') {
        try {
          const genericName = this.parseGenericName(name);

          // Check if we have a VFS/CFT entry for this
          if (i < this.vfsEntries.length) {
            const vfsEntry = this.vfsEntries[i];
            if (vfsEntry.spans.length > 0) {
              const span = vfsEntry.spans[0];
              const cftIndex = span.startOffset;

              if (cftIndex < this.cftEntries.length) {
                const cftEntry = this.cftEntries[cftIndex];

                // Only add if not already present
                if (!this.fileMappings.has(genericName.fileDataId)) {
                  const mapping: FileDataMapping = {
                    fileDataId: genericName.fileDataId,
                    path: genericName.fullName,
                    eKey: cftEntry.eKey,
                    contentSize: cftEntry.contentSize,
                    encodedSize: cftEntry.encodedSize,
                    eKeyHex: cftEntry.eKeyHex!,
                  };

                  this.fileMappings.set(genericName.fileDataId, mapping);
                  this.pathMappings.set(genericName.fullName, genericName.fileDataId);
                }
              }
            }
          }
        } catch (error) {
          this.warnings.push(`Failed to parse generic name: ${name}`);
        }
      }
    }
  }

  /**
   * Parse WoW Generic Name to extract FileDataID
   *
   * @param name Full generic name (52-53 chars)
   * @returns Parsed generic name structure
   */
  private parseGenericName(name: string): WoWGenericName {
    if (name.length < 53 || name[12] !== ':') {
      throw new Error('Invalid generic name format');
    }

    const localeFlags = name.substring(0, 8);
    const contentFlags = name.substring(8, 12);
    const fileDataIdHex = name.substring(13, 21);
    const contentKey = name.substring(21);

    const fileDataId = parseInt(fileDataIdHex, 16);

    if (isNaN(fileDataId)) {
      throw new Error(`Invalid FileDataID hex: ${fileDataIdHex}`);
    }

    return {
      fullName: name,
      localeFlags,
      contentFlags,
      fileDataId,
      contentKey,
    };
  }

  /**
   * Read variable-length integer
   *
   * Used for span counts in VFS table.
   *
   * @param offset Current offset
   * @param endOffset End boundary
   * @returns [value, nextOffset]
   */
  private readVariableLengthInteger(offset: number, endOffset: number): [number, number] {
    let value = 0;
    let shift = 0;
    let byte = 0;

    do {
      if (offset >= endOffset) {
        throw new TVFSParsingError('Incomplete variable-length integer', offset);
      }

      byte = this.data[offset++];
      value |= (byte & 0x7f) << shift;
      shift += 7;
    } while (byte & 0x80);

    return [value, offset];
  }

  /**
   * Read variable-sized integer (big-endian)
   *
   * Used for CFT offsets which can be 1-4 bytes.
   *
   * @param buffer Buffer to read from
   * @param offset Offset in buffer
   * @param numBytes Number of bytes (1-4)
   * @returns Integer value
   */
  private readVariableInt(buffer: Buffer, offset: number, numBytes: number): number {
    let value = 0;
    for (let i = 0; i < numBytes; i++) {
      value = (value << 8) | buffer[offset + i];
    }
    return value;
  }

  /**
   * Get file mapping by FileDataID
   *
   * @param fileDataId FileDataID to lookup
   * @returns FileDataMapping or null if not found
   */
  public getFileMapping(fileDataId: number): FileDataMapping | null {
    return this.fileMappings.get(fileDataId) || null;
  }

  /**
   * Get FileDataID by path
   *
   * @param path File path
   * @returns FileDataID or null if not found
   */
  public getFileDataIdByPath(path: string): number | null {
    return this.pathMappings.get(path) || null;
  }

  /**
   * Log message (if verbose mode enabled)
   */
  private log(message: string): void {
    if (this.options.verbose) {
      process.stderr.write(`[TVFSParser] ${message}
`);
    }
  }
}
