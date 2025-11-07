/**
 * RequestTracer.ts
 *
 * Request tracing system for TrinityCore MCP Server
 * Provides distributed tracing with trace IDs and spans
 *
 * Features:
 * - Trace ID generation and propagation
 * - Span creation and timing
 * - Parent-child span relationships
 * - Request context tracking
 * - Performance profiling
 *
 * @module monitoring/RequestTracer
 */

import { randomUUID } from 'crypto';
import { getLogger, LogLevel } from './Logger';
import { getMetricsExporter } from './MetricsExporter';

/**
 * Span interface
 */
export interface Span {
    spanId: string;
    traceId: string;
    parentSpanId?: string;
    name: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: Map<string, string | number | boolean>;
    logs: SpanLog[];
    status: 'pending' | 'success' | 'error';
    error?: Error;
}

/**
 * Span log entry
 */
export interface SpanLog {
    timestamp: number;
    message: string;
    level: 'debug' | 'info' | 'warn' | 'error';
    fields?: any;
}

/**
 * Trace context
 */
export interface TraceContext {
    traceId: string;
    spanId: string;
    parentSpanId?: string;
    baggage: Map<string, string>;
}

/**
 * RequestTracer class
 * Manages distributed tracing for MCP server requests
 */
export class RequestTracer {
    private activeSpans: Map<string, Span> = new Map();
    private completedSpans: Span[] = [];
    private maxCompletedSpans: number = 1000;

    constructor() {
        // Cleanup old completed spans periodically
        setInterval(() => {
            this.cleanupCompletedSpans();
        }, 60000); // Every minute
    }

    /**
     * Generate a new trace ID
     */
    public generateTraceId(): string {
        return randomUUID().replace(/-/g, '');
    }

    /**
     * Generate a new span ID
     */
    public generateSpanId(): string {
        return randomUUID().replace(/-/g, '').substring(0, 16);
    }

    /**
     * Start a new trace
     */
    public startTrace(name: string): Span {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();

        const span: Span = {
            spanId,
            traceId,
            name,
            startTime: Date.now(),
            tags: new Map(),
            logs: [],
            status: 'pending',
        };

        this.activeSpans.set(spanId, span);

        // Log trace start
        const logger = getLogger();
        logger.debug(`Trace started: ${name}`, { traceId, spanId });

        return span;
    }

    /**
     * Start a child span
     */
    public startSpan(name: string, parentSpan: Span): Span {
        const spanId = this.generateSpanId();

        const span: Span = {
            spanId,
            traceId: parentSpan.traceId,
            parentSpanId: parentSpan.spanId,
            name,
            startTime: Date.now(),
            tags: new Map(),
            logs: [],
            status: 'pending',
        };

        this.activeSpans.set(spanId, span);

        // Add log to parent span
        parentSpan.logs.push({
            timestamp: Date.now(),
            message: `Child span started: ${name}`,
            level: 'debug',
        });

        return span;
    }

    /**
     * End a span
     */
    public endSpan(span: Span, success: boolean = true, error?: Error): void {
        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = success ? 'success' : 'error';

        if (error) {
            span.error = error;
            this.logToSpan(span, 'error', `Span failed: ${error.message}`, { error: error.stack });
        }

        // Remove from active spans
        this.activeSpans.delete(span.spanId);

        // Add to completed spans
        this.completedSpans.push(span);

        // Log span completion
        const logger = getLogger();
        const metadata = {
            spanId: span.spanId,
            status: span.status,
            duration: span.duration,
            tags: Object.fromEntries(span.tags),
        };
        if (success) {
            logger.debug(`Span completed: ${span.name}`, metadata);
        } else {
            logger.error(`Span failed: ${span.name}`, metadata);
        }

        // Record metrics
        try {
            const metrics = getMetricsExporter();
            metrics.recordMcpToolInvocation(
                span.name,
                span.duration / 1000, // Convert to seconds
                success,
                error?.name
            );
        } catch (e) {
            // Ignore metrics errors
        }
    }

    /**
     * Add a tag to a span
     */
    public setTag(span: Span, key: string, value: string | number | boolean): void {
        span.tags.set(key, value);
    }

    /**
     * Add multiple tags to a span
     */
    public setTags(span: Span, tags: { [key: string]: string | number | boolean }): void {
        for (const [key, value] of Object.entries(tags)) {
            span.tags.set(key, value);
        }
    }

    /**
     * Log to a span
     */
    public logToSpan(
        span: Span,
        level: 'debug' | 'info' | 'warn' | 'error',
        message: string,
        fields?: any
    ): void {
        span.logs.push({
            timestamp: Date.now(),
            message,
            level,
            fields,
        });
    }

