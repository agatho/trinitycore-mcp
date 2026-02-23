/**
 * CASCLib Native Addon TypeScript Wrapper
 *
 * Provides TypeScript bindings for the CascLib C++ native addon
 * Enables FileDataID-based file extraction from CASC storages
 */

import path from 'path';

/**
 * Native CASCStorage class from the C++ addon
 */
interface NativeCASCStorage {
  /**
   * Extract file by FileDataID
   * @param fileDataId - FileDataID to extract
   * @returns Buffer containing file data
   * @throws Error if FileDataID not found or extraction fails
   */
  extractFileByID(fileDataId: number): Buffer;

  /**
   * Close CASC storage
   */
  close(): void;

  /**
   * Check if storage is open
   * @returns true if storage is open
   */
  isOpen(): boolean;
}

/**
 * Native module interface
 */
interface CASCNativeModule {
  /**
   * CASCStorage constructor
   * @param wowPath - Path to WoW installation
   * @param localeMask - Locale mask (optional, default: CASC_LOCALE_ALL_WOW)
   */
  CASCStorage: new (wowPath: string, localeMask?: number) => NativeCASCStorage;
}

// Load the native addon
let nativeAddon: CASCNativeModule;

try {
  // Path to the compiled native addon
  const addonPath = path.join(__dirname, '../../build/Release/casc_native.node');
  nativeAddon = require(addonPath);
} catch (error) {
  throw new Error(
    `Failed to load CASC native addon: ${error instanceof Error ? error.message : String(error)}\n` +
    `Make sure to build the native addon first: npx node-gyp rebuild`
  );
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
  private nativeStorage: NativeCASCStorage;

  /**
   * Create a new CASC storage instance
   *
   * @param wowPath - Path to WoW installation directory
   * @param localeMask - Locale mask (default: all WoW locales)
   */
  constructor(wowPath: string, localeMask: number = CASC_LOCALE.ALL_WOW) {
    try {
      this.nativeStorage = new nativeAddon.CASCStorage(wowPath, localeMask);
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
    if (!this.isOpen()) {
      throw new Error('CASC storage is not open');
    }

    if (typeof fileDataId !== 'number' || fileDataId <= 0) {
      throw new Error(`Invalid FileDataID: ${fileDataId}`);
    }

    try {
      // The native method is synchronous, but we wrap in async for consistency
      const buffer = this.nativeStorage.extractFileByID(fileDataId);
      return buffer;
    } catch (error) {
      throw new Error(
        `Failed to extract FileDataID ${fileDataId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Close CASC storage
   *
   * Releases all resources associated with this storage.
   * After calling close(), this storage instance cannot be used anymore.
   */
  close(): void {
    if (this.nativeStorage) {
      this.nativeStorage.close();
    }
  }

  /**
   * Check if storage is open
   *
   * @returns true if storage is open and ready for use
   */
  isOpen(): boolean {
    return this.nativeStorage && this.nativeStorage.isOpen();
  }
}

/**
 * Create a CASC storage instance
 *
 * Convenience function for creating CASCStorage instances
 *
 * @param wowPath - Path to WoW installation directory
 * @param localeMask - Locale mask (default: all WoW locales)
 * @returns CASCStorage instance
 */
export function createCASCStorage(
  wowPath: string,
  localeMask: number = CASC_LOCALE.ALL_WOW
): CASCStorage {
  return new CASCStorage(wowPath, localeMask);
}
