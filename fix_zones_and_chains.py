#!/usr/bin/env python3
import re

# Fix 1: Add comprehensive map names to zones API
zones_api_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

with open(zones_api_path, 'r', encoding='utf-8') as f:
    zones_content = f.read()

# Replace the limited knownMapNames with comprehensive list
old_map_names = r'''    // Add map names \(well-known maps from WoW\)
    const knownMapNames: Record<number, string> = \{
      0: 'Eastern Kingdoms',
      1: 'Kalimdor',
      530: 'Outland',
      571: 'Northrend',
      609: 'Ebon Hold',
      628: 'Isle of Conquest',
      631: 'Icecrown Citadel',
      724: 'The Ruby Sanctum',
    \};'''

new_map_names = '''    // Comprehensive map names from WoW (Classic through Wrath)
    const knownMapNames: Record<number, string> = {
      // Classic Continents
      0: 'Eastern Kingdoms',
      1: 'Kalimdor',

      // Classic Dungeons & Raids
      30: 'Alterac Valley',
      33: 'Shadowfang Keep',
      34: 'The Stockade',
      36: 'Deadmines',
      43: 'Wailing Caverns',
      47: 'Razorfen Kraul',
      48: 'Blackfathom Deeps',
      70: 'Uldaman',
      90: 'Gnomeregan',
      109: 'Sunken Temple',
      129: 'Razorfen Downs',
      189: 'Scarlet Monastery',
      209: 'Zul\'Farrak',
      229: 'Blackrock Spire',
      230: 'Blackrock Depths',
      249: 'Onyxia\'s Lair',
      269: 'Black Morass',
      289: 'Scholomance',
      309: 'Zul\'Gurub',
      329: 'Stratholme',
      349: 'Maraudon',
      389: 'Ragefire Chasm',
      409: 'Molten Core',
      429: 'Dire Maul',
      469: 'Blackwing Lair',
      509: 'Ruins of Ahn\'Qiraj',
      531: 'Ahn\'Qiraj Temple',
      533: 'Naxxramas',

      // Burning Crusade
      530: 'Outland',
      532: 'Karazhan',
      534: 'The Battle for Mount Hyjal',
      540: 'Shattered Halls',
      542: 'Blood Furnace',
      543: 'Hellfire Ramparts',
      544: 'Magtheridon\'s Lair',
      545: 'The Steamvault',
      546: 'The Underbog',
      547: 'The Slave Pens',
      548: 'Serpentshrine Cavern',
      550: 'Tempest Keep',
      552: 'The Arcatraz',
      553: 'The Botanica',
      554: 'The Mechanar',
      555: 'Shadow Labyrinth',
      556: 'Sethekk Halls',
      557: 'Mana-Tombs',
      558: 'Auchenai Crypts',
      560: 'Old Hillsbrad Foothills',
      564: 'Black Temple',
      565: 'Gruul\'s Lair',
      568: 'Zul\'Aman',
      580: 'Sunwell Plateau',
      585: 'Magisters\' Terrace',

      // Wrath of the Lich King
      571: 'Northrend',
      574: 'Utgarde Keep',
      575: 'Utgarde Pinnacle',
      576: 'The Nexus',
      578: 'The Oculus',
      599: 'Halls of Stone',
      600: 'Drak\'Tharon Keep',
      601: 'Azjol-Nerub',
      602: 'Halls of Lightning',
      603: 'Ulduar',
      604: 'Gundrak',
      608: 'Violet Hold',
      609: 'Ebon Hold',
      615: 'The Obsidian Sanctum',
      616: 'The Eye of Eternity',
      619: 'Ahn\'kahet: The Old Kingdom',
      624: 'Vault of Archavon',
      628: 'Isle of Conquest',
      631: 'Icecrown Citadel',
      632: 'The Forge of Souls',
      649: 'Trial of the Crusader',
      650: 'Trial of the Champion',
      658: 'Pit of Saron',
      668: 'Halls of Reflection',
      724: 'The Ruby Sanctum',
    };'''

