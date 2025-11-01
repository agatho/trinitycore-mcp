/**
 * HealthCheck.ts
 *
 * Health check system for TrinityCore MCP Server
 * Provides /health and /ready endpoints for container orchestration
 *
 * Features:
 * - Liveness probe (basic server health)
 * - Readiness probe (ready to serve traffic)
 * - Dependency health checks (database, cache)
 * - Graceful degradation
 * - Health status reporting
 *
 * @module monitoring/HealthCheck
 */

import { getLogger } from './Logger';
import { getMetricsExporter } from './MetricsExporter';

/**
 * Health status enumeration
 */
export enum HealthStatus {
    HEALTHY = 'healthy',
    DEGRADED = 'degraded',
    UNHEALTHY = 'unhealthy',
}

/**
 * Component health interface
 */
export interface ComponentHealth {
    name: string;
    status: HealthStatus;
    message?: string;
    lastCheck: string;
    responseTime?: number;
    details?: any;
}

/**
 * Overall health response
 */
export interface HealthResponse {
    status: HealthStatus;
    timestamp: string;
    uptime: number;
    version: string;
    components: ComponentHealth[];
    metrics?: {
        activeConnections: number;
        queueDepth: number;
        memoryUsageMB: number;
        cpuPercent: number;
    };
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<ComponentHealth>;

/**
 * HealthCheck class
 * Manages health checks for the MCP server and its dependencies
 */
export class HealthCheck {
    private checks: Map<string, HealthCheckFunction> = new Map();
    private lastHealthCheck: HealthResponse | null = null;
    private checkInterval: NodeJS.Timeout | null = null;
    private readonly version: string;

    constructor(version: string = '1.4.0') {
        this.version = version;

        // Register default health checks
        this.registerDefaultChecks();

        // Start periodic health checks
        this.startPeriodicChecks();
    }

    /**
     * Register default health checks
     */
    private registerDefaultChecks(): void {
        // Process health check
        this.registerCheck('process', async () => {
            const usage = process.memoryUsage();
            const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
            const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;

            let status = HealthStatus.HEALTHY;
            let message = 'Process is healthy';

            // Mark as degraded if heap usage > 80%
            if (heapPercent > 80) {
                status = HealthStatus.DEGRADED;
                message = `High memory usage: ${heapPercent.toFixed(1)}%`;
            }

            // Mark as unhealthy if heap usage > 95%
            if (heapPercent > 95) {
                status = HealthStatus.UNHEALTHY;
                message = `Critical memory usage: ${heapPercent.toFixed(1)}%`;
            }

            return {
                name: 'process',
                status,
                message,
                lastCheck: new Date().toISOString(),
                details: {
                    heapUsedMB,
                    heapTotalMB,
                    heapPercent: parseFloat(heapPercent.toFixed(2)),
                    uptime: process.uptime(),
                    pid: process.pid,
                },
            };
        });

        // Event loop health check
        this.registerCheck('event_loop', async () => {
            const startTime = Date.now();
            await new Promise(resolve => setImmediate(resolve));
            const lag = Date.now() - startTime;

            let status = HealthStatus.HEALTHY;
            let message = 'Event loop is healthy';

            // Mark as degraded if lag > 100ms
            if (lag > 100) {
                status = HealthStatus.DEGRADED;
                message = `Event loop lag detected: ${lag}ms`;
            }

            // Mark as unhealthy if lag > 500ms
            if (lag > 500) {
                status = HealthStatus.UNHEALTHY;
                message = `Critical event loop lag: ${lag}ms`;
            }

            return {
                name: 'event_loop',
                status,
                message,
                lastCheck: new Date().toISOString(),
                responseTime: lag,
                details: {
                    lagMs: lag,
                },
            };
        });

        // Metrics system health check
        this.registerCheck('metrics', async () => {
            try {
                const metrics = getMetricsExporter();
                const summary = await metrics.getMetricsSummary();

                return {
                    name: 'metrics',
                    status: HealthStatus.HEALTHY,
                    message: 'Metrics system operational',
                    lastCheck: new Date().toISOString(),
                    details: {
                        uptime: summary.uptime,
                        totalRequests: summary.metrics.http.total_requests,
                    },
                };
            } catch (error) {
                return {
                    name: 'metrics',
                    status: HealthStatus.UNHEALTHY,
                    message: `Metrics system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    lastCheck: new Date().toISOString(),
                };
            }
        });

        // Logger health check
        this.registerCheck('logger', async () => {
            try {
                const logger = getLogger();
                const logFile = logger.getCurrentLogFile();

                return {
                    name: 'logger',
                    status: HealthStatus.HEALTHY,
                    message: 'Logger operational',
                    lastCheck: new Date().toISOString(),
                    details: {
                        currentLogFile: logFile,
                    },
                };
            } catch (error) {
                return {
                    name: 'logger',
                    status: HealthStatus.DEGRADED,
                    message: `Logger degraded: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    lastCheck: new Date().toISOString(),
                };
            }
        });
    }

    /**
     * Register a custom health check
     */
    public registerCheck(name: string, checkFn: HealthCheckFunction): void {
        this.checks.set(name, checkFn);
    }

    /**
     * Unregister a health check
     */
    public unregisterCheck(name: string): void {
        this.checks.delete(name);
    }

