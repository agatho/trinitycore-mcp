#!/bin/bash

# Restore from backup
for f in *.ts; do
  if [ -f "$f.bak" ]; then
    cp "$f.bak" "$f"
  fi
done

# 1. Fix 6 invalid FixType values in MemoryRules.ts
sed -i "s/type: 'add_deallocation'/type: 'custom'/g" MemoryRules.ts
sed -i "s/type: 'add_nullptr_assignment'/type: 'custom'/g" MemoryRules.ts
sed -i "s/type: 'add_resource_cleanup'/type: 'custom'/g" MemoryRules.ts
sed -i "s/type: 'modernize_smart_pointer'/type: 'convert_to_smart_pointer'/g" MemoryRules.ts
sed -i "s/type: 'add_resource_release'/type: 'custom'/g" MemoryRules.ts
sed -i "s/type: 'convert_container_to_smart_ptr'/type: 'convert_to_smart_pointer'/g" MemoryRules.ts

# 2. Fix 3 duplicate properties
sed -i '227d' PerformanceRules.ts
sed -i '802d' PerformanceRules.ts
sed -i '391d' SecurityRules.ts

# 3. Fix 18 malformed CodeFix objects by fixing generateNamingFix and similar functions
# Fix ConventionRules.ts generateNamingFix function
sed -i '/:s*CodeFix {$/,/^}$/ {
  s/description:/type: '\''custom'\'',\n    file: context.file,\n    line: line,\n    explanation:/
  s/changes: \[/diff: `--- ${context.file}\n+++ ${context.file}\n@@ -${line},1 +${line},1 @@\n-${oldName}\n+${newName}`,\n    codeSnippet: {/
  /file: context.file,$/d
  /startLine:/d  
  /endLine:/d
  /oldContent:/d
  /newContent:/d
  /\],$/d
  /unifiedDiff:/d
}' ConventionRules.ts

echo "Basic fixes applied. Manual fixes needed for CodeFix functions."
