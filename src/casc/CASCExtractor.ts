/**
 * CASC File Extractor - Node.js wrapper
 *
 * Provides FileDataID extraction using either:
 * 1. Our custom C++ tool (when built)
 * 2. Fallback to TypeScript implementation
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface CASCExtractorOptions {
  wowPath: string;
  cascToolPath?: string;  // Path to casc-extractor.exe if available
}

export class CASCExtractor {
  private options: CASCExtractorOptions;

  constructor(options: CASCExtractorOptions) {
    this.options = options;
  }

  /**
   * Extract a file by FileDataID
   */
  async extractFileByID(fileDataId: number, outputPath: string): Promise<void> {
    // Check if C++ tool is available
    const cascTool = this.options.cascToolPath ||
      path.join(__dirname, '../../tools/bin/casc-extractor.exe');

    if (fs.existsSync(cascTool)) {
      return this.extractUsingCppTool(cascTool, fileDataId, outputPath);
    } else {
      throw new Error('CASC C++ extractor not yet built. Run tools/casc-extractor/compile.bat to build it.');
    }
  }

  /**
   * Extract using C++ tool
   */
  private async extractUsingCppTool(
    toolPath: string,
    fileDataId: number,
    outputPath: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [this.options.wowPath, fileDataId.toString(), outputPath];

      console.log(`[CASCExtractor] Running: ${toolPath} ${args.join(' ')}`);

      const proc = spawn(toolPath, args);

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log(data.toString().trim());
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error(data.toString().trim());
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`CASC extractor failed with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn CASC extractor: ${err.message}`));
      });
    });
  }
}

/**
 * Quick helper function for one-off extractions
 */
export async function extractCASCFile(
  wowPath: string,
  fileDataId: number,
  outputPath: string
): Promise<void> {
  const extractor = new CASCExtractor({ wowPath });
  await extractor.extractFileByID(fileDataId, outputPath);
}
