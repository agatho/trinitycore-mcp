import { EventEmitter } from 'events';
import * as crypto from 'crypto';

/**
 * Rate limit strategy types
 */
export enum RateLimitStrategy {
  TOKEN_BUCKET = 'token_bucket',
  SLIDING_WINDOW = 'sliding_window',
  FIXED_WINDOW = 'fixed_window',
  LEAKY_BUCKET = 'leaky_bucket'
}

/**
 * Security threat levels
 */
export enum ThreatLevel {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  strategy: RateLimitStrategy;
  maxRequests: number;
  windowMs: number;
  burstSize?: number;
  leakRate?: number;
}

/**
 * Token bucket state
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

/**
 * Sliding window state
 */
interface SlidingWindow {
  requests: number[];
  windowMs: number;
  maxRequests: number;
}

/**
 * Fixed window state
 */
interface FixedWindow {
  count: number;
  windowStart: number;
  windowMs: number;
  maxRequests: number;
}

/**
 * Leaky bucket state
 */
interface LeakyBucket {
  queue: number[];
  lastLeak: number;
  capacity: number;
  leakRate: number;
}

/**
 * API key information
 */
export interface APIKey {
  key: string;
  secret: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
  rateLimit?: RateLimitConfig;
}

/**
 * Security audit log entry
 */
export interface AuditLogEntry {
  timestamp: Date;
  eventType: string;
  severity: ThreatLevel;
  userId?: string;
  ip?: string;
  resource?: string;
  action?: string;
  success: boolean;
  details?: any;
  threat?: ThreatAssessment;
}

/**
 * Threat assessment result
 */
export interface ThreatAssessment {
  level: ThreatLevel;
  score: number;
  factors: string[];
  recommended: string;
}

/**
 * Input validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized?: any;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    strategy: RateLimitStrategy;
    maxRequests: number;
    windowMs: number;
  };
  encryption: {
    algorithm: string;
    keySize: number;
  };
  apiKeys: {
    enabled: boolean;
    expirationDays: number;
  };
  inputValidation: {
    enabled: boolean;
    maxLength: number;
    allowedPatterns: RegExp[];
  };
  threatDetection: {
    enabled: boolean;
    blockThreshold: number;
  };
  auditLogging: {
    enabled: boolean;
    retentionDays: number;
  };
}

/**
 * Enterprise-grade security manager
 * Provides comprehensive security features including rate limiting,
 * input validation, encryption, threat detection, and audit logging
 */
export class SecurityManager extends EventEmitter {
  private config: SecurityConfig;
  private tokenBuckets: Map<string, TokenBucket> = new Map();
  private slidingWindows: Map<string, SlidingWindow> = new Map();
  private fixedWindows: Map<string, FixedWindow> = new Map();
  private leakyBuckets: Map<string, LeakyBucket> = new Map();
  private apiKeys: Map<string, APIKey> = new Map();
  private blockedIPs: Set<string> = new Set();
  private threatScores: Map<string, number> = new Map();
  private auditLog: AuditLogEntry[] = [];
  private encryptionKey: Buffer;

  constructor(config: Partial<SecurityConfig> = {}) {
    super();
    
    this.config = {
      rateLimiting: {
        enabled: true,
        strategy: RateLimitStrategy.TOKEN_BUCKET,
        maxRequests: 100,
        windowMs: 60000,
        ...config.rateLimiting
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keySize: 32,
        ...config.encryption
      },
      apiKeys: {
        enabled: true,
        expirationDays: 365,
        ...config.apiKeys
      },
      inputValidation: {
        enabled: true,
        maxLength: 10000,
        allowedPatterns: [],
        ...config.inputValidation
      },
      threatDetection: {
        enabled: true,
        blockThreshold: 75,
        ...config.threatDetection
      },
      auditLogging: {
        enabled: true,
        retentionDays: 90,
        ...config.auditLogging
      }
    };

    // Generate encryption key
    this.encryptionKey = crypto.randomBytes(this.config.encryption.keySize);

    // Start cleanup intervals
    this.startCleanupIntervals();
  }

