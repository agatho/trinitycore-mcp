/**
 * MetricsExporter.ts
 *
 * Prometheus metrics exporter for TrinityCore MCP Server
 * Collects and exposes application, system, and business metrics
 *
 * Features:
 * - Counter, Gauge, Histogram, and Summary metrics
 * - Custom MCP tool usage metrics
 * - Request/response metrics with labels
 * - System resource metrics (CPU, memory, network)
 * - Database connection pool metrics
 * - Automatic metric registration
 *
 * @module monitoring/MetricsExporter
 */

import { Registry, Counter, Gauge, Histogram, Summary, collectDefaultMetrics } from 'prom-client';

/**
 * MetricsExporter class
 * Manages Prometheus metrics collection and exposition
 */
export class MetricsExporter {
    private registry: Registry;
    private prefix: string;

    // HTTP Request Metrics
    public httpRequestsTotal: Counter;
    public httpRequestDuration: Histogram;
    public httpRequestSize: Summary;
    public httpResponseSize: Summary;
    public httpErrorsTotal: Counter;

    // MCP Tool Metrics
    public mcpToolInvocations: Counter;
    public mcpToolDuration: Histogram;
    public mcpToolErrors: Counter;
    public mcpToolCacheHits: Counter;
    public mcpToolCacheMisses: Counter;

    // System Metrics
    public activeConnections: Gauge;
    public requestQueueDepth: Gauge;
    public memoryUsage: Gauge;
    public cpuUsage: Gauge;
    public eventLoopLag: Histogram;

    // Database Metrics
    public dbQueryDuration: Histogram;
    public dbConnectionPoolSize: Gauge;
    public dbConnectionPoolActive: Gauge;
    public dbConnectionPoolIdle: Gauge;
    public dbQueryErrors: Counter;

    // Cache Metrics
    public cacheOperations: Counter;
    public cacheHitRate: Gauge;
    public cacheSize: Gauge;
    public cacheMemoryUsage: Gauge;

    // Business Metrics
    public spellLookupsTotal: Counter;
    public creatureLookupsTotal: Counter;
    public questLookupsTotal: Counter;
    public apiDocumentationRequests: Counter;

