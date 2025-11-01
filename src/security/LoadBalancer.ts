/**
 * LoadBalancer.ts
 *
 * Load balancing and traffic distribution for TrinityCore MCP Server
 * Supports multiple load balancing algorithms and health-aware routing
 *
 * Features:
 * - Round-robin load balancing
 * - Least connections algorithm
 * - Weighted distribution
 * - Health-aware routing
 * - Session affinity (sticky sessions)
 * - Automatic failover
 * - Connection draining
 *
 * @module security/LoadBalancer
 */

import { getLogger } from '../monitoring/Logger';
import { getMetricsExporter } from '../monitoring/MetricsExporter';
import { getHealthCheck, HealthStatus } from '../monitoring/HealthCheck';

/**
 * Backend server instance
 */
export interface BackendServer {
    id: string;
    host: string;
    port: number;
    weight: number;
    maxConnections: number;
    currentConnections: number;
    healthy: boolean;
    lastHealthCheck: number;
    failureCount: number;
    successCount: number;
}

/**
 * Load balancing algorithm types
 */
export enum LoadBalancingAlgorithm {
    ROUND_ROBIN = 'round_robin',
    LEAST_CONNECTIONS = 'least_connections',
    WEIGHTED_ROUND_ROBIN = 'weighted_round_robin',
    IP_HASH = 'ip_hash',
}

/**
 * Load balancer configuration
 */
export interface LoadBalancerConfig {
    algorithm: LoadBalancingAlgorithm;
    healthCheckInterval: number; // milliseconds
    healthCheckTimeout: number; // milliseconds
    maxFailures: number;
    sessionAffinity: boolean;
    sessionAffinityTimeout: number; // milliseconds
    enableMetrics: boolean;
}

/**
 * Session affinity entry
 */
interface SessionAffinityEntry {
    serverId: string;
    createdAt: number;
    lastAccess: number;
}

/**
 * LoadBalancer class
 * Manages traffic distribution across multiple backend servers
 */
