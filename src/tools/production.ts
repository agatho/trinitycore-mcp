/**
 * MCP Tools for Production Operations
 *
 * Provides 3 production management tools:
 * 1. trigger-backup - Create a new backup manually
 * 2. verify-backup - Verify backup integrity
 * 3. get-security-status - Get security and access control status
 *
 * @module tools/production
 */

import { getBackupManager, BackupType } from '../security/BackupManager';
import { getSecurityManager, APIKey } from '../security/SecurityManager';
import { getLoadBalancer} from '../security/LoadBalancer';
import { getRateLimiter, getMultiTierRateLimiter } from '../security/RateLimiter';

/**
 * Tool 1: trigger-backup
 * Manually trigger a backup operation
 */
export async function triggerBackup(options?: {
    type?: 'full' | 'incremental';
    description?: string;
}): Promise<string> {
    try {
        const backupManager = getBackupManager();
        const backupType = options?.type === 'incremental' ? BackupType.INCREMENTAL : BackupType.FULL;
        const description = options?.description || 'Manual backup triggered via MCP';

        const backup = await backupManager.createBackup(backupType, description);

        return JSON.stringify({
            success: true,
            backup: {
                id: backup.id,
                type: backup.type,
                status: backup.status,
                created_at: new Date(backup.createdAt).toISOString(),
                completed_at: backup.completedAt ? new Date(backup.completedAt).toISOString() : null,
                file_path: backup.filePath,
                file_size_mb: Math.round(backup.fileSize / 1024 / 1024),
                checksum: backup.checksum,
                compressed: backup.compressed,
                encrypted: backup.encrypted,
                duration_ms: backup.completedAt ? backup.completedAt - backup.createdAt : null,
            },
            message: `${backupType} backup created successfully`,
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Failed to create backup',
        }, null, 2);
    }
}

/**
 * Tool 2: verify-backup
 * Verify the integrity of a backup
 */
export async function verifyBackup(options: {
    backup_id?: string;
    verify_all?: boolean;
}): Promise<string> {
    try {
        const backupManager = getBackupManager();

        if (options.verify_all) {
            // Verify all backups
            const backups = backupManager.listBackups();
            const results = [];

            for (const backup of backups) {
                const verified = await backupManager.verifyBackup(backup.id);
                results.push({
                    backup_id: backup.id,
                    verified,
                    status: backup.status,
                    created_at: new Date(backup.createdAt).toISOString(),
                    file_size_mb: Math.round(backup.fileSize / 1024 / 1024),
                });
            }

            const totalBackups = results.length;
            const verifiedBackups = results.filter(r => r.verified).length;
            const failedBackups = totalBackups - verifiedBackups;

            return JSON.stringify({
                success: true,
                summary: {
                    total_backups: totalBackups,
                    verified: verifiedBackups,
                    failed: failedBackups,
                    verification_rate: totalBackups > 0
                        ? ((verifiedBackups / totalBackups) * 100).toFixed(2) + '%'
                        : '0%',
                },
                backups: results,
            }, null, 2);
        } else if (options.backup_id) {
            // Verify specific backup
            const backup = backupManager.getBackup(options.backup_id);
            if (!backup) {
                return JSON.stringify({
                    success: false,
                    error: `Backup not found: ${options.backup_id}`,
                }, null, 2);
            }

            const verified = await backupManager.verifyBackup(options.backup_id);

            return JSON.stringify({
                success: true,
                backup: {
                    id: backup.id,
                    verified,
                    status: backup.status,
                    type: backup.type,
                    created_at: new Date(backup.createdAt).toISOString(),
                    file_path: backup.filePath,
                    file_size_mb: Math.round(backup.fileSize / 1024 / 1024),
                    checksum: backup.checksum,
                },
                message: verified
                    ? 'Backup verification successful'
                    : 'Backup verification failed - checksum mismatch or file missing',
            }, null, 2);
        } else {
            return JSON.stringify({
                success: false,
                error: 'Either backup_id or verify_all must be specified',
            }, null, 2);
        }
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Failed to verify backup',
        }, null, 2);
    }
}

/**
 * Tool 3: get-security-status
 * Get comprehensive security status including API keys, rate limits, and backups
 */
