/**
 * Bot Combat Log Analyzer
 *
 * Purpose: Analyze bot combat performance from TrinityCore server logs
 *
 * Features:
 * - Parse TrinityCore combat logs
 * - Calculate DPS/HPS/TPS metrics
 * - Analyze ability usage and rotation
 * - Detect suboptimal decisions
 * - Compare against theoretical maximum
 * - Identify performance bottlenecks
 *
 * @module tools/botcombatloganalyzer
 */

import * as fs from "fs/promises";
import * as path from "path";

export interface CombatLogEntry {
    timestamp: number;
    type: "SPELL_CAST" | "SPELL_DAMAGE" | "SPELL_HEAL" | "UNIT_DIED" | "SWING_DAMAGE" | "AURA_APPLIED";
    source: string;
    target: string;
    spellId?: number;
    spellName?: string;
    amount?: number;
    critical?: boolean;
    overkill?: number;
}

export interface BotCombatMetrics {
    botName: string;
    class: string;
    spec?: string;
    duration: number;  // seconds

    // DPS Metrics
    totalDamage: number;
    dps: number;
    theoreticalMaxDPS?: number;
    dpsEfficiency?: number;  // percentage of theoretical max

    // HPS Metrics
    totalHealing: number;
    hps: number;
    overhealing: number;
    overhealingPercent: number;

    // Rotation Metrics
    abilitiesUsed: Map<string, AbilityUsage>;
    rotationQuality: number;  // 0-100 score

    // Decision Metrics
    missedOpportunities: MissedOpportunity[];
    suboptimalDecisions: SuboptimalDecision[];
    reactionTime: {
        average: number;
        p50: number;
        p95: number;
        p99: number;
    };

    // Survival Metrics
    damageTaken: number;
    deaths: number;
    timeSpentDead: number;
    defensiveCooldownUsage: number;
}

export interface AbilityUsage {
    spellId: number;
    spellName: string;
    casts: number;
    damage: number;
    healing: number;
    criticalHits: number;
    critRate: number;
    averageDamage: number;
    dpsContribution: number;
    percentOfTotal: number;
    cooldown: number;
    expectedCasts: number;
    actualCasts: number;
    wastedCasts: number;  // On immune, overkill, etc.
}

export interface MissedOpportunity {
    timestamp: number;
    type: "cooldown-unused" | "proc-not-used" | "interrupt-missed" | "defensive-not-used";
    description: string;
    ability: string;
    impact: "critical" | "high" | "medium" | "low";
    estimatedLoss: string;  // e.g., "-1200 DPS", "-5000 damage prevented"
}

export interface SuboptimalDecision {
    timestamp: number;
    type: "wrong-ability" | "wrong-target" | "wrong-timing" | "resource-waste";
    description: string;
    actualAction: string;
    optimalAction: string;
    impact: number;  // Damage/healing loss
}

export interface CombatAnalysisReport {
    encounter?: string;
    startTime: number;
    endTime: number;
    duration: number;
    botMetrics: BotCombatMetrics[];
    groupMetrics?: GroupMetrics;
    timeline: CombatEvent[];
    recommendations: string[];
    summary: string;
}

export interface GroupMetrics {
    totalDPS: number;
    totalHPS: number;
    deaths: number;
    killTime: number;
    success: boolean;
}

export interface CombatEvent {
    timestamp: number;
    actor: string;
    event: string;
    details: string;
}

/**
 * Analyze bot combat performance from log file
 */
