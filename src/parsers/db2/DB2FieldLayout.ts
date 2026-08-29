/**
 * Field layout descriptors for sparse (offset-map) DB2 files.
 *
 * Dense DB2 files carry enough metadata to locate a field on their own: every
 * record is the same size and `field_storage_info` gives each field a fixed bit
 * offset. Sparse files do not. Their records are variable length, strings are
 * stored inline as null-terminated bytes, and every string shifts the offsets of
 * all the fields that follow it. A field's position therefore depends on the
 * contents of the record it lives in and has to be walked per record.
 *
 * Walking requires knowing each field's type, which the file itself does not
 * record. TrinityCore solves this with the hand-written metadata in
 * DB2LoadInfo.h (DB2FileLoaderSparseImpl::CalculateAndStoreFieldOffsets); this
 * module is the same idea: a schema declares its field types once, and the
 * loader walks each record against that declaration.
 *
 * @see DB2SparseFieldLayout.computeOffsets for the walk itself
 */

/**
 * Storage type of a DB2 field.
 *
 * Signedness is part of the type because it decides how a value is read, even
 * though it does not affect how many bytes the field occupies.
 */
export enum DB2FieldType {
  Int8 = 'int8',
  UInt8 = 'uint8',
  Int16 = 'int16',
  UInt16 = 'uint16',
  Int32 = 'int32',
  UInt32 = 'uint32',
  Int64 = 'int64',
  UInt64 = 'uint64',
  Float = 'float',
  /** Null-terminated bytes stored inline in the record. Variable length. */
  String = 'string',
}

/** Byte width of each fixed-size field type. Strings are excluded: they vary. */
const FIXED_FIELD_SIZES: Readonly<Record<Exclude<DB2FieldType, DB2FieldType.String>, number>> = {
  [DB2FieldType.Int8]: 1,
  [DB2FieldType.UInt8]: 1,
  [DB2FieldType.Int16]: 2,
  [DB2FieldType.UInt16]: 2,
  [DB2FieldType.Int32]: 4,
  [DB2FieldType.UInt32]: 4,
  [DB2FieldType.Int64]: 8,
  [DB2FieldType.UInt64]: 8,
  [DB2FieldType.Float]: 4,
};

/**
 * Byte width of a fixed-size field type.
 *
 * @param type Field type to measure
 * @returns Width in bytes
 * @throws {Error} If asked for the width of a string, which has none
 */
export function getFixedFieldSize(type: DB2FieldType): number {
  if (type === DB2FieldType.String) {
    throw new Error('Strings in sparse records are variable length and have no fixed size');
  }
  return FIXED_FIELD_SIZES[type];
}

/**
 * One field in a sparse record.
 *
 * Array fields are a single field holding `arraySize` consecutive elements,
 * matching how DB2 addresses them as (field, arrayIndex). They are not runs of
 * separate fields.
 */
export interface DB2FieldSpec {
  /** Column name, as it appears in the client definition. Used in errors. */
  name: string;
  /** Storage type of each element. */
  type: DB2FieldType;
  /** Element count. 1 for scalars. */
  arraySize: number;
}

/**
 * Records in a sparse file are padded so the next record starts on a 4-byte
 * boundary, so a record's walked length is at most 3 bytes short of the size
 * the catalog declares for it.
 */
export const SPARSE_RECORD_ALIGNMENT = 4;

/**
 * The field layout of one sparse DB2 table, able to locate any field within a
 * record of that table.
 *
 * Immutable and reusable: build one per table and walk as many records as
 * needed through it.
 */
export class DB2SparseFieldLayout {
  private readonly fields: readonly DB2FieldSpec[];

  /** Combined element count across all fields, i.e. the size of a walk result. */
  private readonly totalElements: number;

  /**
   * @param fields Field specs in record order, excluding any noninline column
   *   (a noninline ID is carried by the catalog, not by the record)
   * @throws {Error} If the spec list is empty or any entry is malformed
   */
  constructor(fields: readonly DB2FieldSpec[]) {
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('DB2SparseFieldLayout requires at least one field spec');
    }

    let elements = 0;
    fields.forEach((field, index) => {
      if (!field || typeof field.name !== 'string' || field.name.length === 0) {
        throw new Error(`Field spec at index ${index} is missing a name`);
      }
      if (!Object.values(DB2FieldType).includes(field.type)) {
        throw new Error(`Field '${field.name}' has unknown type '${field.type}'`);
      }
      if (!Number.isInteger(field.arraySize) || field.arraySize < 1) {
        throw new Error(
          `Field '${field.name}' has invalid arraySize ${field.arraySize}; expected an integer >= 1`
        );
      }
      elements += field.arraySize;
    });

