import { EventEmitter } from 'events';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  duration: number;
  details?: any;
  error?: string;
}

/**
 * System health metrics
 */
export interface SystemHealth {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  uptime: number;
  timestamp: Date;
}

/**
 * Service health information
 */
export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  uptime: number;
  lastCheck: Date;
  consecutiveFailures: number;
  metrics?: any;
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<HealthCheckResult>;

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  name: string;
  check: HealthCheckFunction;
  interval?: number;
  timeout?: number;
  retries?: number;
  critical?: boolean;
}

/**
 * Aggregate health report
 */
export interface HealthReport {
  status: HealthStatus;
  timestamp: Date;
  system: SystemHealth;
  services: ServiceHealth[];
  checks: Record<string, HealthCheckResult>;
  uptime: number;
}

/**
 * Enterprise-grade health check system
 * Monitors system resources, services, and custom health checks
 */
export class HealthCheckManager extends EventEmitter {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private services: Map<string, ServiceHealth> = new Map();
  private startTime: Date = new Date();

  constructor() {
    super();
    this.registerDefaultChecks();
  }

  /**
   * Register default system health checks
   */
  private registerDefaultChecks(): void {
    // CPU health check
    this.registerCheck({
      name: 'cpu',
      check: async () => {
        const startUsage = process.cpuUsage();
        await new Promise(resolve => setTimeout(resolve, 100));
        const endUsage = process.cpuUsage(startUsage);
        
        const totalUsage = (endUsage.user + endUsage.system) / 1000000; // Convert to seconds
        const usagePercent = (totalUsage / 0.1) * 100; // 100ms sampling period

        let status = HealthStatus.HEALTHY;
        if (usagePercent > 90) status = HealthStatus.UNHEALTHY;
        else if (usagePercent > 70) status = HealthStatus.DEGRADED;

        return {
          status,
          timestamp: new Date(),
          duration: 100,
          details: {
            usagePercent: Math.round(usagePercent * 100) / 100,
            loadAverage: os.loadavg()
          }
        };
      },
      interval: 30000,
      critical: true
    });

    // Memory health check
    this.registerCheck({
      name: 'memory',
      check: async () => {
        const total = os.totalmem();
        const free = os.freemem();
        const used = total - free;
        const usagePercent = (used / total) * 100;

        let status = HealthStatus.HEALTHY;
        if (usagePercent > 95) status = HealthStatus.UNHEALTHY;
        else if (usagePercent > 85) status = HealthStatus.DEGRADED;

        return {
          status,
          timestamp: new Date(),
          duration: 0,
          details: {
            total,
            free,
            used,
            usagePercent: Math.round(usagePercent * 100) / 100
          }
        };
      },
      interval: 30000,
      critical: true
    });

    // Process health check
    this.registerCheck({
      name: 'process',
      check: async () => {
        const memUsage = process.memoryUsage();
        const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

        let status = HealthStatus.HEALTHY;
        if (heapUsagePercent > 90) status = HealthStatus.UNHEALTHY;
        else if (heapUsagePercent > 75) status = HealthStatus.DEGRADED;

        return {
          status,
          timestamp: new Date(),
          duration: 0,
          details: {
            pid: process.pid,
            uptime: process.uptime(),
            memory: memUsage,
            heapUsagePercent: Math.round(heapUsagePercent * 100) / 100
          }
        };
      },
      interval: 30000
    });
  }

  /**
   * Register a health check
   */
  public registerCheck(config: HealthCheckConfig): void {
    this.checks.set(config.name, {
      interval: 60000,
      timeout: 5000,
      retries: 3,
      critical: false,
      ...config
    });

    // Start periodic check if interval specified
    if (config.interval && config.interval > 0) {
      this.startPeriodicCheck(config.name);
    }

    this.emit('check-registered', { name: config.name });
  }

  /**
   * Unregister a health check
   */
  public unregisterCheck(name: string): boolean {
    this.stopPeriodicCheck(name);
    const deleted = this.checks.delete(name);
    if (deleted) {
      this.results.delete(name);
      this.emit('check-unregistered', { name });
    }
    return deleted;
  }

  /**
   * Start periodic health check
   */
  private startPeriodicCheck(name: string): void {
    const config = this.checks.get(name);
    if (!config || !config.interval) return;

    // Stop existing interval if any
    this.stopPeriodicCheck(name);

    // Run immediately
    this.runCheck(name);

    // Start periodic execution
    const interval = setInterval(() => {
      this.runCheck(name);
    }, config.interval);

    this.intervals.set(name, interval);
  }