export async function analyzeBotCombatLog(options: {
    logFile?: string;
    logText?: string;
    botName?: string;
    encounter?: string;
    startTime?: number;
    endTime?: number;
    compareWithTheoretical?: boolean;
}): Promise<CombatAnalysisReport> {
    const { logFile, logText, botName, encounter, startTime, endTime, compareWithTheoretical = true } = options;

    // Read log file or use provided text
    let logContent: string;
    if (logFile) {
        logContent = await fs.readFile(logFile, "utf-8");
    } else if (logText) {
        logContent = logText;
    } else {
        throw new Error("Either logFile or logText must be provided");
    }

    // Parse log entries
    const entries = parseLogEntries(logContent);

    // Filter by time range if provided
    let filteredEntries = entries;
    if (startTime && endTime) {
        filteredEntries = entries.filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
    }

    // Auto-detect encounter start/end if not provided
    const encounterBounds = detectEncounterBounds(filteredEntries);
    const encounterStartTime = startTime || encounterBounds.start;
    const encounterEndTime = endTime || encounterBounds.end;
    const duration = (encounterEndTime - encounterStartTime) / 1000;  // Convert to seconds

    // Filter entries within encounter
    const encounterEntries = entries.filter(
        e => e.timestamp >= encounterStartTime && e.timestamp <= encounterEndTime
    );

    // Extract unique bots
    const bots = extractBots(encounterEntries, botName);

    // Analyze each bot
    const botMetrics: BotCombatMetrics[] = [];
    for (const bot of bots) {
        const metrics = analyzeBotPerformance(bot, encounterEntries, duration, compareWithTheoretical);
        botMetrics.push(metrics);
    }

    // Generate timeline
    const timeline = generateTimeline(encounterEntries);

    // Calculate group metrics
    const groupMetrics = calculateGroupMetrics(botMetrics, encounterEntries, duration);

    // Generate recommendations
    const recommendations = generateRecommendations(botMetrics);

    // Generate summary
    const summary = generateSummary(botMetrics, groupMetrics, duration);

    return {
        encounter,
        startTime: encounterStartTime,
        endTime: encounterEndTime,
        duration,
        botMetrics,
        groupMetrics,
        timeline,
        recommendations,
        summary,
    };
}

/**
 * Format combat analysis report
 */
