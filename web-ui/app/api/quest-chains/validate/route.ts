import { NextRequest, NextResponse } from 'next/server';
import { queryWorld } from '@/../../src/database/connection';

export const dynamic = 'force-dynamic';

interface ValidationIssue {
  questId: number;
  questTitle?: string;
  type: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  description: string;
  suggestion?: string;
}

/**
 * POST /api/quest-chains/validate
 *
 * Comprehensive quest chain validation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questIds, checkCircularDeps = true, checkLevelProgression = true, checkQuestGivers = true } = body;

    if (!Array.isArray(questIds)) {
      return NextResponse.json({ error: 'questIds must be an array' }, { status: 400 });
    }

    const issues: ValidationIssue[] = [];

    // Fetch all quest data
    const questData = await Promise.all(
      questIds.map(async (questId) => {
        const query = `
          SELECT
            ID as id,
            QuestTitle as title,
            QuestLevel as level,
            MinLevel as minLevel,
            MaxLevel as maxLevel,
            PrevQuestID as prevQuestId,
            NextQuestID as nextQuestId,
            ExclusiveGroup as exclusiveGroup,
            RequiredRaces as requiredRaces,
            RequiredClasses as requiredClasses,
            RequiredFactionId1 as requiredFactionId,
            RequiredFactionValue1 as requiredFactionValue,
            RequiredSkillId as requiredSkillId,
            RequiredSkillPoints as requiredSkillPoints
          FROM quest_template
          WHERE ID = ?
        `;

        const results = await queryWorld(query, [questId]);
        return results[0] || null;
      })
    );

    const validQuests = questData.filter(q => q !== null);

    // 1. Check for missing quests
    questIds.forEach(questId => {
      if (!validQuests.find(q => q.id === questId)) {
        issues.push({
          questId,
          type: 'missing_quest',
          severity: 'critical',
          description: `Quest ${questId} does not exist in the database`,
          suggestion: 'Remove this quest from the chain or verify the quest ID is correct',
        });
      }
    });

    // 2. Check for broken prerequisite references
    for (const quest of validQuests) {
      if (quest.prevQuestId && quest.prevQuestId !== 0) {
        const prevQuest = await queryWorld(
          'SELECT ID, QuestTitle FROM quest_template WHERE ID = ?',
          [quest.prevQuestId]
        );

        if (prevQuest.length === 0) {
          issues.push({
            questId: quest.id,
            questTitle: quest.title,
            type: 'broken_prerequisite',
            severity: 'error',
            description: `Quest "${quest.title}" references missing prerequisite quest ${quest.prevQuestId}`,
            suggestion: `Either create quest ${quest.prevQuestId} or remove the prerequisite reference`,
          });
        }
      }

      // Check next quest
      if (quest.nextQuestId && quest.nextQuestId !== 0) {
        const nextQuest = await queryWorld(
          'SELECT ID FROM quest_template WHERE ID = ?',
          [quest.nextQuestId]
        );

        if (nextQuest.length === 0) {
          issues.push({
            questId: quest.id,
            questTitle: quest.title,
            type: 'broken_next_quest',
            severity: 'warning',
            description: `Quest "${quest.title}" references missing follow-up quest ${quest.nextQuestId}`,
            suggestion: 'This may be intentional if the quest chain is incomplete',
          });
        }
      }
    }

    // 3. Check for circular dependencies
    if (checkCircularDeps) {
      for (const quest of validQuests) {
        const visited = new Set<number>();
        let current = quest;
        let depth = 0;
        const maxDepth = 100; // Prevent infinite loops

        while (current && depth < maxDepth) {
          if (visited.has(current.id)) {
            issues.push({
              questId: quest.id,
              questTitle: quest.title,
              type: 'circular_dependency',
              severity: 'critical',
              description: `Quest "${quest.title}" is part of a circular dependency chain`,
              suggestion: 'Remove one of the prerequisite links to break the cycle',
            });
            break;
          }

          visited.add(current.id);

          if (current.prevQuestId && current.prevQuestId !== 0) {
            const prevQuest = validQuests.find(q => q.id === current.prevQuestId);
            if (prevQuest) {
              current = prevQuest;
              depth++;
            } else {
              break;
            }
          } else {
            break;
          }
        }
      }
    }

    // 4. Check level progression
    if (checkLevelProgression) {
      for (const quest of validQuests) {
        if (quest.prevQuestId && quest.prevQuestId !== 0) {
          const prevQuest = validQuests.find(q => q.id === quest.prevQuestId);

          if (prevQuest) {
            // Check for large level jumps
            const levelDiff = quest.level - prevQuest.level;

            if (levelDiff > 10) {
              issues.push({
                questId: quest.id,
                questTitle: quest.title,
                type: 'level_jump',
                severity: 'warning',
                description: `Quest "${quest.title}" (level ${quest.level}) has a large level jump from previous quest "${prevQuest.title}" (level ${prevQuest.level})`,
                suggestion: 'Consider adding intermediate quests or adjusting quest levels',
              });
            }

            // Check for level regression
            if (levelDiff < -5) {
              issues.push({
                questId: quest.id,
                questTitle: quest.title,
                type: 'level_regression',
                severity: 'error',
                description: `Quest "${quest.title}" (level ${quest.level}) is lower level than previous quest "${prevQuest.title}" (level ${prevQuest.level})`,
                suggestion: 'Quest levels should generally increase or stay the same in a chain',
              });
            }
          }
        }

        // Check minLevel vs questLevel
        if (quest.minLevel > quest.level) {
          issues.push({
            questId: quest.id,
            questTitle: quest.title,
            type: 'invalid_level_requirement',
            severity: 'error',
            description: `Quest "${quest.title}" has minLevel (${quest.minLevel}) higher than questLevel (${quest.level})`,
            suggestion: 'minLevel should be <= questLevel',
          });
        }
      }
    }

    // 5. Check for missing quest givers
    if (checkQuestGivers) {
      for (const quest of validQuests) {
        const questGiver = await queryWorld(
          'SELECT id FROM creature_queststarter WHERE quest = ?',
          [quest.id]
        );

        if (questGiver.length === 0) {
          issues.push({
            questId: quest.id,
            questTitle: quest.title,
            type: 'missing_quest_giver',
            severity: 'error',
            description: `Quest "${quest.title}" has no quest giver NPC`,
            suggestion: 'Add an entry to creature_queststarter or gameobject_queststarter',
          });
        }
      }
    }

    // 6. Check for impossible requirements
    for (const quest of validQuests) {
      // Check race/class conflicts
      if (quest.requiredRaces > 0 && quest.requiredClasses > 0) {
        // This is just a heads up, not necessarily an error
        issues.push({
          questId: quest.id,
          questTitle: quest.title,
          type: 'specific_requirements',
          severity: 'info',
          description: `Quest "${quest.title}" has both race and class requirements`,
          suggestion: 'Verify that the intended player base can access this quest',
        });
      }

      // Check skill requirements
      if (quest.requiredSkillId > 0 && quest.requiredSkillPoints > 450) {
        issues.push({
          questId: quest.id,
          questTitle: quest.title,
          type: 'high_skill_requirement',
          severity: 'warning',
          description: `Quest "${quest.title}" requires skill ${quest.requiredSkillId} at level ${quest.requiredSkillPoints}`,
          suggestion: 'Verify this skill level is appropriate for the quest level',
        });
      }
    }

    // 7. Check for orphaned quests in exclusive groups
    for (const quest of validQuests) {
      if (quest.exclusiveGroup !== 0) {
        const groupQuests = await queryWorld(
          'SELECT ID, QuestTitle FROM quest_template WHERE ExclusiveGroup = ?',
          [quest.exclusiveGroup]
        );

        if (groupQuests.length === 1) {
          issues.push({
            questId: quest.id,
            questTitle: quest.title,
            type: 'orphaned_exclusive_group',
            severity: 'warning',
            description: `Quest "${quest.title}" is the only quest in exclusive group ${quest.exclusiveGroup}`,
            suggestion: 'Exclusive groups should have at least 2 quests, or set ExclusiveGroup to 0',
          });
        }
      }
    }

    // 8. Check for quest objective completability
    for (const quest of validQuests) {
      // Check required items
      const requiredItems = await queryWorld(
        `SELECT RequiredItemId1, RequiredItemId2, RequiredItemId3, RequiredItemId4,
                RequiredItemCount1, RequiredItemCount2, RequiredItemCount3, RequiredItemCount4
         FROM quest_template WHERE ID = ?`,
        [quest.id]
      );

      if (requiredItems.length > 0) {
        const item = requiredItems[0];

        for (let i = 1; i <= 4; i++) {
          const itemId = item[`RequiredItemId${i}`];
          const itemCount = item[`RequiredItemCount${i}`];

          if (itemId && itemId !== 0 && itemCount > 0) {
            // Check if item exists
            const itemExists = await queryWorld(
              'SELECT ItemID FROM item_template WHERE ItemID = ?',
              [itemId]
            );

            if (itemExists.length === 0) {
              issues.push({
                questId: quest.id,
                questTitle: quest.title,
                type: 'missing_required_item',
                severity: 'critical',
                description: `Quest "${quest.title}" requires item ${itemId} which does not exist`,
                suggestion: 'Create the item or remove the item requirement',
              });
            }
          }
        }
      }
    }

    // Calculate validation score
    const criticalCount = issues.filter(i => i.severity === 'critical').length;
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    const totalScore = 100 - (criticalCount * 25) - (errorCount * 10) - (warningCount * 2);
    const score = Math.max(0, Math.min(100, totalScore));

    return NextResponse.json({
      valid: criticalCount === 0 && errorCount === 0,
      score,
      summary: {
        totalQuests: questIds.length,
        validQuests: validQuests.length,
        totalIssues: issues.length,
        criticalIssues: criticalCount,
        errors: errorCount,
        warnings: warningCount,
        info: infoCount,
      },
      issues: issues.sort((a, b) => {
        const severityOrder = { critical: 0, error: 1, warning: 2, info: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      recommendations: generateRecommendations(issues, validQuests),
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

/**
 * Generate recommendations based on validation issues
 */