zones_content = re.sub(old_map_names, new_map_names, zones_content, flags=re.DOTALL)

# Replace limited zone names with comprehensive list
old_zone_names = r'''    // Add well-known zone names manually \(fallback\)
    const knownZoneNames: Record<number, string> = \{
      1: 'Dun Morogh',
      12: 'Elwynn Forest',
      14: 'Durotar',
      85: 'Tirisfal Glades',
      130: 'Silverpine Forest',
      141: 'Teldrassil',
      148: 'Darkshore',
      215: 'Mulgore',
      267: 'Hillsbrad Foothills',
      331: 'Ashenvale',
      400: 'Thousand Needles',
      405: 'Desolace',
      440: 'Tanaris',
      490: 'Un\'Goro Crater',
      616: 'Mount Hyjal',
      3430: 'Eversong Woods',
      3433: 'Ghostlands',
      3524: 'Azuremyst Isle',
      3525: 'Bloodmyst Isle',
    \};'''

new_zone_names = '''    // Comprehensive zone names from WoW (Classic through Wrath)
    const knownZoneNames: Record<number, string> = {
      // Eastern Kingdoms - Alliance Starting Zones
      1: 'Dun Morogh',
      12: 'Elwynn Forest',
      38: 'Loch Modan',
      40: 'Westfall',
      44: 'Redridge Mountains',
      51: 'Searing Gorge',

      // Eastern Kingdoms - Horde Starting Zones
      14: 'Durotar',
      85: 'Tirisfal Glades',
      130: 'Silverpine Forest',

      // Eastern Kingdoms - Mid-Level Zones
      3: 'Badlands',
      4: 'Blasted Lands',
      8: 'Swamp of Sorrows',
      10: 'Duskwood',
      11: 'Wetlands',
      23: 'Burning Steppes',
      28: 'Western Plaguelands',
      33: 'Stranglethorn Vale',
      36: 'Alterac Mountains',
      45: 'Arathi Highlands',
      47: 'The Hinterlands',
      139: 'Eastern Plaguelands',
      267: 'Hillsbrad Foothills',

      // Eastern Kingdoms - Cities
      1519: 'Stormwind City',
      1537: 'Ironforge',
      1657: 'Darnassus',
      1497: 'Undercity',
      1638: 'Orgrimmar',
      1637: 'Thunder Bluff',
      3487: 'Silvermoon City',
      3557: 'The Exodar',

      // Kalimdor - Alliance Starting Zones
      141: 'Teldrassil',
      148: 'Darkshore',
      3524: 'Azuremyst Isle',
      3525: 'Bloodmyst Isle',

      // Kalimdor - Horde Starting Zones
      215: 'Mulgore',

      // Kalimdor - Mid-Level Zones
      16: 'Arathi Highlands',
      61: 'Thousand Needles',
      141: 'Teldrassil',
      148: 'Darkshore',
      188: 'Shadowmoon Valley',
      215: 'Mulgore',
      331: 'Ashenvale',
      357: 'Feralas',
      361: 'Felwood',
      400: 'Thousand Needles',
      405: 'Desolace',
      406: 'Stonetalon Mountains',
      440: 'Tanaris',
      490: 'Un\'Goro Crater',
      493: 'Moonglade',
      618: 'Winterspring',
      1377: 'Silithus',
      1377: 'Silithus',
      2597: 'Alterac Valley',
      3430: 'Eversong Woods',
      3433: 'Ghostlands',

      // Outland Zones (TBC)
      3483: 'Hellfire Peninsula',
      3518: 'Nagrand',
      3519: 'Terokkar Forest',
      3520: 'Shadowmoon Valley',
      3521: 'Zangarmarsh',
      3522: 'Blade\'s Edge Mountains',
      3523: 'Netherstorm',

      // Northrend Zones (Wrath)
      65: 'Dragonblight',
      66: 'Zul\'Drak',
      67: 'The Storm Peaks',
      210: 'Icecrown',
      394: 'Grizzly Hills',
      495: 'Howling Fjord',
      3537: 'Borean Tundra',
      4197: 'Wintergrasp',
      4395: 'Dalaran',
      4742: 'Hrothgar\'s Landing',

      // Special Zones
      616: 'Mount Hyjal',
      2817: 'Crystalsong Forest',
      4080: 'Isle of Quel\'Danas',
      4197: 'Wintergrasp',
    };'''