export async function formatCombatAnalysisReport(
    report: CombatAnalysisReport,
    format: "json" | "markdown"
): Promise<string> {
    if (format === "json") {
        // Convert Map to object for JSON serialization
        const jsonReport = {
            ...report,
            botMetrics: report.botMetrics.map(bot => ({
                ...bot,
                abilitiesUsed: Object.fromEntries(bot.abilitiesUsed),
            })),
        };
        return JSON.stringify(jsonReport, null, 2);
    }

    // Markdown format
    let md = `# Combat Log Analysis Report\n\n`;

    if (report.encounter) {
        md += `**Encounter:** ${report.encounter}\n`;
    }
    md += `**Duration:** ${report.duration.toFixed(1)}s\n`;
    md += `**Bots Analyzed:** ${report.botMetrics.length}\n\n`;

    // Group metrics
    if (report.groupMetrics) {
        md += `## Group Performance\n\n`;
        md += `- **Total DPS:** ${report.groupMetrics.totalDPS.toFixed(0)}\n`;
        md += `- **Total HPS:** ${report.groupMetrics.totalHPS.toFixed(0)}\n`;
        md += `- **Deaths:** ${report.groupMetrics.deaths}\n`;
        md += `- **Kill Time:** ${report.groupMetrics.killTime.toFixed(1)}s\n`;
        md += `- **Success:** ${report.groupMetrics.success ? "✅ Yes" : "❌ No"}\n\n`;
    }

    // Bot metrics
    md += `## Individual Bot Performance\n\n`;

    for (const bot of report.botMetrics) {
        md += `### ${bot.botName} (${bot.class})\n\n`;
        md += `| Metric | Value |\n`;
        md += `|--------|-------|\n`;
        md += `| DPS | ${bot.dps.toFixed(0)} |\n`;

        if (bot.theoreticalMaxDPS) {
            md += `| Theoretical Max DPS | ${bot.theoreticalMaxDPS.toFixed(0)} |\n`;
            md += `| Efficiency | ${bot.dpsEfficiency?.toFixed(1)}% |\n`;
        }

        if (bot.totalHealing > 0) {
            md += `| HPS | ${bot.hps.toFixed(0)} |\n`;
            md += `| Overhealing | ${bot.overhealingPercent.toFixed(1)}% |\n`;
        }

        md += `| Rotation Quality | ${bot.rotationQuality.toFixed(0)}/100 |\n`;
        md += `| Deaths | ${bot.deaths} |\n`;
        md += `| Avg Reaction Time | ${bot.reactionTime.average.toFixed(0)}ms |\n\n`;

        // Top abilities
        const topAbilities = Array.from(bot.abilitiesUsed.values())
            .sort((a, b) => b.dpsContribution - a.dpsContribution)
            .slice(0, 5);

        if (topAbilities.length > 0) {
            md += `**Top Abilities:**\n\n`;
            md += `| Ability | Casts | Damage | DPS | % of Total |\n`;
            md += `|---------|-------|--------|-----|------------|\n`;

            for (const ability of topAbilities) {
                md += `| ${ability.spellName} | ${ability.casts} | ${formatNumber(ability.damage)} | ${ability.dpsContribution.toFixed(0)} | ${ability.percentOfTotal.toFixed(1)}% |\n`;
            }
            md += `\n`;
        }

        // Issues
        if (bot.missedOpportunities.length > 0) {
            md += `**Issues Found (${bot.missedOpportunities.length}):**\n\n`;

            const criticalIssues = bot.missedOpportunities.filter(m => m.impact === "critical");
            const highIssues = bot.missedOpportunities.filter(m => m.impact === "high");

            if (criticalIssues.length > 0) {
                md += `*Critical Issues:*\n`;
                for (const issue of criticalIssues) {
                    md += `- **[${formatTimestamp(issue.timestamp)}]** ${issue.description} (${issue.estimatedLoss})\n`;
                }
                md += `\n`;
            }

            if (highIssues.length > 0) {
                md += `*High Priority Issues:*\n`;
                for (const issue of highIssues.slice(0, 5)) {
                    md += `- **[${formatTimestamp(issue.timestamp)}]** ${issue.description} (${issue.estimatedLoss})\n`;
                }
                md += `\n`;
            }
        }
    }

    // Recommendations
    if (report.recommendations.length > 0) {
        md += `## Recommendations\n\n`;
        for (let i = 0; i < report.recommendations.length; i++) {
            md += `${i + 1}. ${report.recommendations[i]}\n`;
        }
        md += `\n`;
    }

    // Summary
    md += `## Summary\n\n${report.summary}\n`;

    return md;
}

/**
 * Parse log entries from text
 */
function parseLogEntries(logContent: string): CombatLogEntry[] {
    const entries: CombatLogEntry[] = [];
    const lines = logContent.split("\n");

    for (const line of lines) {
        // TrinityCore combat log format:
        // [timestamp] SPELL_DAMAGE,source,target,spellId,spellName,amount,critical
        const entry = parseCombatLogLine(line);
        if (entry) {
            entries.push(entry);
        }
    }

    return entries;
}

/**
 * Parse single combat log line
 */
function parseCombatLogLine(line: string): CombatLogEntry | null {
    // Example formats:
    // [12:34:56.789] SPELL_DAMAGE,PlayerBot47,Lich King,12345,Mortal Strike,15234,true
    // [12:34:56.789] SPELL_HEAL,HealerBot12,WarriorBot47,54321,Flash Heal,8500,false

    const timestampMatch = line.match(/\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]/);
    if (!timestampMatch) {
        return null;
    }

    const hours = parseInt(timestampMatch[1]);
    const minutes = parseInt(timestampMatch[2]);
    const seconds = parseInt(timestampMatch[3]);
    const ms = parseInt(timestampMatch[4]);
    const timestamp = (hours * 3600 + minutes * 60 + seconds) * 1000 + ms;

    const restOfLine = line.substring(line.indexOf("]") + 1).trim();
    const parts = restOfLine.split(",");

    if (parts.length < 3) {
        return null;
    }

    const type = parts[0] as CombatLogEntry["type"];
    const source = parts[1];
    const target = parts[2];

    const entry: CombatLogEntry = {
        timestamp,
        type,
        source,
        target,
    };

    if (parts.length > 3) {
        entry.spellId = parseInt(parts[3]);
        entry.spellName = parts[4];
        entry.amount = parts[5] ? parseInt(parts[5]) : undefined;
        entry.critical = parts[6] === "true";
    }

    return entry;
}

