#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add zone boundaries configuration after the imports
zone_boundaries = """
// ============================================================================
// ZONE BOUNDARY DEFINITIONS
// ============================================================================

/**
 * Zone boundaries for coordinate-based detection
 * Fallback for creatures with incorrect/missing zoneId
 */
interface ZoneBoundary {
  map: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const ZONE_BOUNDARIES: Record<number, ZoneBoundary> = {
  12: { // Elwynn Forest (includes Northshire Abbey)
    map: 0, // Eastern Kingdoms
    minX: -9500,
    maxX: -8700,
    minY: -250,
    maxY: 500
  }
  // Add more zones as needed
};

"""

# Insert after the imports (before TYPE DEFINITIONS comment)
content = content.replace(
    '// ============================================================================\n// TYPE DEFINITIONS',
    zone_boundaries + '// ============================================================================\n// TYPE DEFINITIONS'
)

# Now update the findQuestChainsInZone query to include coordinate-based detection
old_query = """export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {
  // Find all quests in zone that are potential chain starters
  // Removed NextQuestID requirement - many chains only use PrevQuestID
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

  const starters = await queryWorld(query, [zoneId]);"""

new_query = """export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {
  // Find all quests in zone that are potential chain starters
  // Uses both zoneId AND coordinate-based detection as fallback
  const boundary = ZONE_BOUNDARIES[zoneId];

  let query = `
    SELECT DISTINCT qt.ID
    FROM quest_template qt
    LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID
    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest
    INNER JOIN creature c ON cqs.id = c.id
    WHERE (
      c.zoneId = ?
  `;

  // Add coordinate-based detection if boundary is defined
  if (boundary) {
    query += `
      OR (
        c.map = ${boundary.map}
        AND c.position_x BETWEEN ${boundary.minX} AND ${boundary.maxX}
        AND c.position_y BETWEEN ${boundary.minY} AND ${boundary.maxY}
      )
    `;
  }

  query += `
    )
    AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)
    LIMIT 100
  `;

  const starters = await queryWorld(query, [zoneId]);"""

content = content.replace(old_query, new_query)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Added zone boundary detection for coordinate-based quest finding")