    constructor(prefix: string = 'trinitycore_mcp') {
        this.prefix = prefix;
        this.registry = new Registry();

        // Enable default metrics (CPU, memory, event loop, GC)
        collectDefaultMetrics({
            register: this.registry,
            prefix: this.prefix + '_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        });

        // Initialize HTTP metrics
        this.httpRequestsTotal = new Counter({
            name: `${this.prefix}_http_requests_total`,
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'path', 'status_code'],
            registers: [this.registry],
        });

        this.httpRequestDuration = new Histogram({
            name: `${this.prefix}_http_request_duration_seconds`,
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'path', 'status_code'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [this.registry],
        });

        this.httpRequestSize = new Summary({
            name: `${this.prefix}_http_request_size_bytes`,
            help: 'HTTP request size in bytes',
            labelNames: ['method', 'path'],
            percentiles: [0.5, 0.9, 0.95, 0.99],
            registers: [this.registry],
        });

        this.httpResponseSize = new Summary({
            name: `${this.prefix}_http_response_size_bytes`,
            help: 'HTTP response size in bytes',
            labelNames: ['method', 'path'],
            percentiles: [0.5, 0.9, 0.95, 0.99],
            registers: [this.registry],
        });

        this.httpErrorsTotal = new Counter({
            name: `${this.prefix}_http_errors_total`,
            help: 'Total number of HTTP errors',
            labelNames: ['method', 'path', 'error_type'],
            registers: [this.registry],
        });

        // Initialize MCP tool metrics
        this.mcpToolInvocations = new Counter({
            name: `${this.prefix}_mcp_tool_invocations_total`,
            help: 'Total number of MCP tool invocations',
            labelNames: ['tool_name', 'status'],
            registers: [this.registry],
        });

        this.mcpToolDuration = new Histogram({
            name: `${this.prefix}_mcp_tool_duration_seconds`,
            help: 'MCP tool execution duration in seconds',
            labelNames: ['tool_name'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10, 30],
            registers: [this.registry],
        });

        this.mcpToolErrors = new Counter({
            name: `${this.prefix}_mcp_tool_errors_total`,
            help: 'Total number of MCP tool errors',
            labelNames: ['tool_name', 'error_type'],
            registers: [this.registry],
        });

        this.mcpToolCacheHits = new Counter({
            name: `${this.prefix}_mcp_tool_cache_hits_total`,
            help: 'Total number of MCP tool cache hits',
            labelNames: ['tool_name'],
            registers: [this.registry],
        });

        this.mcpToolCacheMisses = new Counter({
            name: `${this.prefix}_mcp_tool_cache_misses_total`,
            help: 'Total number of MCP tool cache misses',
            labelNames: ['tool_name'],
            registers: [this.registry],
        });

        // Initialize system metrics
        this.activeConnections = new Gauge({
            name: `${this.prefix}_active_connections`,
            help: 'Number of active client connections',
            registers: [this.registry],
        });

        this.requestQueueDepth = new Gauge({
            name: `${this.prefix}_request_queue_depth`,
            help: 'Current depth of the request queue',
            registers: [this.registry],
        });

        this.memoryUsage = new Gauge({
            name: `${this.prefix}_memory_usage_bytes`,
            help: 'Memory usage in bytes',
            labelNames: ['type'],
            registers: [this.registry],
        });

        this.cpuUsage = new Gauge({
            name: `${this.prefix}_cpu_usage_percent`,
            help: 'CPU usage percentage',
            registers: [this.registry],
        });

        this.eventLoopLag = new Histogram({
            name: `${this.prefix}_event_loop_lag_seconds`,
            help: 'Event loop lag in seconds',
            buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.registry],
        });

        // Initialize database metrics
        this.dbQueryDuration = new Histogram({
            name: `${this.prefix}_db_query_duration_seconds`,
            help: 'Database query duration in seconds',
            labelNames: ['operation', 'table'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.registry],
        });

        this.dbConnectionPoolSize = new Gauge({
            name: `${this.prefix}_db_connection_pool_size`,
            help: 'Database connection pool size',
            registers: [this.registry],
        });

        this.dbConnectionPoolActive = new Gauge({
            name: `${this.prefix}_db_connection_pool_active`,
            help: 'Active database connections in pool',
            registers: [this.registry],
        });

        this.dbConnectionPoolIdle = new Gauge({
            name: `${this.prefix}_db_connection_pool_idle`,
            help: 'Idle database connections in pool',
            registers: [this.registry],
        });

        this.dbQueryErrors = new Counter({
            name: `${this.prefix}_db_query_errors_total`,
            help: 'Total number of database query errors',
            labelNames: ['operation', 'error_type'],
            registers: [this.registry],
        });

        // Initialize cache metrics
        this.cacheOperations = new Counter({
            name: `${this.prefix}_cache_operations_total`,
            help: 'Total number of cache operations',
            labelNames: ['operation', 'result'],
            registers: [this.registry],
        });

        this.cacheHitRate = new Gauge({
            name: `${this.prefix}_cache_hit_rate`,
            help: 'Cache hit rate (0-1)',
            registers: [this.registry],
        });

        this.cacheSize = new Gauge({
            name: `${this.prefix}_cache_size_entries`,
            help: 'Number of entries in cache',
            labelNames: ['cache_name'],
            registers: [this.registry],
        });

        this.cacheMemoryUsage = new Gauge({
            name: `${this.prefix}_cache_memory_usage_bytes`,
            help: 'Cache memory usage in bytes',
            labelNames: ['cache_name'],
            registers: [this.registry],
        });

        // Initialize business metrics
        this.spellLookupsTotal = new Counter({
            name: `${this.prefix}_spell_lookups_total`,
            help: 'Total number of spell lookups',
            labelNames: ['source'],
            registers: [this.registry],
        });

        this.creatureLookupsTotal = new Counter({
            name: `${this.prefix}_creature_lookups_total`,
            help: 'Total number of creature lookups',
            labelNames: ['source'],
            registers: [this.registry],
        });

        this.questLookupsTotal = new Counter({
            name: `${this.prefix}_quest_lookups_total`,
            help: 'Total number of quest lookups',
            labelNames: ['source'],
            registers: [this.registry],
        });

        this.apiDocumentationRequests = new Counter({
            name: `${this.prefix}_api_documentation_requests_total`,
            help: 'Total number of API documentation requests',
            labelNames: ['class_name', 'has_method'],
            registers: [this.registry],
        });

        // Start periodic system metrics collection
        this.startSystemMetricsCollection();
    }

