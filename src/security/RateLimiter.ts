/**
 * RateLimiter.ts
 *
 * Rate limiting and request throttling for TrinityCore MCP Server
 * Protects against abuse, DoS attacks, and excessive resource usage
 *
 * Features:
 * - Token bucket algorithm
 * - Sliding window rate limiting
 * - Per-IP rate limiting
 * - Per-user rate limiting
 * - Per-endpoint rate limiting
 * - Burst allowance
 * - Automatic cleanup of expired entries
 *
 * @module security/RateLimiter
 */

import { getLogger } from '../monitoring/Logger';
import { getMetricsExporter } from '../monitoring/MetricsExporter';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
    maxRequests: number;      // Maximum requests allowed
    windowMs: number;          // Time window in milliseconds
    burstAllowance: number;    // Extra requests allowed in burst
    blockDuration: number;     // Duration to block after limit exceeded (ms)
    skipSuccessfulRequests: boolean; // Don't count successful requests
    skipFailedRequests: boolean;     // Don't count failed requests
}

/**
 * Rate limit entry
 */
interface RateLimitEntry {
    tokens: number;
    lastRefill: number;
    blocked: boolean;
    blockedUntil: number;
    requestCount: number;
    requestTimestamps: number[];
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
}

/**
 * RateLimiter class
 * Manages request rate limiting using token bucket algorithm
 */
export class RateLimiter {
    private limits: Map<string, RateLimitEntry> = new Map();
    private config: RateLimitConfig;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(config: Partial<RateLimitConfig> = {}) {
        this.config = {
            maxRequests: config.maxRequests || 100,
            windowMs: config.windowMs || 60000, // 1 minute
            burstAllowance: config.burstAllowance || 10,
            blockDuration: config.blockDuration || 300000, // 5 minutes
            skipSuccessfulRequests: config.skipSuccessfulRequests || false,
            skipFailedRequests: config.skipFailedRequests || false,
        };

        // Start cleanup
        this.startCleanup();
    }

    /**
     * Check if request is allowed
     */
    public checkLimit(key: string): RateLimitResult {
        const now = Date.now();
        let entry = this.limits.get(key);

        // Create new entry if doesn't exist
        if (!entry) {
            entry = {
                tokens: this.config.maxRequests + this.config.burstAllowance,
                lastRefill: now,
                blocked: false,
                blockedUntil: 0,
                requestCount: 0,
                requestTimestamps: [],
            };
            this.limits.set(key, entry);
        }

        // Check if currently blocked
        if (entry.blocked && now < entry.blockedUntil) {
            const retryAfter = entry.blockedUntil - now;
            return {
                allowed: false,
                remaining: 0,
                resetTime: entry.blockedUntil,
                retryAfter,
            };
        }

        // Unblock if block period expired
        if (entry.blocked && now >= entry.blockedUntil) {
            entry.blocked = false;
            entry.tokens = this.config.maxRequests + this.config.burstAllowance;
            entry.lastRefill = now;
            entry.requestTimestamps = [];
        }

        // Refill tokens based on time elapsed
        const timeSinceLastRefill = now - entry.lastRefill;
        const tokensToAdd = (timeSinceLastRefill / this.config.windowMs) * this.config.maxRequests;
        entry.tokens = Math.min(
            entry.tokens + tokensToAdd,
            this.config.maxRequests + this.config.burstAllowance
        );
        entry.lastRefill = now;

        // Check if tokens available
        if (entry.tokens >= 1) {
            entry.tokens--;
            entry.requestCount++;
            entry.requestTimestamps.push(now);

            // Cleanup old timestamps
            const windowStart = now - this.config.windowMs;
            entry.requestTimestamps = entry.requestTimestamps.filter(t => t > windowStart);

            return {
                allowed: true,
                remaining: Math.floor(entry.tokens),
                resetTime: now + this.config.windowMs,
            };
        }

        // No tokens available - block client
        entry.blocked = true;
        entry.blockedUntil = now + this.config.blockDuration;

        const logger = getLogger();
        logger.warn('Rate limit exceeded', {
            key,
            requestCount: entry.requestCount,
            maxRequests: this.config.maxRequests,
            blockedUntil: new Date(entry.blockedUntil).toISOString(),
        });

        // Record metric
        const metrics = getMetricsExporter();
        // Could add rate limit metric here

        return {
            allowed: false,
            remaining: 0,
            resetTime: entry.blockedUntil,
            retryAfter: this.config.blockDuration,
        };
    }

    /**
     * Record successful request (may reduce token consumption)
     */
    public recordSuccess(key: string): void {
        if (this.config.skipSuccessfulRequests) {
            const entry = this.limits.get(key);
            if (entry && entry.tokens < this.config.maxRequests + this.config.burstAllowance) {
                entry.tokens++;
            }
        }
    }

    /**
     * Record failed request (may reduce token consumption)
     */
    public recordFailure(key: string): void {
        if (this.config.skipFailedRequests) {
            const entry = this.limits.get(key);
            if (entry && entry.tokens < this.config.maxRequests + this.config.burstAllowance) {
                entry.tokens++;
            }
        }
    }

    /**
     * Reset limit for a key
     */
    public resetLimit(key: string): void {
        this.limits.delete(key);
    }

    /**
     * Clear all limits
     */
    public clearAll(): void {
        this.limits.clear();
    }

