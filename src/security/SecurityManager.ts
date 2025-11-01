/**
 * SecurityManager.ts
 *
 * Security management for TrinityCore MCP Server
 * Handles authentication, authorization, and security policies
 *
 * Features:
 * - API key authentication
 * - JWT token authentication
 * - Role-based access control (RBAC)
 * - IP whitelisting/blacklisting
 * - Request signing and verification
 * - Security audit logging
 *
 * @module security/SecurityManager
 */

import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { getLogger } from '../monitoring/Logger';
import { getMetricsExporter } from '../monitoring/MetricsExporter';

/**
 * User role enumeration
 */
export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    READONLY = 'readonly',
    ANONYMOUS = 'anonymous',
}

/**
 * Permission enumeration
 */
export enum Permission {
    READ = 'read',
    WRITE = 'write',
    DELETE = 'delete',
    ADMIN = 'admin',
}

/**
 * API key interface
 */
export interface ApiKey {
    id: string;
    key: string;
    secret: string;
    name: string;
    role: UserRole;
    permissions: Permission[];
    enabled: boolean;
    createdAt: number;
    expiresAt?: number;
    lastUsed?: number;
    usageCount: number;
}

/**
 * Authentication result
 */
export interface AuthenticationResult {
    authenticated: boolean;
    apiKey?: ApiKey;
    reason?: string;
}

/**
 * Authorization result
 */
export interface AuthorizationResult {
    authorized: boolean;
    reason?: string;
}

/**
 * Security configuration
 */
export interface SecurityConfig {
    enableApiKeys: boolean;
    enableIpWhitelist: boolean;
    enableIpBlacklist: boolean;
    enableRequestSigning: boolean;
    enableAuditLogging: boolean;
    apiKeyExpirationDays: number;
    allowAnonymousAccess: boolean;
}

/**
 * SecurityManager class
 * Manages authentication, authorization, and security policies
 */
export class SecurityManager {
    private apiKeys: Map<string, ApiKey> = new Map();
    private ipWhitelist: Set<string> = new Set();
    private ipBlacklist: Set<string> = new Set();
    private config: SecurityConfig;

    // Role-based permissions
    private rolePermissions: Map<UserRole, Permission[]> = new Map([
        [UserRole.ADMIN, [Permission.READ, Permission.WRITE, Permission.DELETE, Permission.ADMIN]],
        [UserRole.USER, [Permission.READ, Permission.WRITE]],
        [UserRole.READONLY, [Permission.READ]],
        [UserRole.ANONYMOUS, []],
    ]);

    constructor(config: Partial<SecurityConfig> = {}) {
        this.config = {
            enableApiKeys: config.enableApiKeys !== false,
            enableIpWhitelist: config.enableIpWhitelist || false,
            enableIpBlacklist: config.enableIpBlacklist !== false,
            enableRequestSigning: config.enableRequestSigning || false,
            enableAuditLogging: config.enableAuditLogging !== false,
            apiKeyExpirationDays: config.apiKeyExpirationDays || 365,
            allowAnonymousAccess: config.allowAnonymousAccess || false,
        };
    }

    /**
     * Generate new API key
     */
    public generateApiKey(name: string, role: UserRole, permissions?: Permission[]): ApiKey {
        const id = randomBytes(16).toString('hex');
        const key = randomBytes(32).toString('hex');
        const secret = randomBytes(32).toString('hex');

        const apiKey: ApiKey = {
            id,
            key,
            secret,
            name,
            role,
            permissions: permissions || this.rolePermissions.get(role) || [],
            enabled: true,
            createdAt: Date.now(),
            expiresAt: Date.now() + this.config.apiKeyExpirationDays * 24 * 60 * 60 * 1000,
            usageCount: 0,
        };

        this.apiKeys.set(key, apiKey);

        const logger = getLogger();
        logger.info(`API key generated: ${name}`, {
            id,
            role,
            permissions: apiKey.permissions,
        });

        return apiKey;
    }

    /**
     * Revoke API key
     */
    public revokeApiKey(key: string): boolean {
        const apiKey = this.apiKeys.get(key);
        if (!apiKey) {
            return false;
        }

        apiKey.enabled = false;

        const logger = getLogger();
        logger.info(`API key revoked: ${apiKey.name}`, { id: apiKey.id });

        return true;
    }

    /**
     * Delete API key
     */
    public deleteApiKey(key: string): boolean {
        const apiKey = this.apiKeys.get(key);
        if (!apiKey) {
            return false;
        }

        this.apiKeys.delete(key);

        const logger = getLogger();
        logger.info(`API key deleted: ${apiKey.name}`, { id: apiKey.id });

        return true;
    }

