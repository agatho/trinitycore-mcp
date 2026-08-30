/**
 * Quest chain analytics.
 *
 * Quest levels and chain links live in quest_template_addon, not in
 * quest_template: current TrinityCore replaced QuestLevel with content tuning
 * and moved PrevQuestID/NextQuestID to the addon table. Reading them from
 * quest_template failed with "Unknown column 'qt.QuestLevel' in 'field list'".
 *
 * Column names were checked against the live schema rather than assumed:
 * quest_template carries LogTitle and RewardBonusMoney (not QuestTitle or
 * RewardMoney), and ExclusiveGroup is on the addon table.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryWorld } from '@/../src/database/connection';

/**
 * These queries aggregate across whole tables rather than looking up a row, so
 * they legitimately exceed the default five-second budget sized for point
 * lookups. Without this they failed as "Query timeout after 5000ms".
 */
const ANALYTICS_QUERY_TIMEOUT_MS = 60000;

export const dynamic = 'force-dynamic';

/**
 * GET /api/quest-chains/analytics
 *
 * Comprehensive quest chain analytics and insights
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');
    const minLevel = searchParams.get('minLevel');
    const maxLevel = searchParams.get('maxLevel');

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [];

    if (zoneId) {
      conditions.push('c.zoneId = ?');
      params.push(parseInt(zoneId));
    }

    if (minLevel) {
      conditions.push('qta.MaxLevel >= ?');
      params.push(parseInt(minLevel));
    }

    if (maxLevel) {
      conditions.push('qta.MaxLevel <= ?');
      params.push(parseInt(maxLevel));
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    // 1. Overall statistics
    const overallStatsQuery = `
      SELECT
        COUNT(DISTINCT qt.ID) as totalQuests,
        AVG(qta.MaxLevel) as avgLevel,
        MIN(qta.MaxLevel) as minLevel,
        MAX(qta.MaxLevel) as maxLevel,
        COUNT(DISTINCT CASE WHEN qta.PrevQuestID > 0 THEN qt.ID END) as questsWithPrereqs,
        COUNT(DISTINCT CASE WHEN qta.NextQuestID > 0 THEN qt.ID END) as questsWithFollowups,
        AVG(qt.RewardXPDifficulty) as avgXPReward,
        AVG(qt.RewardBonusMoney) as avgGoldReward
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      LEFT JOIN creature_queststarter cqs ON qt.ID = cqs.quest
      LEFT JOIN creature c ON cqs.id = c.id
      WHERE 1=1 ${whereClause}
    `;

    const overallStats = await queryWorld(overallStatsQuery, params, true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 2. Level distribution
    const levelDistQuery = `
      SELECT
        qta.MaxLevel as level,
        COUNT(*) as count
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      LEFT JOIN creature_queststarter cqs ON qt.ID = cqs.quest
      LEFT JOIN creature c ON cqs.id = c.id
      WHERE 1=1 ${whereClause}
      GROUP BY qta.MaxLevel
      ORDER BY qta.MaxLevel
    `;

    const levelDistribution = await queryWorld(levelDistQuery, params, true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 3. Zone distribution
    const zoneDistQuery = `
      SELECT
        c.zoneId,
        CONCAT('Zone ', c.zoneId) as zoneName,
        COUNT(DISTINCT qt.ID) as questCount,
        MIN(qta.MaxLevel) as minLevel,
        MAX(qta.MaxLevel) as maxLevel,
        AVG(qt.RewardXPDifficulty) as avgXP
      FROM creature c
      INNER JOIN creature_queststarter cqs ON c.id = cqs.id
      INNER JOIN quest_template qt ON cqs.quest = qt.ID
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      WHERE c.zoneId IS NOT NULL AND c.zoneId > 0
      GROUP BY c.zoneId
      ORDER BY questCount DESC
      LIMIT 50
    `;

    const zoneDistribution = await queryWorld(zoneDistQuery, [], true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 4. Quest chain length distribution
    // Chain length is the number of quests linked to this one, plus itself.
    // Counted with a grouped derived table rather than a subquery evaluated per
    // row: quest_template_addon is indexed only on ID, so the per-row form
    // scanned the whole table for each of ~47,000 quests and timed out.
    const chainLengthQuery = `
      SELECT
        CASE
          WHEN chainLength = 1 THEN 'Standalone'
          WHEN chainLength BETWEEN 2 AND 3 THEN 'Short (2-3)'
          WHEN chainLength BETWEEN 4 AND 6 THEN 'Medium (4-6)'
          WHEN chainLength BETWEEN 7 AND 10 THEN 'Long (7-10)'
          ELSE 'Epic (10+)'
        END as category,
        COUNT(*) as count
      FROM (
        SELECT
          qt.ID,
          COALESCE(successors.n, 0)
            + CASE WHEN qta.PrevQuestID > 0 THEN 1 ELSE 0 END
            + 1 as chainLength
        FROM quest_template qt
        LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
        LEFT JOIN (
          SELECT PrevQuestID as prevId, COUNT(*) as n
          FROM quest_template_addon
          WHERE PrevQuestID > 0
          GROUP BY PrevQuestID
        ) successors ON successors.prevId = qt.ID
        WHERE 1=1 ${whereClause}
      ) as chains
      GROUP BY category
      ORDER BY
        CASE category
          WHEN 'Standalone' THEN 1
          WHEN 'Short (2-3)' THEN 2
          WHEN 'Medium (4-6)' THEN 3
          WHEN 'Long (7-10)' THEN 4
          WHEN 'Epic (10+)' THEN 5
        END
    `;

    const chainLengthDist = await queryWorld(chainLengthQuery, params, true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 5. Broken quests report
    const brokenQuestsQuery = `
      SELECT
        qt.ID as questId,
        qt.LogTitle as title,
        qta.MaxLevel as level,
        qta.PrevQuestID as prevQuestId,
        'Missing prerequisite' as issue
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      WHERE qta.PrevQuestID > 0
        AND NOT EXISTS (
          SELECT 1 FROM quest_template_addon qt2
          WHERE qt2.ID = qta.PrevQuestID
        )
      LIMIT 100
    `;

    const brokenQuests = await queryWorld(brokenQuestsQuery, [], true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 6. Orphaned quests (no prerequisites, no follow-ups)
    const orphanedQuestsQuery = `
      SELECT
        qt.ID as questId,
        qt.LogTitle as title,
        qta.MaxLevel as level
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      LEFT JOIN creature_queststarter cqs ON qt.ID = cqs.quest
      LEFT JOIN creature c ON cqs.id = c.id
      WHERE (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
        AND (qta.NextQuestID = 0 OR qta.NextQuestID IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM quest_template_addon qt2
          WHERE qt2.PrevQuestID = qt.ID
        )
        ${whereClause}
      LIMIT 100
    `;

    const orphanedQuests = await queryWorld(orphanedQuestsQuery, params, true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 7. Quest density heatmap (quests per zone per level bracket)
    const heatmapQuery = `
      SELECT
        c.zoneId,
        FLOOR(qta.MaxLevel / 5) * 5 as levelBracket,
        COUNT(DISTINCT qt.ID) as questCount
      FROM creature c
      INNER JOIN creature_queststarter cqs ON c.id = cqs.id
      INNER JOIN quest_template qt ON cqs.quest = qt.ID
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      WHERE c.zoneId IS NOT NULL AND c.zoneId > 0
      GROUP BY c.zoneId, levelBracket
      HAVING questCount > 0
      ORDER BY c.zoneId, levelBracket
    `;

    const questDensityHeatmap = await queryWorld(heatmapQuery, [], true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 8. Reward analysis
    const rewardAnalysisQuery = `
      SELECT
        FLOOR(qta.MaxLevel / 10) * 10 as levelBracket,
        AVG(qt.RewardXPDifficulty) as avgXP,
        AVG(qt.RewardBonusMoney) as avgGold,
        MAX(qt.RewardXPDifficulty) as maxXP,
        MAX(qt.RewardBonusMoney) as maxGold,
        MIN(qt.RewardXPDifficulty) as minXP,
        MIN(qt.RewardBonusMoney) as minGold,
        COUNT(*) as questCount
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      LEFT JOIN creature_queststarter cqs ON qt.ID = cqs.quest
      LEFT JOIN creature c ON cqs.id = c.id
      WHERE 1=1 ${whereClause}
      GROUP BY levelBracket
      ORDER BY levelBracket
    `;

    const rewardAnalysis = await queryWorld(rewardAnalysisQuery, params, true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 9. Top zones by quest count
    const topZones = zoneDistribution.slice(0, 10);

    // 10. Quest type distribution
    // Grouped by ordinal rather than by the alias: MySQL's ONLY_FULL_GROUP_BY
    // rejects grouping by an alias whose expression names non-aggregated
    // columns, even though every row in a group shares the same value.
    // Whether a quest starts a chain is decided from one grouped pass over the
    // addon table, not an EXISTS evaluated per row: PrevQuestID is unindexed,
    // so the per-row form scanned the whole table ~47,000 times and timed out.
    // Grouped by ordinal because ONLY_FULL_GROUP_BY rejects grouping by an
    // alias whose expression names non-aggregated columns.
    const questTypeQuery = `
      SELECT
        CASE
          WHEN qta.ExclusiveGroup != 0 THEN 'Exclusive Choice'
          WHEN qta.PrevQuestID > 0 AND qta.NextQuestID > 0 THEN 'Chain Middle'
          WHEN qta.PrevQuestID > 0 THEN 'Chain End'
          WHEN qta.NextQuestID > 0 THEN 'Chain Start'
          WHEN successors.prevId IS NOT NULL THEN 'Chain Start'
          ELSE 'Standalone'
        END as questType,
        COUNT(*) as count
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      LEFT JOIN (
        SELECT DISTINCT PrevQuestID as prevId
        FROM quest_template_addon
        WHERE PrevQuestID > 0
      ) successors ON successors.prevId = qt.ID
      LEFT JOIN creature_queststarter cqs ON qt.ID = cqs.quest
      LEFT JOIN creature c ON cqs.id = c.id
      WHERE 1=1 ${whereClause}
      GROUP BY 1
    `;

    const questTypeDistribution = await queryWorld(questTypeQuery, params, true, ANALYTICS_QUERY_TIMEOUT_MS);

    // 11. Calculate insights
    const insights = generateInsights({
      overallStats: overallStats[0],
      brokenQuests,
      orphanedQuests,
      topZones,
      levelDistribution,
    });

    return NextResponse.json({
      summary: {
        ...overallStats[0],
        brokenQuestsCount: brokenQuests.length,
        orphanedQuestsCount: orphanedQuests.length,
      },
      distributions: {
        level: levelDistribution,
        zone: zoneDistribution,
        chainLength: chainLengthDist,
        questType: questTypeDistribution,
      },
      heatmap: questDensityHeatmap,
      rewardAnalysis,
      topZones,
      issues: {
        brokenQuests: brokenQuests.slice(0, 20),
        orphanedQuests: orphanedQuests.slice(0, 20),
      },
      insights,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Quest analytics error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate quest analytics',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate insights from analytics data
 */
