#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the chain tracing logic - TrinityCore uses PrevQuestID (backwards), not NextQuestID
old_code = """    const quest = results[0];
    nodes.push({
      ...quest,
      depth
    });

    currentQuestId = quest.nextQuest && quest.nextQuest !== 0 ? quest.nextQuest : null;
    depth++;
  }"""

new_code = """    const quest = results[0];
    nodes.push({
      ...quest,
      depth
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
  }"""

content = content.replace(old_code, new_code)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed quest chain tracing to use PrevQuestID instead of NextQuestID")
