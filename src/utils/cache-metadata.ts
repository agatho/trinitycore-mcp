/**
 * Sidecar metadata for generated JSON caches.
 *
 * Caches are build-specific. Serving 12.0 spell names to a 12.1 query is a
 * silent wrong answer, so every cache records which build produced it and the
 * loader refuses a mismatch.
 *
 * @module utils/cache-metadata
 */

import * as fs from "fs";
import * as path from "path";
import { getActiveBuild } from "../version/BuildManifest";

export interface CacheMetadata {
  build: number;
  generatedAt: string;
  sourceFile: string;
  sourceLayoutHash: string;
  recordCount: number;
}

export class CacheBuildMismatchError extends Error {
  constructor(cachePath: string, cacheBuild: number, expectedBuild: number, regenerateCommand?: string) {
    super(
      `Cache ${cachePath} was generated for build ${cacheBuild} but the active build is ${expectedBuild}. ` +
        `Refusing to serve stale data.` +
        (regenerateCommand ? ` Regenerate it with: ${regenerateCommand}` : "")
    );
    this.name = "CacheBuildMismatchError";
  }
}

function sidecarPath(cacheFilePath: string): string {
  return `${cacheFilePath}.meta.json`;
}

export function readCacheMetadata(cacheFilePath: string): CacheMetadata | null {
  const p = sidecarPath(cacheFilePath);
  if (!fs.existsSync(p)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as CacheMetadata;
  } catch {
    return null;
  }
}

export function writeCacheMetadata(cacheFilePath: string, meta: CacheMetadata): void {
  fs.writeFileSync(sidecarPath(cacheFilePath), JSON.stringify(meta, null, 2), "utf8");
}

/**
 * Resolve a cache file inside the active build's cache directory.
 * @param fileName Bare cache file name, e.g. "spell_names_cache.json"
 */
export function cachePathFor(fileName: string): string {
  return path.join(getActiveBuild().cacheDir, fileName);
}
