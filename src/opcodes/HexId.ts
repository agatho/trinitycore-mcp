/**
 * Canonical form for the hexadecimal family/index identifiers that appear in
 * opcode tables, provenance files and user input.
 *
 * The raw data is not internally consistent: the vendored provenance file
 * writes some client families as `"0x3D"` and others as `"0x3d"`, generated
 * tables always write uppercase, and a user typing `--family 0x3d` supplies a
 * third spelling. Every one of those denotes the same family. Comparing them
 * as raw strings — or with an ad-hoc `toUpperCase()` that turns `"0x3d"` into
 * `"0X3D"` — silently yields "no match" instead of an answer, which is how
 * both the family-index lookup miss and the confidence misattribution in this
 * subsystem were able to happen.
 *
 * There is therefore exactly ONE normalizer, used on both sides of every
 * comparison: when an index is built and when it is queried.
 *
 * @module opcodes/HexId
 */

/**
 * Normalize a hexadecimal identifier to `0x` + uppercase digits, zero-padded
 * to at least `minDigits`.
 *
 * Accepts an optional `0x`/`0X` prefix, surrounding whitespace, any digit
 * case, and redundant leading zeros. Non-hexadecimal input is returned
 * uppercased with the prefix normalized rather than rejected: these values
 * come from data files whose contents this module does not own, and an
 * unrecognized spelling must fail as a clean lookup miss, never as a thrown
 * error from inside an index build.
 *
 * @param raw - Identifier as written in a data file or supplied by a caller
 * @param minDigits - Minimum digit count after the `0x` prefix (default 2)
 * @returns The canonical form, e.g. `"0x3D"`
 *
 * @example
 * normalizeHexId("0x3d");  // "0x3D"
 * normalizeHexId("0X3D");  // "0x3D"
 * normalizeHexId("3d");    // "0x3D"
 * normalizeHexId("0x043"); // "0x43"
 */
export function normalizeHexId(raw: string, minDigits = 2): string {
  const body = String(raw).trim().replace(/^0[xX]/, "").toUpperCase();
  const trimmed = body.replace(/^0+(?=.)/, "");
  return `0x${trimmed.padStart(minDigits, "0")}`;
}

/**
 * Parse a hexadecimal identifier to a number.
 *
 * @param raw - Identifier as written in a data file, with or without `0x`
 * @returns The numeric value, or `null` when `raw` is not a hexadecimal literal
 */
export function parseHexId(raw: string): number | null {
  const body = String(raw).trim().replace(/^0[xX]/, "");
  if (!/^[0-9A-Fa-f]+$/.test(body)) {
    return null;
  }
  return parseInt(body, 16);
}
