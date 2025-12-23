/**
 * Zone Difficulty Calculator
 * Human Exploration Tool #6
 *
 * Purpose: Analyze zone difficulty based on mob levels, density, quest availability, and danger areas.
 * Benefit: Humans can determine if a zone is appropriate for their character level and playstyle.
 */

import { queryWorld } from "../database/connection";

/**
 * Zone information
 */
export interface ZoneInfo {
  id: number;
  name: string;
  areaLevel: number;
  expansion: number;
  mapId: number;
}

/**
 * Mob statistics for a zone
 */
export interface MobStats {
  totalMobs: number;
  avgLevel: number;
  minLevel: number;
  maxLevel: number;
  eliteCount: number;
  rareCount: number;
  bossCount: number;
  mobDensity: number; // mobs per unit area (estimated)
  dangerousAreas: Array<{
    name: string;
    avgLevel: number;
    elitePercent: number;
  }>;
}

/**
 * Quest statistics for a zone
 */
export interface QuestStats {
  totalQuests: number;
  avgLevel: number;
  minLevel: number;
  maxLevel: number;
  questDensity: number; // quests per level bracket
  questTypes: Record<string, number>;
  dailyQuests: number;
  eliteQuests: number;
}

/**
 * Zone difficulty rating
 */
export interface DifficultyRating {
  overall: number; // 1-10 scale
  mobDifficulty: number;
  questDifficulty: number;
  navigationDifficulty: number;
  recommendation: "solo" | "group" | "raid" | "mixed";
  playerLevelRange: { min: number; max: number; optimal: number };
  warnings: string[];
  tips: string[];
}

/**
 * Complete zone analysis
 */
export interface ZoneAnalysis {
  zone: ZoneInfo;
  mobs: MobStats;
  quests: QuestStats;
  difficulty: DifficultyRating;
  comparison?: {
    similarZones: Array<{ id: number; name: string; similarity: number }>;
  };
}

/**
 * Get zone information
 */
export async function getZoneInfo(zoneId: number): Promise<ZoneInfo | null> {
  const rows = await queryWorld(
    `SELECT
      ID as id,
      AreaName as name,
      AreaLevel as areaLevel,
      ExpansionID as expansion,
      MapID as mapId
     FROM areatable_dbc
     WHERE ID = ?`,
    [zoneId]
  );

  if (rows.length === 0) return null;

  return rows[0];
}

/**
 * Analyze mob statistics in a zone
 */
export async function analyzeMobStats(zoneId: number): Promise<MobStats> {
  // Get all creatures in the zone
  const mobData = await queryWorld(
    `SELECT
      ct.minlevel,
      ct.maxlevel,
      ct.rank,
      ct.name,
      COUNT(*) as spawnCount
     FROM creature c
     JOIN creature_template ct ON c.id1 = ct.entry
     WHERE c.zoneId = ?
     GROUP BY ct.entry, ct.name, ct.minlevel, ct.maxlevel, ct.rank`,
    [zoneId]
  );

  if (mobData.length === 0) {
    return {
      totalMobs: 0,
      avgLevel: 0,
      minLevel: 0,
      maxLevel: 0,
      eliteCount: 0,
      rareCount: 0,
      bossCount: 0,
      mobDensity: 0,
      dangerousAreas: [],
    };
  }

  // Calculate statistics
  let totalSpawns = 0;
  let totalLevels = 0;
  let minLevel = Number.MAX_SAFE_INTEGER;
  let maxLevel = 0;
  let eliteCount = 0;
  let rareCount = 0;
  let bossCount = 0;

  for (const mob of mobData) {
    const spawnCount = mob.spawnCount;
    const avgMobLevel = (mob.minlevel + mob.maxlevel) / 2;

    totalSpawns += spawnCount;
    totalLevels += avgMobLevel * spawnCount;
    minLevel = Math.min(minLevel, mob.minlevel);
    maxLevel = Math.max(maxLevel, mob.maxlevel);

    // Rank: 0=Normal, 1=Elite, 2=Rare Elite, 3=Boss, 4=Rare
    if (mob.rank === 1) eliteCount += spawnCount;
    else if (mob.rank === 2) rareCount += spawnCount;
    else if (mob.rank === 3) bossCount += spawnCount;
    else if (mob.rank === 4) rareCount += spawnCount;
  }

  const avgLevel = totalSpawns > 0 ? totalLevels / totalSpawns : 0;

  // Estimate mob density (mobs per 1000 units squared)
  const mobDensity = totalSpawns / 100; // Simplified estimation

  // Identify dangerous areas (high-level or elite-heavy spawns)
  const dangerousAreas: Array<{
    name: string;
    avgLevel: number;
    elitePercent: number;
  }> = [];

  const areaGroups = new Map<string, { levels: number[]; elites: number; total: number }>();

  for (const mob of mobData) {
    const areaKey = mob.name.split(" ")[0]; // Simplified area grouping
    if (!areaGroups.has(areaKey)) {
      areaGroups.set(areaKey, { levels: [], elites: 0, total: 0 });
    }

    const area = areaGroups.get(areaKey)!;
    area.levels.push((mob.minlevel + mob.maxlevel) / 2);
    area.total += mob.spawnCount;
    if (mob.rank >= 1) area.elites += mob.spawnCount;
  }

  for (const [name, data] of areaGroups) {
    const areaAvgLevel = data.levels.reduce((a, b) => a + b, 0) / data.levels.length;
    const elitePercent = (data.elites / data.total) * 100;

    if (areaAvgLevel > avgLevel + 3 || elitePercent > 30) {
      dangerousAreas.push({
        name,
        avgLevel: Math.round(areaAvgLevel),
        elitePercent: Math.round(elitePercent),
      });
    }
  }

  return {
    totalMobs: totalSpawns,
    avgLevel: Math.round(avgLevel),
    minLevel,
    maxLevel,
    eliteCount,
    rareCount,
    bossCount,
    mobDensity: Math.round(mobDensity * 10) / 10,
    dangerousAreas: dangerousAreas.slice(0, 5), // Top 5
  };
}

