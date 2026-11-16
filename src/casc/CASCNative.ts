/**
 * CASCLib Native Addon TypeScript Wrapper
 *
 * Provides TypeScript bindings for the CascLib C++ native addon.
 * The addon is optional: if it fails to load, the server still starts and
 * CASC-dependent calls fail with a clear error instead of crashing startup.
 */

import path from 'path';

/**
 * Native CASCStorage class from the C++ addon
 */
interface NativeCASCStorage {
  extractFileByID(fileDataId: number): Buffer;
  close(): void;
  isOpen(): boolean;
}

/**
 * Native module interface
 */
interface CASCNativeModule {
  CASCStorage: new (wowPath: string, localeMask?: number) => NativeCASCStorage;
}

// Load the native addon without crashing startup if it is missing.
let nativeAddon: CASCNativeModule | null = null;
let nativeLoadError: string | null = null;

try {
  const addonPath = path.join(__dirname, '../../build/Release/casc_native.node');
  nativeAddon = require(addonPath) as CASCNativeModule;
} catch (error) {
  nativeLoadError = error instanceof Error ? error.message : String(error);
  // stderr only: stdout is the MCP JSON-RPC channel.
  process.stderr.write(`[CASC] native addon unavailable: ${nativeLoadError}\n`);
}

/** True when the native CASC addon loaded successfully. */
export function isCASCNativeAvailable(): boolean {
  return nativeAddon !== null;
}

/** Returns the addon, or throws a clear error if it is not available. */
function requireCASCNative(): CASCNativeModule {
  if (!nativeAddon) {
    throw new Error(
      `CASC native addon is not available: ${nativeLoadError}\n` +
      'Build it with: npx node-gyp rebuild (requires dep/CascLib and dep/zlib)'
    );
  }
  return nativeAddon;
}

/**
 * Locale mask constants
 */
export const CASC_LOCALE = {
  ALL: 0xFFFFFFFF,
  ALL_WOW: 0x0001F3F6,  // All except enCN and enTW
  ENUS: 0x00000002,
  KOKR: 0x00000004,
  FRFR: 0x00000010,
  DEDE: 0x00000020,
  ZHCN: 0x00000040,
  ESES: 0x00000080,
  ZHTW: 0x00000100,
  ENGB: 0x00000200,
  ENCN: 0x00000400,
  ENTW: 0x00000800,
  ESMX: 0x00001000,
  RURU: 0x00002000,
  PTBR: 0x00004000,
  ITIT: 0x00008000,
  PTPT: 0x00010000
} as const;

/**
 * CASCStorage wrapper class
 *
 * High-level TypeScript wrapper around the native C++ CASCStorage
 */
export class CASCStorage {
  private nativeStorage: NativeCASCStorage | null = null;

  /**
   * Create a new CASC storage instance
   *
   * @param wowPath - Path to WoW installation directory
   * @param localeMask - Locale mask (default: all WoW locales)
   */
  constructor(wowPath: string, localeMask: number = CASC_LOCALE.ALL_WOW) {
    const addon = requireCASCNative();
    try {
      this.nativeStorage = new addon.CASCStorage(wowPath, localeMask);
    } catch (error) {
      throw new Error(
        `Failed to open CASC storage at "${wowPath}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Extract file by FileDataID
   *
   * @param fileDataId - FileDataID to extract
   * @returns Promise resolving to Buffer containing file data
   * @throws Error if FileDataID not found or extraction fails
   */
  async extractFileByID(fileDataId: number): Promise<Buffer> {
    if (!this.isOpen() || !this.nativeStorage) {
      throw new Error('CASC storage is not open');
    }

    if (typeof fileDataId !== 'number' || fileDataId <= 0) {
      throw new Error(`Invalid FileDataID: ${fileDataId}`);
    }

    try {
      return this.nativeStorage.extractFileByID(fileDataId);
    } catch (error) {
      throw new Error(
        `Failed to extract FileDataID ${fileDataId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Close CASC storage. The instance cannot be used afterwards.
   */
  close(): void {
    if (this.nativeStorage) {
      this.nativeStorage.close();
      this.nativeStorage = null;
    }
  }

  /**
   * Check if storage is open and ready for use
   */
  isOpen(): boolean {
    return this.nativeStorage !== null && this.nativeStorage.isOpen();
  }
}

/**
 * Create a CASC storage instance
 */
export function createCASCStorage(
  wowPath: string,
  localeMask: number = CASC_LOCALE.ALL_WOW
): CASCStorage {
  return new CASCStorage(wowPath, localeMask);
}