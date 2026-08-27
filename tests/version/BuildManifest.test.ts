import { parseBuildManifest, ManifestValidationError } from "../../src/version/BuildManifest";

const validRaw = {
  manifestVersion: 1,
  activeBuild: "12.1.0.69497",
  builds: {
    "12.1.0.69497": {
      build: 69497, product: "wow", expansion: "Midnight",
      status: "active", db2Format: "WDC5",
      dataPaths: { db2: "d", dbc: "c", gt: "g", vmap: "v", mmap: "m", listfile: "l" },
      cacheDir: "data/cache/69497",
    },
  },
};

describe("parseBuildManifest", () => {
  it("parses a valid manifest and injects the id onto each entry", () => {
    const m = parseBuildManifest(validRaw);
    expect(m.activeBuild).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].id).toBe("12.1.0.69497");
    expect(m.builds["12.1.0.69497"].build).toBe(69497);
  });

  it("rejects a manifest with no active build", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.builds["12.1.0.69497"].status = "archived";
    expect(() => parseBuildManifest(raw)).toThrow(ManifestValidationError);
  });

  it("rejects a manifest with two active builds", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.builds["12.0.5.66838"] = { ...raw.builds["12.1.0.69497"], build: 66838 };
    expect(() => parseBuildManifest(raw)).toThrow(/exactly one/i);
  });

  it("rejects duplicate build numbers", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.builds["12.0.5.66838"] = { ...raw.builds["12.1.0.69497"], status: "archived" };
    expect(() => parseBuildManifest(raw)).toThrow(/duplicate build number/i);
  });

  it("rejects activeBuild that names a missing build", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    raw.activeBuild = "12.9.9.99999";
    expect(() => parseBuildManifest(raw)).toThrow(/activeBuild/i);
  });

  it("rejects an entry missing a data path key", () => {
    const raw = JSON.parse(JSON.stringify(validRaw));
    delete raw.builds["12.1.0.69497"].dataPaths.vmap;
    expect(() => parseBuildManifest(raw)).toThrow(/vmap/i);
  });

  it("rejects an unsupported manifestVersion", () => {
    expect(() => parseBuildManifest({ ...validRaw, manifestVersion: 2 })).toThrow(/manifestVersion/i);
  });
});
