/**
 * Build manifest reporting.
 *
 * `config/builds.json` decides which client build every tool reads. Nothing
 * exposed that: callers outside this process - the web UI above all - had to
 * guess from environment variables, which is how a settings page came to show
 * one build's directories while the tools read another's.
 *
 * This module reports the manifest as data: which build is active, where each
 * build's files live, whether those directories are actually present, and which
 * legacy environment variables disagree.
 *
 * @module tools/buildinfo
 */

import * as fs from 'fs';
import { logger } from '../utils/logger';
import { BuildDataPaths, BuildEntry, getActiveBuild, listBuilds } from '../version/BuildManifest';
import {
  DataPathDisagreement,
  findDataPathDisagreements,
} from '../version/DataPathConsistency';

/** One data directory of a build, with whether it exists on this machine. */
export interface BuildDataPathReport {
  /** Which kind of data this path holds, e.g. "db2" or "vmap". */
  kind: keyof BuildDataPaths;
  /** Path as declared in the manifest. */
  path: string;
  /** Whether it exists. A missing path is why a tool returns nothing. */
  exists: boolean;
}

export interface BuildReport {
  id: string;
  build: number;
  product: string;
  expansion: string;
  status: string;
  db2Format: string;
  cacheDir: string;
  /** Opcode table this build uses; may name a different build deliberately. */
  opcodeTable?: string;
  /** True for the build every tool reads unless given an explicit build id. */
  active: boolean;
  dataPaths: BuildDataPathReport[];
  /** Data directories declared by this build that are not present. */
  missingPaths: string[];
}

export interface BuildInfoReport {
  /** Id of the build every tool reads by default. */
  activeBuild: string;
  builds: BuildReport[];
  /**
   * Legacy path variables that name a different directory than the active
   * build. Tools ignore them, but anything reading them directly does not.
   */
  environmentDisagreements: DataPathDisagreement[];
  /** One line summarising the state, suitable for display. */
  summary: string;
}

function pathExists(candidate: string): boolean {
  if (!candidate) {
    return false;
  }
  try {
    return fs.existsSync(candidate);
  } catch {
    return false;
  }
}

function reportBuild(entry: BuildEntry, activeId: string): BuildReport {
  const kinds = Object.keys(entry.dataPaths) as (keyof BuildDataPaths)[];
  const dataPaths = kinds.map((kind) => ({
    kind,
    path: entry.dataPaths[kind],
    exists: pathExists(entry.dataPaths[kind]),
  }));

  return {
    id: entry.id,
    build: entry.build,
    product: entry.product,
    expansion: entry.expansion,
    status: entry.status,
    db2Format: entry.db2Format,
    cacheDir: entry.cacheDir,
    opcodeTable: entry.opcodeTable,
    active: entry.id === activeId,
    dataPaths,
    missingPaths: dataPaths.filter((p) => !p.exists).map((p) => `${p.kind}: ${p.path}`),
  };
}

/**
 * Report the build manifest and how well it matches this machine.
 *
 * @returns Every declared build, which one is active, whether its data
 *   directories exist, and which environment variables disagree with it
 * @throws {Error} If no manifest resolves, which leaves no build to report
 *
 * @example
 * ```typescript
 * const info = getBuildInfo();
 * console.log(info.summary);
 * // "Active build 12.1.0.69497 (69497, Midnight). All 6 data paths present."
 * ```
 */
export function getBuildInfo(): BuildInfoReport {
  const active = getActiveBuild();
  const builds = listBuilds().map((entry) => reportBuild(entry, active.id));
  const environmentDisagreements = findDataPathDisagreements();

  const activeReport = builds.find((b) => b.active);
  const pathCount = activeReport ? activeReport.dataPaths.length : 0;
  const missing = activeReport ? activeReport.missingPaths.length : 0;

  const parts = [
    `Active build ${active.id} (${active.build}, ${active.expansion}).`,
    missing === 0
      ? `All ${pathCount} data paths present.`
      : `${missing} of ${pathCount} data paths missing.`,
  ];
  if (environmentDisagreements.length > 0) {
    parts.push(
      `${environmentDisagreements.length} environment path variable(s) name a different build.`
    );
  }

  const report: BuildInfoReport = {
    activeBuild: active.id,
    builds,
    environmentDisagreements,
    summary: parts.join(' '),
  };

  if (missing > 0 || environmentDisagreements.length > 0) {
    logger.warn(`Build info: ${report.summary}`);
  }

  return report;
}
