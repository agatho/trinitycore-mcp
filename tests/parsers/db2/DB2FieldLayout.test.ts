/**
 * Tests for the sparse DB2 field layout walker.
 *
 * Sparse records are variable length with inline strings, so a field's position
 * depends on the contents of the record holding it. These tests pin down the
 * walk and the checks that stop a wrong layout from silently mis-reading data.
 */

import {
  DB2FieldType,
  DB2FieldSpec,
  DB2SparseFieldLayout,
  getFixedFieldSize,
  registerSparseFieldLayout,
  getSparseFieldLayout,
  clearSparseFieldLayouts,
  SPARSE_RECORD_ALIGNMENT,
} from '../../../src/parsers/db2/DB2FieldLayout';

/** Build a record: a string, a uint16, an int32[2], padded to alignment. */
function buildRecord(name: string, level: number, pair: [number, number]): Buffer {
  const nameBytes = Buffer.from(name, 'utf8');
  const body = Buffer.alloc(nameBytes.length + 1 + 2 + 8);
  nameBytes.copy(body, 0);
  body.writeUInt8(0, nameBytes.length); // null terminator
  body.writeUInt16LE(level, nameBytes.length + 1);
  body.writeInt32LE(pair[0], nameBytes.length + 3);
  body.writeInt32LE(pair[1], nameBytes.length + 7);

  const padded = Math.ceil(body.length / SPARSE_RECORD_ALIGNMENT) * SPARSE_RECORD_ALIGNMENT;
  const record = Buffer.alloc(padded);
  body.copy(record, 0);
  return record;
}

const SPECS: DB2FieldSpec[] = [
  { name: 'Name_lang', type: DB2FieldType.String, arraySize: 1 },
  { name: 'ItemLevel', type: DB2FieldType.UInt16, arraySize: 1 },
  { name: 'AllowableRaces', type: DB2FieldType.Int32, arraySize: 2 },
];

describe('getFixedFieldSize', () => {
  it('returns the byte width of each fixed type', () => {
    expect(getFixedFieldSize(DB2FieldType.Int8)).toBe(1);
    expect(getFixedFieldSize(DB2FieldType.UInt8)).toBe(1);
    expect(getFixedFieldSize(DB2FieldType.Int16)).toBe(2);
    expect(getFixedFieldSize(DB2FieldType.UInt16)).toBe(2);
    expect(getFixedFieldSize(DB2FieldType.Int32)).toBe(4);
    expect(getFixedFieldSize(DB2FieldType.UInt32)).toBe(4);
    expect(getFixedFieldSize(DB2FieldType.Float)).toBe(4);
    expect(getFixedFieldSize(DB2FieldType.Int64)).toBe(8);
    expect(getFixedFieldSize(DB2FieldType.UInt64)).toBe(8);
  });

  it('refuses to give a string a fixed width', () => {
    expect(() => getFixedFieldSize(DB2FieldType.String)).toThrow(/variable length/);
  });
});