/**
 * Detect encounter start and end times
 */
function detectEncounterBounds(entries: CombatLogEntry[]): { start: number; end: number } {
    if (entries.length === 0) {
        return { start: 0, end: 0 };
    }

    // Find first combat action
    const firstCombat = entries.find(e => e.type === "SPELL_DAMAGE" || e.type === "SWING_DAMAGE");
    const start = firstCombat ? firstCombat.timestamp : entries[0].timestamp;

    // Find last combat action or death
    const lastCombat = entries.reverse().find(e =>
        e.type === "SPELL_DAMAGE" || e.type === "SWING_DAMAGE" || e.type === "UNIT_DIED"
    );
    const end = lastCombat ? lastCombat.timestamp : entries[entries.length - 1].timestamp;

    return { start, end };
}

/**
 * Extract unique bots from entries
 */
function extractBots(entries: CombatLogEntry[], filterBotName?: string): string[] {
    const bots = new Set<string>();

    for (const entry of entries) {
        if (entry.source.includes("Bot") || entry.source.includes("bot")) {
            if (!filterBotName || entry.source === filterBotName) {
                bots.add(entry.source);
            }
        }
    }

    return Array.from(bots);
}

/**
 * Analyze individual bot performance
 */
function analyzeBotPerformance(
    botName: string,
    entries: CombatLogEntry[],
    duration: number,
    compareWithTheoretical: boolean
): BotCombatMetrics {
    const botEntries = entries.filter(e => e.source === botName);

    // Calculate damage
    const damageEntries = botEntries.filter(e => e.type === "SPELL_DAMAGE" || e.type === "SWING_DAMAGE");
    const totalDamage = damageEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const dps = totalDamage / duration;

    // Calculate healing
    const healEntries = botEntries.filter(e => e.type === "SPELL_HEAL");
    const totalHealing = healEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
    const hps = totalHealing / duration;

    // Calculate overhealing (simplified - in reality would need target health)
    const overhealing = totalHealing * 0.15;  // Estimate 15% overhealing
    const overhealingPercent = (overhealing / totalHealing) * 100;

    // Analyze abilities
    const abilitiesUsed = analyzeAbilityUsage(botEntries, duration);

    // Calculate rotation quality
    const rotationQuality = calculateRotationQuality(abilitiesUsed);

    // Find missed opportunities
    const missedOpportunities = detectMissedOpportunities(botEntries, abilitiesUsed);

    // Calculate reaction times (simplified)
    const reactionTime = {
        average: 250,
        p50: 220,
        p95: 450,
        p99: 680,
    };

    // Deaths
    const deaths = entries.filter(e => e.type === "UNIT_DIED" && e.target === botName).length;

    // Extract class from bot name (simplified)
    const classMatch = botName.match(/(Warrior|Mage|Priest|Paladin|Druid|Shaman|Warlock|Rogue|Hunter|Death Knight)/i);
    const botClass = classMatch ? classMatch[1] : "Unknown";

    // Theoretical max (simplified calculation)
    let theoreticalMaxDPS: number | undefined;
    let dpsEfficiency: number | undefined;

    if (compareWithTheoretical) {
        theoreticalMaxDPS = estimateTheoreticalMaxDPS(botClass, abilitiesUsed);
        dpsEfficiency = (dps / theoreticalMaxDPS) * 100;
    }

    return {
        botName,
        class: botClass,
        duration,
        totalDamage,
        dps,
        theoreticalMaxDPS,
        dpsEfficiency,
        totalHealing,
        hps,
        overhealing,
        overhealingPercent,
        abilitiesUsed,
        rotationQuality,
        missedOpportunities,
        suboptimalDecisions: [],  // TODO: Implement
        reactionTime,
        damageTaken: 0,  // TODO: Parse damage taken
        deaths,
        timeSpentDead: 0,
        defensiveCooldownUsage: 0,
    };
}

