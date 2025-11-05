/**
 * DB2 File Source abstraction for WoW 11.2 (The War Within)
 * Based on TrinityCore's DB2FileSource pattern
 */

import * as fs from 'fs';

/**
 * Abstract file source interface for DB2 reading
 * Allows testability without filesystem dependencies
 */
export interface IDB2FileSource {
  isOpen(): boolean;
  read(buffer: Buffer, numBytes: number): boolean;
  getPosition(): number;
  setPosition(position: number): boolean;
  skip(numBytes: number): boolean;
  getFileSize(): number;
  getFileName(): string;
}

/**
 * Filesystem-based DB2 file source
 * Implements IDB2FileSource for reading from disk
 */
export class DB2FileSystemSource implements IDB2FileSource {
  private fd: number | null = null;
  private filePath: string;
  private position: number = 0;
  private fileSize: number = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.open();
  }

  /**
   * Open file for reading
   * @throws Error if file cannot be opened
   */
  private open(): void {
    if (!fs.existsSync(this.filePath)) {
      throw new Error(`DB2 file not found: ${this.filePath}`);
    }

    const stats = fs.statSync(this.filePath);
    if (!stats.isFile()) {
      throw new Error(`DB2 path is not a file: ${this.filePath}`);
    }

    this.fileSize = stats.size;
    this.fd = fs.openSync(this.filePath, 'r');
    this.position = 0;
  }

  /**
   * Check if file is open
   * @returns True if file descriptor is valid
   */
  public isOpen(): boolean {
    return this.fd !== null;
  }

  /**
   * Read bytes from file into buffer
   * @param buffer Buffer to read into
   * @param numBytes Number of bytes to read
   * @returns True if read successful
   */
  public read(buffer: Buffer, numBytes: number): boolean {
    if (!this.isOpen() || this.fd === null) {
      return false;
    }

    if (this.position + numBytes > this.fileSize) {
      return false;
    }

    try {
      const bytesRead = fs.readSync(this.fd, buffer, 0, numBytes, this.position);
      if (bytesRead !== numBytes) {
        return false;
      }

      this.position += numBytes;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current read position
   * @returns Current position in bytes
   */
  public getPosition(): number {
    return this.position;
  }

  /**
   * Set read position
   * @param position New position in bytes
   * @returns True if position set successfully
   */
  public setPosition(position: number): boolean {
    if (position < 0 || position > this.fileSize) {
      return false;
    }

    this.position = position;
    return true;
  }

  /**
   * Skip bytes (advance position without reading)
   * @param numBytes Number of bytes to skip
   * @returns True if skip successful
   */
  public skip(numBytes: number): boolean {
    const newPosition = this.position + numBytes;
    return this.setPosition(newPosition);
  }

  /**
   * Get total file size
   * @returns File size in bytes
   */
  public getFileSize(): number {
    return this.fileSize;
  }

  /**
   * Get file name
   * @returns File path
   */
  public getFileName(): string {
    return this.filePath;
  }

  /**
   * Close file descriptor
   */
  public close(): void {
    if (this.fd !== null) {
      fs.closeSync(this.fd);
      this.fd = null;
    }
  }

  /**
   * Ensure file is closed on destruction
   */
  public destructor(): void {
    this.close();
  }
}

/**
 * Memory-based DB2 file source for testing
 * Implements IDB2FileSource using in-memory buffer
 */
export class DB2MemorySource implements IDB2FileSource {
  private buffer: Buffer;
  private position: number = 0;
  private fileName: string;

  constructor(buffer: Buffer, fileName: string = 'memory.db2') {
    this.buffer = buffer;
    this.fileName = fileName;
  }

  public isOpen(): boolean {
    return true;
  }

  public read(buffer: Buffer, numBytes: number): boolean {
    if (this.position + numBytes > this.buffer.length) {
      return false;
    }

    this.buffer.copy(buffer, 0, this.position, this.position + numBytes);
    this.position += numBytes;
    return true;
  }

  public getPosition(): number {
    return this.position;
  }

  public setPosition(position: number): boolean {
    if (position < 0 || position > this.buffer.length) {
      return false;
    }

    this.position = position;
    return true;
  }

  public skip(numBytes: number): boolean {
    const newPosition = this.position + numBytes;
    return this.setPosition(newPosition);
  }

  public getFileSize(): number {
    return this.buffer.length;
  }

  public getFileName(): string {
    return this.fileName;
  }
}