describe('DB2SparseFieldLayout', () => {
  describe('construction', () => {
    it('rejects an empty spec list', () => {
      expect(() => new DB2SparseFieldLayout([])).toThrow(/at least one field/);
    });

    it('rejects a field with no name', () => {
      expect(
        () => new DB2SparseFieldLayout([{ name: '', type: DB2FieldType.Int32, arraySize: 1 }])
      ).toThrow(/missing a name/);
    });

    it('rejects an unknown type', () => {
      expect(
        () =>
          new DB2SparseFieldLayout([
            { name: 'Bad', type: 'int24' as DB2FieldType, arraySize: 1 },
          ])
      ).toThrow(/unknown type/);
    });

    it('rejects a non-positive array size', () => {
      expect(
        () => new DB2SparseFieldLayout([{ name: 'Bad', type: DB2FieldType.Int32, arraySize: 0 }])
      ).toThrow(/invalid arraySize/);
    });

    it('reports its field and element counts', () => {
      const layout = new DB2SparseFieldLayout(SPECS);
      expect(layout.getFieldCount()).toBe(3);
      expect(layout.getTotalElementCount()).toBe(4); // the int32 field holds two
      expect(layout.getField(1)?.name).toBe('ItemLevel');
      expect(layout.getField(99)).toBeNull();
    });
  });

  describe('computeOffsets', () => {
    const layout = new DB2SparseFieldLayout(SPECS);

    it('places every field after a variable-length string', () => {
      const record = buildRecord('Worn Shortsword', 5, [-1, -1]);
      const offsets = layout.computeOffsets(record, 0, record.length);

      expect(offsets[0]).toEqual([0]);
      expect(offsets[1]).toEqual(['Worn Shortsword'.length + 1]);
      expect(offsets[2]).toEqual([
        'Worn Shortsword'.length + 3,
        'Worn Shortsword'.length + 7,
      ]);

      expect(record.readUInt16LE(offsets[1][0])).toBe(5);
      expect(record.readInt32LE(offsets[2][1])).toBe(-1);
    });

    it('moves later fields when the string length changes', () => {
      const short = buildRecord('Axe', 5, [0, 0]);
      const long = buildRecord('Thunderfury, Blessed Blade', 5, [0, 0]);

      const shortOffsets = layout.computeOffsets(short, 0, short.length);
      const longOffsets = layout.computeOffsets(long, 0, long.length);

      expect(longOffsets[1][0]).toBeGreaterThan(shortOffsets[1][0]);
      expect(short.readUInt16LE(shortOffsets[1][0])).toBe(5);
      expect(long.readUInt16LE(longOffsets[1][0])).toBe(5);
    });

    it('reads a record that does not start at the beginning of the buffer', () => {
      const record = buildRecord('Dagger', 9, [3, 4]);
      const buffer = Buffer.concat([Buffer.alloc(16, 0xff), record]);

      const offsets = layout.computeOffsets(buffer, 16, record.length);

      expect(buffer.toString('utf8', 16, 16 + 6)).toBe('Dagger');
      expect(buffer.readUInt16LE(16 + offsets[1][0])).toBe(9);
      expect(buffer.readInt32LE(16 + offsets[2][0])).toBe(3);
    });

    it('accepts the padding that aligns the next record', () => {
      // 'Axe' walks to 3 + 1 + 2 + 8 = 14 bytes, which pads to 16.
      const record = buildRecord('Axe', 1, [0, 0]);
      expect(record.length).toBe(16);
      expect(() => layout.computeOffsets(record, 0, 16)).not.toThrow();
    });

    it('rejects a record window outside the buffer', () => {
      const record = buildRecord('Axe', 1, [0, 0]);
      expect(() => layout.computeOffsets(record, 0, record.length + 4)).toThrow(/runs past/);
    });

    it('rejects a non-positive record size', () => {
      const record = buildRecord('Axe', 1, [0, 0]);
      expect(() => layout.computeOffsets(record, 0, 0)).toThrow(/Invalid sparse record window/);
    });

    it('rejects a record whose string never terminates', () => {
      const record = Buffer.alloc(16, 0x41); // all 'A', no null anywhere
      expect(() => layout.computeOffsets(record, 0, 16)).toThrow(/Unterminated string/);
    });

    it('rejects a layout that overruns the record', () => {
      const wide = new DB2SparseFieldLayout([
        { name: 'Name_lang', type: DB2FieldType.String, arraySize: 1 },
        { name: 'TooMany', type: DB2FieldType.Int64, arraySize: 8 },
      ]);
      const record = buildRecord('Axe', 1, [0, 0]);
      expect(() => wide.computeOffsets(record, 0, record.length)).toThrow(/overruns/);
    });

    it('rejects a layout that stops short of the record', () => {
      // A silent mis-read: the walk stays inside the record but leaves more
      // than the alignment padding unaccounted for.
      const narrow = new DB2SparseFieldLayout([
        { name: 'Name_lang', type: DB2FieldType.String, arraySize: 1 },
      ]);
      const record = buildRecord('Worn Shortsword', 5, [0, 0]);
      expect(() => narrow.computeOffsets(record, 0, record.length)).toThrow(
        /does not match this file/
      );
    });
  });
});

describe('sparse field layout registry', () => {
  afterEach(() => {
    clearSparseFieldLayouts();
  });

  it('resolves a layout by file name, ignoring case', () => {
    const layout = new DB2SparseFieldLayout(SPECS);
    registerSparseFieldLayout('ItemSparse.db2', layout);

    expect(getSparseFieldLayout('ItemSparse.db2')).toBe(layout);
    expect(getSparseFieldLayout('itemsparse.db2')).toBe(layout);
  });

  it('resolves a layout from a full path', () => {
    const layout = new DB2SparseFieldLayout(SPECS);
    registerSparseFieldLayout('ItemSparse.db2', layout);

    expect(getSparseFieldLayout('M:\\World of Warcraft\\dbc\\enUS\\ItemSparse.db2')).toBe(layout);
    expect(getSparseFieldLayout('/data/dbc/enUS/ItemSparse.db2')).toBe(layout);
  });

  it('returns null for an unregistered or empty file name', () => {
    expect(getSparseFieldLayout('Spell.db2')).toBeNull();
    expect(getSparseFieldLayout('')).toBeNull();
  });

  it('requires a file name to register', () => {
    const layout = new DB2SparseFieldLayout(SPECS);
    expect(() => registerSparseFieldLayout('', layout)).toThrow(/requires a file name/);
  });
});
