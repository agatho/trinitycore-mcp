/**
 * Consistency check between the build manifest and the legacy path variables.
 *
 * Data paths were configured through environment variables (DB2_PATH, GT_PATH,
 * VMAP_PATH, ...) before the build manifest existed. Those variables are set
 * once and forgotten, so after a build cutover they still name the previous
 * build's directories. Tools resolve through the manifest now, but a stale
 * variable is still a sign that something on this machine - another script, the
 * web UI, an operator's expectations - is pointed at the wrong build.
 *
 * Reporting the disagreement at startup turns a silent wrong answer into a
 * visible warning.
 *
 * @module version/DataPathConsistency
 */

import * as path from 'path';
import { BuildDataPaths, getActiveBuild } from './BuildManifest';

/** Environment variable paired with the manifest path it duplicates. */
const PATH_VARIABLES: ReadonlyArray<{ envVar: string; kind: keyof BuildDataPaths }> = [
  { envVar: 'DB2_PATH', kind: 'db2' },
  { envVar: 'DBC_PATH', kind: 'dbc' },
  { envVar: 'GT_PATH', kind: 'gt' },
  { envVar: 'VMAP_PATH', kind: 'vmap' },
  { envVar: 'MMAP_PATH', kind: 'mmap' },
];

export interface DataPathDisagreement {
  envVar: string;
  kind: keyof BuildDataPaths;
  /** What the environment says. */
  envValue: string;
  /** What the active build says. */
  buildValue: string;
}

/**
 * Compare two paths as the filesystem would, ignoring separator style and case.
 *
 * Windows paths reach us with either separator and in either case, and a
 * spurious warning about `M:\x` versus `M:/x` would train people to ignore the
 * real ones.
 */
function samePath(a: string, b: string): boolean {
  const normalize = (value: string): string =>
    path.normalize(value.trim()).replace(/[\\/]+$/, '').toLowerCase();
  return normalize(a) === normalize(b);
}

/**
 * Find legacy path variables that disagree with the active build.
 *
 * A variable that is unset is not a disagreement: it simply leaves the manifest
 * to decide, which is the intended arrangement.
 *
 * @param env Environment to inspect; defaults to this process's
 * @returns One entry per variable that names a different directory
 *
 * @example
 * ```typescript
 * for (const d of findDataPathDisagreements()) {
 *   logger.warn(`${d.envVar} points at ${d.envValue}, not ${d.buildValue}`);
 * }
 * ```
 */
export function findDataPathDisagreements(
  env: NodeJS.ProcessEnv = process.env
): DataPathDisagreement[] {
  const build = getActiveBuild();
  const disagreements: DataPathDisagreement[] = [];

  for (const { envVar, kind } of PATH_VARIABLES) {
    const envValue = env[envVar];
    if (!envValue) {
      continue;
    }
    const buildValue = build.dataPaths[kind];
    if (!buildValue || samePath(envValue, buildValue)) {
      continue;
    }
    disagreements.push({ envVar, kind, envValue, buildValue });
  }

  return disagreements;
}

/**
 * One line per disagreement, ready to log.
 *
 * @param disagreements Result of {@link findDataPathDisagreements}
 * @returns Human-readable lines; empty when everything agrees
 */
export function describeDataPathDisagreements(
  disagreements: DataPathDisagreement[]
): string[] {
  if (disagreements.length === 0) {
    return [];
  }

  const build = getActiveBuild();
  const lines = [
    `${disagreements.length} data path variable(s) disagree with the active build ` +
      `${build.id} (${build.build}). Tools read the build's paths, so these variables ` +
      `are ignored - but anything else reading them, the web UI included, gets the wrong build's data:`,
  ];
  for (const d of disagreements) {
    lines.push(`  ${d.envVar}=${d.envValue} but build ${build.build} uses ${d.buildValue}`);
  }
  lines.push(
    `Update them, or remove them and let config/builds.json be the single source of truth.`
  );
  return lines;
}
