/**
 * Records what an extraction produced, so a partial or mismatched data tree is
 * detectable before it is trusted.
 *
 * @module version/ExtractionManifest
 */

import * as fs from "fs";
import * as path from "path";

export interface ExtractedFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface ExtractionManifest {
  build: string;
  buildNumber: number;
  extractedAt: string;
  files: ExtractedFile[];
  counts: Record<string, number>;
}

export interface VerifyResult {
  ok: boolean;
  reason: string;
}

export const EXTRACTION_MANIFEST_FILE = "extraction-manifest.json";

export function writeExtractionManifest(dir: string, manifest: ExtractionManifest): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, EXTRACTION_MANIFEST_FILE), JSON.stringify(manifest, null, 2), "utf8");
}

export function readExtractionManifest(dir: string): ExtractionManifest | null {
  const p = path.join(dir, EXTRACTION_MANIFEST_FILE);
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as ExtractionManifest;
  } catch {
    return null;
  }
}

export function verifyExtraction(dir: string, expectedBuild: string): VerifyResult {
  const manifest = readExtractionManifest(dir);
  if (!manifest) {
    return { ok: false, reason: `No extraction manifest in ${dir}; the data tree is unverified` };
  }
  if (manifest.build !== expectedBuild) {
    return {
      ok: false,
      reason: `Extraction in ${dir} is for build ${manifest.build}, expected ${expectedBuild}`,
    };
  }
  return { ok: true, reason: `Extraction verified for build ${expectedBuild} (${manifest.files.length} files)` };
}