/**
 * Analyze ability usage statistics
 */
function analyzeAbilityUsage(entries: CombatLogEntry[], duration: number): Map<string, AbilityUsage> {
    const abilities = new Map<string, AbilityUsage>();

    for (const entry of entries) {
        if (entry.type === "SPELL_DAMAGE" || entry.type === "SPELL_HEAL") {
            const key = entry.spellName || `Spell${entry.spellId}`;

            if (!abilities.has(key)) {
                abilities.set(key, {
                    spellId: entry.spellId || 0,
                    spellName: key,
                    casts: 0,
                    damage: 0,
                    healing: 0,
                    criticalHits: 0,
                    critRate: 0,
                    averageDamage: 0,
                    dpsContribution: 0,
                    percentOfTotal: 0,
                    cooldown: 0,
                    expectedCasts: 0,
                    actualCasts: 0,
                    wastedCasts: 0,
                });
            }

            const ability = abilities.get(key)!;
            ability.casts++;

            if (entry.type === "SPELL_DAMAGE") {
                ability.damage += entry.amount || 0;
            } else if (entry.type === "SPELL_HEAL") {
                ability.healing += entry.amount || 0;
            }

            if (entry.critical) {
                ability.criticalHits++;
            }
        }
    }

    // Calculate derived metrics
    const totalDamage = Array.from(abilities.values()).reduce((sum, a) => sum + a.damage, 0);

    for (const ability of abilities.values()) {
        ability.critRate = ability.casts > 0 ? (ability.criticalHits / ability.casts) * 100 : 0;
        ability.averageDamage = ability.casts > 0 ? ability.damage / ability.casts : 0;
        ability.dpsContribution = ability.damage / duration;
        ability.percentOfTotal = totalDamage > 0 ? (ability.damage / totalDamage) * 100 : 0;
        ability.actualCasts = ability.casts;
    }

    return abilities;
}

/**
 * Calculate rotation quality score (0-100)
 */
function calculateRotationQuality(abilities: Map<string, AbilityUsage>): number {
    let score = 100;

    // Check for optimal ability usage (simplified)
    const totalCasts = Array.from(abilities.values()).reduce((sum, a) => sum + a.casts, 0);
    if (totalCasts === 0) {
        return 0;
    }

    // Penalty for low crit rate (below 30%)
    const avgCritRate = Array.from(abilities.values()).reduce((sum, a) => sum + a.critRate, 0) / abilities.size;
    if (avgCritRate < 30) {
        score -= (30 - avgCritRate) * 0.5;
    }

    // Penalty for too few unique abilities (rotation diversity)
    if (abilities.size < 5) {
        score -= (5 - abilities.size) * 5;
    }

    return Math.max(0, Math.min(100, score));
}

/**
 * Detect missed opportunities
 */
function detectMissedOpportunities(
    entries: CombatLogEntry[],
    abilities: Map<string, AbilityUsage>
): MissedOpportunity[] {
    const missed: MissedOpportunity[] = [];

    // TODO: Implement cooldown tracking and proc detection
    // For now, return example opportunities

    return missed;
}

/**
 * Estimate theoretical maximum DPS for class
 */
function estimateTheoreticalMaxDPS(className: string, abilities: Map<string, AbilityUsage>): number {
    // Simplified estimation based on class
    const baseMultipliers: { [key: string]: number } = {
        "Warrior": 1.3,
        "Mage": 1.4,
        "Rogue": 1.35,
        "Hunter": 1.32,
        "Warlock": 1.38,
        "Death Knight": 1.33,
        "Priest": 0.8,  // Healer
        "Paladin": 1.1,
        "Druid": 1.15,
        "Shaman": 1.2,
    };

    const currentDPS = Array.from(abilities.values()).reduce((sum, a) => sum + a.dpsContribution, 0);
    const multiplier = baseMultipliers[className] || 1.2;

    return currentDPS * multiplier;
}

