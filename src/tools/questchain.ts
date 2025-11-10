/**
 * Quest Chain MCP Tool
 *
 * Comprehensive quest system analysis: chains, prerequisites, flow analysis,
 * reward optimization, and quest hub identification for bot AI decisions.
 *
 * @module questchain
 */

import { queryWorld } from "../database/connection";
import { getQuestInfo, QuestInfo } from "./quest";
import {
  getStatPriority,
  getDefaultStatWeights as getDefaultStatPrioritiesFromDB,
  ContentType as StatPriorityContentType,
  StatType,
  type StatPriority
} from "../data/stat-priorities";
import { logger } from "../utils/logger";


// ============================================================================
// ZONE BOUNDARY DEFINITIONS
// ============================================================================

/**
 * Zone boundaries for coordinate-based detection
 * Fallback for creatures with incorrect/missing zoneId
 *
 * Auto-generated from database coordinate analysis
 * Covers ALL zones with quests across all maps
 *
 * Key format: "zoneId_mapId" to handle phased/instanced zones
 */
interface ZoneBoundary {
  zoneId: number;
  map: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const ZONE_BOUNDARIES: Record<string, ZoneBoundary> = {
  '1_0': { zoneId: 1, map: 0, minX: -5622, maxX: -5062, minY: -883, maxY: -473 }, // 14 quests
  '3_0': { zoneId: 3, map: 0, minX: -6703, maxX: -6703, minY: -2451, maxY: -2451 }, // 1 quests
  '4_0': { zoneId: 4, map: 0, minX: -11812, maxX: -11013, minY: -3632, maxY: -3096 }, // 18 quests
  '8_0': { zoneId: 8, map: 0, minX: -9785, maxX: -9783, minY: -3846, maxY: -3835 }, // 2 quests
  '10_0': { zoneId: 10, map: 0, minX: -10512, maxX: -10512, minY: -1266, maxY: -1266 }, // 1 quests
  '11_0': { zoneId: 11, map: 0, minX: -3817, maxX: -3817, minY: -769, maxY: -769 }, // 1 quests
  '12_0': { zoneId: 12, map: 0, minX: -9500, maxX: -8700, minY: -250, maxY: 500 }, // 26 quests + Northshire Abbey (zoneId=0)
  '33_0': { zoneId: 33, map: 0, minX: -12368, maxX: -11321, minY: -196, maxY: 163 }, // 2 quests
  '38_0': { zoneId: 38, map: 0, minX: -5387, maxX: -5387, minY: -2882, maxY: -2882 }, // 1 quests
  '40_0': { zoneId: 40, map: 0, minX: -10542, maxX: -9855, minY: 1018, maxY: 1276 }, // 2 quests
  '44_0': { zoneId: 44, map: 0, minX: -9301, maxX: -9301, minY: -2323, maxY: -2323 }, // 1 quests
  '45_0': { zoneId: 45, map: 0, minX: -1242, maxX: -1019, minY: -3555, maxY: -2525 }, // 2 quests
  '46_0': { zoneId: 46, map: 0, minX: -8389, maxX: -7642, minY: -2775, maxY: -2139 }, // 2 quests
  '47_0': { zoneId: 47, map: 0, minX: -599, maxX: 267, minY: -4617, maxY: -2118 }, // 2 quests
  '85_0': { zoneId: 85, map: 0, minX: 1573, maxX: 2603, minY: -535, maxY: 383 }, // 14 quests
  '130_0': { zoneId: 130, map: 0, minX: 460, maxX: 1431, minY: 1010, maxY: 1527 }, // 17 quests
  '139_0': { zoneId: 139, map: 0, minX: 2251, maxX: 2375, minY: -5651, maxY: -5284 }, // 5 quests
  '267_0': { zoneId: 267, map: 0, minX: -52, maxX: 147, minY: -879, maxY: -209 }, // 2 quests
  '1519_0': { zoneId: 1519, map: 0, minX: -9053, maxX: -7880, minY: 204, maxY: 1329 }, // 56 quests
  '1537_0': { zoneId: 1537, map: 0, minX: -5046, maxX: -4830, minY: -1173, maxY: -816 }, // 7 quests
  '4706_0': { zoneId: 4706, map: 0, minX: -928, maxX: -916, minY: 1630, maxY: 1632 }, // 10 quests
  '4922_0': { zoneId: 4922, map: 0, minX: -5351, maxX: -2527, minY: -6791, maxY: -3183 }, // 208 quests
  '5287_0': { zoneId: 5287, map: 0, minX: -14470, maxX: -14314, minY: 462, maxY: 510 }, // 3 quests
  '6454_0': { zoneId: 6454, map: 0, minX: 1740, maxX: 1757, minY: 1641, maxY: 1704 }, // 1 quests
  '14046_0': { zoneId: 14046, map: 0, minX: 1779, maxX: 2050, minY: 213, maxY: 276 }, // 15 quests
  '14_1': { zoneId: 14, map: 1, minX: 253, maxX: 1862, minY: -5462, maxY: -4408 }, // 19 quests
  '15_1': { zoneId: 15, map: 1, minX: -3809, maxX: -3134, minY: -4537, maxY: -2842 }, // 2 quests
  '16_1': { zoneId: 16, map: 1, minX: 2664, maxX: 2664, minY: -6169, maxY: -6169 }, // 1 quests
  '17_1': { zoneId: 17, map: 1, minX: -1031, maxX: -388, minY: -3766, maxY: -2591 }, // 5 quests
  '141_1': { zoneId: 141, map: 1, minX: 9837, maxX: 9851, minY: 948, maxY: 991 }, // 4 quests
  '148_1': { zoneId: 148, map: 1, minX: 7354, maxX: 7415, minY: -259, maxY: -224 }, // 3 quests
  '215_1': { zoneId: 215, map: 1, minX: -2346, maxX: -2317, minY: -375, maxY: -344 }, // 3 quests
  '331_1': { zoneId: 331, map: 1, minX: 2341, maxX: 2759, minY: -2556, maxY: -438 }, // 2 quests
  '357_1': { zoneId: 357, map: 1, minX: -4461, maxX: -4381, minY: 240, maxY: 2177 }, // 2 quests
  '400_1': { zoneId: 400, map: 1, minX: -6098, maxX: -6093, minY: -3879, maxY: -3875 }, // 2 quests
  '405_1': { zoneId: 405, map: 1, minX: -1708, maxX: 180, minY: 1304, maxY: 3099 }, // 2 quests
  '406_1': { zoneId: 406, map: 1, minX: 957, maxX: 1175, minY: 418, maxY: 990 }, // 2 quests
  '440_1': { zoneId: 440, map: 1, minX: -7220, maxX: -7053, minY: -3831, maxY: -3732 }, // 5 quests
  '493_1': { zoneId: 493, map: 1, minX: 8002, maxX: 8002, minY: -2680, maxY: -2680 }, // 2 quests
  '616_1': { zoneId: 616, map: 1, minX: 4081, maxX: 5703, minY: -4978, maxY: -1509 }, // 163 quests
  '618_1': { zoneId: 618, map: 1, minX: 6707, maxX: 6812, minY: -4747, maxY: -4600 }, // 5 quests
  '1377_1': { zoneId: 1377, map: 1, minX: -6831, maxX: -6827, minY: 730, maxY: 736 }, // 2 quests
  '1637_1': { zoneId: 1637, map: 1, minX: 1577, maxX: 1925, minY: -4722, maxY: -4067 }, // 44 quests
  '1638_1': { zoneId: 1638, map: 1, minX: -1336, maxX: -971, minY: -79, maxY: 204 }, // 7 quests
  '1657_1': { zoneId: 1657, map: 1, minX: 9868, maxX: 10055, minY: 2111, maxY: 2500 }, // 7 quests
  '5034_1': { zoneId: 5034, map: 1, minX: -9758, maxX: -9758, minY: -914, maxY: -914 }, // 5 quests
  '5695_1': { zoneId: 5695, map: 1, minX: -8413, maxX: -8411, minY: 1481, maxY: 1486 }, // 27 quests
  '6453_1': { zoneId: 6453, map: 1, minX: -1149, maxX: -1149, minY: -5441, maxY: -5441 }, // 4 quests
  '2597_30': { zoneId: 2597, map: 30, minX: -1320, maxX: 729, minY: -638, maxY: -3 }, // 25 quests
  '719_48': { zoneId: 719, map: 48, minX: -847, maxX: -159, minY: -473, maxY: 74 }, // 2 quests
  '2437_389': { zoneId: 2437, map: 389, minX: -300, maxX: -14, minY: -60, maxY: 221 }, // 8 quests
  '3430_530': { zoneId: 3430, map: 530, minX: 9292, maxX: 9545, minY: -7268, maxY: -6783 }, // 12 quests
  '3433_530': { zoneId: 3433, map: 530, minX: 7580, maxX: 7580, minY: -6769, maxY: -6769 }, // 1 quests
  '3487_530': { zoneId: 3487, map: 530, minX: 9557, maxX: 9758, minY: -7494, maxY: -7116 }, // 2 quests
  '3519_530': { zoneId: 3519, map: 530, minX: -1801, maxX: -1785, minY: 4914, maxY: 4935 }, // 2 quests
  '3523_530': { zoneId: 3523, map: 530, minX: 2976, maxX: 3074, minY: 3595, maxY: 3683 }, // 3 quests
  '3524_530': { zoneId: 3524, map: 530, minX: -4307, maxX: -4185, minY: -12598, maxY: -11333 }, // 11 quests
  '3525_530': { zoneId: 3525, map: 530, minX: -2035, maxX: -2035, minY: -11896, maxY: -11896 }, // 1 quests
  '3557_530': { zoneId: 3557, map: 530, minX: -4046, maxX: -3811, minY: -11904, maxY: -11615 }, // 4 quests
  '3703_530': { zoneId: 3703, map: 530, minX: -2176, maxX: -1748, minY: 5303, maxY: 5769 }, // 3 quests
  '4080_530': { zoneId: 4080, map: 530, minX: 12664, maxX: 12808, minY: -7091, maxY: -6875 }, // 6 quests
  '6455_530': { zoneId: 6455, map: 530, minX: 10058, maxX: 10489, minY: -6372, maxY: -5820 }, // 7 quests
  '67_571': { zoneId: 67, map: 571, minX: 6192, maxX: 6194, minY: -1059, maxY: -1058 }, // 3 quests
  '4395_571': { zoneId: 4395, map: 571, minX: 5664, maxX: 5943, minY: 531, maxY: 767 }, // 4 quests
  '4131_585': { zoneId: 4131, map: 585, minX: 17, maxX: 17, minY: 0, maxY: 0 }, // 3 quests
  '5004_643': { zoneId: 5004, map: 643, minX: -617, maxX: -617, minY: 809, maxY: 809 }, // 2 quests
  '5042_646': { zoneId: 5042, map: 646, minX: -234, maxX: 2386, minY: -631, maxY: 1996 }, // 120 quests
  '4720_648': { zoneId: 4720, map: 648, minX: 495, maxX: 2393, minY: 1225, maxY: 3852 }, // 69 quests
  '4737_648': { zoneId: 4737, map: 648, minX: -8435, maxX: -7841, minY: 1277, maxY: 1903 }, // 35 quests
  '4714_654': { zoneId: 4714, map: 654, minX: -2460, maxX: -1288, minY: 977, maxY: 2608 }, // 60 quests
  '4755_654': { zoneId: 4755, map: 654, minX: -1808, maxX: -1399, minY: 1297, maxY: 1726 }, // 40 quests
  '5416_730': { zoneId: 5416, map: 730, minX: 837, maxX: 852, minY: 1039, maxY: 1055 }, // 2 quests
  '5042_747': { zoneId: 5042, map: 747, minX: 29, maxX: 49, minY: 8, maxY: 11 }, // 7 quests
  '5736_860': { zoneId: 5736, map: 860, minX: 1380, maxX: 1462, minY: 3217, maxY: 3466 }, // 12 quests
  '5785_870': { zoneId: 5785, map: 870, minX: 3116, maxX: 3179, minY: -760, maxY: -697 }, // 4 quests
  '5844_940': { zoneId: 5844, map: 940, minX: 3943, maxX: 4927, minY: 159, maxY: 462 }, // 1 quests
  '5861_974': { zoneId: 5861, map: 974, minX: -4418, maxX: -4091, minY: 6279, maxY: 6395 }, // 9 quests
  '6052_1001': { zoneId: 6052, map: 1001, minX: 838, maxX: 838, minY: 619, maxY: 619 }, // 4 quests
  '6109_1004': { zoneId: 6109, map: 1004, minX: 961, maxX: 1122, minY: 523, maxY: 605 }, // 4 quests
  '6066_1007': { zoneId: 6066, map: 1007, minX: 204, maxX: 204, minY: 103, maxY: 103 }, // 4 quests
  '6719_1116': { zoneId: 6719, map: 1116, minX: 1511, maxX: 2363, minY: 294, maxY: 462 }, // 10 quests
  '6720_1116': { zoneId: 6720, map: 1116, minX: 5435, maxX: 5540, minY: 4949, maxY: 5012 }, // 4 quests
  '7004_1116': { zoneId: 7004, map: 1116, minX: 5611, maxX: 5629, minY: 4521, maxY: 4534 }, // 18 quests
  '7078_1116': { zoneId: 7078, map: 1116, minX: 1928, maxX: 1936, minY: 322, maxY: 340 }, // 5 quests
  '7078_1158': { zoneId: 7078, map: 1158, minX: 1842, maxX: 1942, minY: 97, maxY: 330 }, // 35 quests
  '7334_1220': { zoneId: 7334, map: 1220, minX: -875, maxX: 1136, minY: 5597, maxY: 6859 }, // 32 quests
  '7502_1220': { zoneId: 7502, map: 1220, minX: -877, maxX: -794, minY: 4286, maxY: 4594 }, // 7 quests
  '7558_1220': { zoneId: 7558, map: 1220, minX: 2906, maxX: 2906, minY: 7678, maxY: 7678 }, // 1 quests
  '7025_1265': { zoneId: 7025, map: 1265, minX: 3835, maxX: 4192, minY: -2787, maxY: -2372 }, // 22 quests
  '7813_1479': { zoneId: 7813, map: 1479, minX: 1060, maxX: 1060, minY: 7225, maxY: 7225 }, // 1 quests
  '7705_1481': { zoneId: 7705, map: 1481, minX: 825, maxX: 1458, minY: 1631, maxY: 3203 }, // 13 quests
  '8567_1643': { zoneId: 8567, map: 1643, minX: 727, maxX: 1443, minY: -443, maxY: -424 }, // 2 quests
  '8717_1643': { zoneId: 8717, map: 1643, minX: 1012, maxX: 1141, minY: -625, maxY: -479 }, // 10 quests
  '8721_1643': { zoneId: 8721, map: 1643, minX: -1152, maxX: 426, minY: 1184, maxY: 2401 }, // 36 quests
  '9042_1643': { zoneId: 9042, map: 1643, minX: 2519, maxX: 2519, minY: -769, maxY: -769 }, // 2 quests
  '9359_1860': { zoneId: 9359, map: 1860, minX: 464, maxX: 502, minY: 1452, maxY: 1471 }, // 1 quests
  '9415_1865': { zoneId: 9415, map: 1865, minX: 2138, maxX: 2138, minY: 3319, maxY: 3319 }, // 1 quests
  '10028_2081': { zoneId: 10028, map: 2081, minX: 1632, maxX: 1632, minY: 525, maxY: 525 }, // 1 quests
  '10424_2175': { zoneId: 10424, map: 2175, minX: -435, maxX: 232, minY: -2639, maxY: -2283 }, // 32 quests
  '10413_2222': { zoneId: 10413, map: 2222, minX: -1940, maxX: -1891, minY: 7650, maxY: 7755 }, // 2 quests
  '10534_2222': { zoneId: 10534, map: 2222, minX: -4346, maxX: -4090, minY: -4635, maxY: -3923 }, // 6 quests
  '10565_2222': { zoneId: 10565, map: 2222, minX: -1834, maxX: -1790, minY: 1125, maxY: 1157 }, // 4 quests
  '10424_2261': { zoneId: 10424, map: 2261, minX: -13, maxX: 38, minY: -1, maxY: 6 }, // 4 quests
  '12825_2268': { zoneId: 12825, map: 2268, minX: 702, maxX: 702, minY: 619, maxY: 619 }, // 1 quests
  '12952_2297': { zoneId: 12952, map: 2297, minX: 426, maxX: 426, minY: -2124, maxY: -2124 }, // 3 quests
  '10424_2369': { zoneId: 10424, map: 2369, minX: -11, maxX: -4, minY: 1, maxY: 12 }, // 3 quests
  '13536_2374': { zoneId: 13536, map: 2374, minX: -4254, maxX: -4254, minY: 730, maxY: 730 }, // 1 quests
  '13646_2444': { zoneId: 13646, map: 2444, minX: -5087, maxX: -2318, minY: -3338, maxY: 4093 }, // 16 quests
  '13862_2444': { zoneId: 13862, map: 2444, minX: 63, maxX: 310, minY: -1044, maxY: -904 }, // 7 quests
  '14717_2552': { zoneId: 14717, map: 2552, minX: 607, maxX: 1965, minY: -3102, maxY: -1232 }, // 15 quests
  '14771_2552': { zoneId: 14771, map: 2552, minX: 2608, maxX: 3213, minY: -3072, maxY: -2221 }, // 10 quests
  '15336_2738': { zoneId: 15336, map: 2738, minX: 1324, maxX: 1330, minY: -1042, maxY: -1040 }, // 5 quests
  '15781_2738': { zoneId: 15781, map: 2738, minX: -868, maxX: -806, minY: -97, maxY: -80 }, // 16 quests
  '15509_2785': { zoneId: 15509, map: 2785, minX: 5752, maxX: 5778, minY: -3024, maxY: -3024 }, // 1 quests
};

/**
 * Get all zone boundaries for a given zoneId (may span multiple maps)
 */
function getZoneBoundaries(zoneId: number): ZoneBoundary[] {
  return Object.values(ZONE_BOUNDARIES).filter(b => b.zoneId === zoneId);
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface QuestChain {
  chainId: string;
  quests: QuestChainNode[];
  startQuest: number;
  endQuest: number;
  totalQuests: number;
  minLevel: number;
  maxLevel: number;
  estimatedTime: number; // minutes
  storyline?: string;
}

export interface QuestChainNode {
  questId: number;
  name: string;
  level: number;
  previousQuest: number | null;
  nextQuest: number | null;
  breadcrumbQuest: number | null;
  exclusiveGroup: number;
  depth: number; // Position in chain (0 = start)
}

export interface QuestPrerequisites {
  questId: number;
  name: string;

  // Level requirements
  minLevel: number;
  maxLevel: number;
  questLevel: number;

  // Quest requirements
  previousQuestRequired: number | null;
  previousQuestName?: string;
  breadcrumbFrom: number | null;

  // Class/Race requirements
  requiredClasses: number; // Bitmask
  requiredRaces: number; // Bitmask
  allowableClasses: number;
  allowableRaces: number;

  // Reputation requirements
  requiredFaction: number;
  requiredFactionRep: number;

  // Skill requirements
  requiredSkill: number;
  requiredSkillValue: number;

  // Item requirements
  sourceItemId: number;

  // Exclusive group
  exclusiveGroup: number;
  exclusiveGroupQuests?: number[];

  // Validation
  canAccept: boolean;
  blockingReasons: string[];
}

export interface QuestReward {
  questId: number;
  name: string;

  // Experience and money
  rewardXP: number;
  rewardMoney: number;
  rewardXPDifficulty: number;
  rewardMoneyDifficulty: number;

  // Choice rewards (pick one)
  choiceRewards: Array<{
    itemId: number;
    quantity: number;
    itemLevel: number;
    estimatedValue: number;
  }>;

  // Guaranteed rewards
  rewards: Array<{
    itemId: number;
    quantity: number;
  }>;

  // Reputation
  reputationRewards: Array<{
    factionId: number;
    reputationChange: number;
  }>;

  // Currency
  currencyRewards: Array<{
    currencyId: number;
    amount: number;
  }>;

  // Bonus rewards
  bonusRewards?: any[];

  // Optimization
  bestChoiceForClass?: {
    classId: number;
    itemId: number;
    reason: string;
  };
}

export interface QuestHub {
  mapId: number;
  zoneId: number;
  zoneName: string;
  centerX: number;
  centerY: number;
  questCount: number;
  quests: Array<{
    questId: number;
    name: string;
    level: number;
    questGiverId: number;
    questGiverName: string;
  }>;
  levelRange: { min: number; max: number };
  efficiency: number; // Quests per square unit
}

export interface QuestObjective {
  questId: number;
  objectiveIndex: number;
  type: string; // "kill", "collect", "interact", "explore"
  description: string;
  requiredAmount: number;

  // For kill objectives
  creatureId?: number;
  creatureName?: string;
  spawnLocations?: Array<{ map: number; x: number; y: number; z: number }>;

  // For collection objectives
  itemId?: number;
  itemName?: string;
  dropChance?: number;

  // For interaction objectives
  gameObjectId?: number;
  gameObjectName?: string;

  // Difficulty estimation
  estimatedTime: number; // minutes
  difficultyRating: "trivial" | "easy" | "medium" | "hard" | "extreme";
}

export interface QuestFlowAnalysis {
  zoneId: number;
  zoneName: string;
  optimalPath: number[]; // Ordered quest IDs
  parallelGroups: number[][]; // Quests that can be done simultaneously
  bottlenecks: Array<{
    questId: number;
    reason: string;
  }>;
  estimatedCompletionTime: number; // minutes
  xpPerHour: number;
  goldPerHour: number;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get complete quest prerequisites and requirements
 */
export async function getQuestPrerequisites(questId: number): Promise<QuestPrerequisites> {
  const query = `
    SELECT
      qt.ID as questId, qt.LogTitle as name, qta.MaxLevel as minLevel, qta.MaxLevel as maxLevel,
      qta.MaxLevel as questLevel, qta.PrevQuestID as previousQuestRequired,
      qta.BreadcrumbForQuestId as breadcrumbFrom, qta.AllowableClasses as requiredClasses,
      qt.RequiredRaces as requiredRaces, qt.AllowableClasses as allowableClasses,
      qt.AllowableRaces as allowableRaces, qt.RequiredFactionId1 as requiredFaction,
      qt.RequiredFactionValue1 as requiredFactionRep, qt.RequiredSkillId as requiredSkill,
      qt.RequiredSkillPoints as requiredSkillValue, qt.SourceItemId as sourceItemId,
      COALESCE(qta.ExclusiveGroup, 0) as exclusiveGroup
    FROM quest_template qt
    LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
    WHERE qt.ID = ?
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    throw new Error(`Quest ${questId} not found`);
  }

  const quest = results[0];

  // Get previous quest name if exists
  let previousQuestName: string | undefined;
  if (quest.previousQuestRequired && quest.previousQuestRequired !== 0) {
    const prevQuest = await queryWorld(
      "SELECT LogTitle as name FROM quest_template WHERE ID = ?",
      [quest.previousQuestRequired]
    );
    previousQuestName = prevQuest[0]?.name;
  }

  // Get exclusive group quests
  let exclusiveGroupQuests: number[] = [];
  if (quest.exclusiveGroup !== 0) {
    const groupQuests = await queryWorld(
      "SELECT ID FROM quest_template WHERE ExclusiveGroup = ? AND ID != ?",
      [quest.exclusiveGroup, questId]
    );
    exclusiveGroupQuests = groupQuests.map((q: any) => q.ID);
  }

  // Validation
  const blockingReasons: string[] = [];
  let canAccept = true;

  // Note: This is a simplified validation - actual bot would check player state
  if (quest.previousQuestRequired && quest.previousQuestRequired !== 0) {
    blockingReasons.push(`Requires completion of quest ${quest.previousQuestRequired}`);
    canAccept = false;
  }

  return {
    ...quest,
    previousQuestName,
    exclusiveGroupQuests,
    canAccept,
    blockingReasons
  };
}

/**
 * Trace a quest chain from start to end
 */
export async function traceQuestChain(startQuestId: number): Promise<QuestChain> {
  const visited = new Set<number>();
  const nodes: QuestChainNode[] = [];

  let currentQuestId: number | null = startQuestId;
  let depth = 0;

  while (currentQuestId && !visited.has(currentQuestId)) {
    visited.add(currentQuestId);

    const query = `
      SELECT
        qt.ID as questId, qt.LogTitle as name, qta.MaxLevel as level,
        qta.PrevQuestID as previousQuest, qta.NextQuestID as nextQuest,
        qta.BreadcrumbForQuestId as breadcrumbQuest, COALESCE(qta.ExclusiveGroup, 0) as exclusiveGroup
      FROM quest_template qt
      LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
      WHERE qt.ID = ?
    `;

    const results = await queryWorld(query, [currentQuestId]);

    if (!results || results.length === 0) break;

    const quest = results[0];

    // Fetch objectives and rewards for this quest
    let objectives = null;
    let rewards = null;

    try {
      objectives = await analyzeQuestObjectives(currentQuestId);
    } catch (err) {
      logger.debug('QuestChain', `Could not fetch objectives for quest ${currentQuestId}`, {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    try {
      rewards = await getQuestRewards(currentQuestId);
    } catch (err) {
      logger.debug('QuestChain', `Could not fetch rewards for quest ${currentQuestId}`, {
        error: err instanceof Error ? err.message : String(err)
      });
    }

    nodes.push({
      ...quest,
      depth,
      objectives,
      rewards
    });

    // TrinityCore chains use PrevQuestID (backwards), not NextQuestID (always 0)
    // Find the next quest that has the current quest as its prerequisite
    const nextQuery = `
      SELECT ID
      FROM quest_template_addon
      WHERE PrevQuestID = ?
      LIMIT 1
    `;
    const nextResults = await queryWorld(nextQuery, [currentQuestId]);
    currentQuestId = nextResults && nextResults.length > 0 ? nextResults[0].ID : null;
    depth++;
  }

  if (nodes.length === 0) {
    throw new Error(`Quest chain starting at ${startQuestId} not found`);
  }

  const levels = nodes.map(n => n.level);
  const minLevel = Math.min(...levels);
  const maxLevel = Math.max(...levels);
  const estimatedTime = nodes.length * 10; // Rough estimate: 10 min per quest

  return {
    chainId: `chain_${startQuestId}`,
    quests: nodes,
    startQuest: nodes[0].questId,
    endQuest: nodes[nodes.length - 1].questId,
    totalQuests: nodes.length,
    minLevel,
    maxLevel,
    estimatedTime
  };
}

/**
 * Find all quest chains in a zone
 */
export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {
  // Find all quests in zone that are potential chain starters
  // Uses both zoneId AND coordinate-based detection as fallback
  const boundaries = getZoneBoundaries(zoneId);

  let query = `
    SELECT DISTINCT qt.ID
    FROM quest_template qt
    LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest
    INNER JOIN creature c ON cqs.id = c.id
    WHERE (
      c.zoneId = ?
  `;

  // Add coordinate-based detection for all boundaries (handles multi-map zones)
  // ALWAYS check both correct zoneId AND zoneId=0 within coordinates (database quality issues)
  if (boundaries.length > 0) {
    for (const boundary of boundaries) {
      query += `
      OR (
        c.map = ${boundary.map}
        AND c.position_x BETWEEN ${boundary.minX} AND ${boundary.maxX}
        AND c.position_y BETWEEN ${boundary.minY} AND ${boundary.maxY}
        AND (c.zoneId = ${zoneId} OR c.zoneId = 0)
      )
    `;
    }
  }

  query += `
    )
    AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
    LIMIT 500
  `;

  const starters = await queryWorld(query, [zoneId]);

  logger.debug('QuestChain', `findQuestChainsInZone(${zoneId}): Found ${starters.length} starter quests`);
  if (starters.length > 0 && starters.length <= 5) {
    logger.debug('QuestChain', 'Starter quest IDs', {
      questIds: starters.map((s: any) => s.ID)
    });
  }

  const chains: QuestChain[] = [];

  for (const starter of starters) {
    try {
      const chain = await traceQuestChain(starter.ID);
      // Include all quests, even standalone ones (chains of 1 quest)
      if (chain.totalQuests >= 1) {
        chains.push(chain);
      }
    } catch (error) {
      // Skip invalid chains
      logger.debug('QuestChain', `Failed to trace chain for quest ${starter.ID}`, {
        error: error instanceof Error ? error.message : String(error)
      });
      continue;
    }
  }

  return chains.sort((a, b) => b.totalQuests - a.totalQuests);
}

/**
 * Get quest rewards with optimization suggestions
 * TrinityCore 11.2 schema - uses quest_reward_choice_items and quest_template columns
 */
export async function getQuestRewards(questId: number, classId?: number): Promise<QuestReward> {
  const query = `
    SELECT
      ID as questId, LogTitle as name,
      RewardXPDifficulty as rewardXPDifficulty, RewardMoney as rewardMoney,
      RewardBonusMoney as rewardMoneyDifficulty,
      RewardItem1, RewardAmount1,
      RewardItem2, RewardAmount2,
      RewardItem3, RewardAmount3,
      RewardItem4, RewardAmount4,
      RewardFactionID1, RewardFactionValue1, RewardFactionOverride1,
      RewardFactionID2, RewardFactionValue2, RewardFactionOverride2,
      RewardFactionID3, RewardFactionValue3, RewardFactionOverride3,
      RewardFactionID4, RewardFactionValue4, RewardFactionOverride4,
      RewardFactionID5, RewardFactionValue5, RewardFactionOverride5
    FROM quest_template
    WHERE ID = ?
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    throw new Error(`Quest ${questId} not found`);
  }

  const quest = results[0];

  // TrinityCore 11.2: Get choice rewards from quest_reward_choice_items
  const choiceQuery = `
    SELECT
      ItemID as itemId, Quantity as quantity
    FROM quest_reward_choice_items
    WHERE QuestID = ?
  `;

  const choiceRewards = await queryWorld(choiceQuery, [questId]);

  // TrinityCore 11.2: Parse guaranteed rewards from quest_template columns
  const rewards = [];
  for (let i = 1; i <= 4; i++) {
    const itemId = quest[`RewardItem${i}`];
    const quantity = quest[`RewardAmount${i}`];
    if (itemId && itemId > 0 && quantity && quantity > 0) {
      rewards.push({ itemId, quantity });
    }
  }

  // TrinityCore 11.2: Parse reputation rewards from quest_template columns
  const reputationRewards = [];
  for (let i = 1; i <= 5; i++) {
    const factionId = quest[`RewardFactionID${i}`];
    const reputationChange = quest[`RewardFactionValue${i}`] || quest[`RewardFactionOverride${i}`];
    if (factionId && factionId > 0 && reputationChange) {
      reputationRewards.push({ factionId, reputationChange });
    }
  }

  // Determine best choice reward for class if class is provided
  let bestChoiceForClass: QuestReward["bestChoiceForClass"];
  if (classId && choiceRewards && choiceRewards.length > 0) {
    bestChoiceForClass = await determineBestQuestReward(choiceRewards, classId);
  }

  // Enrich choice rewards with item details
  const enrichedChoiceRewards = await Promise.all(
    (choiceRewards || []).map(async (r: any) => {
      const itemStats = await getItemStatsForReward(r.itemId);
      return {
        itemId: r.itemId,
        quantity: r.quantity,
        itemLevel: itemStats.itemLevel || 0,
        estimatedValue: itemStats.sellPrice || 0,
      };
    })
  );

  return {
    questId: quest.questId,
    name: quest.name,
    rewardXP: 0, // Would need level calculation
    rewardMoney: quest.rewardMoney || 0,
    rewardXPDifficulty: quest.rewardXPDifficulty || 0,
    rewardMoneyDifficulty: quest.rewardMoneyDifficulty || 0,
    choiceRewards: enrichedChoiceRewards,
    rewards: rewards || [],
    reputationRewards: reputationRewards || [],
    currencyRewards: [],
    bestChoiceForClass,
  };
}

/**
 * Stat weights for each class/role
 * Higher value = more important stat for that class
 */
const CLASS_STAT_PRIORITIES: { [classId: number]: { [stat: string]: number } } = {
  // 1: Warrior
  1: {
    strength: 1.0,
    stamina: 0.8,
    criticalStrike: 0.7,
    haste: 0.6,
    mastery: 0.7,
    versatility: 0.5,
    armor: 0.9,
  },
  // 2: Paladin
  2: {
    strength: 1.0,
    stamina: 0.8,
    intellect: 0.3, // For Holy
    criticalStrike: 0.6,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.5,
    armor: 0.9,
  },
  // 3: Hunter
  3: {
    agility: 1.0,
    stamina: 0.6,
    criticalStrike: 0.8,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.5,
  },
  // 4: Rogue
  4: {
    agility: 1.0,
    stamina: 0.6,
    criticalStrike: 0.8,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.6,
  },
  // 5: Priest
  5: {
    intellect: 1.0,
    stamina: 0.7,
    criticalStrike: 0.6,
    haste: 0.8,
    mastery: 0.6,
    versatility: 0.5,
  },
  // 6: Death Knight
  6: {
    strength: 1.0,
    stamina: 0.8,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.5,
    armor: 0.9,
  },
  // 7: Shaman
  7: {
    intellect: 0.7, // For Ele/Resto
    agility: 0.7, // For Enh
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.5,
  },
  // 8: Mage
  8: {
    intellect: 1.0,
    stamina: 0.6,
    criticalStrike: 0.8,
    haste: 0.8,
    mastery: 0.7,
    versatility: 0.5,
  },
  // 9: Warlock
  9: {
    intellect: 1.0,
    stamina: 0.6,
    criticalStrike: 0.7,
    haste: 0.8,
    mastery: 0.7,
    versatility: 0.5,
  },
  // 10: Monk
  10: {
    agility: 0.7,
    intellect: 0.3, // For Mistweaver
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.6,
    armor: 0.5,
  },
  // 11: Druid
  11: {
    agility: 0.6, // For Feral/Guardian
    intellect: 0.6, // For Balance/Resto
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.5,
    armor: 0.6,
  },
  // 12: Demon Hunter
  12: {
    agility: 1.0,
    stamina: 0.7,
    criticalStrike: 0.8,
    haste: 0.7,
    mastery: 0.6,
    versatility: 0.6,
  },
  // 13: Evoker
  13: {
    intellect: 1.0,
    stamina: 0.7,
    criticalStrike: 0.7,
    haste: 0.7,
    mastery: 0.7,
    versatility: 0.6,
  },
};

/**
 * Get item stats for quest reward analysis
 */
async function getItemStatsForReward(itemId: number): Promise<any> {
  try {
    const query = `
      SELECT
        ItemID as itemId,
        Class as itemClass,
        SubClass as itemSubClass,
        InventoryType as inventoryType,
        ItemLevel as itemLevel,
        RequiredLevel as requiredLevel,
        SellPrice as sellPrice,
        Quality as quality,
        BonusStats as bonusStats
      FROM item_template
      WHERE ItemID = ?
      LIMIT 1
    `;

    const results = await queryWorld(query, [itemId]);

    if (!results || results.length === 0) {
      return { itemId, itemLevel: 0, sellPrice: 0, stats: {} };
    }

    const item = results[0];

    // Parse item stats (simplified - real implementation would parse all stat fields)
    const stats: { [key: string]: number } = {};

    // Get primary stats from item stat fields
    const statQuery = `
      SELECT
        stat_type1, stat_value1,
        stat_type2, stat_value2,
        stat_type3, stat_value3,
        stat_type4, stat_value4,
        stat_type5, stat_value5,
        stat_type6, stat_value6,
        stat_type7, stat_value7,
        stat_type8, stat_value8,
        stat_type9, stat_value9,
        stat_type10, stat_value10,
        armor
      FROM item_template
      WHERE ItemID = ?
    `;

    const statResults = await queryWorld(statQuery, [itemId]);

    if (statResults && statResults.length > 0) {
      const itemStats = statResults[0];

      // Map stat types to stat names
      const statTypeMap: { [key: number]: string } = {
        3: "agility",
        4: "strength",
        5: "intellect",
        7: "stamina",
        32: "criticalStrike",
        36: "haste",
        40: "versatility",
        49: "mastery",
      };

      // Extract all stats
      for (let i = 1; i <= 10; i++) {
        const statType = itemStats[`stat_type${i}`];
        const statValue = itemStats[`stat_value${i}`];

        if (statType && statValue && statTypeMap[statType]) {
          const statName = statTypeMap[statType];
          stats[statName] = (stats[statName] || 0) + statValue;
        }
      }

      // Add armor if present
      if (itemStats.armor) {
        stats.armor = itemStats.armor;
      }
    }

    return {
      ...item,
      stats,
    };
  } catch (error) {
    return { itemId, itemLevel: 0, sellPrice: 0, stats: {} };
  }
}

/**
 * Determine the best quest reward choice for a given class and specialization
 * Enhancement #1 (Phase 7): Now uses comprehensive stat priorities database
 *
 * @param choiceRewards - Array of quest reward items
 * @param classId - Player class ID (1-13)
 * @param specId - Player specialization ID (optional, uses default if not provided)
 * @returns Best reward recommendation with reasoning
 */
async function determineBestQuestReward(
  choiceRewards: any[],
  classId: number,
  specId?: number
): Promise<{ classId: number; itemId: number; reason: string }> {
  // Get stat priority from comprehensive database (leveling content assumed for quest rewards)
  let statPriority: StatPriority | undefined;

  if (specId) {
    // Try to get spec-specific priorities (leveling content)
    statPriority = getStatPriority(classId, specId, StatPriorityContentType.RAID_DPS);
  }

  // Fallback to default priorities for class
  if (!statPriority) {
    statPriority = getDefaultStatPrioritiesFromDB(classId, specId || 0);
  }

  // Fallback to legacy priorities if still no match
  const statPriorities = statPriority
    ? convertStatPriorityToWeights(statPriority)
    : (CLASS_STAT_PRIORITIES[classId] || CLASS_STAT_PRIORITIES[1]);

  let bestItemId = 0;
  let bestScore = 0;
  let bestReason = "";
  const itemScores: Array<{ itemId: number; score: number; reason: string }> = [];

  for (const reward of choiceRewards) {
    const itemDetails = await getItemStatsForReward(reward.itemId);
    const stats = itemDetails.stats || {};

    // Calculate item score based on stat priorities
    let itemScore = 0;
    const statContributions: string[] = [];

    for (const [statName, statValue] of Object.entries(stats)) {
      const statWeight = statPriorities[statName as string] || 0;
      const contribution = (statValue as number) * statWeight;
      itemScore += contribution;

      if (contribution > 0 && (statValue as number) > 0) {
        statContributions.push(`${statValue} ${statName}`);
      }
    }

    // Bonus for higher item level (each ilvl = 0.5 score)
    const ilvlBonus = (itemDetails.itemLevel || 0) * 0.5;
    itemScore += ilvlBonus;

    // Bonus for higher quality
    const qualityBonus = {
      0: 0, // Poor (gray)
      1: 1, // Common (white)
      2: 2, // Uncommon (green)
      3: 5, // Rare (blue)
      4: 10, // Epic (purple)
      5: 20, // Legendary (orange)
      6: 30, // Artifact (artifact)
      7: 40, // Heirloom (heirloom)
    };
    const qualityScore = qualityBonus[itemDetails.quality as keyof typeof qualityBonus] || 0;
    itemScore += qualityScore;

    // Bonus for socket slots (each socket = 5 score)
    const socketBonus = (itemDetails.socketCount || 0) * 5;
    itemScore += socketBonus;

    // Armor type filtering (penalize wrong armor type)
    const armorPenalty = calculateArmorTypePenalty(classId, itemDetails.itemClass, itemDetails.itemSubClass);
    itemScore *= (1 - armorPenalty);

    // Weapon type filtering (penalize wrong weapon type)
    const weaponPenalty = calculateWeaponTypePenalty(classId, itemDetails.itemClass, itemDetails.itemSubClass);
    itemScore *= (1 - weaponPenalty);

    // Build reason string
    const qualityNames = ["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Artifact", "Heirloom"];
    const qualityName = qualityNames[itemDetails.quality] || "Unknown";

    const topStats = statContributions.slice(0, 3).join(", ");
    const socketInfo = itemDetails.socketCount > 0 ? ` +${itemDetails.socketCount} socket(s)` : "";
    const reason = `${qualityName} item (iLvl ${itemDetails.itemLevel || 0})${socketInfo} with best stats: ${topStats || "no stats"}`;

    itemScores.push({ itemId: reward.itemId, score: itemScore, reason });

    if (itemScore > bestScore) {
      bestScore = itemScore;
      bestItemId = reward.itemId;
      bestReason = reason;
    }
  }

  // If no item scored above 0, default to first reward
  if (bestScore === 0 && choiceRewards.length > 0) {
    bestItemId = choiceRewards[0].itemId;
    bestReason = "No stat-weighted items found, selecting first reward (likely currency or consumable)";
  }

  return {
    classId,
    itemId: bestItemId || 0,
    reason: bestReason || "No suitable rewards available",
  };
}

/**
 * Convert StatPriority from stat-priorities database to legacy weight format
 */
function convertStatPriorityToWeights(statPriority: StatPriority): { [stat: string]: number } {
  const weights: { [stat: string]: number } = {};

  // Map StatPriority weights to legacy stat names
  weights.strength = statPriority.priorityOrder.includes(StatType.STRENGTH) ? 1.0 : 0.0;
  weights.agility = statPriority.priorityOrder.includes(StatType.AGILITY) ? 1.0 : 0.0;
  weights.intellect = statPriority.priorityOrder.includes(StatType.INTELLECT) ? 1.0 : 0.0;
  weights.stamina = 0.6; // Always somewhat valuable

  weights.criticalStrike = statPriority.weights.criticalStrike || 0.0;
  weights.haste = statPriority.weights.haste || 0.0;
  weights.mastery = statPriority.weights.mastery || 0.0;
  weights.versatility = statPriority.weights.versatility || 0.0;
  weights.armor = statPriority.weights.armor || 0.0;

  return weights;
}

/**
 * Calculate armor type penalty for wrong armor class
 * Returns 0.0 (no penalty) to 1.0 (fully penalized)
 */
function calculateArmorTypePenalty(classId: number, itemClass: number, itemSubClass: number): number {
  // Item class 4 = Armor
  if (itemClass !== 4) {
    return 0.0; // Not armor, no penalty
  }

  // Armor subclass: 0=Misc, 1=Cloth, 2=Leather, 3=Mail, 4=Plate
  const classArmorTypes: { [classId: number]: number[] } = {
    1: [4], // Warrior - Plate
    2: [4], // Paladin - Plate
    3: [3], // Hunter - Mail
    4: [2], // Rogue - Leather
    5: [1], // Priest - Cloth
    6: [4], // Death Knight - Plate
    7: [3], // Shaman - Mail
    8: [1], // Mage - Cloth
    9: [1], // Warlock - Cloth
    10: [2], // Monk - Leather
    11: [2], // Druid - Leather
    12: [2], // Demon Hunter - Leather
    13: [3], // Evoker - Mail
  };

  const allowedArmorTypes = classArmorTypes[classId] || [1]; // Default to cloth

  // If armor type matches, no penalty
  if (allowedArmorTypes.includes(itemSubClass)) {
    return 0.0;
  }

  // Wrong armor type: 50% penalty
  return 0.5;
}

/**
 * Calculate weapon type penalty for wrong weapon class
 * Returns 0.0 (no penalty) to 1.0 (fully penalized)
 */
function calculateWeaponTypePenalty(classId: number, itemClass: number, itemSubClass: number): number {
  // Item class 2 = Weapon
  if (itemClass !== 2) {
    return 0.0; // Not a weapon, no penalty
  }

  // Weapon subclass proficiency by class
  // This is simplified - in reality, need to check class_spell for weapon skills
  const classWeaponTypes: { [classId: number]: number[] } = {
    1: [0, 1, 2, 4, 5, 6, 7, 8, 10, 13, 15, 19], // Warrior - All weapons
    2: [0, 1, 2, 4, 5, 6, 7, 8, 10], // Paladin - Most weapons
    3: [0, 1, 2, 3, 13, 15, 18], // Hunter - Ranged + melee
    4: [0, 1, 4, 7, 13, 15], // Rogue - One-handed + daggers
    5: [7, 10, 15, 19], // Priest - Staves, wands, maces
    6: [0, 1, 4, 5, 6, 7, 8], // Death Knight - Most melee
    7: [0, 1, 4, 5, 10, 13], // Shaman - Maces, axes, fist weapons
    8: [7, 10, 15, 19], // Mage - Staves, swords, wands
    9: [7, 10, 15, 19], // Warlock - Staves, swords, wands
    10: [0, 4, 7, 13], // Monk - Fist weapons, staves, polearms
    11: [0, 4, 7, 10, 13], // Druid - Fist weapons, staves, polearms, maces
    12: [0, 1, 4, 13], // Demon Hunter - Warglaives, one-handed
    13: [0, 1, 4, 7, 10], // Evoker - Staves, daggers, swords, maces
  };

  const allowedWeaponTypes = classWeaponTypes[classId] || [];

  // If weapon type matches, no penalty
  if (allowedWeaponTypes.includes(itemSubClass)) {
    return 0.0;
  }

  // Wrong weapon type: 90% penalty (very high - can't use wrong weapon type)
  return 0.9;
}

/**
 * Find quest hubs (clusters of quest givers)
 */
export async function findQuestHubs(zoneId: number, minQuestCount: number = 3): Promise<QuestHub[]> {
  const query = `
    SELECT
      c.zoneId, c.map as mapId, c.position_x as x, c.position_y as y,
      COUNT(DISTINCT cqs.quest) as questCount,
      MIN(qta.MaxLevel) as minLevel, MAX(qta.MaxLevel) as maxLevel
    FROM creature c
    INNER JOIN creature_queststarter cqs ON c.id = cqs.id
    INNER JOIN quest_template qt ON cqs.quest = qt.ID
    WHERE c.zoneId = ?
    GROUP BY c.guid
    HAVING questCount >= ?
    ORDER BY questCount DESC
    LIMIT 20
  `;

  const hubs = await queryWorld(query, [zoneId, minQuestCount]);

  return hubs.map((hub: any) => ({
    mapId: hub.mapId,
    zoneId: hub.zoneId,
    zoneName: `Zone ${hub.zoneId}`,
    centerX: hub.x,
    centerY: hub.y,
    questCount: hub.questCount,
    quests: [],
    levelRange: { min: hub.minLevel, max: hub.maxLevel },
    efficiency: hub.questCount / 100 // Simplified efficiency
  }));
}

/**
 * Analyze quest objectives and estimate difficulty
 * TrinityCore 11.2 schema - uses quest_objectives table
 */
export async function analyzeQuestObjectives(questId: number): Promise<QuestObjective[]> {
  const objectives: QuestObjective[] = [];

  // TrinityCore 11.2: quest_objectives table with Type field
  const query = `
    SELECT
      ID, QuestID, Type, \`Order\`, StorageIndex, ObjectID, Amount, Description
    FROM quest_objectives
    WHERE QuestID = ?
    ORDER BY \`Order\`
  `;

  const results = await queryWorld(query, [questId]);

  if (!results || results.length === 0) {
    return objectives;
  }

  // TrinityCore 11.2 objective type mapping
  const typeMap: Record<number, string> = {
    0: "kill",        // QUEST_OBJECTIVE_MONSTER - Kill creatures
    1: "collect",     // QUEST_OBJECTIVE_ITEM - Collect items
    2: "interact",    // QUEST_OBJECTIVE_GAMEOBJECT - Interact with objects
    3: "talk",        // QUEST_OBJECTIVE_TALKTO - Talk to NPC
    4: "currency",    // QUEST_OBJECTIVE_CURRENCY - Collect currency
    5: "learnSpell",  // QUEST_OBJECTIVE_LEARNSPELL - Learn a spell
    6: "minReputation", // QUEST_OBJECTIVE_MIN_REPUTATION
    7: "maxReputation", // QUEST_OBJECTIVE_MAX_REPUTATION
    8: "money",       // QUEST_OBJECTIVE_MONEY
    9: "playermove",  // QUEST_OBJECTIVE_PLAYERMOVE
    10: "explore",    // QUEST_OBJECTIVE_AREATRIGGER - Explore area
    14: "winPetBattle", // QUEST_OBJECTIVE_WINPETBATTLEAGAINSTNPC
    27: "defeatBattlePet", // QUEST_OBJECTIVE_DEFEATBATTLEPET
    28: "criteria",   // QUEST_OBJECTIVE_CRITERIA_TREE
    29: "progressBar", // QUEST_OBJECTIVE_PROGRESS_BAR
    42: "haveCurrency", // QUEST_OBJECTIVE_HAVE_CURRENCY
    43: "obtainCurrency", // QUEST_OBJECTIVE_OBTAIN_CURRENCY
    44: "increaseCurrencyCapacity", // QUEST_OBJECTIVE_INCREASE_REPUTATION
  };

  for (const obj of results) {
    const type = typeMap[obj.Type] || `unknown_type_${obj.Type}`;
    const amount = obj.Amount || 1;

    // Generate description based on type
    let description = obj.Description;
    if (!description || description.trim() === "") {
      description = `Objective ${obj.Order + 1}`;
      if (type === "kill" && obj.ObjectID > 0) {
        description = `Kill creature ${obj.ObjectID} (${amount}x)`;
      } else if (type === "collect" && obj.ObjectID > 0) {
        description = `Collect item ${obj.ObjectID} (${amount}x)`;
      } else if (type === "interact" && obj.ObjectID > 0) {
        description = `Interact with object ${obj.ObjectID} (${amount}x)`;
      } else if (type === "explore") {
        description = `Explore area`;
      } else if (type === "talk" && obj.ObjectID > 0) {
        description = `Talk to NPC ${obj.ObjectID}`;
      }
    }

    objectives.push({
      questId,
      objectiveIndex: obj.Order,
      type,
      description,
      requiredAmount: amount,
      creatureId: obj.Type === 0 ? obj.ObjectID : undefined,
      gameObjectId: obj.Type === 2 ? obj.ObjectID : undefined,
      itemId: obj.Type === 1 ? obj.ObjectID : undefined,
      estimatedTime: amount * (type === "kill" ? 2 : type === "collect" ? 3 : 1),
      difficultyRating: amount > 20 ? "hard" : amount > 10 ? "medium" : "easy"
    });
  }

  return objectives;
}

/**
 * Optimize quest path through a zone
 */
export async function optimizeQuestPath(
  zoneId: number,
  playerLevel: number,
  maxQuests: number = 20
): Promise<QuestFlowAnalysis> {
  // Get available quests in level range
  const query = `
    SELECT DISTINCT qt.ID as questId, qt.LogTitle as name,
           qta.MaxLevel as MinLevel, qta.MaxLevel as QuestLevel, qt.RewardXPDifficulty,
           qt.RewardMoney
    FROM quest_template qt
    LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest
    INNER JOIN creature c ON cqs.id = c.id
    WHERE c.zoneId = ?
      AND qta.MaxLevel <= ?
      AND qta.MaxLevel <= ? + 5
    ORDER BY qta.MaxLevel, qt.ID
    LIMIT ?
  `;

  const quests = await queryWorld(query, [zoneId, playerLevel, playerLevel, maxQuests]);

  // Simple optimization: order by level and prerequisites
  const optimalPath = quests.map((q: any) => q.questId);

  // Group quests that can be done in parallel (same area, similar objectives)
  const parallelGroups: number[][] = [];
  const bottlenecks: Array<{ questId: number; reason: string }> = [];

  const estimatedTime = quests.length * 10; // 10 min per quest
  const totalXP = quests.reduce((sum: number, q: any) => sum + (q.RewardXPDifficulty || 0), 0);
  const totalGold = quests.reduce((sum: number, q: any) => sum + (q.RewardMoney || 0), 0);

  return {
    zoneId,
    zoneName: `Zone ${zoneId}`,
    optimalPath,
    parallelGroups,
    bottlenecks,
    estimatedCompletionTime: estimatedTime,
    xpPerHour: (totalXP / estimatedTime) * 60,
    goldPerHour: (totalGold / estimatedTime) * 60
  };
}
