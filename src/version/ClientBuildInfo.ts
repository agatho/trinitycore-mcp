// src/version/ClientBuildInfo.ts
/**
 * Reads the WoW client's .build.info to determine the installed build,
 * and compares it against the manifest's active build.
 *
 * @module version/ClientBuildInfo
 */

import * as fs from "fs";
import * as path from "path";

export type ClientBuildRow = Record<string, string>;

export interface DriftResult {
  drifted: boolean;
  message: string;
}

/**
 * Parse a .build.info file. The first line is a pipe-delimited header where
 * each column is "Name!TYPE:LEN"; subsequent lines are pipe-delimited values.
 */
export function parseBuildInfo(content: string): ClientBuildRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new Error(".build.info is empty: expected a header row");
  }

  const headers = lines[0].split("|").map((h) => h.split("!")[0]);
  return lines.slice(1).map((line) => {
    const values = line.split("|");
    const row: ClientBuildRow = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}

/**
 * Resolve the installed client's version string, e.g. "12.1.0.69497".
 * @param wowPath Root of the WoW installation (the directory holding .build.info)
 * @throws Error when the file is missing or contains no active row
 */
export async function resolveClientBuild(wowPath: string): Promise<string> {
  const target = path.join(wowPath, ".build.info");
  if (!fs.existsSync(target)) {
    throw new Error(`Cannot determine client build: no .build.info at ${target}`);
  }

  const rows = parseBuildInfo(await fs.promises.readFile(target, "utf8"));
  const active = rows.find((r) => r.Active === "1");
  if (!active) {
    throw new Error(`No active row in ${target}; cannot determine installed build`);
  }
  if (!active.Version) {
    throw new Error(`Active row in ${target} has no Version column`);
  }
  return active.Version;
}

/**
 * Compare the manifest's active build against the installed client.
 * A synthesized manifest (id "unknown") never reports drift — it makes no claim.
 */
export function checkBuildDrift(manifestActiveId: string, clientVersion: string): DriftResult {
  if (manifestActiveId === "unknown") {
    return { drifted: false, message: "Manifest is synthesized; no build claim to compare" };
  }
  if (manifestActiveId === clientVersion) {
    return { drifted: false, message: `Manifest active build matches installed client (${clientVersion})` };
  }
  return {
    drifted: true,
    message:
      `Build drift: manifest active build is ${manifestActiveId} but the installed client is ${clientVersion}. ` +
      `Extract ${clientVersion} and add it to config/builds.json, or switch activeBuild.`,
  };
}