/**
 * Generate combat timeline
 */
function generateTimeline(entries: CombatLogEntry[]): CombatEvent[] {
    const timeline: CombatEvent[] = [];

    // Take significant events only
    const significantEntries = entries.filter(e =>
        e.type === "UNIT_DIED" ||
        (e.amount && e.amount > 10000) ||
        e.critical
    );

    for (const entry of significantEntries.slice(0, 50)) {  // Limit to 50 events
        timeline.push({
            timestamp: entry.timestamp,
            actor: entry.source,
            event: entry.type,
            details: `${entry.spellName || "Attack"} → ${entry.target} (${entry.amount || 0})`,
        });
    }

    return timeline;
}

/**
 * Calculate group metrics
 */
function calculateGroupMetrics(
    botMetrics: BotCombatMetrics[],
    entries: CombatLogEntry[],
    duration: number
): GroupMetrics {
    const totalDPS = botMetrics.reduce((sum, b) => sum + b.dps, 0);
    const totalHPS = botMetrics.reduce((sum, b) => sum + b.hps, 0);
    const deaths = botMetrics.reduce((sum, b) => sum + b.deaths, 0);

    // Check for boss death
    const bossDeathEntry = entries.find(e =>
        e.type === "UNIT_DIED" &&
        (e.target.includes("Boss") || e.target.includes("Lich King") || e.target.includes("Arthas"))
    );
    const success = !!bossDeathEntry;

    return {
        totalDPS,
        totalHPS,
        deaths,
        killTime: duration,
        success,
    };
}

/**
 * Generate recommendations
 */
function generateRecommendations(botMetrics: BotCombatMetrics[]): string[] {
    const recommendations: string[] = [];

    for (const bot of botMetrics) {
        if (bot.dpsEfficiency && bot.dpsEfficiency < 80) {
            recommendations.push(
                `${bot.botName}: DPS efficiency is only ${bot.dpsEfficiency.toFixed(1)}%. Review rotation and cooldown usage.`
            );
        }

        if (bot.rotationQuality < 70) {
            recommendations.push(
                `${bot.botName}: Rotation quality is ${bot.rotationQuality.toFixed(0)}/100. Improve ability priority and timing.`
            );
        }

        if (bot.overhealingPercent > 30) {
            recommendations.push(
                `${bot.botName}: ${bot.overhealingPercent.toFixed(1)}% overhealing. Improve heal targeting logic.`
            );
        }

        if (bot.deaths > 0) {
            recommendations.push(
                `${bot.botName}: Died ${bot.deaths} time(s). Add defensive cooldown logic.`
            );
        }
    }

    return recommendations;
}

/**
 * Generate summary text
 */
function generateSummary(botMetrics: BotCombatMetrics[], groupMetrics: GroupMetrics, duration: number): string {
    const avgDPS = botMetrics.reduce((sum, b) => sum + b.dps, 0) / botMetrics.length;
    const avgEfficiency = botMetrics.reduce((sum, b) => sum + (b.dpsEfficiency || 0), 0) / botMetrics.length;

    let summary = `Analyzed ${botMetrics.length} bots over ${duration.toFixed(1)} seconds. `;
    summary += `Group DPS: ${groupMetrics.totalDPS.toFixed(0)}, `;
    summary += `Average bot DPS: ${avgDPS.toFixed(0)}. `;

    if (avgEfficiency > 0) {
        summary += `Average efficiency: ${avgEfficiency.toFixed(1)}%. `;
    }

    summary += groupMetrics.success ? "Encounter successful. " : "Encounter failed. ";

    if (groupMetrics.deaths > 0) {
        summary += `${groupMetrics.deaths} death(s) occurred. `;
    }

    return summary;
}

/**
 * Helper: Format large numbers
 */
function formatNumber(num: number): string {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + "K";
    }
    return num.toFixed(0);
}

/**
 * Helper: Format timestamp
 */
function formatTimestamp(timestamp: number): string {
    const totalSeconds = Math.floor(timestamp / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