  /**
   * Check rate limit for an identifier
   */
  public checkRateLimit(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetAt?: Date } {
    if (!this.config.rateLimiting.enabled) {
      return { allowed: true, remaining: Infinity };
    }

    const strategy = config?.strategy || this.config.rateLimiting.strategy;

    switch (strategy) {
      case RateLimitStrategy.TOKEN_BUCKET:
        return this.checkTokenBucket(identifier, config);
      case RateLimitStrategy.SLIDING_WINDOW:
        return this.checkSlidingWindow(identifier, config);
      case RateLimitStrategy.FIXED_WINDOW:
        return this.checkFixedWindow(identifier, config);
      case RateLimitStrategy.LEAKY_BUCKET:
        return this.checkLeakyBucket(identifier, config);
      default:
        return { allowed: true, remaining: Infinity };
    }
  }

  /**
   * Token bucket rate limiting
   */
  private checkTokenBucket(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; remaining: number } {
    const maxRequests = config?.maxRequests || this.config.rateLimiting.maxRequests;
    const windowMs = config?.windowMs || this.config.rateLimiting.windowMs;
    const refillRate = maxRequests / (windowMs / 1000);

    let bucket = this.tokenBuckets.get(identifier);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: maxRequests,
        lastRefill: now,
        capacity: maxRequests,
        refillRate
      };
      this.tokenBuckets.set(identifier, bucket);
    }

    // Refill tokens
    const elapsed = (now - bucket.lastRefill) / 1000;
    bucket.tokens = Math.min(
      bucket.capacity,
      bucket.tokens + elapsed * bucket.refillRate
    );
    bucket.lastRefill = now;

    // Check if request allowed
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, remaining: Math.floor(bucket.tokens) };
    }

    return { allowed: false, remaining: 0 };
  }

  /**
   * Sliding window rate limiting
   */
  private checkSlidingWindow(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; remaining: number } {
    const maxRequests = config?.maxRequests || this.config.rateLimiting.maxRequests;
    const windowMs = config?.windowMs || this.config.rateLimiting.windowMs;

    let window = this.slidingWindows.get(identifier);
    const now = Date.now();

    if (!window) {
      window = {
        requests: [],
        windowMs,
        maxRequests
      };
      this.slidingWindows.set(identifier, window);
    }

    // Remove old requests
    window.requests = window.requests.filter(time => now - time < windowMs);

    // Check if request allowed
    if (window.requests.length < maxRequests) {
      window.requests.push(now);
      return { allowed: true, remaining: maxRequests - window.requests.length };
    }

    return { allowed: false, remaining: 0 };
  }

  /**
   * Fixed window rate limiting
   */
  private checkFixedWindow(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; remaining: number; resetAt: Date } {
    const maxRequests = config?.maxRequests || this.config.rateLimiting.maxRequests;
    const windowMs = config?.windowMs || this.config.rateLimiting.windowMs;

    let window = this.fixedWindows.get(identifier);
    const now = Date.now();

    if (!window) {
      window = {
        count: 0,
        windowStart: now,
        windowMs,
        maxRequests
      };
      this.fixedWindows.set(identifier, window);
    }

    // Reset window if expired
    if (now - window.windowStart >= windowMs) {
      window.count = 0;
      window.windowStart = now;
    }

    // Check if request allowed
    if (window.count < maxRequests) {
      window.count++;
      const resetAt = new Date(window.windowStart + windowMs);
      return { 
        allowed: true, 
        remaining: maxRequests - window.count,
        resetAt 
      };
    }

    const resetAt = new Date(window.windowStart + windowMs);
    return { allowed: false, remaining: 0, resetAt };
  }

  /**
   * Leaky bucket rate limiting
   */
  private checkLeakyBucket(
    identifier: string,
    config?: RateLimitConfig
  ): { allowed: boolean; remaining: number } {
    const capacity = config?.burstSize || this.config.rateLimiting.maxRequests;
    const leakRate = config?.leakRate || 1;

    let bucket = this.leakyBuckets.get(identifier);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        queue: [],
        lastLeak: now,
        capacity,
        leakRate
      };
      this.leakyBuckets.set(identifier, bucket);
    }

    // Leak requests
    const elapsed = (now - bucket.lastLeak) / 1000;
    const leaked = Math.floor(elapsed * leakRate);
    bucket.queue.splice(0, leaked);
    bucket.lastLeak = now;

    // Check if request allowed
    if (bucket.queue.length < capacity) {
      bucket.queue.push(now);
      return { allowed: true, remaining: capacity - bucket.queue.length };
    }

    return { allowed: false, remaining: 0 };
  }

  /**
   * Validate and sanitize input
   */
  public validateInput(input: any, rules?: {
    type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    allowedValues?: any[];
    sanitize?: boolean;
  }): ValidationResult {
    if (!this.config.inputValidation.enabled) {
      return { valid: true, errors: [] };
    }

    const errors: string[] = [];
    let sanitized = input;

    // Required check
    if (rules?.required && (input === null || input === undefined || input === '')) {
      errors.push('Input is required');
      return { valid: false, errors };
    }

    // Type check
    if (rules?.type) {
      const actualType = Array.isArray(input) ? 'array' : typeof input;
      if (actualType !== rules.type) {
        errors.push(`Expected type ${rules.type}, got ${actualType}`);
      }
    }

    // String validations
    if (typeof input === 'string') {
      if (rules?.minLength && input.length < rules.minLength) {
        errors.push(`Minimum length is ${rules.minLength}`);
      }
      if (rules?.maxLength && input.length > rules.maxLength) {
        errors.push(`Maximum length is ${rules.maxLength}`);
      }
      if (rules?.pattern && !rules.pattern.test(input)) {
        errors.push('Input does not match required pattern');
      }

      // Sanitize
      if (rules?.sanitize) {
        sanitized = this.sanitizeString(input);
      }
    }

    // Allowed values
    if (rules?.allowedValues && !rules.allowedValues.includes(input)) {
      errors.push('Input is not in allowed values');
    }

    // SQL injection detection
    if (typeof input === 'string' && this.detectSQLInjection(input)) {
      errors.push('Potential SQL injection detected');
    }

    // XSS detection
    if (typeof input === 'string' && this.detectXSS(input)) {
      errors.push('Potential XSS attack detected');
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized: rules?.sanitize ? sanitized : undefined
    };
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/'/g, "''") // Escape single quotes
      .replace(/"/g, '&quot;') // Escape double quotes
      .replace(/&/g, '&amp;') // Escape ampersands
      .trim();
  }

  /**
   * Detect SQL injection attempts
   */
  private detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bSELECT\b.*\bFROM\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(--|;|\/\*|\*\/)/,
      /(\bOR\b.*=.*)/i,
      /(\bAND\b.*=.*)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect XSS attempts
   */
  private detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[^>]*>/gi,
      /<embed[^>]*>/gi,
      /<object[^>]*>/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Generate API key
   */
  public generateAPIKey(
    name: string,
    permissions: string[],
    expirationDays?: number
  ): APIKey {
    const key = crypto.randomBytes(32).toString('hex');
    const secret = crypto.randomBytes(64).toString('hex');
    
    const expiresAt = expirationDays
      ? new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey: APIKey = {
      key,
      secret,
      name,
      permissions,
      createdAt: new Date(),
      expiresAt,
      usageCount: 0
    };

    this.apiKeys.set(key, apiKey);

    this.logAudit({
      timestamp: new Date(),
      eventType: 'api_key_generated',
      severity: ThreatLevel.NONE,
      resource: name,
      action: 'generate',
      success: true
    });

    return apiKey;
  }

  /**
   * Validate API key
   */
  public validateAPIKey(key: string): { valid: boolean; apiKey?: APIKey; error?: string } {
    const apiKey = this.apiKeys.get(key);

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Update usage
    apiKey.lastUsed = new Date();
    apiKey.usageCount++;

    return { valid: true, apiKey };
  }

  /**
   * Revoke API key
   */
  public revokeAPIKey(key: string): boolean {
    const revoked = this.apiKeys.delete(key);

    if (revoked) {
      this.logAudit({
        timestamp: new Date(),
        eventType: 'api_key_revoked',
        severity: ThreatLevel.LOW,
        resource: key,
        action: 'revoke',
        success: true
      });
    }

    return revoked;
  }

  /**
   * Sign request with HMAC
   */
  public signRequest(data: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(data));
    return hmac.digest('hex');
  }

  /**
   * Verify request signature
   */
  public verifySignature(data: any, signature: string, secret: string): boolean {
    const expectedSignature = this.signRequest(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Encrypt data
   */
  public encrypt(data: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.config.encryption.algorithm,
      this.encryptionKey,
      iv
    ) as crypto.CipherGCM;

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * Decrypt data
   */
  public decrypt(encrypted: string, iv: string, tag: string): string {
    const decipher = crypto.createDecipheriv(
      this.config.encryption.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    ) as crypto.DecipherGCM;

    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Assess threat level
   */
  public assessThreat(
    identifier: string,
    factors: {
      rateLimitViolations?: number;
      invalidInputs?: number;
      blockedAttempts?: number;
      suspiciousPatterns?: number;
    }
  ): ThreatAssessment {
    let score = 0;
    const detectedFactors: string[] = [];

    if (factors.rateLimitViolations && factors.rateLimitViolations > 5) {
      score += factors.rateLimitViolations * 5;
      detectedFactors.push(`${factors.rateLimitViolations} rate limit violations`);
    }

    if (factors.invalidInputs && factors.invalidInputs > 3) {
      score += factors.invalidInputs * 10;
      detectedFactors.push(`${factors.invalidInputs} invalid inputs`);
    }

    if (factors.blockedAttempts && factors.blockedAttempts > 0) {
      score += factors.blockedAttempts * 20;
      detectedFactors.push(`${factors.blockedAttempts} blocked attempts`);
    }

    if (factors.suspiciousPatterns && factors.suspiciousPatterns > 0) {
      score += factors.suspiciousPatterns * 15;
      detectedFactors.push(`${factors.suspiciousPatterns} suspicious patterns`);
    }

    // Determine threat level
    let level: ThreatLevel;
    let recommended: string;

    if (score < 25) {
      level = ThreatLevel.NONE;
      recommended = 'Continue monitoring';
    } else if (score < 50) {
      level = ThreatLevel.LOW;
      recommended = 'Increase monitoring frequency';
    } else if (score < 75) {
      level = ThreatLevel.MEDIUM;
      recommended = 'Implement additional validation';
    } else if (score < 100) {
      level = ThreatLevel.HIGH;
      recommended = 'Consider temporary blocking';
    } else {
      level = ThreatLevel.CRITICAL;
      recommended = 'Block immediately';
      this.blockedIPs.add(identifier);
    }

    // Update threat score
    this.threatScores.set(identifier, score);

    const assessment: ThreatAssessment = {
      level,
      score,
      factors: detectedFactors,
      recommended
    };

    // Log threat assessment
    this.logAudit({
      timestamp: new Date(),
      eventType: 'threat_assessment',
      severity: level,
      userId: identifier,
      action: 'assess',
      success: true,
      threat: assessment
    });

    this.emit('threat-detected', { identifier, assessment });

    return assessment;
  }

  /**
   * Check if IP is blocked
   */
  public isBlocked(identifier: string): boolean {
    return this.blockedIPs.has(identifier);
  }

  /**
   * Block identifier
   */
  public block(identifier: string, reason: string): void {
    this.blockedIPs.add(identifier);

    this.logAudit({
      timestamp: new Date(),
      eventType: 'identifier_blocked',
      severity: ThreatLevel.HIGH,
      userId: identifier,
      action: 'block',
      success: true,
      details: { reason }
    });

    this.emit('identifier-blocked', { identifier, reason });
  }

  /**
   * Unblock identifier
   */
  public unblock(identifier: string): void {
    this.blockedIPs.delete(identifier);
    this.threatScores.delete(identifier);

    this.logAudit({
      timestamp: new Date(),
      eventType: 'identifier_unblocked',
      severity: ThreatLevel.LOW,
      userId: identifier,
      action: 'unblock',
      success: true
    });
  }

  /**
   * Log audit entry
   */
  public logAudit(entry: AuditLogEntry): void {
    if (!this.config.auditLogging.enabled) {
      return;
    }

    this.auditLog.push(entry);
    this.emit('audit-log', entry);
  }

  /**
   * Get audit log
   */
  public getAuditLog(filter?: {
    startDate?: Date;
    endDate?: Date;
    eventType?: string;
    severity?: ThreatLevel;
    userId?: string;
  }): AuditLogEntry[] {
    let filtered = [...this.auditLog];

    if (filter) {
      if (filter.startDate) {
        filtered = filtered.filter(e => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        filtered = filtered.filter(e => e.timestamp <= filter.endDate!);
      }
      if (filter.eventType) {
        filtered = filtered.filter(e => e.eventType === filter.eventType);
      }
      if (filter.severity !== undefined) {
        filtered = filtered.filter(e => e.severity === filter.severity);
      }
      if (filter.userId) {
        filtered = filtered.filter(e => e.userId === filter.userId);
      }
    }

    return filtered;
  }

  /**
   * Get security statistics
   */
  public getStatistics(): {
    rateLimits: { active: number; blocked: number };
    apiKeys: { total: number; expired: number; active: number };
    threats: { blocked: number; high: number; medium: number; low: number };
    audit: { total: number; critical: number; high: number };
  } {
    const now = new Date();
    const expiredKeys = Array.from(this.apiKeys.values()).filter(
      k => k.expiresAt && k.expiresAt < now
    ).length;

    const threatsByLevel = Array.from(this.threatScores.values()).reduce(
      (acc, score) => {
        if (score >= 100) acc.blocked++;
        else if (score >= 75) acc.high++;
        else if (score >= 50) acc.medium++;
        else if (score >= 25) acc.low++;
        return acc;
      },
      { blocked: 0, high: 0, medium: 0, low: 0 }
    );

    const criticalAudits = this.auditLog.filter(
      e => e.severity === ThreatLevel.CRITICAL
    ).length;
    const highAudits = this.auditLog.filter(
      e => e.severity === ThreatLevel.HIGH
    ).length;

    return {
      rateLimits: {
        active: this.tokenBuckets.size + this.slidingWindows.size + 
                this.fixedWindows.size + this.leakyBuckets.size,
        blocked: this.blockedIPs.size
      },
      apiKeys: {
        total: this.apiKeys.size,
        expired: expiredKeys,
        active: this.apiKeys.size - expiredKeys
      },
      threats: threatsByLevel,
      audit: {
        total: this.auditLog.length,
        critical: criticalAudits,
        high: highAudits
      }
    };
  }

  /**
   * Start cleanup intervals
   */
  private startCleanupIntervals(): void {
    // Clean expired API keys every hour
    setInterval(() => {
      const now = new Date();
      for (const [key, apiKey] of this.apiKeys.entries()) {
        if (apiKey.expiresAt && apiKey.expiresAt < now) {
          this.apiKeys.delete(key);
        }
      }
    }, 60 * 60 * 1000);

    // Clean old audit logs based on retention policy
    setInterval(() => {
      const cutoff = new Date(
        Date.now() - this.config.auditLogging.retentionDays * 24 * 60 * 60 * 1000
      );
      this.auditLog = this.auditLog.filter(e => e.timestamp > cutoff);
    }, 24 * 60 * 60 * 1000);

    // Clean stale rate limit entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const staleThreshold = 5 * 60 * 1000; // 5 minutes

      for (const [id, bucket] of this.tokenBuckets.entries()) {
        if (now - bucket.lastRefill > staleThreshold) {
          this.tokenBuckets.delete(id);
        }
      }

      for (const [id, bucket] of this.leakyBuckets.entries()) {
        if (now - bucket.lastLeak > staleThreshold) {
          this.leakyBuckets.delete(id);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Shutdown security manager
   */
  public shutdown(): void {
    this.tokenBuckets.clear();
    this.slidingWindows.clear();
    this.fixedWindows.clear();
    this.leakyBuckets.clear();
    this.blockedIPs.clear();
    this.threatScores.clear();
    this.emit('shutdown');
  }
}