    /**
     * Get limit info for a key
     */
    public getLimitInfo(key: string): any {
        const entry = this.limits.get(key);
        if (!entry) {
            return {
                exists: false,
                tokens: this.config.maxRequests + this.config.burstAllowance,
                blocked: false,
            };
        }

        const now = Date.now();
        return {
            exists: true,
            tokens: Math.floor(entry.tokens),
            blocked: entry.blocked && now < entry.blockedUntil,
            blockedUntil: entry.blocked ? new Date(entry.blockedUntil).toISOString() : null,
            requestCount: entry.requestCount,
            recentRequests: entry.requestTimestamps.length,
        };
    }

    /**
     * Get statistics
     */
    public getStatistics(): any {
        const now = Date.now();
        const entries = Array.from(this.limits.values());

        return {
            total_clients: this.limits.size,
            blocked_clients: entries.filter(e => e.blocked && now < e.blockedUntil).length,
            total_requests: entries.reduce((sum, e) => sum + e.requestCount, 0),
            config: {
                max_requests: this.config.maxRequests,
                window_ms: this.config.windowMs,
                burst_allowance: this.config.burstAllowance,
                block_duration: this.config.blockDuration,
            },
        };
    }

    /**
     * Start periodic cleanup
     */
    private startCleanup(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000); // Every minute
    }

    /**
     * Stop cleanup
     */
    public stopCleanup(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        const expiredKeys: string[] = [];

        for (const [key, entry] of this.limits.entries()) {
            // Remove if not blocked and no recent activity
            if (!entry.blocked && entry.requestTimestamps.length === 0) {
                if (now - entry.lastRefill > this.config.windowMs * 2) {
                    expiredKeys.push(key);
                }
            }
        }

        for (const key of expiredKeys) {
            this.limits.delete(key);
        }

        if (expiredKeys.length > 0) {
            const logger = getLogger();
            logger.debug(`Cleaned up ${expiredKeys.length} expired rate limit entries`);
        }
    }

    /**
     * Shutdown rate limiter
     */
    public shutdown(): void {
        this.stopCleanup();
        this.limits.clear();
    }
}

/**
 * Multi-tier rate limiter
 * Supports different limits for different tiers (anonymous, authenticated, premium)
 */
export class MultiTierRateLimiter {
    private limiters: Map<string, RateLimiter> = new Map();

    constructor(
        private tiers: { [tier: string]: RateLimitConfig }
    ) {
        for (const [tier, config] of Object.entries(tiers)) {
            this.limiters.set(tier, new RateLimiter(config));
        }
    }

    /**
     * Check limit for a tier
     */
    public checkLimit(tier: string, key: string): RateLimitResult {
        const limiter = this.limiters.get(tier);
        if (!limiter) {
            throw new Error(`Unknown tier: ${tier}`);
        }

        return limiter.checkLimit(key);
    }

    /**
     * Record success for a tier
     */
    public recordSuccess(tier: string, key: string): void {
        const limiter = this.limiters.get(tier);
        if (limiter) {
            limiter.recordSuccess(key);
        }
    }

    /**
     * Record failure for a tier
     */
    public recordFailure(tier: string, key: string): void {
        const limiter = this.limiters.get(tier);
        if (limiter) {
            limiter.recordFailure(key);
        }
    }

    /**
     * Get statistics for all tiers
     */
    public getStatistics(): any {
        const stats: any = {};
        for (const [tier, limiter] of this.limiters.entries()) {
            stats[tier] = limiter.getStatistics();
        }
        return stats;
    }

    /**
     * Shutdown all limiters
     */
    public shutdown(): void {
        for (const limiter of this.limiters.values()) {
            limiter.shutdown();
        }
    }
}

// Singleton instances
let globalRateLimiter: RateLimiter | null = null;
let multiTierRateLimiter: MultiTierRateLimiter | null = null;

/**
 * Get or create the global rate limiter
 */
export function getRateLimiter(config?: Partial<RateLimitConfig>): RateLimiter {
    if (!globalRateLimiter) {
        globalRateLimiter = new RateLimiter(config);
    }
    return globalRateLimiter;
}

/**
 * Get or create the multi-tier rate limiter
 */
export function getMultiTierRateLimiter(): MultiTierRateLimiter {
    if (!multiTierRateLimiter) {
        multiTierRateLimiter = new MultiTierRateLimiter({
            anonymous: {
                maxRequests: 60,
                windowMs: 60000,
                burstAllowance: 10,
                blockDuration: 300000,
                skipSuccessfulRequests: false,
                skipFailedRequests: false,
            },
            authenticated: {
                maxRequests: 200,
                windowMs: 60000,
                burstAllowance: 20,
                blockDuration: 180000,
                skipSuccessfulRequests: false,
                skipFailedRequests: false,
            },
            premium: {
                maxRequests: 1000,
                windowMs: 60000,
                burstAllowance: 50,
                blockDuration: 60000,
                skipSuccessfulRequests: false,
                skipFailedRequests: false,
            },
        });
    }
    return multiTierRateLimiter;
}

/**
 * Reset singletons (for testing)
 */
export function resetRateLimiters(): void {
    if (globalRateLimiter) {
        globalRateLimiter.shutdown();
        globalRateLimiter = null;
    }
    if (multiTierRateLimiter) {
        multiTierRateLimiter.shutdown();
        multiTierRateLimiter = null;
    }
}