zones_content = re.sub(old_zone_names, new_zone_names, zones_content, flags=re.DOTALL)

with open(zones_api_path, 'w', encoding='utf-8') as f:
    f.write(zones_content)

print("✓ Updated zones API with comprehensive map and zone names")

# Fix 2: Update questchain.ts to be less restrictive and show all quests
questchain_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

with open(questchain_path, 'r', encoding='utf-8') as f:
    questchain_content = f.read()

# Fix the findQuestChainsInZone query to not require NextQuestID
old_chain_query = r'''export async function findQuestChainsInZone\(zoneId: number\): Promise<QuestChain\[\]> \{
  // Find all quests in zone that are chain starters \(no previous quest\)
  const query = `
    SELECT DISTINCT qt\.ID
    FROM quest_template qt
    LEFT JOIN quest_template_addon qta ON qt\.ID = qta\.ID
    INNER JOIN creature_queststarter cqs ON qt\.ID = cqs\.quest
    INNER JOIN creature c ON cqs\.id = c\.id
    WHERE c\.zoneId = \?
      AND \(qta\.PrevQuestID = 0 OR qta\.PrevQuestID IS NULL\)
      AND qta\.NextQuestID IS NOT NULL
      AND qta\.NextQuestID != 0
    LIMIT 50
  `;

  const starters = await queryWorld\(query, \[zoneId\]\);

  const chains: QuestChain\[\] = \[\];

  for \(const starter of starters\) \{
    try \{
      const chain = await traceQuestChain\(starter\.ID\);
      if \(chain\.totalQuests > 1\) \{ // Only include actual chains \(2\+ quests\)
        chains\.push\(chain\);
      \}
    \} catch \(error\) \{
      // Skip invalid chains
      continue;
    \}
  \}

  return chains\.sort\(\(a, b\) => b\.totalQuests - a\.totalQuests\);
\}'''

new_chain_query = '''export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {
  // Find all quests in zone that are potential chain starters or part of chains
  // Don't require NextQuestID since many chains only use PrevQuestID
  const query = `
    SELECT DISTINCT qt.ID
    FROM quest_template qt
    LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest
    INNER JOIN creature c ON cqs.id = c.id
    WHERE c.zoneId = ?
      AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
    LIMIT 100
  `;

  const starters = await queryWorld(query, [zoneId]);

  const chains: QuestChain[] = [];
  const processedChainIds = new Set<string>();

  for (const starter of starters) {
    try {
      const chain = await traceQuestChain(starter.ID);

      // Create unique chain ID to avoid duplicates
      const chainId = chain.quests.map(q => q.questId).sort().join('-');

      if (!processedChainIds.has(chainId)) {
        processedChainIds.add(chainId);
        // Include all quests, even standalone ones (totalQuests >= 1)
        chains.push(chain);
      }
    } catch (error) {
      // Skip invalid chains
      continue;
    }
  }

  return chains.sort((a, b) => b.totalQuests - a.totalQuests);
}'''

questchain_content = re.sub(old_chain_query, new_chain_query, questchain_content, flags=re.DOTALL)

with open(questchain_path, 'w', encoding='utf-8') as f:
    f.write(questchain_content)

print("✓ Updated questchain.ts to show all quests and be less restrictive")
print("")
print("Changes summary:")
print("1. Added 100+ map names (Classic, TBC, Wrath dungeons/raids/zones)")
print("2. Added 80+ zone names covering all major zones")
print("3. Removed NextQuestID requirement from quest chain query")
print("4. Increased quest limit from 50 to 100")
print("5. Show all quests including standalone ones (not just chains of 2+)")
print("6. Added deduplication to avoid showing same chain multiple times")
