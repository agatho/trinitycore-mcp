/**
 * Quest Chain Utility Functions
 * Color coding, time estimation, and helper functions
 */

export interface Quest {
  id: number;
  title: string;
  level: number;
  prevQuestId?: number;
  nextQuestId?: number;
  zone?: string;
  zoneId?: number;
  faction?: string;
  depth: number;
  prerequisites?: any;
  rewards?: any;
  objectives?: any[];
  requiredRaces?: number;
  requiredClasses?: number;
  exclusiveGroup?: number;
  isDaily?: boolean;
  isWeekly?: boolean;
  isRepeatable?: boolean;
}

/**
 * Get quest color based on type, faction, and state
 */
export function getQuestColor(quest: Quest, quests: Quest[]): string {
  // Check for broken chain (highest priority)
  const isBroken = quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId);
  if (isBroken) return '#ef4444'; // red-500

  // Check for orphaned quest
  const isOrphaned = !quest.prevQuestId && !quests.find(q => q.prevQuestId === quest.id);
  if (isOrphaned && !quest.nextQuestId) return '#f59e0b'; // amber-500

  // Daily/Repeatable quests
  if (quest.isDaily) return '#10b981'; // green-500
  if (quest.isWeekly) return '#14b8a6'; // teal-500
  if (quest.isRepeatable) return '#06b6d4'; // cyan-500

  // Epic/Raid quests (high level)
  if (quest.level >= 60) return '#8b5cf6'; // purple-500

  // Faction-based coloring
  if (quest.faction) {
    switch (quest.faction.toLowerCase()) {
      case 'alliance':
        return '#3b82f6'; // blue-500
      case 'horde':
        return '#dc2626'; // red-600
      case 'neutral':
        return '#6b7280'; // gray-500
    }
  }

  // Race-specific quests
  if (quest.requiredRaces && quest.requiredRaces > 0) {
    // Alliance races: 1, 3, 4, 7, 11 (Human, Dwarf, Night Elf, Gnome, Draenei)
    const allianceRaces = [1, 2, 4, 8, 64]; // Bitmask values
    const hordeRaces = [16, 32, 128, 256, 512]; // Orc, Undead, Tauren, Troll, Blood Elf

    if (allianceRaces.some(mask => quest.requiredRaces! & mask)) {
      return '#3b82f6'; // blue-500 (Alliance)
    }
    if (hordeRaces.some(mask => quest.requiredRaces! & mask)) {
      return '#dc2626'; // red-600 (Horde)
    }
  }

  // Default color (normal quest)
  return '#3b82f6'; // blue-500
}

/**
 * Get quest category for filtering
 */
export function getQuestCategory(quest: Quest, quests: Quest[]): string {
  if (quest.isDaily) return 'Daily';
  if (quest.isWeekly) return 'Weekly';
  if (quest.isRepeatable) return 'Repeatable';

  const isBroken = quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId);
  if (isBroken) return 'Broken';

  const isOrphaned = !quest.prevQuestId && !quests.find(q => q.prevQuestId === quest.id);
  if (isOrphaned && !quest.nextQuestId) return 'Orphaned';

  if (quest.prevQuestId && quest.nextQuestId) return 'Chain Middle';
  if (quest.prevQuestId) return 'Chain End';
  if (quest.nextQuestId || quests.find(q => q.prevQuestId === quest.id)) return 'Chain Start';

  return 'Standalone';
}

/**
 * Estimate time to complete quest based on objectives
 */
