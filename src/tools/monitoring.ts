/**
 * MCP Tools for Health Monitoring
 *
 * Provides 3 monitoring tools:
 * 1. get-health-status - Get server health metrics
 * 2. get-metrics-snapshot - Get current metrics snapshot
 * 3. query-logs - Query server logs with filtering
 *
 * @module tools/monitoring
 */

import { getHealthCheck, HealthStatus } from '../monitoring/HealthCheck';
import { getMetricsExporter } from '../monitoring/MetricsExporter';
import { getLogger, LogLevel } from '../monitoring/Logger';

/**
 * Tool 1: get-health-status
 * Get comprehensive health status of the MCP server
 */
export async function getHealthStatus(): Promise<string> {
    try {
        const healthCheck = getHealthCheck();
        const health = await healthCheck.getHealthStatus();

        // Format response
        const output = {
            status: health.status,
            summary: {
                overall_status: health.status,
                timestamp: health.timestamp,
                uptime_seconds: health.uptime,
                version: health.version,
            },
            components: health.components.map(c => ({
                name: c.name,
                status: c.status,
                message: c.message || 'OK',
                last_check: c.lastCheck,
                response_time_ms: c.responseTime,
                details: c.details,
            })),
            system_metrics: health.metrics ? {
                active_connections: health.metrics.activeConnections,
                request_queue_depth: health.metrics.queueDepth,
                memory_usage_mb: health.metrics.memoryUsageMB,
                cpu_usage_percent: health.metrics.cpuPercent,
            } : null,
            health_indicators: {
                is_healthy: health.status === HealthStatus.HEALTHY,
                is_ready: health.status === HealthStatus.HEALTHY || health.status === HealthStatus.DEGRADED,
                unhealthy_components: health.components.filter(c => c.status === HealthStatus.UNHEALTHY).map(c => c.name),
                degraded_components: health.components.filter(c => c.status === HealthStatus.DEGRADED).map(c => c.name),
            },
        };

        return JSON.stringify(output, null, 2);
    } catch (error) {
        return JSON.stringify({
            error: 'Failed to get health status',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2);
    }
}

/**
 * Tool 2: get-metrics-snapshot
 * Get current metrics snapshot with all collected metrics
 */
export async function getMetricsSnapshot(options?: {
    format?: 'json' | 'prometheus';
    include_details?: boolean;
}): Promise<string> {
    try {
        const metrics = getMetricsExporter();
        const format = options?.format || 'json';
        const includeDetails = options?.include_details !== false;

        if (format === 'prometheus') {
            // Return Prometheus-formatted metrics
            const prometheusMetrics = await metrics.getMetrics();
            return prometheusMetrics;
        }

        // Get metrics summary
        const summary = await metrics.getMetricsSummary();

        if (!includeDetails) {
            // Return compact summary
            return JSON.stringify({
                timestamp: summary.timestamp,
                uptime_seconds: summary.uptime,
                metrics: {
                    http: {
                        total_requests: summary.metrics.http.total_requests,
                        total_errors: summary.metrics.http.total_errors,
                        error_rate: summary.metrics.http.total_requests > 0
                            ? (summary.metrics.http.total_errors / summary.metrics.http.total_requests * 100).toFixed(2) + '%'
                            : '0%',
                    },
                    mcp_tools: {
                        total_invocations: summary.metrics.mcp_tools.total_invocations,
                        total_errors: summary.metrics.mcp_tools.total_errors,
                        cache_hit_rate: (summary.metrics.mcp_tools.cache_hit_rate * 100).toFixed(2) + '%',
                    },
                    system: {
                        active_connections: summary.metrics.system.active_connections,
                        queue_depth: summary.metrics.system.queue_depth,
                        memory_rss_mb: summary.metrics.system.memory_rss_mb,
                        memory_heap_used_mb: summary.metrics.system.memory_heap_used_mb,
                        cpu_percent: summary.metrics.system.cpu_percent.toFixed(2) + '%',
                    },
                    database: {
                        pool_size: summary.metrics.database.pool_size,
                        pool_active: summary.metrics.database.pool_active,
                        pool_idle: summary.metrics.database.pool_idle,
                        pool_utilization: summary.metrics.database.pool_size > 0
                            ? (summary.metrics.database.pool_active / summary.metrics.database.pool_size * 100).toFixed(2) + '%'
                            : '0%',
                    },
                },
            }, null, 2);
        }

        // Return full detailed metrics
        const fullMetrics = await metrics.getMetricsJson();

        return JSON.stringify({
            timestamp: summary.timestamp,
            uptime_seconds: summary.uptime,
            summary: summary.metrics,
            detailed_metrics: fullMetrics.map((m: any) => ({
                name: m.name,
                help: m.help,
                type: m.type,
                values: m.values,
            })),
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            error: 'Failed to get metrics snapshot',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2);
    }
}

/**
 * Tool 3: query-logs
 * Query server logs with filtering options
 */
export async function queryLogs(options: {
    level?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
    start_time?: string; // ISO 8601 timestamp
    end_time?: string; // ISO 8601 timestamp
    trace_id?: string;
    limit?: number;
    search?: string; // Search in message field
}): Promise<string> {
    try {
        const logger = getLogger();

        // Parse time filters
        const startTime = options.start_time ? new Date(options.start_time) : undefined;
        const endTime = options.end_time ? new Date(options.end_time) : undefined;

        // Query logs
        const logs = await logger.queryLogs({
            level: options.level,
            startTime,
            endTime,
            traceId: options.trace_id,
            limit: options.limit || 100,
        });

        // Apply search filter if provided
        let filteredLogs = logs;
        if (options.search) {
            const searchLower = options.search.toLowerCase();
            filteredLogs = logs.filter(log =>
                log.message.toLowerCase().includes(searchLower) ||
                (log.metadata && JSON.stringify(log.metadata).toLowerCase().includes(searchLower))
            );
        }

        // Format response
        const output = {
            query: {
                level: options.level || 'all',
                start_time: options.start_time,
                end_time: options.end_time,
                trace_id: options.trace_id,
                search: options.search,
                limit: options.limit || 100,
            },
            results: {
                total_count: filteredLogs.length,
                returned_count: filteredLogs.length,
                logs: filteredLogs.map(log => ({
                    timestamp: log.timestamp,
                    level: log.level,
                    message: log.message,
                    trace_id: log.traceId,
                    service: log.service,
                    environment: log.environment,
                    metadata: log.metadata,
                    error: log.error ? {
                        name: log.error.name,
                        message: log.error.message,
                        stack: log.error.stack,
                    } : undefined,
                    performance: log.performance,
                })),
            },
            statistics: {
                by_level: {
                    DEBUG: filteredLogs.filter(l => l.level === 'DEBUG').length,
                    INFO: filteredLogs.filter(l => l.level === 'INFO').length,
                    WARN: filteredLogs.filter(l => l.level === 'WARN').length,
                    ERROR: filteredLogs.filter(l => l.level === 'ERROR').length,
                    FATAL: filteredLogs.filter(l => l.level === 'FATAL').length,
                },
                unique_trace_ids: [...new Set(filteredLogs.map(l => l.traceId).filter(Boolean))].length,
                error_count: filteredLogs.filter(l => l.level === 'ERROR' || l.level === 'FATAL').length,
            },
        };

        return JSON.stringify(output, null, 2);
    } catch (error) {
        return JSON.stringify({
            error: 'Failed to query logs',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2);
    }
}

/**
 * Helper: Get current log file location
 */
export async function getLogFileLocation(): Promise<string> {
    try {
        const logger = getLogger();
        const logFile = logger.getCurrentLogFile();

        return JSON.stringify({
            current_log_file: logFile,
            note: 'Logs are rotated when they exceed the configured size limit',
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            error: 'Failed to get log file location',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2);
    }
}

/**
 * Helper: Get monitoring system status
 */
export async function getMonitoringStatus(): Promise<string> {
    try {
        const healthCheck = getHealthCheck();
        const metrics = getMetricsExporter();
        const logger = getLogger();

        // Check if all systems are operational
        const health = await healthCheck.getHealthStatus();
        const metricsWorking = await metrics.getMetricsSummary().then(() => true).catch(() => false);
        const logFile = logger.getCurrentLogFile();

        return JSON.stringify({
            monitoring_systems: {
                health_check: {
                    status: 'operational',
                    last_check: health.timestamp,
                },
                metrics_collection: {
                    status: metricsWorking ? 'operational' : 'degraded',
                },
                logging: {
                    status: logFile ? 'operational' : 'degraded',
                    current_log_file: logFile,
                },
            },
            overall_status: (health.status === HealthStatus.HEALTHY && metricsWorking && logFile)
                ? 'fully_operational'
                : 'degraded',
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            error: 'Failed to get monitoring status',
            message: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2);
    }
}
