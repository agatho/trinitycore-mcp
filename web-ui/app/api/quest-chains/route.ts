import { NextRequest, NextResponse } from 'next/server';
import {
  traceQuestChain,
  findQuestChainsInZone,
  getQuestPrerequisites,
  getQuestRewards,
  analyzeQuestObjectives,
  type QuestChain,
  type QuestPrerequisites,
  type QuestReward,
  type QuestObjective,
} from '@/../src/tools/questchain';

export const dynamic = 'force-dynamic';

/**
 * GET /api/quest-chains
 *
 * Query parameters:
 * - questId: number - Trace quest chain starting from this quest
 * - zoneId: number - Find all quest chains in this zone
 * - search: string - Search quests by name or ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questId = searchParams.get('questId');
    const zoneId = searchParams.get('zoneId');
    const search = searchParams.get('search');

    // Trace single quest chain
    if (questId) {
      const chain = await traceQuestChain(parseInt(questId));

      // Enrich with additional data
      const enrichedQuests = await Promise.all(
        chain.quests.map(async (quest) => {
          try {
            const [prerequisites, rewards, objectives] = await Promise.all([
              getQuestPrerequisites(quest.questId).catch(() => null),
              getQuestRewards(quest.questId).catch(() => null),
              analyzeQuestObjectives(quest.questId).catch(() => []),
            ]);

            return {
              ...quest,
              prerequisites,
              rewards,
              objectives,
            };
          } catch (error) {
            // Return quest without enrichment if error
            return quest;
          }
        })
      );

      return NextResponse.json({
        ...chain,
        quests: enrichedQuests,
      });
    }

    // Find quest chains in zone
    if (zoneId) {
      const chains = await findQuestChainsInZone(parseInt(zoneId));

      return NextResponse.json({
        zoneId: parseInt(zoneId),
        totalChains: chains.length,
        chains,
      });
    }

    // Search quests
    if (search) {
      const { queryWorld } = await import('@/../src/database/connection');

      const searchQuery = `
        SELECT
          ID as id,
          QuestTitle as title,
          QuestLevel as level,
          MinLevel as minLevel,
          PrevQuestID as prevQuestId,
          NextQuestID as nextQuestId,
          ExclusiveGroup as exclusiveGroup
        FROM quest_template
        WHERE
          QuestTitle LIKE ? OR
          ID = ?
        LIMIT 50
      `;

      const searchPattern = `%${search}%`;
      const questIdMatch = parseInt(search) || 0;

      const results = await queryWorld(searchQuery, [searchPattern, questIdMatch]);

      return NextResponse.json({
        query: search,
        totalResults: results.length,
        quests: results,
      });
    }

    return NextResponse.json(
      { error: 'Missing required parameter: questId, zoneId, or search' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Quest chains API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch quest chains',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/quest-chains/validate
 *
 * Validate quest chain integrity
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questIds } = body;

    if (!Array.isArray(questIds)) {
      return NextResponse.json({ error: 'questIds must be an array' }, { status: 400 });
    }

    const { queryWorld } = await import('@/../src/database/connection');

    // Check for broken references
    const brokenChains: Array<{
      questId: number;
      issue: string;
      severity: 'error' | 'warning';
    }> = [];

    for (const questId of questIds) {
      const query = `
        SELECT
          ID as id,
          QuestTitle as title,
          PrevQuestID as prevQuestId,
          NextQuestID as nextQuestId
        FROM quest_template
        WHERE ID = ?
      `;

      const results = await queryWorld(query, [questId]);

      if (results.length === 0) {
        brokenChains.push({
          questId,
          issue: `Quest ${questId} does not exist in database`,
          severity: 'error',
        });
        continue;
      }

      const quest = results[0];

      // Check if previous quest exists
      if (quest.prevQuestId && quest.prevQuestId !== 0) {
        const prevQuest = await queryWorld(
          'SELECT ID FROM quest_template WHERE ID = ?',
          [quest.prevQuestId]
        );

        if (prevQuest.length === 0) {
          brokenChains.push({
            questId: quest.id,
            issue: `Quest "${quest.title}" references missing prerequisite quest ${quest.prevQuestId}`,
            severity: 'error',
          });
        }
      }

      // Check if next quest exists
      if (quest.nextQuestId && quest.nextQuestId !== 0) {
        const nextQuest = await queryWorld(
          'SELECT ID FROM quest_template WHERE ID = ?',
          [quest.nextQuestId]
        );

        if (nextQuest.length === 0) {
          brokenChains.push({
            questId: quest.id,
            issue: `Quest "${quest.title}" references missing follow-up quest ${quest.nextQuestId}`,
            severity: 'warning',
          });
        }
      }
    }

    return NextResponse.json({
      totalQuests: questIds.length,
      issuesFound: brokenChains.length,
      isValid: brokenChains.length === 0,
      issues: brokenChains,
    });
  } catch (error: any) {
    console.error('Quest chain validation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to validate quest chains',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