export async function getSecurityStatus(): Promise<string> {
    try {
        const securityManager = getSecurityManager();
        const backupManager = getBackupManager();
        const loadBalancer = getLoadBalancer();
        const rateLimiter = getRateLimiter();
        const multiTierRateLimiter = getMultiTierRateLimiter();

        // Get security statistics
        const securityStats = securityManager.getStatistics();
        const backupStats = backupManager.getStatistics();
        const loadBalancerStats = loadBalancer.getStatistics();
        const rateLimiterStats = rateLimiter.getStatistics();
        const multiTierStats = multiTierRateLimiter.getStatistics();

        // Get API key details
        const apiKeys = securityManager.listApiKeys();
        const now = Date.now();
        const expiringSoon = apiKeys.filter((k: APIKey) =>
            k.expiresAt && new Date(k.expiresAt).getTime() - now < 7 * 24 * 60 * 60 * 1000 // 7 days
        );

        // Get recent backups
        const recentBackups = backupManager.listBackups().slice(0, 5);

        return JSON.stringify({
            security: {
                api_keys: {
                    total: securityStats.apiKeys.total,
                    active: securityStats.apiKeys.active,
                    expired: securityStats.apiKeys.expired,
                    expiring_soon: expiringSoon.length,
                },
                rate_limits: {
                    active: securityStats.rateLimits.active,
                    blocked: securityStats.rateLimits.blocked,
                },
                threats: securityStats.threats,
                audit: securityStats.audit,
            },
            rate_limiting: {
                global: {
                    total_clients: rateLimiterStats.total_clients,
                    blocked_clients: rateLimiterStats.blocked_clients,
                    total_requests: rateLimiterStats.total_requests,
                    config: rateLimiterStats.config,
                },
                by_tier: multiTierStats,
            },
            load_balancing: {
                total_servers: loadBalancerStats.total_servers,
                healthy_servers: loadBalancerStats.healthy_servers,
                unhealthy_servers: loadBalancerStats.unhealthy_servers,
                total_connections: loadBalancerStats.total_connections,
                active_sessions: loadBalancerStats.active_sessions,
                algorithm: loadBalancerStats.algorithm,
                servers: loadBalancerStats.servers,
            },
            backups: {
                total_backups: backupStats.total_backups,
                total_size_mb: backupStats.total_size_mb,
                by_status: backupStats.by_status,
                by_type: backupStats.by_type,
                oldest_backup: backupStats.oldest_backup,
                newest_backup: backupStats.newest_backup,
                schedule_active: backupStats.schedule_active,
                current_backup: backupStats.current_backup,
                recent_backups: recentBackups.map(b => ({
                    id: b.id,
                    type: b.type,
                    status: b.status,
                    created_at: new Date(b.createdAt).toISOString(),
                    size_mb: Math.round(b.fileSize / 1024 / 1024),
                })),
            },
            alerts: {
                expiring_api_keys: expiringSoon.map((k: APIKey) => ({
                    key: k.key,
                    name: k.name,
                    expires_at: k.expiresAt,
                    days_remaining: k.expiresAt
                        ? Math.floor((new Date(k.expiresAt).getTime() - now) / (24 * 60 * 60 * 1000))
                        : null,
                })),
                unhealthy_servers: loadBalancerStats.servers
                    .filter((s: any) => !s.healthy)
                    .map((s: any) => ({
                        id: s.id,
                        host: s.host,
                        port: s.port,
                        failure_count: s.failure_count,
                    })),
                failed_backups: recentBackups
                    .filter(b => b.status === 'failed')
                    .map(b => ({
                        id: b.id,
                        created_at: new Date(b.createdAt).toISOString(),
                    })),
            },
            overall_status: {
                security_healthy: securityStats.apiKeys.active > 0,
                load_balancer_healthy: loadBalancerStats.healthy_servers > 0,
                backups_healthy: backupStats.by_status.verified > 0 || backupStats.by_status.completed > 0,
                rate_limiter_active: true,
            },
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            message: 'Failed to get security status',
        }, null, 2);
    }
}

/**
 * Helper: List all backups
 */
export async function listBackups(): Promise<string> {
    try {
        const backupManager = getBackupManager();
        const backups = backupManager.listBackups();

        return JSON.stringify({
            total_backups: backups.length,
            backups: backups.map(b => ({
                id: b.id,
                type: b.type,
                status: b.status,
                created_at: new Date(b.createdAt).toISOString(),
                completed_at: b.completedAt ? new Date(b.completedAt).toISOString() : null,
                file_path: b.filePath,
                size_mb: Math.round(b.fileSize / 1024 / 1024),
                checksum: b.checksum,
                metadata: b.metadata,
            })),
        }, null, 2);
    } catch (error) {
        return JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
        }, null, 2);
    }
}