  /**
   * Stop periodic health check
   */
  private stopPeriodicCheck(name: string): void {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
    }
  }

  /**
   * Run a specific health check
   */
  public async runCheck(name: string): Promise<HealthCheckResult> {
    const config = this.checks.get(name);
    if (!config) {
      throw new Error(`Health check not found: ${name}`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Execute check with timeout
      const checkPromise = config.check();
      const timeoutPromise = new Promise<HealthCheckResult>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
      });

      result = await Promise.race([checkPromise, timeoutPromise]);
      result.duration = Date.now() - startTime;
    } catch (error) {
      result = {
        status: HealthStatus.UNHEALTHY,
        timestamp: new Date(),
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }

    this.results.set(name, result);
    this.emit('check-completed', { name, result });

    // Update service health if critical check fails
    if (config.critical && result.status === HealthStatus.UNHEALTHY) {
      this.emit('critical-check-failed', { name, result });
    }

    return result;
  }

  /**
   * Run all health checks
   */
  public async runAllChecks(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};
    
    await Promise.all(
      Array.from(this.checks.keys()).map(async (name) => {
        results[name] = await this.runCheck(name);
      })
    );

    return results;
  }

  /**
   * Get health check result
   */
  public getCheckResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  /**
   * Get all health check results
   */
  public getAllResults(): Record<string, HealthCheckResult> {
    const results: Record<string, HealthCheckResult> = {};
    for (const [name, result] of this.results.entries()) {
      results[name] = result;
    }
    return results;
  }

  /**
   * Register a service
   */
  public registerService(name: string): void {
    this.services.set(name, {
      name,
      status: HealthStatus.HEALTHY,
      uptime: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0
    });
    this.emit('service-registered', { name });
  }

  /**
   * Update service health
   */
  public updateServiceHealth(
    name: string,
    status: HealthStatus,
    metrics?: any
  ): void {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service not found: ${name}`);
    }

    const oldStatus = service.status;
    service.status = status;
    service.lastCheck = new Date();
    service.metrics = metrics;

    if (status === HealthStatus.UNHEALTHY) {
      service.consecutiveFailures++;
    } else {
      service.consecutiveFailures = 0;
    }

    if (oldStatus !== status) {
      this.emit('service-status-changed', { name, oldStatus, newStatus: status });
    }
  }

  /**
   * Get service health
   */
  public getServiceHealth(name: string): ServiceHealth | undefined {
    return this.services.get(name);
  }

  /**
   * Get all service health
   */
  public getAllServicesHealth(): ServiceHealth[] {
    return Array.from(this.services.values());
  }

  /**
   * Get system health metrics
   */
  public getSystemHealth(): SystemHealth {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    // Get disk usage (simplified - would need platform-specific code for accurate disk info)
    const diskTotal = 1000000000000; // 1TB placeholder
    const diskFree = 500000000000; // 500GB placeholder
    const diskUsed = diskTotal - diskFree;

    return {
      cpu: {
        usage: os.loadavg()[0],
        loadAverage: os.loadavg(),
        cores: os.cpus().length
      },
      memory: {
        total,
        free,
        used,
        usagePercent: (used / total) * 100
      },
      disk: {
        total: diskTotal,
        free: diskFree,
        used: diskUsed,
        usagePercent: (diskUsed / diskTotal) * 100
      },
      uptime: os.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Get aggregate health report
   */
  public async getHealthReport(): Promise<HealthReport> {
    const checkResults = await this.runAllChecks();
    const systemHealth = this.getSystemHealth();
    const services = this.getAllServicesHealth();

    // Determine overall status
    let overallStatus = HealthStatus.HEALTHY;
    
    // Check critical checks
    for (const [name, config] of this.checks.entries()) {
      if (config.critical) {
        const result = checkResults[name];
        if (result.status === HealthStatus.UNHEALTHY) {
          overallStatus = HealthStatus.UNHEALTHY;
          break;
        } else if (result.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.HEALTHY) {
          overallStatus = HealthStatus.DEGRADED;
        }
      }
    }

    // Check services
    for (const service of services) {
      if (service.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
        break;
      } else if (service.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.HEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      system: systemHealth,
      services,
      checks: checkResults,
      uptime: (Date.now() - this.startTime.getTime()) / 1000
    };
  }

  /**
   * Get health status (lightweight)
   */
  public getHealthStatus(): HealthStatus {
    let status = HealthStatus.HEALTHY;

    // Check critical checks
    for (const [name, config] of this.checks.entries()) {
      if (config.critical) {
        const result = this.results.get(name);
        if (result) {
          if (result.status === HealthStatus.UNHEALTHY) {
            return HealthStatus.UNHEALTHY;
          } else if (result.status === HealthStatus.DEGRADED) {
            status = HealthStatus.DEGRADED;
          }
        }
      }
    }

    // Check services
    for (const service of this.services.values()) {
      if (service.status === HealthStatus.UNHEALTHY) {
        return HealthStatus.UNHEALTHY;
      } else if (service.status === HealthStatus.DEGRADED) {
        status = HealthStatus.DEGRADED;
      }
    }

    return status;
  }

  /**
   * Check if system is healthy
   */
  public isHealthy(): boolean {
    return this.getHealthStatus() === HealthStatus.HEALTHY;
  }

  /**
   * Get uptime in seconds
   */
  public getUptime(): number {
    return (Date.now() - this.startTime.getTime()) / 1000;
  }

  /**
   * Start all periodic checks
   */
  public startAll(): void {
    for (const name of this.checks.keys()) {
      const config = this.checks.get(name);
      if (config?.interval) {
        this.startPeriodicCheck(name);
      }
    }
    this.emit('started');
  }

  /**
   * Stop all periodic checks
   */
  public stopAll(): void {
    for (const name of this.checks.keys()) {
      this.stopPeriodicCheck(name);
    }
    this.emit('stopped');
  }

  /**
   * Shutdown health check manager
   */
  public shutdown(): void {
    this.stopAll();
    this.checks.clear();
    this.results.clear();
    this.services.clear();
    this.emit('shutdown');
  }
}

/**
 * Global health check manager instance
 */
let globalHealthCheckManager: HealthCheckManager | null = null;

/**
 * Get or create global health check manager
 */
export function getHealthCheckManager(): HealthCheckManager {
  if (!globalHealthCheckManager) {
    globalHealthCheckManager = new HealthCheckManager();
    globalHealthCheckManager.startAll();
  }
  return globalHealthCheckManager;
}

/**
 * Set global health check manager
 */
export function setHealthCheckManager(manager: HealthCheckManager): void {
  globalHealthCheckManager = manager;
}
