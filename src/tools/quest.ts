/**
 * Quest data query tool
 */

import { queryWorld } from "../database/connection";

export interface QuestInfo {
  questId: number;
  title: string;
  details: string;
  objectives: string;
  level: number;
  minLevel: number;
  type: string;
  rewards: QuestRewards;
  error?: string;
}

export interface QuestRewards {
  experience: number;
  money: number;
  items: Array<{ itemId: number; count: number }>;
  reputation: Array<{ factionId: number; amount: number }>;
}

export async function getQuestInfo(questId: number): Promise<QuestInfo> {
  try {
    const query = `
      SELECT
        qt.ID as questId,
        qt.LogTitle as title,
        qt.LogDescription as details,
        qt.QuestDescription as objectives,
        qta.MaxLevel as level,
        qt.MinLevel as minLevel,
        qt.QuestInfoID as type,
        qt.RewardXPDifficulty as experience,
        qt.RewardMoney as money
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      WHERE qt.ID = ?
      LIMIT 1
    `;

    const quests = await queryWorld(query, [questId]);

    if (!quests || quests.length === 0) {
      return {
        questId,
        title: "Not Found",
        details: "",
        objectives: "",
        level: 0,
        minLevel: 0,
        type: "UNKNOWN",
        rewards: {
          experience: 0,
          money: 0,
          items: [],
          reputation: [],
        },
        error: `Quest ${questId} not found`,
      };
    }

    const quest = quests[0];

    return {
      questId: quest.questId,
      title: quest.title,
      details: quest.details,
      objectives: quest.objectives,
      level: quest.level,
      minLevel: quest.minLevel,
      type: getQuestTypeName(quest.type),
      rewards: {
        experience: quest.experience,
        money: quest.money,
        items: [],
        reputation: [],
      },
    };
  } catch (error) {
    return {
      questId,
      title: "Error",
      details: "",
      objectives: "",
      level: 0,
      minLevel: 0,
      type: "UNKNOWN",
      rewards: {
        experience: 0,
        money: 0,
        items: [],
        reputation: [],
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getQuestTypeName(type: number): string {
  const types = [
    "NORMAL",
    "GROUP",
    "LIFE",
    "PVP",
    "RAID",
    "DUNGEON",
    "WORLD_EVENT",
    "LEGENDARY",
    "ESCORT",
    "HEROIC",
    "RAID_10",
    "RAID_25",
  ];
  return types[type] || "UNKNOWN";
}
