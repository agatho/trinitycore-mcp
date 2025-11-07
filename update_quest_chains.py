#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the findQuestChainsInZone function
start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if 'export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {' in line:
        start_idx = i
    if start_idx is not None and i > start_idx and line.strip() == '}' and 'for (const starter of starters)' not in ''.join(lines[start_idx:i]):
        # Found closing brace of the function
        end_idx = i
        break

if start_idx and end_idx:
    # Replace the entire function
    new_function = [
        'export async function findQuestChainsInZone(zoneId: number): Promise<QuestChain[]> {\n',
        '  // Find all quests in zone that are potential chain starters or part of chains\n',
        '  // Don\'t require NextQuestID since many chains only use PrevQuestID\n',
        '  const query = `\n',
        '    SELECT DISTINCT qt.ID\n',
        '    FROM quest_template qt\n',
        '    LEFT JOIN quest_template_addon qta ON qt.ID = qta.ID\n',
        '    INNER JOIN creature_queststarter cqs ON qt.ID = cqs.quest\n',
        '    INNER JOIN creature c ON cqs.id = c.id\n',
        '    WHERE c.zoneId = ?\n',
        '      AND (qta.PrevQuestID = 0 OR qta.PrevQuestID IS NULL)\n',
        '    LIMIT 100\n',
        '  `;\n',
        '\n',
        '  const starters = await queryWorld(query, [zoneId]);\n',
        '\n',
        '  const chains: QuestChain[] = [];\n',
        '  const processedChainIds = new Set<string>();\n',
        '\n',
        '  for (const starter of starters) {\n',
        '    try {\n',
        '      const chain = await traceQuestChain(starter.ID);\n',
        '\n',
        '      // Create unique chain ID to avoid duplicates\n',
        '      const chainId = chain.quests.map(q => q.questId).sort().join(\'-\');\n',
        '\n',
        '      if (!processedChainIds.has(chainId)) {\n',
        '        processedChainIds.add(chainId);\n',
        '        // Include all quests, even standalone ones (totalQuests >= 1)\n',
        '        chains.push(chain);\n',
        '      }\n',
        '    } catch (error) {\n',
        '      // Skip invalid chains\n',
        '      continue;\n',
        '    }\n',
        '  }\n',
        '\n',
        '  return chains.sort((a, b) => b.totalQuests - a.totalQuests);\n',
        '}\n',
    ]

    # Replace lines
    lines[start_idx:end_idx+1] = new_function

    # Write file
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

    print("SUCCESS: Updated quest chain function")
else:
    print("ERROR: Could not find function")
