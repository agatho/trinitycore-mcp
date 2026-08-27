// tests/version/ClientBuildInfo.test.ts
import { parseBuildInfo, checkBuildDrift } from "../../src/version/ClientBuildInfo";

const HEADER =
  "Branch!STRING:0|Active!DEC:1|Build Key!HEX:16|Version!STRING:0|Product!STRING:0";

describe("parseBuildInfo", () => {
  it("parses rows into named columns", () => {
    const rows = parseBuildInfo(`${HEADER}\neu|1|abc123|12.1.0.69497|wow`);
    expect(rows).toHaveLength(1);
    expect(rows[0].Version).toBe("12.1.0.69497");
    expect(rows[0].Product).toBe("wow");
    expect(rows[0].Active).toBe("1");
  });

  it("strips the !TYPE:LEN suffix from header names", () => {
    const rows = parseBuildInfo(`${HEADER}\neu|1|abc|12.1.0.69497|wow`);
    expect(Object.keys(rows[0])).toContain("Build Key");
  });

  it("returns an empty array for a header-only file", () => {
    expect(parseBuildInfo(HEADER)).toEqual([]);
  });

  it("ignores blank trailing lines", () => {
    const rows = parseBuildInfo(`${HEADER}\neu|1|abc|12.1.0.69497|wow\n\n`);
    expect(rows).toHaveLength(1);
  });

  it("throws on a file with no header", () => {
    expect(() => parseBuildInfo("")).toThrow(/header/i);
  });
});

describe("checkBuildDrift", () => {
  it("reports no drift when ids match", () => {
    expect(checkBuildDrift("12.1.0.69497", "12.1.0.69497").drifted).toBe(false);
  });

  it("reports drift and names both builds", () => {
    const r = checkBuildDrift("12.1.0.69497", "12.1.0.69600");
    expect(r.drifted).toBe(true);
    expect(r.message).toContain("12.1.0.69497");
    expect(r.message).toContain("12.1.0.69600");
  });

  it("never reports drift for a synthesized 'unknown' manifest", () => {
    expect(checkBuildDrift("unknown", "12.1.0.69497").drifted).toBe(false);
  });
});