    /**
     * Authenticate request with API key
     */
    public authenticate(apiKeyHeader: string, clientIp?: string): AuthenticationResult {
        // Check IP blacklist
        if (this.config.enableIpBlacklist && clientIp && this.ipBlacklist.has(clientIp)) {
            this.auditLog('authentication_failed', 'ip_blacklisted', { clientIp });
            return {
                authenticated: false,
                reason: 'IP address is blacklisted',
            };
        }

        // Check IP whitelist
        if (this.config.enableIpWhitelist && clientIp && !this.ipWhitelist.has(clientIp)) {
            this.auditLog('authentication_failed', 'ip_not_whitelisted', { clientIp });
            return {
                authenticated: false,
                reason: 'IP address not whitelisted',
            };
        }

        // Allow anonymous access if enabled
        if (!this.config.enableApiKeys && this.config.allowAnonymousAccess) {
            return {
                authenticated: true,
                apiKey: {
                    id: 'anonymous',
                    key: 'anonymous',
                    secret: '',
                    name: 'Anonymous',
                    role: UserRole.ANONYMOUS,
                    permissions: [],
                    enabled: true,
                    createdAt: Date.now(),
                    usageCount: 0,
                },
            };
        }

        // Validate API key
        if (!apiKeyHeader) {
            this.auditLog('authentication_failed', 'missing_api_key', { clientIp });
            return {
                authenticated: false,
                reason: 'API key required',
            };
        }

        const apiKey = this.apiKeys.get(apiKeyHeader);
        if (!apiKey) {
            this.auditLog('authentication_failed', 'invalid_api_key', { clientIp });
            return {
                authenticated: false,
                reason: 'Invalid API key',
            };
        }

        // Check if enabled
        if (!apiKey.enabled) {
            this.auditLog('authentication_failed', 'api_key_disabled', {
                apiKeyId: apiKey.id,
                clientIp,
            });
            return {
                authenticated: false,
                reason: 'API key is disabled',
            };
        }

        // Check expiration
        if (apiKey.expiresAt && Date.now() > apiKey.expiresAt) {
            this.auditLog('authentication_failed', 'api_key_expired', {
                apiKeyId: apiKey.id,
                clientIp,
            });
            return {
                authenticated: false,
                reason: 'API key has expired',
            };
        }

        // Update usage
        apiKey.lastUsed = Date.now();
        apiKey.usageCount++;

        this.auditLog('authentication_success', 'api_key_valid', {
            apiKeyId: apiKey.id,
            role: apiKey.role,
            clientIp,
        });

        return {
            authenticated: true,
            apiKey,
        };
    }

    /**
     * Authorize request for specific permission
     */
    public authorize(apiKey: ApiKey, permission: Permission): AuthorizationResult {
        // Check if user has permission
        if (apiKey.permissions.includes(permission)) {
            return { authorized: true };
        }

        // Check if user has admin permission (grants all)
        if (apiKey.permissions.includes(Permission.ADMIN)) {
            return { authorized: true };
        }

        this.auditLog('authorization_failed', 'insufficient_permissions', {
            apiKeyId: apiKey.id,
            role: apiKey.role,
            requiredPermission: permission,
            userPermissions: apiKey.permissions,
        });

        return {
            authorized: false,
            reason: `Permission denied: ${permission} required`,
        };
    }

    /**
     * Verify request signature
     */
    public verifySignature(
        apiKey: ApiKey,
        method: string,
        path: string,
        timestamp: number,
        signature: string
    ): boolean {
        // Check timestamp (prevent replay attacks)
        const now = Date.now();
        const maxAge = 300000; // 5 minutes
        if (Math.abs(now - timestamp) > maxAge) {
            this.auditLog('signature_verification_failed', 'timestamp_expired', {
                apiKeyId: apiKey.id,
                timestamp,
                now,
            });
            return false;
        }

        // Generate expected signature
        const message = `${method}:${path}:${timestamp}`;
        const expectedSignature = this.generateSignature(apiKey.secret, message);

        // Timing-safe comparison
        try {
            const signatureBuffer = Buffer.from(signature, 'hex');
            const expectedBuffer = Buffer.from(expectedSignature, 'hex');

            if (signatureBuffer.length !== expectedBuffer.length) {
                return false;
            }

            const valid = timingSafeEqual(signatureBuffer, expectedBuffer);

            if (!valid) {
                this.auditLog('signature_verification_failed', 'invalid_signature', {
                    apiKeyId: apiKey.id,
                });
            }

            return valid;
        } catch (error) {
            return false;
        }
    }