export function estimateQuestTime(quest: Quest): number {
  if (!quest.objectives || quest.objectives.length === 0) {
    return 10; // Default 10 minutes for quests without objective data
  }

  let totalTime = 0;

  quest.objectives.forEach((obj: any) => {
    switch (obj.type?.toLowerCase()) {
      case 'kill':
        // Kill objectives: ~30 seconds per mob
        totalTime += (obj.requiredAmount || 10) * 0.5;
        break;

      case 'collect':
        // Collection objectives: depends on drop chance
        const dropChance = obj.dropChance || 0.25; // Default 25% drop rate
        const expectedKills = (obj.requiredAmount || 10) / dropChance;
        totalTime += expectedKills * 0.5;
        break;

      case 'interact':
        // Interaction objectives: ~1 minute per interaction
        totalTime += (obj.requiredAmount || 1) * 1;
        break;

      case 'explore':
        // Exploration objectives: ~2 minutes per location
        totalTime += (obj.requiredAmount || 1) * 2;
        break;

      default:
        // Unknown objective type
        totalTime += 5;
    }
  });

  // Add travel time (rough estimate based on zone)
  totalTime += 5;

  // Add turn-in time
  totalTime += 2;

  return Math.max(5, Math.round(totalTime));
}

/**
 * Calculate XP per hour for quest
 */
export function calculateXPPerHour(quest: Quest): number {
  if (!quest.rewards?.rewardXP) return 0;

  const timeInMinutes = estimateQuestTime(quest);
  const timeInHours = timeInMinutes / 60;

  return Math.round(quest.rewards.rewardXP / timeInHours);
}

/**
 * Calculate gold per hour for quest
 */
export function calculateGoldPerHour(quest: Quest): number {
  if (!quest.rewards?.rewardMoney) return 0;

  const timeInMinutes = estimateQuestTime(quest);
  const timeInHours = timeInMinutes / 60;
  const goldAmount = quest.rewards.rewardMoney / 10000; // Convert copper to gold

  return parseFloat((goldAmount / timeInHours).toFixed(2));
}

/**
 * Calculate efficiency score for quest (0-100)
 */
export function calculateEfficiencyScore(quest: Quest): number {
  const xpPerHour = calculateXPPerHour(quest);
  const goldPerHour = calculateGoldPerHour(quest);

  // Normalize based on level (higher level quests should give more XP)
  const expectedXPPerHour = quest.level * 1000;
  const expectedGoldPerHour = quest.level * 0.5;

  const xpScore = Math.min(100, (xpPerHour / expectedXPPerHour) * 50);
  const goldScore = Math.min(100, (goldPerHour / expectedGoldPerHour) * 50);

  return Math.round(xpScore + goldScore);
}

/**
 * Get quest difficulty rating
 */
export function getQuestDifficulty(quest: Quest): 'Trivial' | 'Easy' | 'Medium' | 'Hard' | 'Extreme' {
  if (!quest.objectives || quest.objectives.length === 0) {
    return 'Easy';
  }

  let difficultyScore = 0;

  quest.objectives.forEach((obj: any) => {
    // Add difficulty based on required amount
    if (obj.requiredAmount > 20) difficultyScore += 3;
    else if (obj.requiredAmount > 10) difficultyScore += 2;
    else difficultyScore += 1;

    // Add difficulty based on drop chance (for collection)
    if (obj.type === 'collect' && obj.dropChance) {
      if (obj.dropChance < 0.1) difficultyScore += 3;
      else if (obj.dropChance < 0.3) difficultyScore += 2;
    }

    // Add difficulty based on objective type
    if (obj.difficultyRating) {
      switch (obj.difficultyRating) {
        case 'extreme': difficultyScore += 4; break;
        case 'hard': difficultyScore += 3; break;
        case 'medium': difficultyScore += 2; break;
        case 'easy': difficultyScore += 1; break;
      }
    }
  });

  // Normalize to rating
  if (difficultyScore <= 3) return 'Trivial';
  if (difficultyScore <= 6) return 'Easy';
  if (difficultyScore <= 10) return 'Medium';
  if (difficultyScore <= 15) return 'Hard';
  return 'Extreme';
}

/**
 * Get color for difficulty rating
 */
export function getDifficultyColor(difficulty: string): string {
  switch (difficulty) {
    case 'Trivial': return '#6b7280'; // gray
    case 'Easy': return '#10b981'; // green
    case 'Medium': return '#f59e0b'; // amber
    case 'Hard': return '#f97316'; // orange
    case 'Extreme': return '#ef4444'; // red
    default: return '#6b7280';
  }
}