    /**
     * Get active span by ID
     */
    public getSpan(spanId: string): Span | undefined {
        return this.activeSpans.get(spanId);
    }

    /**
     * Get trace context from span
     */
    public getTraceContext(span: Span): TraceContext {
        return {
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId,
            baggage: new Map(),
        };
    }

    /**
     * Extract trace context from headers
     */
    public extractContext(headers: { [key: string]: string }): TraceContext | null {
        const traceId = headers['x-trace-id'];
        const spanId = headers['x-span-id'];
        const parentSpanId = headers['x-parent-span-id'];

        if (!traceId || !spanId) {
            return null;
        }

        return {
            traceId,
            spanId,
            parentSpanId,
            baggage: new Map(),
        };
    }

    /**
     * Inject trace context into headers
     */
    public injectContext(context: TraceContext): { [key: string]: string } {
        const headers: { [key: string]: string } = {
            'x-trace-id': context.traceId,
            'x-span-id': context.spanId,
        };

        if (context.parentSpanId) {
            headers['x-parent-span-id'] = context.parentSpanId;
        }

        return headers;
    }

    /**
     * Get all spans for a trace
     */
    public getTraceSpans(traceId: string): Span[] {
        const activeTraceSpans = Array.from(this.activeSpans.values()).filter(
            span => span.traceId === traceId
        );
        const completedTraceSpans = this.completedSpans.filter(span => span.traceId === traceId);

        return [...activeTraceSpans, ...completedTraceSpans];
    }

    /**
     * Get trace summary
     */
    public getTraceSummary(traceId: string): any {
        const spans = this.getTraceSpans(traceId);

        if (spans.length === 0) {
            return null;
        }

        const rootSpan = spans.find(s => !s.parentSpanId);
        const totalDuration = rootSpan?.duration || 0;
        const spanCount = spans.length;
        const errorCount = spans.filter(s => s.status === 'error').length;
        const pendingCount = spans.filter(s => s.status === 'pending').length;

        return {
            traceId,
            rootSpan: rootSpan?.name,
            totalDuration,
            spanCount,
            errorCount,
            pendingCount,
            status: errorCount > 0 ? 'error' : pendingCount > 0 ? 'pending' : 'success',
            spans: spans.map(s => ({
                spanId: s.spanId,
                parentSpanId: s.parentSpanId,
                name: s.name,
                duration: s.duration,
                status: s.status,
                tags: Object.fromEntries(s.tags),
            })),
        };
    }

    /**
     * Cleanup old completed spans
     */
    private cleanupCompletedSpans(): void {
        if (this.completedSpans.length > this.maxCompletedSpans) {
            this.completedSpans = this.completedSpans.slice(-this.maxCompletedSpans);
        }
    }

    /**
     * Get statistics
     */
    public getStatistics(): any {
        return {
            activeSpans: this.activeSpans.size,
            completedSpans: this.completedSpans.length,
            totalSpans: this.activeSpans.size + this.completedSpans.length,
        };
    }

    /**
     * Clear all traces (for testing)
     */
    public clear(): void {
        this.activeSpans.clear();
        this.completedSpans = [];
    }
}

/**
 * Trace decorator for async functions
 */
export function Trace(name?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const traceName = name || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            const tracer = getRequestTracer();
            const span = tracer.startTrace(traceName);

            try {
                const result = await originalMethod.apply(this, args);
                tracer.endSpan(span, true);
                return result;
            } catch (error) {
                tracer.endSpan(span, false, error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        };

        return descriptor;
    };
}

/**
 * Span decorator for async functions (requires parent span in first argument)
 */
export function ChildSpan(name?: string) {
    return function (
        target: any,
        propertyKey: string,
        descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        const spanName = name || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (parentSpan: Span, ...args: any[]) {
            const tracer = getRequestTracer();
            const span = tracer.startSpan(spanName, parentSpan);

            try {
                const result = await originalMethod.apply(this, [parentSpan, ...args]);
                tracer.endSpan(span, true);
                return result;
            } catch (error) {
                tracer.endSpan(span, false, error instanceof Error ? error : new Error(String(error)));
                throw error;
            }
        };

        return descriptor;
    };
}

// Singleton instance
let requestTracer: RequestTracer | null = null;

/**
 * Get or create the singleton RequestTracer instance
 */
export function getRequestTracer(): RequestTracer {
    if (!requestTracer) {
        requestTracer = new RequestTracer();
    }
    return requestTracer;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRequestTracer(): void {
    if (requestTracer) {
        requestTracer.clear();
    }
    requestTracer = null;
}