/**
 * Analyze quest statistics in a zone
 */
export async function analyzeQuestStats(zoneId: number): Promise<QuestStats> {
  // TrinityCore 11.2.7: MinLevel removed, now uses ContentTuningID for scaling
  const questData = await queryWorld(
    `SELECT
      qt.ID,
      qta.MaxLevel as QuestLevel,
      qt.ContentTuningID,
      qt.QuestInfoID as QuestType,
      qt.Flags,
      qta.SpecialFlags
     FROM quest_template qt
     LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
     WHERE qt.QuestSortID = ?`,
    [zoneId]
  );

  if (questData.length === 0) {
    return {
      totalQuests: 0,
      avgLevel: 0,
      minLevel: 0,
      maxLevel: 0,
      questDensity: 0,
      questTypes: {},
      dailyQuests: 0,
      eliteQuests: 0,
    };
  }

  let totalLevel = 0;
  let minLevel = Number.MAX_SAFE_INTEGER;
  let maxLevel = 0;
  let dailyQuests = 0;
  let eliteQuests = 0;
  const questTypes: Record<string, number> = {};

  for (const quest of questData) {
    totalLevel += quest.QuestLevel || 0;
    // TrinityCore 11.2.7: Use QuestLevel for min/max since MinLevel was removed
    minLevel = Math.min(minLevel, quest.QuestLevel || 0);
    maxLevel = Math.max(maxLevel, quest.QuestLevel || 0);

    // Quest type
    const typeName = getQuestTypeName(quest.QuestType);
    questTypes[typeName] = (questTypes[typeName] || 0) + 1;

    // Daily quest (Flags & 0x1000)
    if (quest.Flags & 0x1000) dailyQuests++;

    // Elite quest (SpecialFlags & 0x1)
    if (quest.SpecialFlags & 0x1) eliteQuests++;
  }

  const avgLevel = questData.length > 0 ? totalLevel / questData.length : 0;
  const levelRange = maxLevel - minLevel + 1;
  const questDensity = levelRange > 0 ? questData.length / levelRange : 0;

  return {
    totalQuests: questData.length,
    avgLevel: Math.round(avgLevel),
    minLevel,
    maxLevel,
    questDensity: Math.round(questDensity * 10) / 10,
    questTypes,
    dailyQuests,
    eliteQuests,
  };
}

/**
 * Get quest type name
 */
function getQuestTypeName(typeId: number): string {
  const types: Record<number, string> = {
    0: "Normal",
    1: "Group",
    21: "Life",
    41: "PvP",
    62: "Raid",
    81: "Dungeon",
    82: "World Event",
    83: "Legendary",
    84: "Escort",
    85: "Heroic",
    88: "Raid (10)",
    89: "Raid (25)",
  };

  return types[typeId] || "Other";
}

