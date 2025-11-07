import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  metadata?: any;
  stack?: string;
  pid?: number;
  hostname?: string;
  traceId?: string;
  service?: string;
  environment?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    unit: string;
  };
}

/**
 * Log query interface
 */
export interface LogQuery {
  level?: string;
  startTime?: Date;
  endTime?: Date;
  traceId?: string;
  limit?: number;
}

/**
 * Log transport interface
 */
export interface LogTransport {
  name: string;
  minLevel: LogLevel;
  write(entry: LogEntry): void | Promise<void>;
  flush?(): void | Promise<void>;
  close?(): void | Promise<void>;
}

/**
 * Console transport
 */
export class ConsoleTransport implements LogTransport {
  public name = 'console';
  public minLevel: LogLevel;
  private colors: boolean;

  constructor(minLevel: LogLevel = LogLevel.INFO, colors: boolean = true) {
    this.minLevel = minLevel;
    this.colors = colors;
  }

  write(entry: LogEntry): void {
    if (entry.level < this.minLevel) return;

    const levelStr = this.formatLevel(entry.level);
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const message = `${timestamp} ${levelStr} ${context} ${entry.message}`;

    if (entry.level >= LogLevel.ERROR) {
      console.error(message);
      if (entry.stack) console.error(entry.stack);
    } else if (entry.level >= LogLevel.WARN) {
      console.warn(message);
    } else {
      console.log(message);
    }

    if (entry.metadata) {
      console.log(util.inspect(entry.metadata, { colors: this.colors, depth: 3 }));
    }
  }

  private formatLevel(level: LogLevel): string {
    const levels = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
    return levels[level];
  }
}

/**
 * File transport
 */
export class FileTransport implements LogTransport {
  public name = 'file';
  public minLevel: LogLevel;
  private filePath: string;
  private stream: fs.WriteStream;
  private buffer: string[] = [];
  private maxBufferSize: number = 100;
  private flushInterval: NodeJS.Timeout;

  constructor(
    filePath: string,
    minLevel: LogLevel = LogLevel.INFO,
    maxBufferSize: number = 100
  ) {
    this.minLevel = minLevel;
    this.filePath = filePath;
    this.maxBufferSize = maxBufferSize;

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.stream = fs.createWriteStream(filePath, { flags: 'a' });
    this.flushInterval = setInterval(() => this.flush(), 5000);
  }

  write(entry: LogEntry): void {
    if (entry.level < this.minLevel) return;

    const line = JSON.stringify(entry) + '\n';
    this.buffer.push(line);

    if (this.buffer.length >= this.maxBufferSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) return;

    const content = this.buffer.join('');
    this.stream.write(content);
    this.buffer = [];
  }

  close(): void {
    clearInterval(this.flushInterval);
    this.flush();
    this.stream.end();
  }
}

/**
 * Enterprise-grade structured logger
 */
export class Logger extends EventEmitter {
  private context?: string;
  private transports: LogTransport[] = [];
  private minLevel: LogLevel = LogLevel.INFO;
  private hostname: string;
  private pid: number;

  constructor(context?: string, minLevel: LogLevel = LogLevel.INFO) {
    super();
    this.context = context;
    this.minLevel = minLevel;
    this.hostname = require('os').hostname();
    this.pid = process.pid;
    this.addTransport(new ConsoleTransport(minLevel));
  }

  public addTransport(transport: LogTransport): void {
    this.transports.push(transport);
    this.emit('transport-added', { name: transport.name });
  }

  public removeTransport(name: string): boolean {
    const index = this.transports.findIndex(t => t.name === name);
    if (index >= 0) {
      const transport = this.transports[index];
      if (transport.close) {
        transport.close();
      }
      this.transports.splice(index, 1);
      this.emit('transport-removed', { name });
      return true;
    }
    return false;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    metadata?: any,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      metadata,
      stack: error?.stack,
      pid: this.pid,
      hostname: this.hostname
    };
  }

  private write(entry: LogEntry): void {
    if (entry.level < this.minLevel) return;

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        console.error('Transport write error:', error);
      }
    }

    this.emit('log', entry);
  }

  public trace(message: string, metadata?: any): void {
    this.write(this.createEntry(LogLevel.TRACE, message, metadata));
  }

  public debug(message: string, metadata?: any): void {
    this.write(this.createEntry(LogLevel.DEBUG, message, metadata));
  }

  public info(message: string, metadata?: any): void {
    this.write(this.createEntry(LogLevel.INFO, message, metadata));
  }

  public warn(message: string, metadata?: any): void {
    this.write(this.createEntry(LogLevel.WARN, message, metadata));
  }

  public error(message: string, error?: Error | any, metadata?: any): void {
    const err = error instanceof Error ? error : undefined;
    const meta = error instanceof Error ? metadata : error;
    this.write(this.createEntry(LogLevel.ERROR, message, meta, err));
  }

  public fatal(message: string, error?: Error | any, metadata?: any): void {
    const err = error instanceof Error ? error : undefined;
    const meta = error instanceof Error ? metadata : error;
    this.write(this.createEntry(LogLevel.FATAL, message, meta, err));
  }

  public child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context;
    const child = new Logger(childContext, this.minLevel);
    child.transports = this.transports;
    return child;
  }

  public setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  public getLevel(): LogLevel {
    return this.minLevel;
  }

  public async flush(): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const transport of this.transports) {
      if (transport.flush) {
        const result = transport.flush();
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }
    await Promise.all(promises);
  }

  public async close(): Promise<void> {
    await this.flush();
    const promises: Promise<void>[] = [];
    for (const transport of this.transports) {
      if (transport.close) {
        const result = transport.close();
        if (result instanceof Promise) {
          promises.push(result);
        }
      }
    }
    await Promise.all(promises);
    this.transports = [];
    this.emit('closed');
  }

  /**
   * Get current log file path (if FileTransport is configured)
   */
  public getCurrentLogFile(): string | null {
    const fileTransport = this.transports.find(t => t.name === 'file') as FileTransport | undefined;
    return fileTransport ? (fileTransport as any).filePath : null;
  }

  /**
   * Query logs from file (if FileTransport is configured)
   */
  public async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    const logFile = this.getCurrentLogFile();
    if (!logFile) {
      return [];
    }

    try {
      // Read log file
      const content = await fs.promises.readFile(logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // Parse and filter logs
      let logs: LogEntry[] = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;

          // Convert timestamp string to Date if needed
          if (typeof entry.timestamp === 'string') {
            entry.timestamp = new Date(entry.timestamp);
          }

          // Apply filters
          if (query.level && entry.level !== LogLevel[query.level as keyof typeof LogLevel]) {
            continue;
          }

          if (query.startTime && entry.timestamp < query.startTime) {
            continue;
          }

          if (query.endTime && entry.timestamp > query.endTime) {
            continue;
          }

          if (query.traceId && entry.traceId !== query.traceId) {
            continue;
          }

          logs.push(entry);
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }

      // Apply limit
      if (query.limit && query.limit > 0) {
        logs = logs.slice(-query.limit);
      }

      return logs;
    } catch (error) {
      console.error('Error reading log file:', error);
      return [];
    }
  }
}

let globalLogger: Logger | null = null;

export function getLogger(context?: string, minLevel?: LogLevel): Logger {
  if (!globalLogger) {
    globalLogger = new Logger(undefined, minLevel);
  }
  if (context) {
    return globalLogger.child(context);
  }
  return globalLogger;
}

export function setLogger(logger: Logger): void {
  globalLogger = logger;
}