function generateInsights(data: any): string[] {
  const insights: string[] = [];
  const { overallStats, brokenQuests, orphanedQuests, topZones, levelDistribution } = data;

  // Insight 1: Overall quest health
  const brokenPct = (brokenQuests.length / overallStats.totalQuests) * 100;
  if (brokenPct > 10) {
    insights.push(`⚠️ ${brokenPct.toFixed(1)}% of quests have broken prerequisites - database integrity check recommended`);
  } else if (brokenPct > 0) {
    insights.push(`✅ Only ${brokenPct.toFixed(1)}% of quests have issues - relatively healthy quest database`);
  } else {
    insights.push('✅ No broken quest chains detected - excellent database integrity');
  }

  // Insight 2: Orphaned quests
  const orphanedPct = (orphanedQuests.length / overallStats.totalQuests) * 100;
  if (orphanedPct > 30) {
    insights.push(`📊 ${orphanedPct.toFixed(1)}% of quests are standalone - consider creating more quest chains`);
  }

  // Insight 3: Quest distribution
  if (topZones.length > 0) {
    const topZone = topZones[0];
    insights.push(`🗺️ Most quests are in ${topZone.zoneName} (${topZone.questCount} quests, levels ${topZone.minLevel}-${topZone.maxLevel})`);
  }

  // Insight 4: Level progression
  const chainPct = ((overallStats.questsWithPrereqs / overallStats.totalQuests) * 100);
  if (chainPct < 20) {
    insights.push(`🔗 Only ${chainPct.toFixed(1)}% of quests are part of chains - consider adding more story progression`);
  } else {
    insights.push(`🔗 ${chainPct.toFixed(1)}% of quests are part of chains - good story progression`);
  }

  // Insight 5: Reward balance
  if (overallStats.avgXPReward) {
    insights.push(`💰 Average XP reward: ${Math.round(overallStats.avgXPReward)} | Average gold: ${(overallStats.avgGoldReward / 10000).toFixed(2)}g`);
  }

  // Insight 6: Level gaps
  if (levelDistribution && levelDistribution.length > 1) {
    const gaps: number[] = [];
    for (let i = 1; i < levelDistribution.length; i++) {
      const gap = levelDistribution[i].level - levelDistribution[i - 1].level;
      if (gap > 5) {
        gaps.push(levelDistribution[i - 1].level);
      }
    }

    if (gaps.length > 0) {
      insights.push(`📈 Level gaps detected after levels: ${gaps.join(', ')} - consider adding more content for these brackets`);
    }
  }

  return insights;
}
