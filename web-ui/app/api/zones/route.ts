import { NextRequest, NextResponse } from 'next/server';
import { queryWorld } from '@/../src/database/connection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/zones
 *
 * Get all zones that have quests with quest counts
 * Returns zones with composite key (map-zone) since zones are not unique across maps
 */
export async function GET(request: NextRequest) {
  try {
    const query = `
      SELECT
        CONCAT(c.map, '-', c.zoneId) as id,
        c.zoneId as zoneId,
        c.map as mapId,
        CONCAT('Zone ', c.zoneId) as name,
        COUNT(DISTINCT cqs.quest) as questCount,
        0 as minLevel,
        0 as maxLevel
      FROM creature c
      INNER JOIN creature_queststarter cqs ON c.id = cqs.id
      INNER JOIN quest_template qt ON cqs.quest = qt.ID
      WHERE c.zoneId IS NOT NULL AND c.zoneId > 0
      GROUP BY c.map, c.zoneId
      HAVING questCount > 0
      ORDER BY c.map, questCount DESC, c.zoneId
    `;

    const zones = await queryWorld(query, []);

    // Comprehensive map names from WoW (Classic through Wrath)
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
      209: 'Zul'Farrak',
      229: 'Blackrock Spire',
      230: 'Blackrock Depths',
      249: 'Onyxia's Lair',
      269: 'Black Morass',
      289: 'Scholomance',
      309: 'Zul'Gurub',
      329: 'Stratholme',
      349: 'Maraudon',
      389: 'Ragefire Chasm',
      409: 'Molten Core',
      429: 'Dire Maul',
      469: 'Blackwing Lair',
      509: 'Ruins of Ahn'Qiraj',
      531: 'Ahn'Qiraj Temple',
      533: 'Naxxramas',

      // Burning Crusade
      530: 'Outland',
      532: 'Karazhan',
      534: 'The Battle for Mount Hyjal',
      540: 'Shattered Halls',
      542: 'Blood Furnace',
      543: 'Hellfire Ramparts',
      544: 'Magtheridon's Lair',
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
      565: 'Gruul's Lair',
      568: 'Zul'Aman',
      580: 'Sunwell Plateau',
      585: 'Magisters' Terrace',

      // Wrath of the Lich King
      571: 'Northrend',
      574: 'Utgarde Keep',
      575: 'Utgarde Pinnacle',
      576: 'The Nexus',
      578: 'The Oculus',
      599: 'Halls of Stone',
      600: 'Drak'Tharon Keep',
      601: 'Azjol-Nerub',
      602: 'Halls of Lightning',
      603: 'Ulduar',
      604: 'Gundrak',
      608: 'Violet Hold',
      609: 'Ebon Hold',
      615: 'The Obsidian Sanctum',
      616: 'The Eye of Eternity',
      619: 'Ahn'kahet: The Old Kingdom',
      624: 'Vault of Archavon',
      628: 'Isle of Conquest',
      631: 'Icecrown Citadel',
      632: 'The Forge of Souls',
      649: 'Trial of the Crusader',
      650: 'Trial of the Champion',
      658: 'Pit of Saron',
      668: 'Halls of Reflection',
      724: 'The Ruby Sanctum',
    };

    // Try to enrich with zone names from area_table if available
    const enrichedZones = await Promise.all(
      zones.map(async (zone: any) => {
        try {
          // Try to get proper zone name from various possible tables
          // Note: TrinityCore may not have area names in DB, they're usually in DBC files
          const nameQuery = `
            SELECT name FROM world.area_table WHERE ID = ?
            UNION
            SELECT AreaName as name FROM world.areatrigger WHERE AreaTriggerID = ?
            LIMIT 1
          `;

          const nameResults = await queryWorld(nameQuery, [zone.zoneId, zone.zoneId]);

          if (nameResults && nameResults.length > 0 && nameResults[0].name) {
            zone.name = nameResults[0].name;
          }
        } catch (error) {
          // Keep default name if lookup fails
        }

        // Add map name
        zone.mapName = knownMapNames[zone.mapId] || `Map ${zone.mapId}`;

        return zone;
      })
    );

    // Add well-known zone names manually (fallback)
    // Comprehensive zone names from WoW (Classic through Wrath)
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
    };

    const finalZones = enrichedZones.map((zone: any) => {
      if (zone.name.startsWith('Zone ') && knownZoneNames[zone.zoneId]) {
        zone.name = knownZoneNames[zone.zoneId];
      }
      return zone;
    });

    // Get unique maps for map selector
    const mapsMap = new Map<number, { id: number; name: string; zoneCount: number }>();
    finalZones.forEach((zone: any) => {
      if (!mapsMap.has(zone.mapId)) {
        mapsMap.set(zone.mapId, {
          id: zone.mapId,
          name: zone.mapName,
          zoneCount: 0,
        });
      }
      const mapData = mapsMap.get(zone.mapId)!;
      mapData.zoneCount++;
    });

    const maps = Array.from(mapsMap.values()).sort((a, b) => a.id - b.id);

    return NextResponse.json({
      totalZones: finalZones.length,
      totalMaps: maps.length,
      zones: finalZones,
      maps,
    });
  } catch (error: any) {
    console.error('Zones API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch zones',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
