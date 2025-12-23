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
  minLevel: number; // Deprecated in 11.2.7 - now uses ContentTuningID for scaling
  contentTuningId?: number; // TrinityCore 11.2.7+: Content scaling ID
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
    // TrinityCore 11.2.7: MinLevel removed, now uses ContentTuningID for scaling
    // MaxLevel is in quest_template_addon, quest level determined by ContentTuningID
    const query = `
      SELECT
        qt.ID as questId,
        qt.LogTitle as title,
        qt.LogDescription as details,
        qt.QuestDescription as objectives,
        qta.MaxLevel as level,
        qt.ContentTuningID as contentTuningId,
        qt.QuestInfoID as type,
        qt.RewardXPDifficulty as experience,
        qt.RewardMoneyDifficulty as money
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
      level: quest.level || 0,
      minLevel: 0, // Deprecated in 11.2.7 - use contentTuningId
      contentTuningId: quest.contentTuningId,
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
