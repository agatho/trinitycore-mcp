import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  loadOpcodeTable,
  getOpcodeTable,
  resolveOpcodeTable,
  resetOpcodeTableForTesting,
} from "../../src/opcodes/OpcodeTable";
import { loadBuildManifest, resetManifestForTesting } from "../../src/version/BuildManifest";

describe("OpcodeTable", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ot-"));
    fs.writeFileSync(path.join(dir, "12.1.0.69214.json"), JSON.stringify({
      build: 69214, version: "12.1.0",
      source: { file: "V12_1_0_69214/Opcodes.cs", derivedFrom: "V12_0_7_67808", method: "family-shift", importedAt: "2026-08-27T00:00:00.000Z" },
      unmappedCatalogFamilies: ["0x2E", "0x35"],
      unmappedCatalogIndexRanges: [
        { family: "0x3A", fromIndex: "0x100", toIndex: null },
        { family: "0x42", fromIndex: "0x039", toIndex: "0x040" },
        { family: "0x42", fromIndex: "0x11B", toIndex: "0x11E" },
      ],
      counts: { CMSG: 2, SMSG: 4, MSG: 0 },
      // These families/indices are CLIENT wire identifiers: this is a derived
      // table. None of them is its own catalog preimage — see the provenance
      // fixture below, where every clientFamily is genuinely shifted away from
      // its catalog key.
      opcodes: [
        { name: "CMSG_ACCEPT_GUILD_INVITE", value: 4390953, hex: "0x430029", direction: "CMSG", family: "0x43", index: "0x029" },
        { name: "CMSG_ACCEPT_TRADE", value: 4001796, hex: "0x3D0004", direction: "CMSG", family: "0x3D", index: "0x004" },
        { name: "SMSG_ABORT_NEW_WORLD", value: 4522032, hex: "0x450030", direction: "SMSG", family: "0x45", index: "0x030" },
        { name: "SMSG_JAM_SOURCED", value: 4587522, hex: "0x460002", direction: "SMSG", family: "0x46", index: "0x002" },
        { name: "SMSG_UNDECIDED_INDEX", value: 4522304, hex: "0x450140", direction: "SMSG", family: "0x45", index: "0x140" },
        { name: "SMSG_NO_PREIMAGE", value: 5242881, hex: "0x500001", direction: "SMSG", family: "0x50", index: "0x001" },
      ],
    }));
    // Provenance is keyed by CATALOG family; clientFamily is the family the
    // derivation shifted that catalog family to. Catalog and client keys must
    // NOT coincide, or the two namespaces collapse and a client-family lookup
    // that reads the catalog map directly looks correct by accident.
    //
    //   catalog 0x42 --shift 1--> client 0x43   (wire)
    //   catalog 0x3B --shift 2--> client 0x3d   (interp; lowercase on purpose)
    //   catalog 0x43 --shift 2--> client 0x45   (interp)
    //   catalog 0x44 --shift 2--> client 0x46   (jam)
    //
    // Note catalog 0x43 and client 0x43 both exist and mean different things:
    // that overlap is the whole point of the fixture.
    fs.writeFileSync(path.join(dir, "12.1.0.69214-provenance.json"), JSON.stringify({
      familyShift: {
        "0x42": { shift: 1, provenance: "wire", provenanceDetail: "wire", clientFamily: "0x43" },
        "0x3B": { shift: 2, provenance: "interp", provenanceDetail: "interp", clientFamily: "0x3d" },
        "0x43": { shift: 2, provenance: "interp", provenanceDetail: "interp", clientFamily: "0x45" },
        "0x44": { shift: 2, provenance: "jam", provenanceDetail: "jam", clientFamily: "0x46" },
        "0x2E": { shift: null, provenance: "ambiguous", provenanceDetail: "ambiguous: +1 or +2, never observed", clientFamily: "" },
        "0x35": { shift: null, provenance: "ambiguous", provenanceDetail: "ambiguous: +2 or +3, never observed", clientFamily: "" },
      },
      // Catalog family 0x43 (client 0x45) is decided for catalog indices
      // [0x000, 0x100) with offset 0, and undecided from 0x100 on. The client
      // image of the decided range is therefore [0x000, 0x100); a client index
      // beyond it can only have come from the undecided range.
      indexOffsets: {
        "0x43": [
          { catalogIndexFrom: "0x000", offset: 0 },
          { catalogIndexFrom: "0x100", offset: null },
        ],
      },
      ambiguousFamilies: ["0x2E", "0x35"], meta: {},
    }));
    resetOpcodeTableForTesting();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetOpcodeTableForTesting();
  });

  it("looks up by exact name", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("CMSG_ACCEPT_TRADE")!.hex).toBe("0x3D0004");
  });

  it("looks up by name case-insensitively", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("cmsg_accept_trade")!.name).toBe("CMSG_ACCEPT_TRADE");
  });

  it("looks up by numeric value", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByValue(0x430029)!.name).toBe("CMSG_ACCEPT_GUILD_INVITE");
  });

  describe("confidence attribution on a derived table", () => {
    // A derived table's family is a CLIENT wire family; the provenance is keyed
    // by CATALOG family. Reading the provenance with a client family is a
    // namespace error that produces a confident-looking wrong answer wherever
    // the two spaces happen to overlap, and a false null wherever they do not.

    it("resolves confidence through the client->catalog reverse index", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // Client 0x43 <- catalog 0x42, provenance "wire" => high.
      // Reading catalog "0x43" directly (which exists, and is "interp") would
      // wrongly report medium.
      expect(t.lookupByName("CMSG_ACCEPT_GUILD_INVITE")!.confidence).toBe("high");
    });

    it("does not report null for a client family absent from the catalog key space", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // Client 0x3D <- catalog 0x3B, provenance "interp" => medium.
      // There is no catalog family 0x3D, so a direct lookup reports null.
      expect(t.lookupByName("CMSG_ACCEPT_TRADE")!.confidence).toBe("medium");
    });

    it("normalizes hex case on both sides of the reverse index", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // The fixture writes catalog 0x3B's clientFamily as lowercase "0x3d"
      // while the table writes the same family as "0x3D". Case-sensitive
      // comparison would lose the mapping entirely.
      expect(t.lookupByName("CMSG_ACCEPT_TRADE")!.confidence).not.toBeNull();
    });

    it("attributes a jam-sourced family through its shifted client family", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // Client 0x46 <- catalog 0x44, provenance "jam" => high.
      expect(t.lookupByName("SMSG_JAM_SOURCED")!.confidence).toBe("high");
    });

    it("attributes a client index inside a decided index range", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // Client 0x45/0x030 <- catalog 0x43/0x030, inside the decided range.
      expect(t.lookupByName("SMSG_ABORT_NEW_WORLD")!.confidence).toBe("medium");
    });

    it("reports null for a client index that can only come from an undecided range", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // Client 0x45/0x140 lies outside the image of catalog 0x43's only
      // decided index range, so its catalog slot — and its provenance — is
      // unknown. Inheriting the family's confidence here would claim the
      // derivation decided something it explicitly did not.
      expect(t.lookupByName("SMSG_UNDECIDED_INDEX")!.confidence).toBeNull();
    });

    it("reports null for a client family with no catalog preimage", () => {
      const t = loadOpcodeTable("12.1.0.69214", dir);
      // Nothing in the derivation produces client family 0x50, so no
      // provenance code applies to it. Null is the honest answer.
      expect(t.lookupByName("SMSG_NO_PREIMAGE")!.confidence).toBeNull();
    });
  });

  it("lists a family", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.listFamily("0x43")).toHaveLength(1);
  });

  it("lists a family given in lowercase hex", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // "0x3d".toUpperCase() is "0X3D", which matches no index key; a family
    // filter typed in lowercase used to return zero results silently.
    expect(t.listFamily("0x3d").map((o) => o.name)).toEqual(["CMSG_ACCEPT_TRADE"]);
  });

  it("lists a family given without the 0x prefix or with padding", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.listFamily("3d")).toHaveLength(1);
    expect(t.listFamily("0x03D")).toHaveLength(1);
  });

  it("reports unmapped catalog families", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.isUnmappedCatalogFamily("0x2E")).toBe(true);
    expect(t.isUnmappedCatalogFamily("0x2e")).toBe(true);
    expect(t.isUnmappedCatalogFamily("0x43")).toBe(false);
  });

  it("returns null for an unknown name", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.lookupByName("CMSG_NOPE")).toBeNull();
  });

  it("suggests near-miss names", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.suggestNames("CMSG_ACCEPT_TRAD")).toContain("CMSG_ACCEPT_TRADE");
  });

  it("searches by substring and filters by direction", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.search("ACCEPT")).toHaveLength(2);
    expect(t.search("ACCEPT", { direction: "SMSG" })).toHaveLength(0);
  });

  it("throws a named error when the table file is missing", () => {
    expect(() => loadOpcodeTable("12.9.9.99999", dir)).toThrow(/import-opcodes/);
  });

  it("exposes the raw unmapped catalog index ranges", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.unmappedCatalogIndexRanges).toHaveLength(3);
    expect(t.unmappedCatalogIndexRanges[0]).toEqual({ family: "0x3A", fromIndex: "0x100", toIndex: null });
  });

  it("reports a catalog index inside a bounded unmapped range as undetermined", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // 0x42 range is [0x039, 0x040); 0x03A is inside it.
    expect(t.isUndeterminedCatalogIndex("0x42", 0x03a)).toBe(true);
  });

  it("treats the exclusive toIndex boundary as NOT undetermined", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // 0x040 is the exclusive upper bound of the [0x039, 0x040) range — outside it.
    expect(t.isUndeterminedCatalogIndex("0x42", 0x040)).toBe(false);
  });

  it("reports a catalog index inside an open-ended (toIndex: null) range as undetermined", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // 0x3A range is [0x100, end); 0x200 is far past 0x100 but still open-ended.
    expect(t.isUndeterminedCatalogIndex("0x3A", 0x200)).toBe(true);
  });

  it("returns false for a catalog family with no unmapped index ranges", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.isUndeterminedCatalogIndex("0x43", 0x029)).toBe(false);
  });

  it("measures no catalog gap when the source catalog is not available beside the table", () => {
    const t = loadOpcodeTable("12.1.0.69214", dir);
    // The temp directory holds only the derived table; a gap figure would have
    // to be invented, so none is reported.
    expect(t.catalogCoverageGap).toBeNull();
  });

  it("measures the catalog gap against the source catalog table when one is present", () => {
    fs.writeFileSync(path.join(dir, "12.0.7.67808.json"), JSON.stringify({
      build: 67808, version: "12.0.7",
      source: { file: "V12_0_7_67808/Opcodes.cs", derivedFrom: null, method: "catalog", importedAt: "2026-08-27T00:00:00.000Z" },
      unmappedCatalogFamilies: [], unmappedCatalogIndexRanges: [],
      counts: { CMSG: 3, SMSG: 4, MSG: 0 },
      opcodes: [
        { name: "CMSG_ACCEPT_GUILD_INVITE", value: 4325417, hex: "0x420029", direction: "CMSG", family: "0x42", index: "0x029" },
        { name: "CMSG_ACCEPT_TRADE", value: 3866626, hex: "0x3B0002", direction: "CMSG", family: "0x3B", index: "0x002" },
        { name: "CMSG_DROPPED_IN_DERIVATION", value: 4325418, hex: "0x42002A", direction: "CMSG", family: "0x42", index: "0x02A" },
        { name: "SMSG_ABORT_NEW_WORLD", value: 4390960, hex: "0x430030", direction: "SMSG", family: "0x43", index: "0x030" },
        { name: "SMSG_JAM_SOURCED", value: 4456450, hex: "0x440002", direction: "SMSG", family: "0x44", index: "0x002" },
        { name: "SMSG_UNDECIDED_INDEX", value: 4391232, hex: "0x430140", direction: "SMSG", family: "0x43", index: "0x140" },
        { name: "SMSG_ALSO_DROPPED", value: 4456451, hex: "0x440003", direction: "SMSG", family: "0x44", index: "0x003" },
      ],
    }));
    resetOpcodeTableForTesting();

    const t = loadOpcodeTable("12.1.0.69214", dir);
    expect(t.catalogCoverageGap).toEqual({
      sourceTableId: "12.0.7.67808",
      sourceNames: 7,
      tableNames: 6,
      // SMSG_NO_PREIMAGE exists only in the derived table; the catalog names
      // CMSG_DROPPED_IN_DERIVATION and SMSG_ALSO_DROPPED are the two missing.
      missingNames: 2,
    });
  });
});