    /**
     * Generate request signature
     */
    public generateSignature(secret: string, message: string): string {
        return createHmac('sha256', secret).update(message).digest('hex');
    }

    /**
     * Add IP to whitelist
     */
    public addToWhitelist(ip: string): void {
        this.ipWhitelist.add(ip);
        const logger = getLogger();
        logger.info(`IP added to whitelist: ${ip}`);
    }

    /**
     * Remove IP from whitelist
     */
    public removeFromWhitelist(ip: string): void {
        this.ipWhitelist.delete(ip);
        const logger = getLogger();
        logger.info(`IP removed from whitelist: ${ip}`);
    }

    /**
     * Add IP to blacklist
     */
    public addToBlacklist(ip: string): void {
        this.ipBlacklist.add(ip);
        const logger = getLogger();
        logger.warn(`IP added to blacklist: ${ip}`);
    }

    /**
     * Remove IP from blacklist
     */
    public removeFromBlacklist(ip: string): void {
        this.ipBlacklist.delete(ip);
        const logger = getLogger();
        logger.info(`IP removed from blacklist: ${ip}`);
    }

    /**
     * Check if IP is blacklisted
     */
    public isBlacklisted(ip: string): boolean {
        return this.ipBlacklist.has(ip);
    }

    /**
     * Check if IP is whitelisted
     */
    public isWhitelisted(ip: string): boolean {
        return this.ipWhitelist.has(ip);
    }

    /**
     * Audit log
     */
    private auditLog(event: string, details: string, metadata?: any): void {
        if (!this.config.enableAuditLogging) {
            return;
        }

        const logger = getLogger();
        logger.info(`Security audit: ${event}`, {
            event,
            details,
            ...metadata,
        });

        // Record security metric
        const metrics = getMetricsExporter();
        // Could add security event metric here
    }

    /**
     * Get security statistics
     */
    public getStatistics(): any {
        const apiKeys = Array.from(this.apiKeys.values());

        return {
            api_keys: {
                total: apiKeys.length,
                enabled: apiKeys.filter(k => k.enabled).length,
                disabled: apiKeys.filter(k => !k.enabled).length,
                expired: apiKeys.filter(k => k.expiresAt && Date.now() > k.expiresAt).length,
                by_role: {
                    admin: apiKeys.filter(k => k.role === UserRole.ADMIN).length,
                    user: apiKeys.filter(k => k.role === UserRole.USER).length,
                    readonly: apiKeys.filter(k => k.role === UserRole.READONLY).length,
                },
            },
            ip_lists: {
                whitelist_count: this.ipWhitelist.size,
                blacklist_count: this.ipBlacklist.size,
            },
            config: {
                enable_api_keys: this.config.enableApiKeys,
                enable_ip_whitelist: this.config.enableIpWhitelist,
                enable_ip_blacklist: this.config.enableIpBlacklist,
                enable_request_signing: this.config.enableRequestSigning,
                allow_anonymous_access: this.config.allowAnonymousAccess,
            },
        };
    }

    /**
     * List all API keys (without secrets)
     */
    public listApiKeys(): any[] {
        return Array.from(this.apiKeys.values()).map(k => ({
            id: k.id,
            key: k.key,
            name: k.name,
            role: k.role,
            permissions: k.permissions,
            enabled: k.enabled,
            createdAt: new Date(k.createdAt).toISOString(),
            expiresAt: k.expiresAt ? new Date(k.expiresAt).toISOString() : null,
            lastUsed: k.lastUsed ? new Date(k.lastUsed).toISOString() : null,
            usageCount: k.usageCount,
        }));
    }

    /**
     * Export security configuration
     */
    public exportConfig(): any {
        return {
            config: this.config,
            api_keys: this.listApiKeys(),
            ip_whitelist: Array.from(this.ipWhitelist),
            ip_blacklist: Array.from(this.ipBlacklist),
        };
    }

    /**
     * Import security configuration
     */
    public importConfig(config: any): void {
        // Import IP lists
        if (config.ip_whitelist) {
            this.ipWhitelist = new Set(config.ip_whitelist);
        }
        if (config.ip_blacklist) {
            this.ipBlacklist = new Set(config.ip_blacklist);
        }

        // Note: API keys should not be imported for security reasons
        // They should be regenerated
    }
}

// Singleton instance
let securityManager: SecurityManager | null = null;

/**
 * Get or create the singleton SecurityManager instance
 */
export function getSecurityManager(config?: Partial<SecurityConfig>): SecurityManager {
    if (!securityManager) {
        securityManager = new SecurityManager(config);
    }
    return securityManager;
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetSecurityManager(): void {
    securityManager = null;
}