    this.fields = fields;
    this.totalElements = elements;
  }

  /** Number of fields in the layout. Array fields count once. */
  public getFieldCount(): number {
    return this.fields.length;
  }

  /** Field spec at an index, or null when the index is out of range. */
  public getField(index: number): DB2FieldSpec | null {
    if (index < 0 || index >= this.fields.length) {
      return null;
    }
    return this.fields[index];
  }

  /**
   * Locate every field element within a single sparse record.
   *
   * Walks the record from its first byte, advancing by each element's width and,
   * for strings, to just past the null terminator. This mirrors TrinityCore's
   * DB2FileLoaderSparseImpl::CalculateAndStoreFieldOffsets().
   *
   * @param buffer Buffer containing the record
   * @param recordStart Byte offset of the record within `buffer`
   * @param recordSize Record length in bytes, as declared by the catalog
   * @returns Offsets relative to `recordStart`, indexed [field][arrayIndex]
   * @throws {Error} If the record is truncated, a string is unterminated, or the
   *   walk does not land within the record's declared (padded) length - each of
   *   which means the layout does not describe this file
   *
   * @example
   * ```typescript
   * const offsets = layout.computeOffsets(buf, entry.offset, entry.size);
   * const itemLevel = buf.readUInt16LE(entry.offset + offsets[50][0]);
   * ```
   */
  public computeOffsets(buffer: Buffer, recordStart: number, recordSize: number): number[][] {
    if (recordStart < 0 || recordSize <= 0) {
      throw new Error(`Invalid sparse record window: start=${recordStart} size=${recordSize}`);
    }
    const recordEnd = recordStart + recordSize;
    if (recordEnd > buffer.length) {
      throw new Error(
        `Sparse record at ${recordStart} (+${recordSize}) runs past the ${buffer.length}-byte buffer`
      );
    }

    const offsets: number[][] = new Array(this.fields.length);
    let offset = 0;

    for (let f = 0; f < this.fields.length; f++) {
      const field = this.fields[f];
      const elementOffsets: number[] = new Array(field.arraySize);

      for (let a = 0; a < field.arraySize; a++) {
        elementOffsets[a] = offset;

        if (field.type === DB2FieldType.String) {
          const searchFrom = recordStart + offset;
          const terminator = buffer.indexOf(0, searchFrom);
          if (terminator === -1 || terminator >= recordEnd) {
            throw new Error(
              `Unterminated string in field '${field.name}'[${a}] of the sparse record at ` +
                `${recordStart}: no null terminator before the record ends`
            );
          }
          offset = terminator - recordStart + 1;
        } else {
          offset += getFixedFieldSize(field.type);
        }

        if (offset > recordSize) {
          throw new Error(
            `Field '${field.name}'[${a}] overruns the sparse record at ${recordStart}: ` +
              `walked ${offset} bytes of ${recordSize}. The layout does not match this file.`
          );
        }
      }

      offsets[f] = elementOffsets;
    }

    // The walk must account for the whole record, give or take the padding that
    // aligns the next record. Landing anywhere else means the layout is wrong in
    // a way that happened not to overrun - a silent mis-read, so reject it.
    const padded = Math.ceil(offset / SPARSE_RECORD_ALIGNMENT) * SPARSE_RECORD_ALIGNMENT;
    if (padded !== recordSize) {
      throw new Error(
        `Sparse record at ${recordStart} is ${recordSize} bytes but the layout walks ` +
          `${offset} (padded ${padded}). The layout does not match this file.`
      );
    }

    return offsets;
  }

  /** Combined element count across all fields. */
  public getTotalElementCount(): number {
    return this.totalElements;
  }
}

/**
 * Sparse field layouts by DB2 file name, lower-cased.
 *
 * A sparse file cannot be read without one, so schemas register their layout
 * here at module load and the loader looks it up by file name. Keeping the
 * registry in this module rather than in the schema layer keeps the dependency
 * pointing one way: schemas know about the DB2 layer, not the reverse.
 */
const sparseFieldLayouts: Map<string, DB2SparseFieldLayout> = new Map();

/**
 * Register the field layout for a sparse DB2 file.
 *
 * @param fileName DB2 file name, e.g. `ItemSparse.db2` (matched case-insensitively)
 * @param layout Layout describing that file's records
 * @throws {Error} If the file name is empty
 */
export function registerSparseFieldLayout(fileName: string, layout: DB2SparseFieldLayout): void {
  if (!fileName) {
    throw new Error('registerSparseFieldLayout requires a file name');
  }
  sparseFieldLayouts.set(fileName.toLowerCase(), layout);
}

/**
 * Look up the field layout for a sparse DB2 file.
 *
 * @param fileName DB2 file name or full path; only the base name is matched
 * @returns The registered layout, or null when none is registered
 */
export function getSparseFieldLayout(fileName: string): DB2SparseFieldLayout | null {
  if (!fileName) {
    return null;
  }
  const base = fileName.replace(/\\/g, '/').split('/').pop() || fileName;
  return sparseFieldLayouts.get(base.toLowerCase()) || null;
}

/** Drop all registered layouts. Intended for tests. */
export function clearSparseFieldLayouts(): void {
  sparseFieldLayouts.clear();
}