/**
 * Calculate chain depth
 */
export function calculateChainDepth(quest: Quest, quests: Quest[]): number {
  let depth = 0;
  let current = quest;
  const visited = new Set<number>();

  while (current.prevQuestId && !visited.has(current.id)) {
    visited.add(current.id);
    const prev = quests.find(q => q.id === current.prevQuestId);
    if (!prev) break;
    depth++;
    current = prev;
  }

  return depth;
}

/**
 * Get faction name from bitmask
 */
export function getFactionFromRaceMask(raceMask: number): 'Alliance' | 'Horde' | 'Neutral' {
  if (!raceMask || raceMask === 0) return 'Neutral';

  // Alliance races bitmask
  const allianceRaces = 1 | 2 | 4 | 8 | 64 | 1024; // Human, Orc, Dwarf, Night Elf, Draenei, Worgen

  // Horde races bitmask
  const hordeRaces = 16 | 32 | 128 | 256 | 512; // Undead, Tauren, Gnome, Troll, Blood Elf

  if ((raceMask & allianceRaces) && !(raceMask & hordeRaces)) return 'Alliance';
  if ((raceMask & hordeRaces) && !(raceMask & allianceRaces)) return 'Horde';

  return 'Neutral';
}

/**
 * Filter quests by criteria
 */
export interface QuestFilters {
  minLevel?: number;
  maxLevel?: number;
  faction?: 'Alliance' | 'Horde' | 'Neutral' | 'All';
  category?: string;
  zone?: string;
  searchTerm?: string;
  showBroken?: boolean;
  showOrphaned?: boolean;
}

export function filterQuests(quests: Quest[], filters: QuestFilters): Quest[] {
  return quests.filter(quest => {
    // Level filter
    if (filters.minLevel && quest.level < filters.minLevel) return false;
    if (filters.maxLevel && quest.level > filters.maxLevel) return false;

    // Faction filter
    if (filters.faction && filters.faction !== 'All') {
      const questFaction = quest.faction || getFactionFromRaceMask(quest.requiredRaces || 0);
      if (questFaction !== filters.faction) return false;
    }

    // Category filter
    if (filters.category) {
      const category = getQuestCategory(quest, quests);
      if (category !== filters.category) return false;
    }

    // Zone filter
    if (filters.zone && quest.zone !== filters.zone) return false;

    // Search term
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      const matchesTitle = quest.title.toLowerCase().includes(term);
      const matchesId = quest.id.toString().includes(term);
      if (!matchesTitle && !matchesId) return false;
    }

    // Show broken
    if (filters.showBroken === false) {
      const isBroken = quest.prevQuestId && !quests.find(q => q.id === quest.prevQuestId);
      if (isBroken) return false;
    }

    // Show orphaned
    if (filters.showOrphaned === false) {
      const isOrphaned = !quest.prevQuestId && !quests.find(q => q.prevQuestId === quest.id);
      if (isOrphaned && !quest.nextQuestId) return false;
    }

    return true;
  });
}

/**
 * Group quests by zone
 */
export function groupQuestsByZone(quests: Quest[]): Record<string, Quest[]> {
  const groups: Record<string, Quest[]> = {};

  quests.forEach(quest => {
    const zone = quest.zone || 'Unknown Zone';
    if (!groups[zone]) groups[zone] = [];
    groups[zone].push(quest);
  });

  return groups;
}

/**
 * Group quests by level bracket
 */
export function groupQuestsByLevel(quests: Quest[], bracketSize: number = 10): Record<string, Quest[]> {
  const groups: Record<string, Quest[]> = {};

  quests.forEach(quest => {
    const bracket = Math.floor(quest.level / bracketSize) * bracketSize;
    const key = `${bracket}-${bracket + bracketSize - 1}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(quest);
  });

  return groups;
}
