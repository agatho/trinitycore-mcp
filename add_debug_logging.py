#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add debug logging after the starters query
old_code = """  const starters = await queryWorld(query, [zoneId]);

  const chains: QuestChain[] = [];

  for (const starter of starters) {"""

new_code = """  const starters = await queryWorld(query, [zoneId]);

  console.log(`[DEBUG] findQuestChainsInZone(${zoneId}): Found ${starters.length} starter quests`);
  if (starters.length > 0 && starters.length <= 5) {
    console.log('[DEBUG] Starter quest IDs:', starters.map((s: any) => s.ID));
  }

  const chains: QuestChain[] = [];

  for (const starter of starters) {"""

content = content.replace(old_code, new_code)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Added debug logging to questchain.ts")
