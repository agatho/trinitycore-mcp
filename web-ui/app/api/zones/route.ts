import { NextRequest, NextResponse } from 'next/server';
import { queryWorld } from '@/../../src/database/connection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/zones
 *
 * Get all zones that have quests with quest counts
 */
export async function GET(request: NextRequest) {
  try {
    const query = `
      SELECT DISTINCT
        c.zoneId as id,
        c.zoneId as zoneId,
        CONCAT('Zone ', c.zoneId) as name,
        COUNT(DISTINCT cqs.quest) as questCount,
        MIN(qt.MinLevel) as minLevel,
        MAX(qt.MinLevel) as maxLevel,
        c.map as mapId
      FROM creature c
      INNER JOIN creature_queststarter cqs ON c.id = cqs.id
      INNER JOIN quest_template qt ON cqs.quest = qt.ID
      WHERE c.zoneId IS NOT NULL AND c.zoneId > 0
      GROUP BY c.zoneId, c.map
      HAVING questCount > 0
      ORDER BY questCount DESC, c.zoneId
    `;

    const zones = await queryWorld(query, []);

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

          const nameResults = await queryWorld(nameQuery, [zone.id, zone.id]);

          if (nameResults && nameResults.length > 0 && nameResults[0].name) {
            zone.name = nameResults[0].name;
          }
        } catch (error) {
          // Keep default name if lookup fails
        }

        return zone;
      })
    );

    // Add well-known zone names manually (fallback)
    const knownZoneNames: Record<number, string> = {
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
    };

    const finalZones = enrichedZones.map((zone: any) => {
      if (zone.name.startsWith('Zone ') && knownZoneNames[zone.id]) {
        zone.name = knownZoneNames[zone.id];
      }
      return zone;
    });

    return NextResponse.json({
      totalZones: finalZones.length,
      zones: finalZones,
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