/**
 * Calculate difficulty rating for a zone
 */
export function calculateDifficultyRating(
  zoneInfo: ZoneInfo,
  mobStats: MobStats,
  questStats: QuestStats
): DifficultyRating {
  // Calculate mob difficulty (1-10)
  let mobDifficulty = 0;

  // Base difficulty from average level
  mobDifficulty += Math.min(mobStats.avgLevel / 10, 5);

  // Elite/rare/boss presence
  const elitePercent = (mobStats.eliteCount / mobStats.totalMobs) * 100;
  const rarePercent = (mobStats.rareCount / mobStats.totalMobs) * 100;
  const bossPercent = (mobStats.bossCount / mobStats.totalMobs) * 100;

  mobDifficulty += (elitePercent / 20) * 2; // Up to +2 for 40% elites
  mobDifficulty += (rarePercent / 10) * 1; // Up to +1 for 10% rares
  mobDifficulty += (bossPercent / 5) * 2; // Up to +2 for 5% bosses

  // Mob density
  if (mobStats.mobDensity > 50) mobDifficulty += 1;
  if (mobStats.mobDensity > 100) mobDifficulty += 1;

  mobDifficulty = Math.min(Math.round(mobDifficulty), 10);

  // Calculate quest difficulty (1-10)
  let questDifficulty = 0;

  // Average quest level
  questDifficulty += Math.min(questStats.avgLevel / 10, 5);

  // Elite quests
  const eliteQuestPercent = (questStats.eliteQuests / questStats.totalQuests) * 100;
  questDifficulty += (eliteQuestPercent / 20) * 3;

  // Quest types (group/raid quests increase difficulty)
  const groupQuests = questStats.questTypes["Group"] || 0;
  const raidQuests = questStats.questTypes["Raid"] || 0;
  questDifficulty += (groupQuests / questStats.totalQuests) * 2;
  questDifficulty += (raidQuests / questStats.totalQuests) * 3;

  questDifficulty = Math.min(Math.round(questDifficulty), 10);

  // Navigation difficulty (based on dangerous areas)
  let navigationDifficulty = Math.min(mobStats.dangerousAreas.length, 5);

  // Overall difficulty
  const overall = Math.round((mobDifficulty + questDifficulty + navigationDifficulty) / 3);

  // Determine recommendation
  let recommendation: "solo" | "group" | "raid" | "mixed" = "solo";
  if (mobStats.bossCount > 5 || (questStats.questTypes["Raid"] || 0) > 3) {
    recommendation = "raid";
  } else if (elitePercent > 30 || (questStats.questTypes["Group"] || 0) > 5) {
    recommendation = "group";
  } else if (elitePercent > 10 || questStats.eliteQuests > 0) {
    recommendation = "mixed";
  }

  // Player level range
  const optimalLevel = Math.round((mobStats.avgLevel + questStats.avgLevel) / 2);
  const playerLevelRange = {
    min: Math.max(1, mobStats.minLevel - 3),
    max: mobStats.maxLevel + 2,
    optimal: optimalLevel,
  };

  // Warnings
  const warnings: string[] = [];
  if (elitePercent > 40) {
    warnings.push("High concentration of elite mobs - group recommended");
  }
  if (mobStats.bossCount > 0) {
    warnings.push(`${mobStats.bossCount} boss mobs present - avoid if solo`);
  }
  if (mobStats.dangerousAreas.length > 0) {
    warnings.push(`${mobStats.dangerousAreas.length} dangerous areas identified`);
  }
  if (questStats.eliteQuests > questStats.totalQuests * 0.3) {
    warnings.push("Many quests require elite mob kills");
  }
  if (mobStats.mobDensity > 80) {
    warnings.push("Very high mob density - careful pulling required");
  }

  // Tips
  const tips: string[] = [];
  if (questStats.dailyQuests > 0) {
    tips.push(`${questStats.dailyQuests} daily quests available`);
  }
  if (questStats.questDensity > 3) {
    tips.push("High quest density - efficient leveling zone");
  }
  if (recommendation === "solo" && questStats.totalQuests > 20) {
    tips.push("Good solo leveling zone with many quests");
  }
  if (mobStats.rareCount > 0) {
    tips.push(`${mobStats.rareCount} rare spawns for farming`);
  }

  return {
    overall,
    mobDifficulty,
    questDifficulty,
    navigationDifficulty,
    recommendation,
    playerLevelRange,
    warnings,
    tips,
  };
}

