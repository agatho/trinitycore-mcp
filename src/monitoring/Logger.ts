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

  public getFilePath(): string {
    return this.filePath;
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
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 10000;

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
    error?: Error,
    traceId?: string
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.context,
      metadata,
      stack: error?.stack,
      pid: this.pid,
      hostname: this.hostname,
      service: 'trinitycore-mcp',
      environment: process.env.NODE_ENV || 'development'
    };

    if (traceId) {
      entry.traceId = traceId;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return entry;
  }

  private write(entry: LogEntry): void {
    if (entry.level < this.minLevel) return;

    // Store in history
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }

    for (const transport of this.transports) {
      try {
        transport.write(entry);
      } catch (error) {
        console.error('Transport write error:', error);
      }
    }

    this.emit('log', entry);
  }

  public trace(message: string, metadata?: any, traceId?: string): void {
    this.write(this.createEntry(LogLevel.TRACE, message, metadata, undefined, traceId));
  }

  public debug(message: string, metadata?: any, traceId?: string): void {
    this.write(this.createEntry(LogLevel.DEBUG, message, metadata, undefined, traceId));
  }

  public info(message: string, metadata?: any, traceId?: string): void {
    this.write(this.createEntry(LogLevel.INFO, message, metadata, undefined, traceId));
  }

  public warn(message: string, metadata?: any, traceId?: string): void {
    this.write(this.createEntry(LogLevel.WARN, message, metadata, undefined, traceId));
  }

  public error(message: string, error?: Error | any, metadata?: any, traceId?: string): void {
    const err = error instanceof Error ? error : undefined;
    const meta = error instanceof Error ? metadata : error;
    this.write(this.createEntry(LogLevel.ERROR, message, meta, err, traceId));
  }

  public fatal(message: string, error?: Error | any, metadata?: any, traceId?: string): void {
    const err = error instanceof Error ? error : undefined;
    const meta = error instanceof Error ? metadata : error;
    this.write(this.createEntry(LogLevel.FATAL, message, meta, err, traceId));
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

  public getCurrentLogFile(): string | null {
    for (const transport of this.transports) {
      if (transport.name === 'file' && transport instanceof FileTransport) {
        return transport.getFilePath();
      }
    }
    return null;
  }

  public async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    let results = [...this.logHistory];

    // Filter by level
    if (query.level) {
      const levelValue = LogLevel[query.level as keyof typeof LogLevel];
      if (levelValue !== undefined) {
        results = results.filter(entry => entry.level === levelValue);
      }
    }

    // Filter by time range
    if (query.startTime) {
      results = results.filter(entry => entry.timestamp >= query.startTime!);
    }
    if (query.endTime) {
      results = results.filter(entry => entry.timestamp <= query.endTime!);
    }

    // Filter by trace ID
    if (query.traceId) {
      results = results.filter(entry => entry.traceId === query.traceId);
    }

    // Sort by timestamp (most recent first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  public performance(
    level: LogLevel,
    name: string,
    duration: number,
    message: string,
    metadata?: any,
    traceId?: string
  ): void {
    const entry = this.createEntry(level, message, metadata, undefined, traceId);
    entry.performance = {
      duration,
      unit: 'ms'
    };
    this.write(entry);
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
