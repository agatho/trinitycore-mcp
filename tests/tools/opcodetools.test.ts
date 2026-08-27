import { computeDiff } from "../../src/tools/opcodetools";

const base = [
  { name: "CMSG_A", value: 0x430001, hex: "0x430001", direction: "CMSG" as const, family: "0x43", index: "0x001", confidence: "high" as const, build: 67808 },
  { name: "CMSG_B", value: 0x430002, hex: "0x430002", direction: "CMSG" as const, family: "0x43", index: "0x002", confidence: "high" as const, build: 67808 },
  { name: "SMSG_GONE", value: 0x440001, hex: "0x440001", direction: "SMSG" as const, family: "0x44", index: "0x001", confidence: "high" as const, build: 67808 },
];

const next = [
  { name: "CMSG_A", value: 0x440001, hex: "0x440001", direction: "CMSG" as const, family: "0x44", index: "0x001", confidence: "high" as const, build: 69214 },
  { name: "CMSG_B", value: 0x430002, hex: "0x430002", direction: "CMSG" as const, family: "0x43", index: "0x002", confidence: "high" as const, build: 69214 },
  { name: "SMSG_NEW", value: 0x450009, hex: "0x450009", direction: "SMSG" as const, family: "0x45", index: "0x009", confidence: "high" as const, build: 69214 },
];

describe("computeDiff", () => {
  it("detects added opcodes", () => {
    expect(computeDiff(base, next).added.map((o) => o.name)).toEqual(["SMSG_NEW"]);
  });

  it("detects removed opcodes", () => {
    expect(computeDiff(base, next).removed.map((o) => o.name)).toEqual(["SMSG_GONE"]);
  });

  it("detects moved opcodes with both values", () => {
    const moved = computeDiff(base, next).moved;
    expect(moved).toHaveLength(1);
    expect(moved[0].name).toBe("CMSG_A");
    expect(moved[0].from).toBe("0x430001");
    expect(moved[0].to).toBe("0x440001");
  });

  it("does not report unchanged opcodes", () => {
    const d = computeDiff(base, next);
    expect([...d.added, ...d.removed, ...d.moved].map((o) => o.name)).not.toContain("CMSG_B");
  });

  it("summarizes counts", () => {
    const d = computeDiff(base, next);
    expect(d.summary).toEqual({ added: 1, removed: 1, moved: 1, unchanged: 1 });
  });

  it("returns an empty diff for identical inputs", () => {
    const d = computeDiff(base, base);
    expect(d.summary).toEqual({ added: 0, removed: 0, moved: 0, unchanged: 3 });
  });
});