export class LoadBalancer {
    private servers: Map<string, BackendServer> = new Map();
    private currentIndex: number = 0;
    private sessionAffinity: Map<string, SessionAffinityEntry> = new Map();
    private config: LoadBalancerConfig;
    private healthCheckInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<LoadBalancerConfig> = {}) {
        this.config = {
            algorithm: config.algorithm || LoadBalancingAlgorithm.ROUND_ROBIN,
            healthCheckInterval: config.healthCheckInterval || 10000, // 10 seconds
            healthCheckTimeout: config.healthCheckTimeout || 5000, // 5 seconds
            maxFailures: config.maxFailures || 3,
            sessionAffinity: config.sessionAffinity !== false,
            sessionAffinityTimeout: config.sessionAffinityTimeout || 300000, // 5 minutes
            enableMetrics: config.enableMetrics !== false,
        };

        // Start health checks
        this.startHealthChecks();

        // Start session cleanup
        this.startSessionCleanup();
    }

    /**
     * Register a backend server
     */
    public registerServer(server: Omit<BackendServer, 'currentConnections' | 'healthy' | 'lastHealthCheck' | 'failureCount' | 'successCount'>): void {
        const backendServer: BackendServer = {
            ...server,
            currentConnections: 0,
            healthy: true,
            lastHealthCheck: Date.now(),
            failureCount: 0,
            successCount: 0,
        };

        this.servers.set(server.id, backendServer);

        const logger = getLogger();
        logger.info(`Backend server registered: ${server.id}`, {
            host: server.host,
            port: server.port,
            weight: server.weight,
        });
    }

    /**
     * Unregister a backend server
     */
    public unregisterServer(serverId: string): void {
        const server = this.servers.get(serverId);
        if (!server) {
            return;
        }

        // Drain connections first
        this.drainServer(serverId);

        // Remove from pool
        this.servers.delete(serverId);

        const logger = getLogger();
        logger.info(`Backend server unregistered: ${serverId}`);
    }

    /**
     * Get next available server based on load balancing algorithm
     */
    public getNextServer(clientIp?: string): BackendServer | null {
        // Check if we have any healthy servers
        const healthyServers = this.getHealthyServers();
        if (healthyServers.length === 0) {
            const logger = getLogger();
            logger.error('No healthy backend servers available');
            return null;
        }

        // Check session affinity
        if (this.config.sessionAffinity && clientIp) {
            const session = this.sessionAffinity.get(clientIp);
            if (session) {
                const server = this.servers.get(session.serverId);
                if (server && server.healthy && server.currentConnections < server.maxConnections) {
                    // Update last access time
                    session.lastAccess = Date.now();
                    return server;
                }
            }
        }

        // Select server based on algorithm
        let selectedServer: BackendServer | null = null;

        switch (this.config.algorithm) {
            case LoadBalancingAlgorithm.ROUND_ROBIN:
                selectedServer = this.roundRobin(healthyServers);
                break;

            case LoadBalancingAlgorithm.LEAST_CONNECTIONS:
                selectedServer = this.leastConnections(healthyServers);
                break;

            case LoadBalancingAlgorithm.WEIGHTED_ROUND_ROBIN:
                selectedServer = this.weightedRoundRobin(healthyServers);
                break;

            case LoadBalancingAlgorithm.IP_HASH:
                if (clientIp) {
                    selectedServer = this.ipHash(healthyServers, clientIp);
                } else {
                    selectedServer = this.roundRobin(healthyServers);
                }
                break;

            default:
                selectedServer = this.roundRobin(healthyServers);
        }

        // Store session affinity
        if (selectedServer && this.config.sessionAffinity && clientIp) {
            this.sessionAffinity.set(clientIp, {
                serverId: selectedServer.id,
                createdAt: Date.now(),
                lastAccess: Date.now(),
            });
        }

        return selectedServer;
    }

    /**
     * Round-robin algorithm
     */
    private roundRobin(servers: BackendServer[]): BackendServer {
        const server = servers[this.currentIndex % servers.length];
        this.currentIndex = (this.currentIndex + 1) % servers.length;
        return server;
    }

    /**
     * Least connections algorithm
     */
    private leastConnections(servers: BackendServer[]): BackendServer {
        return servers.reduce((min, server) =>
            server.currentConnections < min.currentConnections ? server : min
        );
    }

    /**
     * Weighted round-robin algorithm
     */
    private weightedRoundRobin(servers: BackendServer[]): BackendServer {
        // Build weighted server list
        const weightedServers: BackendServer[] = [];
        for (const server of servers) {
            for (let i = 0; i < server.weight; i++) {
                weightedServers.push(server);
            }
        }

        const server = weightedServers[this.currentIndex % weightedServers.length];
        this.currentIndex = (this.currentIndex + 1) % weightedServers.length;
        return server;
    }

    /**
     * IP hash algorithm
     */
    private ipHash(servers: BackendServer[], clientIp: string): BackendServer {
        const hash = this.hashString(clientIp);
        const index = hash % servers.length;
        return servers[index];
    }

    /**
     * Simple string hash function
     */
    private hashString(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Get all healthy servers
     */
    private getHealthyServers(): BackendServer[] {
        return Array.from(this.servers.values()).filter(
            server => server.healthy && server.currentConnections < server.maxConnections
        );
    }

    /**
     * Increment connection count
     */
    public incrementConnections(serverId: string): void {
        const server = this.servers.get(serverId);
        if (server) {
            server.currentConnections++;
        }
    }

    /**
     * Decrement connection count
     */
    public decrementConnections(serverId: string): void {
        const server = this.servers.get(serverId);
        if (server) {
            server.currentConnections = Math.max(0, server.currentConnections - 1);
        }
    }

    /**
     * Record successful request
     */
    public recordSuccess(serverId: string): void {
        const server = this.servers.get(serverId);
        if (server) {
            server.successCount++;
            server.failureCount = 0; // Reset failure count on success
        }
    }

    /**
     * Record failed request
     */
    public recordFailure(serverId: string): void {
        const server = this.servers.get(serverId);
        if (!server) return;

        server.failureCount++;

        // Mark unhealthy if max failures reached
        if (server.failureCount >= this.config.maxFailures) {
            this.markUnhealthy(serverId);
        }

        const logger = getLogger();
        logger.warn(`Backend server failure recorded: ${serverId}`, {
            failureCount: server.failureCount,
            maxFailures: this.config.maxFailures,
        });
    }

    /**
     * Mark server as unhealthy
     */
    private markUnhealthy(serverId: string): void {
        const server = this.servers.get(serverId);
        if (!server) return;

        server.healthy = false;

        const logger = getLogger();
        logger.error(`Backend server marked unhealthy: ${serverId}`, undefined, {
            failureCount: server.failureCount,
        });

        // Record metric
        if (this.config.enableMetrics) {
            const metrics = getMetricsExporter();
            // Could add custom metric here
        }
    }

    /**
     * Mark server as healthy
     */
    private markHealthy(serverId: string): void {
        const server = this.servers.get(serverId);
        if (!server) return;

        const wasUnhealthy = !server.healthy;
        server.healthy = true;
        server.failureCount = 0;

        if (wasUnhealthy) {
            const logger = getLogger();
            logger.info(`Backend server restored to healthy: ${serverId}`);
        }
    }

    /**
     * Start periodic health checks
     */
    private startHealthChecks(): void {
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthChecks();
        }, this.config.healthCheckInterval);
    }

    /**
     * Stop health checks
     */
    public stopHealthChecks(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Perform health check on all servers
     */
    private async performHealthChecks(): Promise<void> {
        const checks = Array.from(this.servers.values()).map(server =>
            this.checkServerHealth(server)
        );

        await Promise.all(checks);
    }

    /**
     * Check health of a single server
     */
    private async checkServerHealth(server: BackendServer): Promise<void> {
        try {
            // Simple TCP connection test
            const startTime = Date.now();
            const healthy = await this.tcpHealthCheck(server.host, server.port, this.config.healthCheckTimeout);
            const duration = Date.now() - startTime;

            server.lastHealthCheck = Date.now();

            if (healthy) {
                this.markHealthy(server.id);
            } else {
                this.recordFailure(server.id);
            }
        } catch (error) {
            this.recordFailure(server.id);
        }
    }

    /**
     * TCP health check
     */
    private async tcpHealthCheck(host: string, port: number, timeout: number): Promise<boolean> {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();

            const timer = setTimeout(() => {
                socket.destroy();
                resolve(false);
            }, timeout);

            socket.on('connect', () => {
                clearTimeout(timer);
                socket.destroy();
                resolve(true);
            });

            socket.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });

            socket.connect(port, host);
        });
    }

    /**
     * Drain connections from a server
     */
    private async drainServer(serverId: string): Promise<void> {
        const server = this.servers.get(serverId);
        if (!server) return;

        const logger = getLogger();
        logger.info(`Draining connections from server: ${serverId}`, {
            currentConnections: server.currentConnections,
        });

        // Mark as unhealthy to prevent new connections
        server.healthy = false;

        // Wait for existing connections to complete (max 30 seconds)
        const maxWait = 30000;
        const checkInterval = 1000;
        let waited = 0;

        while (server.currentConnections > 0 && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }

        if (server.currentConnections > 0) {
            logger.warn(`Server drain timeout: ${serverId}`, {
                remainingConnections: server.currentConnections,
            });
        } else {
            logger.info(`Server drained successfully: ${serverId}`);
        }
    }

    /**
     * Start session cleanup
     */
    private startSessionCleanup(): void {
        setInterval(() => {
            this.cleanupSessions();
        }, 60000); // Every minute
    }

    /**
     * Cleanup expired sessions
     */
    private cleanupSessions(): void {
        const now = Date.now();
        const expired: string[] = [];

        for (const [clientIp, session] of this.sessionAffinity.entries()) {
            if (now - session.lastAccess > this.config.sessionAffinityTimeout) {
                expired.push(clientIp);
            }
        }

        for (const clientIp of expired) {
            this.sessionAffinity.delete(clientIp);
        }

        if (expired.length > 0) {
            const logger = getLogger();
            logger.debug(`Cleaned up ${expired.length} expired sessions`);
        }
    }

    /**
     * Get load balancer statistics
     */
    public getStatistics(): any {
        const servers = Array.from(this.servers.values());

        return {
            total_servers: servers.length,
            healthy_servers: servers.filter(s => s.healthy).length,
            unhealthy_servers: servers.filter(s => !s.healthy).length,
            total_connections: servers.reduce((sum, s) => sum + s.currentConnections, 0),
            active_sessions: this.sessionAffinity.size,
            algorithm: this.config.algorithm,
            servers: servers.map(s => ({
                id: s.id,
                host: s.host,
                port: s.port,
                healthy: s.healthy,
                connections: s.currentConnections,
                max_connections: s.maxConnections,
                weight: s.weight,
                success_count: s.successCount,
                failure_count: s.failureCount,
                last_health_check: new Date(s.lastHealthCheck).toISOString(),
            })),
        };
    }

    /**
     * Shutdown load balancer
     */
    public shutdown(): void {
        this.stopHealthChecks();
        this.sessionAffinity.clear();
    }
}

// Singleton instance
let loadBalancer: LoadBalancer | null = null;

/**
 * Get or create the singleton LoadBalancer instance
 */
export function getLoadBalancer(config?: Partial<LoadBalancerConfig>): LoadBalancer {
    if (!loadBalancer) {
        loadBalancer = new LoadBalancer(config);
    }
    return loadBalancer;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetLoadBalancer(): void {
    if (loadBalancer) {
        loadBalancer.shutdown();
    }
    loadBalancer = null;
}
