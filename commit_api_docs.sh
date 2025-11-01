#!/bin/bash
# Script to commit API documentation files in manageable batches
# This avoids Git's "argument list too long" error

cd /c/TrinityBots/trinitycore-mcp

echo "Adding API documentation files letter by letter..."

# Add files for each letter
for letter in {A..Z}; do
    echo "Adding ${letter}*.yaml files..."
    git add data/api_docs/general/${letter}*.yaml 2>&1 | head -5
done

echo ""
echo "Creating commit..."
git commit -m "docs(api): Add 7,760 TrinityCore API documentation files

Complete API reference covering:
- Aura System (100+ methods)
- Combat System (50+ methods)
- Creature System (280+ methods)
- GameObject System (160+ methods)
- Item System (150+ methods)
- Player System (500+ methods)
- Spell System (300+ methods)
- Unit System (400+ methods)
- And many more core systems

Total: 7,760 YAML files documenting TrinityCore C++ API

Generated with Claude Code
"

echo ""
echo "Pushing to GitHub..."
git push origin master

echo ""
echo "✅ Complete! API documentation committed and pushed."
