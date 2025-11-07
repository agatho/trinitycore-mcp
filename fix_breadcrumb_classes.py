#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix Line 204: qt.BreadcrumbForQuestId and qt.RequiredClasses should be from qta
content = content.replace(
    'qt.BreadcrumbForQuestId as breadcrumbFrom, qt.RequiredClasses as requiredClasses,',
    'qta.BreadcrumbForQuestId as breadcrumbFrom, qta.AllowableClasses as requiredClasses,'
)

# Fix Line 279: qt.BreadcrumbForQuestId should be qta.BreadcrumbForQuestId
content = content.replace(
    'qt.BreadcrumbForQuestId as breadcrumbQuest,',
    'qta.BreadcrumbForQuestId as breadcrumbQuest,'
)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed BreadcrumbForQuestId and RequiredClasses references")