describe("getOpcodeTable resolution", () => {
  // Regression: loadOpcodeTable() used to assign a single module-level
  // "cached" slot that getOpcodeTable() returned in preference to consulting
  // the manifest. Loading any other table anywhere in the process — a
  // cross-build diff, most obviously — therefore repointed every later opcode
  // lookup, listing and generated packet handler at that table.
  let dir: string;
  let manifestPath: string;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "otm-"));
    manifestPath = path.join(dir, "builds.json");
    fs.writeFileSync(manifestPath, JSON.stringify({
      manifestVersion: 1,
      activeBuild: "12.0.x-test",
      builds: {
        "12.0.x-test": {
          build: 65390, product: "wow", expansion: "Midnight", status: "active", db2Format: "WDC5",
          dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
          cacheDir: "data/cache/65390",
          opcodeTable: "12.1.0.69214",
        },
      },
    }));
    resetManifestForTesting();
    resetOpcodeTableForTesting();
    await loadBuildManifest(manifestPath);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    resetManifestForTesting();
    resetOpcodeTableForTesting();
  });

  it("keeps resolving through the manifest after another table is loaded", () => {
    const a = loadOpcodeTable("12.1.0.69214");
    expect(getOpcodeTable().build).toBe(a.build);

    // Load a different table, exactly as diffOpcodes does for its baseline.
    const b = loadOpcodeTable("12.0.7.67808");
    expect(b.build).not.toBe(a.build);

    // The manifest still names 12.1.0.69214, so that is still what the active
    // build resolves to.
    expect(getOpcodeTable().build).toBe(69214);
    expect(getOpcodeTable()).toBe(a);
  });

  it("reports no selection caveat when the manifest names the table", () => {
    expect(resolveOpcodeTable().note).toBeNull();
  });
});

describe("getOpcodeTable with no build manifest", () => {
  // Regression: with no manifest, the manifest layer synthesizes a build
  // literally named "unknown", which can never match a table id. Throwing
  // there took every opcode tool offline for a server merely started from an
  // unexpected working directory.
  beforeEach(() => {
    resetManifestForTesting();
    resetOpcodeTableForTesting();
  });

  afterEach(() => {
    resetManifestForTesting();
    resetOpcodeTableForTesting();
  });

  it("falls back to the newest available table instead of throwing", () => {
    expect(() => getOpcodeTable()).not.toThrow();
    // data/opcodes ships 12.0.7.67808 and 12.1.0.69214; the newest wins.
    expect(getOpcodeTable().build).toBe(69214);
  });

  it("states that the table was chosen by fallback", () => {
    const resolution = resolveOpcodeTable();
    expect(resolution.note).toMatch(/no build manifest was found/i);
    expect(resolution.note).toContain("12.1.0.69214");
  });
});
