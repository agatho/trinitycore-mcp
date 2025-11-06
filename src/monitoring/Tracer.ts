import { EventEmitter } from 'events';
import * as crypto from 'crypto';

export enum SpanStatus {
  OK = 'ok',
  ERROR = 'error',
  UNSET = 'unset'
}

export enum SpanKind {
  INTERNAL = 'internal',
  SERVER = 'server',
  CLIENT = 'client',
  PRODUCER = 'producer',
  CONSUMER = 'consumer'
}

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
}

export interface SpanData {
  context: SpanContext;
  name: string;
  kind: SpanKind;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: SpanStatus;
  attributes: Record<string, any>;
  events: Array<{ name: string; timestamp: Date; attributes?: Record<string, any> }>;
}

export class Span {
  private data: SpanData;
  private tracer: Tracer;
  private ended: boolean = false;

  constructor(tracer: Tracer, name: string, context: SpanContext, kind: SpanKind = SpanKind.INTERNAL) {
    this.tracer = tracer;
    this.data = {
      context,
      name,
      kind,
      startTime: new Date(),
      status: SpanStatus.UNSET,
      attributes: {},
      events: []
    };
  }

  setAttribute(key: string, value: any): this {
    this.data.attributes[key] = value;
    return this;
  }

  addEvent(name: string, attributes?: Record<string, any>): this {
    this.data.events.push({ name, timestamp: new Date(), attributes });
    return this;
  }

  setStatus(status: SpanStatus): this {
    this.data.status = status;
    return this;
  }

  recordException(error: Error): this {
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack || ''
    });
    this.setStatus(SpanStatus.ERROR);
    return this;
  }

  getContext(): SpanContext {
    return this.data.context;
  }

  getData(): SpanData {
    return { ...this.data };
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.data.endTime = new Date();
    this.data.duration = this.data.endTime.getTime() - this.data.startTime.getTime();
    if (this.data.status === SpanStatus.UNSET) {
      this.data.status = SpanStatus.OK;
    }
    this.tracer.endSpan(this);
  }
}

export class Tracer extends EventEmitter {
  private serviceName: string;
  private activeSpans: Map<string, Span> = new Map();
  private completedSpans: SpanData[] = [];

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
  }

  private generateTraceId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateSpanId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  startSpan(name: string, options?: { kind?: SpanKind; parent?: SpanContext }): Span {
    const context: SpanContext = {
      traceId: options?.parent?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: options?.parent?.spanId,
      traceFlags: 1
    };

    const span = new Span(this, name, context, options?.kind);
    span.setAttribute('service.name', this.serviceName);
    this.activeSpans.set(context.spanId, span);
    return span;
  }

  endSpan(span: Span): void {
    const context = span.getContext();
    this.activeSpans.delete(context.spanId);
    this.completedSpans.push(span.getData());
    this.emit('span-ended', { span });
  }

  async trace<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.startSpan(name);
    try {
      const result = await fn(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  shutdown(): void {
    this.activeSpans.clear();
    this.completedSpans = [];
  }
}

let globalTracer: Tracer | null = null;

export function getTracer(serviceName?: string): Tracer {
  if (!globalTracer) {
    globalTracer = new Tracer(serviceName || 'trinitycore-mcp');
  }
  return globalTracer;
}