function generateRecommendations(issues: ValidationIssue[], quests: any[]): string[] {
  const recommendations: string[] = [];

  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const brokenPrereqs = issues.filter(i => i.type === 'broken_prerequisite').length;
  const levelJumps = issues.filter(i => i.type === 'level_jump').length;
  const missingGivers = issues.filter(i => i.type === 'missing_quest_giver').length;

  if (criticalCount > 0) {
    recommendations.push('⛔ Fix all critical issues before deploying this quest chain to production');
  }

  if (errorCount > 5) {
    recommendations.push('⚠️ This quest chain has multiple errors that should be addressed');
  }

  if (brokenPrereqs > 0) {
    recommendations.push(`🔗 ${brokenPrereqs} broken prerequisite(s) detected - verify all referenced quests exist`);
  }

  if (levelJumps > 0) {
    recommendations.push(`📈 ${levelJumps} large level jump(s) detected - consider smoother progression`);
  }

  if (missingGivers > 0) {
    recommendations.push(`👤 ${missingGivers} quest(s) have no quest giver - add NPCs or objects to start these quests`);
  }

  if (issues.length === 0) {
    recommendations.push('✅ Quest chain looks good! No issues detected');
  } else if (criticalCount === 0 && errorCount === 0) {
    recommendations.push('✅ No critical issues found, but review warnings for optimization opportunities');
  }

  return recommendations;
}