/**
 * Complete zone analysis
 */
export async function analyzeZoneDifficulty(zoneId: number): Promise<ZoneAnalysis> {
  const zoneInfo = await getZoneInfo(zoneId);

  if (!zoneInfo) {
    throw new Error(`Zone ${zoneId} not found`);
  }

  const mobStats = await analyzeMobStats(zoneId);
  const questStats = await analyzeQuestStats(zoneId);
  const difficulty = calculateDifficultyRating(zoneInfo, mobStats, questStats);

  return {
    zone: zoneInfo,
    mobs: mobStats,
    quests: questStats,
    difficulty,
  };
}

/**
 * Find similar zones by difficulty
 */
export async function findSimilarZones(
  zoneId: number,
  limit: number = 5
): Promise<Array<{ id: number; name: string; similarity: number }>> {
  const targetAnalysis = await analyzeZoneDifficulty(zoneId);

  // Get all zones in same expansion
  const zones = await queryWorld(
    `SELECT ID, AreaName
     FROM areatable_dbc
     WHERE ExpansionID = ? AND ID != ?
     LIMIT 50`,
    [targetAnalysis.zone.expansion, zoneId]
  );

  const similarities: Array<{ id: number; name: string; similarity: number }> = [];

  for (const zone of zones) {
    try {
      const analysis = await analyzeZoneDifficulty(zone.ID);

      // Calculate similarity score (0-100)
      let similarity = 100;

      // Level difference penalty
      const levelDiff = Math.abs(
        targetAnalysis.mobs.avgLevel - analysis.mobs.avgLevel
      );
      similarity -= levelDiff * 5;

      // Difficulty difference penalty
      const difficultyDiff = Math.abs(
        targetAnalysis.difficulty.overall - analysis.difficulty.overall
      );
      similarity -= difficultyDiff * 10;

      // Quest count similarity
      const questRatio =
        Math.min(targetAnalysis.quests.totalQuests, analysis.quests.totalQuests) /
        Math.max(targetAnalysis.quests.totalQuests, analysis.quests.totalQuests);
      similarity *= questRatio;

      // Mob density similarity
      const densityRatio =
        Math.min(targetAnalysis.mobs.mobDensity, analysis.mobs.mobDensity) /
        Math.max(targetAnalysis.mobs.mobDensity, analysis.mobs.mobDensity);
      similarity *= densityRatio;

      similarities.push({
        id: zone.ID,
        name: zone.AreaName,
        similarity: Math.max(0, Math.round(similarity)),
      });
    } catch {
      // Skip zones with no data
    }
  }

  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

/**
 * Find zones by level range
 */
export async function findZonesByLevel(
  minLevel: number,
  maxLevel: number
): Promise<
  Array<{
    id: number;
    name: string;
    avgLevel: number;
    difficulty: number;
  }>
> {
  const zones = await queryWorld(
    `SELECT ID, AreaName, AreaLevel
     FROM areatable_dbc
     WHERE AreaLevel BETWEEN ? AND ?
     ORDER BY AreaLevel`,
    [minLevel, maxLevel]
  );

  const results: Array<{
    id: number;
    name: string;
    avgLevel: number;
    difficulty: number;
  }> = [];

  for (const zone of zones) {
    try {
      const mobStats = await analyzeMobStats(zone.ID);

      if (mobStats.totalMobs > 0) {
        const questStats = await analyzeQuestStats(zone.ID);
        const difficulty = calculateDifficultyRating(
          {
            id: zone.ID,
            name: zone.AreaName,
            areaLevel: zone.AreaLevel,
            expansion: 0,
            mapId: 0,
          },
          mobStats,
          questStats
        );

        results.push({
          id: zone.ID,
          name: zone.AreaName,
          avgLevel: mobStats.avgLevel,
          difficulty: difficulty.overall,
        });
      }
    } catch {
      // Skip zones with issues
    }
  }

  return results;
}

/**
 * Get leveling path recommendation
 */
export async function getLevelingPath(
  startLevel: number,
  targetLevel: number,
  faction: "alliance" | "horde" = "alliance"
): Promise<
  Array<{
    levelRange: { min: number; max: number };
    zones: Array<{ id: number; name: string; difficulty: number }>;
  }>
> {
  const path: Array<{
    levelRange: { min: number; max: number };
    zones: Array<{ id: number; name: string; difficulty: number }>;
  }> = [];

  const bracketSize = 5; // 5-level brackets
  for (let level = startLevel; level < targetLevel; level += bracketSize) {
    const bracketMax = Math.min(level + bracketSize - 1, targetLevel);

    const zones = await findZonesByLevel(level, bracketMax);

    // Filter to recommended difficulty (1-6 for solo leveling)
    const recommendedZones = zones
      .filter((z) => z.difficulty <= 6)
      .slice(0, 3); // Top 3 zones per bracket

    if (recommendedZones.length > 0) {
      path.push({
        levelRange: { min: level, max: bracketMax },
        zones: recommendedZones,
      });
    }
  }

  return path;
}

/**
 * Export zone analysis to markdown
 */
export function exportZoneAnalysisMarkdown(analysis: ZoneAnalysis): string {
  const lines: string[] = [];

  lines.push(`# ${analysis.zone.name} - Zone Analysis`);
  lines.push("");
  lines.push(`**Zone ID:** ${analysis.zone.id}`);
  lines.push(`**Expansion:** ${analysis.zone.expansion}`);
  lines.push(`**Area Level:** ${analysis.zone.areaLevel}`);
  lines.push("");

  lines.push("## Difficulty Rating");
  lines.push(`**Overall:** ${analysis.difficulty.overall}/10`);
  lines.push(`**Mob Difficulty:** ${analysis.difficulty.mobDifficulty}/10`);
  lines.push(`**Quest Difficulty:** ${analysis.difficulty.questDifficulty}/10`);
  lines.push(
    `**Navigation Difficulty:** ${analysis.difficulty.navigationDifficulty}/10`
  );
  lines.push(`**Recommendation:** ${analysis.difficulty.recommendation}`);
  lines.push(
    `**Player Level Range:** ${analysis.difficulty.playerLevelRange.min}-${analysis.difficulty.playerLevelRange.max} (Optimal: ${analysis.difficulty.playerLevelRange.optimal})`
  );
  lines.push("");

  lines.push("## Mob Statistics");
  lines.push(`**Total Mobs:** ${analysis.mobs.totalMobs}`);
  lines.push(
    `**Level Range:** ${analysis.mobs.minLevel}-${analysis.mobs.maxLevel} (Avg: ${analysis.mobs.avgLevel})`
  );
  lines.push(`**Elites:** ${analysis.mobs.eliteCount}`);
  lines.push(`**Rares:** ${analysis.mobs.rareCount}`);
  lines.push(`**Bosses:** ${analysis.mobs.bossCount}`);
  lines.push(`**Mob Density:** ${analysis.mobs.mobDensity}`);
  lines.push("");

  if (analysis.mobs.dangerousAreas.length > 0) {
    lines.push("### Dangerous Areas");
    for (const area of analysis.mobs.dangerousAreas) {
      lines.push(
        `- **${area.name}**: Avg Level ${area.avgLevel}, ${area.elitePercent}% Elite`
      );
    }
    lines.push("");
  }

  lines.push("## Quest Statistics");
  lines.push(`**Total Quests:** ${analysis.quests.totalQuests}`);
  lines.push(
    `**Level Range:** ${analysis.quests.minLevel}-${analysis.quests.maxLevel} (Avg: ${analysis.quests.avgLevel})`
  );
  lines.push(`**Quest Density:** ${analysis.quests.questDensity} per level`);
  lines.push(`**Daily Quests:** ${analysis.quests.dailyQuests}`);
  lines.push(`**Elite Quests:** ${analysis.quests.eliteQuests}`);
  lines.push("");

  if (Object.keys(analysis.quests.questTypes).length > 0) {
    lines.push("### Quest Types");
    for (const [type, count] of Object.entries(analysis.quests.questTypes)) {
      lines.push(`- **${type}**: ${count}`);
    }
    lines.push("");
  }

  if (analysis.difficulty.warnings.length > 0) {
    lines.push("## Warnings");
    for (const warning of analysis.difficulty.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push("");
  }

  if (analysis.difficulty.tips.length > 0) {
    lines.push("## Tips");
    for (const tip of analysis.difficulty.tips) {
      lines.push(`- 💡 ${tip}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