    /**
     * Start collecting system metrics periodically
     */
    private startSystemMetricsCollection(): void {
        // Collect memory metrics every 5 seconds
        setInterval(() => {
            const usage = process.memoryUsage();
            this.memoryUsage.set({ type: 'rss' }, usage.rss);
            this.memoryUsage.set({ type: 'heapTotal' }, usage.heapTotal);
            this.memoryUsage.set({ type: 'heapUsed' }, usage.heapUsed);
            this.memoryUsage.set({ type: 'external' }, usage.external);
        }, 5000);

        // Collect CPU metrics every 5 seconds
        let lastCpuUsage = process.cpuUsage();
        setInterval(() => {
            const currentCpuUsage = process.cpuUsage(lastCpuUsage);
            const totalUsage = (currentCpuUsage.user + currentCpuUsage.system) / 1000000; // Convert to seconds
            const cpuPercent = (totalUsage / 5) * 100; // 5 second interval
            this.cpuUsage.set(Math.min(cpuPercent, 100));
            lastCpuUsage = process.cpuUsage();
        }, 5000);

        // Collect event loop lag every second
        let lastCheck = Date.now();
        setInterval(() => {
            const now = Date.now();
            const lag = (now - lastCheck - 1000) / 1000; // Expected 1 second, actual lag in seconds
            if (lag > 0) {
                this.eventLoopLag.observe(lag);
            }
            lastCheck = now;
        }, 1000);
    }

    /**
     * Record HTTP request
     */
    public recordHttpRequest(
        method: string,
        path: string,
        statusCode: number,
        duration: number,
        requestSize?: number,
        responseSize?: number
    ): void {
        this.httpRequestsTotal.inc({ method, path, status_code: statusCode });
        this.httpRequestDuration.observe({ method, path, status_code: statusCode }, duration);

        if (requestSize !== undefined) {
            this.httpRequestSize.observe({ method, path }, requestSize);
        }

        if (responseSize !== undefined) {
            this.httpResponseSize.observe({ method, path }, responseSize);
        }
    }

    /**
     * Record HTTP error
     */
    public recordHttpError(method: string, path: string, errorType: string): void {
        this.httpErrorsTotal.inc({ method, path, error_type: errorType });
    }

    /**
     * Record MCP tool invocation
     */
    public recordMcpToolInvocation(toolName: string, duration: number, success: boolean, error?: string): void {
        this.mcpToolInvocations.inc({ tool_name: toolName, status: success ? 'success' : 'error' });
        this.mcpToolDuration.observe({ tool_name: toolName }, duration);

        if (!success && error) {
            this.mcpToolErrors.inc({ tool_name: toolName, error_type: error });
        }
    }

    /**
     * Record cache hit or miss
     */
    public recordCacheAccess(toolName: string, hit: boolean): void {
        if (hit) {
            this.mcpToolCacheHits.inc({ tool_name: toolName });
        } else {
            this.mcpToolCacheMisses.inc({ tool_name: toolName });
        }
    }

    /**
     * Update active connections count
     */
    public setActiveConnections(count: number): void {
        this.activeConnections.set(count);
    }

    /**
     * Update request queue depth
     */
    public setRequestQueueDepth(depth: number): void {
        this.requestQueueDepth.set(depth);
    }

    /**
     * Record database query
     */
    public recordDbQuery(operation: string, table: string, duration: number, error?: string): void {
        this.dbQueryDuration.observe({ operation, table }, duration);

        if (error) {
            this.dbQueryErrors.inc({ operation, error_type: error });
        }
    }

    /**
     * Update database connection pool metrics
     */
    public updateDbConnectionPool(total: number, active: number, idle: number): void {
        this.dbConnectionPoolSize.set(total);
        this.dbConnectionPoolActive.set(active);
        this.dbConnectionPoolIdle.set(idle);
    }

    /**
     * Record cache operation
     */
    public recordCacheOperation(operation: 'get' | 'set' | 'delete', result: 'hit' | 'miss' | 'success'): void {
        this.cacheOperations.inc({ operation, result });
    }

    /**
     * Update cache metrics
     */
    public updateCacheMetrics(cacheName: string, size: number, memoryUsage: number, hitRate: number): void {
        this.cacheSize.set({ cache_name: cacheName }, size);
        this.cacheMemoryUsage.set({ cache_name: cacheName }, memoryUsage);
        this.cacheHitRate.set(hitRate);
    }

    /**
     * Record spell lookup
     */
    public recordSpellLookup(source: 'db' | 'dbc' | 'cache'): void {
        this.spellLookupsTotal.inc({ source });
    }

    /**
     * Record creature lookup
     */
    public recordCreatureLookup(source: 'db' | 'cache'): void {
        this.creatureLookupsTotal.inc({ source });
    }