    /**
     * Start periodic health checks
     */
    private startPeriodicChecks(intervalMs: number = 30000): void {
        this.checkInterval = setInterval(async () => {
            try {
                await this.performHealthCheck();
            } catch (error) {
                const logger = getLogger();
                logger.error('Periodic health check failed', error instanceof Error ? error : undefined);
            }
        }, intervalMs);
    }

    /**
     * Stop periodic health checks
     */
    public stopPeriodicChecks(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    /**
     * Perform health check on all registered components
     */
    private async performHealthCheck(): Promise<HealthResponse> {
        const components: ComponentHealth[] = [];

        // Run all health checks in parallel
        const checkPromises = Array.from(this.checks.entries()).map(async ([name, checkFn]) => {
            try {
                const result = await Promise.race([
                    checkFn(),
                    new Promise<ComponentHealth>((_, reject) =>
                        setTimeout(() => reject(new Error('Health check timeout')), 5000)
                    ),
                ]);
                return result;
            } catch (error) {
                return {
                    name,
                    status: HealthStatus.UNHEALTHY,
                    message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    lastCheck: new Date().toISOString(),
                } as ComponentHealth;
            }
        });

        components.push(...(await Promise.all(checkPromises)));

        // Determine overall status
        let overallStatus = HealthStatus.HEALTHY;
        const unhealthyCount = components.filter(c => c.status === HealthStatus.UNHEALTHY).length;
        const degradedCount = components.filter(c => c.status === HealthStatus.DEGRADED).length;

        if (unhealthyCount > 0) {
            overallStatus = HealthStatus.UNHEALTHY;
        } else if (degradedCount > 0) {
            overallStatus = HealthStatus.DEGRADED;
        }

        // Get metrics
        let metrics;
        try {
            const metricsExporter = getMetricsExporter();
            const summary = await metricsExporter.getMetricsSummary();
            metrics = {
                activeConnections: summary.metrics.system.active_connections,
                queueDepth: summary.metrics.system.queue_depth,
                memoryUsageMB: summary.metrics.system.memory_rss_mb,
                cpuPercent: summary.metrics.system.cpu_percent,
            };
        } catch (error) {
            // Metrics not available
        }

        const response: HealthResponse = {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: this.version,
            components,
            metrics,
        };

        this.lastHealthCheck = response;
        return response;
    }

    /**
     * Get liveness probe status
     * Returns 200 if process is alive, 503 if unhealthy
     */
    public async getLivenessProbe(): Promise<{ status: number; body: any }> {
        try {
            // Liveness probe checks if the process is alive
            // Simple check: can we allocate memory and respond?
            const response = {
                status: 'alive',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                pid: process.pid,
            };

            return { status: 200, body: response };
        } catch (error) {
            return {
                status: 503,
                body: {
                    status: 'dead',
                    error: error instanceof Error ? error.message : 'Unknown error',
                },
            };
        }
    }

    /**
     * Get readiness probe status
     * Returns 200 if ready to serve traffic, 503 if not ready
     */
    public async getReadinessProbe(): Promise<{ status: number; body: any }> {
        const health = await this.performHealthCheck();

        // Ready if status is HEALTHY or DEGRADED (can still serve traffic with degraded performance)
        const isReady = health.status === HealthStatus.HEALTHY || health.status === HealthStatus.DEGRADED;

        return {
            status: isReady ? 200 : 503,
            body: {
                ready: isReady,
                status: health.status,
                timestamp: health.timestamp,
                components: health.components,
            },
        };
    }

    /**
     * Get full health status
     */
    public async getHealthStatus(): Promise<HealthResponse> {
        // Use cached result if recent (< 5 seconds old)
        if (this.lastHealthCheck) {
            const age = Date.now() - new Date(this.lastHealthCheck.timestamp).getTime();
            if (age < 5000) {
                return this.lastHealthCheck;
            }
        }

        return await this.performHealthCheck();
    }

    /**
     * Get health status for specific component
     */
    public async getComponentHealth(componentName: string): Promise<ComponentHealth | null> {
        const checkFn = this.checks.get(componentName);
        if (!checkFn) {
            return null;
        }

        try {
            return await checkFn();
        } catch (error) {
            return {
                name: componentName,
                status: HealthStatus.UNHEALTHY,
                message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                lastCheck: new Date().toISOString(),
            };
        }
    }

    /**
     * Check if system is healthy
     */
    public async isHealthy(): Promise<boolean> {
        const health = await this.getHealthStatus();
        return health.status === HealthStatus.HEALTHY;
    }

    /**
     * Check if system is ready
     */
    public async isReady(): Promise<boolean> {
        const health = await this.getHealthStatus();
        return health.status === HealthStatus.HEALTHY || health.status === HealthStatus.DEGRADED;
    }

    /**
     * Shutdown health check system
     */
    public shutdown(): void {
        this.stopPeriodicChecks();
    }
}

// Singleton instance
let healthCheck: HealthCheck | null = null;

/**
 * Get or create the singleton HealthCheck instance
 */
export function getHealthCheck(version?: string): HealthCheck {
    if (!healthCheck) {
        healthCheck = new HealthCheck(version);
    }
    return healthCheck;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetHealthCheck(): void {
    if (healthCheck) {
        healthCheck.shutdown();
    }
    healthCheck = null;
}