    /**
     * Record quest lookup
     */
    public recordQuestLookup(source: 'db' | 'cache'): void {
        this.questLookupsTotal.inc({ source });
    }

    /**
     * Record API documentation request
     */
    public recordApiDocRequest(className: string, hasMethod: boolean): void {
        this.apiDocumentationRequests.inc({ class_name: className, has_method: hasMethod.toString() });
    }

    /**
     * Get metrics in Prometheus format
     */
    public async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }

    /**
     * Get metrics as JSON
     */
    public async getMetricsJson(): Promise<any> {
        const metrics = await this.registry.getMetricsAsJSON();
        return metrics;
    }

    /**
     * Get content type for metrics
     */
    public getContentType(): string {
        return this.registry.contentType;
    }

    /**
     * Reset all metrics (useful for testing)
     */
    public reset(): void {
        this.registry.resetMetrics();
    }

    /**
     * Get current metrics summary
     */
    public async getMetricsSummary(): Promise<any> {
        const metrics = await this.getMetricsJson();

        return {
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            metrics: {
                http: {
                    total_requests: this.getCounterValue(metrics, 'http_requests_total'),
                    total_errors: this.getCounterValue(metrics, 'http_errors_total'),
                },
                mcp_tools: {
                    total_invocations: this.getCounterValue(metrics, 'mcp_tool_invocations_total'),
                    total_errors: this.getCounterValue(metrics, 'mcp_tool_errors_total'),
                    cache_hit_rate: this.calculateCacheHitRate(metrics),
                },
                system: {
                    active_connections: this.getGaugeValue(metrics, 'active_connections'),
                    queue_depth: this.getGaugeValue(metrics, 'request_queue_depth'),
                    memory_rss_mb: Math.round(this.getGaugeValue(metrics, 'memory_usage_bytes', { type: 'rss' }) / 1024 / 1024),
                    memory_heap_used_mb: Math.round(this.getGaugeValue(metrics, 'memory_usage_bytes', { type: 'heapUsed' }) / 1024 / 1024),
                    cpu_percent: this.getGaugeValue(metrics, 'cpu_usage_percent'),
                },
                database: {
                    pool_size: this.getGaugeValue(metrics, 'db_connection_pool_size'),
                    pool_active: this.getGaugeValue(metrics, 'db_connection_pool_active'),
                    pool_idle: this.getGaugeValue(metrics, 'db_connection_pool_idle'),
                    query_errors: this.getCounterValue(metrics, 'db_query_errors_total'),
                },
                business: {
                    spell_lookups: this.getCounterValue(metrics, 'spell_lookups_total'),
                    creature_lookups: this.getCounterValue(metrics, 'creature_lookups_total'),
                    quest_lookups: this.getCounterValue(metrics, 'quest_lookups_total'),
                    api_doc_requests: this.getCounterValue(metrics, 'api_documentation_requests_total'),
                },
            },
        };
    }

    /**
     * Helper: Get counter value from metrics JSON
     */
    private getCounterValue(metrics: any[], name: string): number {
        const metric = metrics.find(m => m.name === `${this.prefix}_${name}`);
        if (!metric || !metric.values || metric.values.length === 0) return 0;
        return metric.values.reduce((sum: number, v: any) => sum + (v.value || 0), 0);
    }

    /**
     * Helper: Get gauge value from metrics JSON
     */
    private getGaugeValue(metrics: any[], name: string, labels?: any): number {
        const metric = metrics.find(m => m.name === `${this.prefix}_${name}`);
        if (!metric || !metric.values || metric.values.length === 0) return 0;

        if (labels) {
            const value = metric.values.find((v: any) => {
                return Object.keys(labels).every(key => v.labels && v.labels[key] === labels[key]);
            });
            return value ? value.value : 0;
        }

        return metric.values[0].value || 0;
    }

    /**
     * Helper: Calculate cache hit rate
     */
    private calculateCacheHitRate(metrics: any[]): number {
        const hits = this.getCounterValue(metrics, 'mcp_tool_cache_hits_total');
        const misses = this.getCounterValue(metrics, 'mcp_tool_cache_misses_total');
        const total = hits + misses;
        return total > 0 ? hits / total : 0;
    }
}

// Singleton instance
let metricsExporter: MetricsExporter | null = null;

/**
 * Get or create the singleton MetricsExporter instance
 */
export function getMetricsExporter(): MetricsExporter {
    if (!metricsExporter) {
        metricsExporter = new MetricsExporter();
    }
    return metricsExporter;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetMetricsExporter(): void {
    metricsExporter = null;
}
