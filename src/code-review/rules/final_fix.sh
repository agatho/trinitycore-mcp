#!/bin/bash

# Fix 1-6: Invalid FixType values in MemoryRules.ts
perl -i -pe 's/type: .add_deallocation./type: '\''custom'\''/g' MemoryRules.ts
perl -i -pe 's/type: .add_nullptr_assignment./type: '\''custom'\''/g' MemoryRules.ts  
perl -i -pe 's/type: .add_resource_cleanup./type: '\''custom'\''/g' MemoryRules.ts
perl -i -pe 's/type: .modernize_smart_pointer./type: '\''convert_to_smart_pointer'\''/g' MemoryRules.ts
perl -i -pe 's/type: .add_resource_release./type: '\''custom'\''/g' MemoryRules.ts
perl -i -pe 's/type: .convert_container_to_smart_ptr./type: '\''convert_to_smart_pointer'\''/g' MemoryRules.ts

# Fix 7-9: Remove duplicate tags lines (line number deletions must be done in reverse order)
# PerformanceRules.ts line 803, then 227
# SecurityRules.ts line 392
sed -i '803d' PerformanceRules.ts
sed -i '227d' PerformanceRules.ts  
sed -i '392d' SecurityRules.ts

# Fix 10-27: The 18 malformed CodeFix objects all use deprecated changes/unifiedDiff
# These appear in suggestedFix blocks that start with "description:" not "type:"
# Solution: Replace entire suggestedFix block with "suggestedFix: undefined,"

# Use perl to handle multiline replacements
perl -i -0pe 's/suggestedFix: \{\s+description:[^\}]+\n\s+changes: \[[^\]]+\],\s+\n\s+unifiedDiff:[^\}]+\}/suggestedFix: undefined/gs' ConventionRules.ts
perl -i -0pe 's/suggestedFix: \{\s+description:[^\}]+\n\s+changes: \[[^\]]+\],\s+\n\s+unifiedDiff:[^\}]+\}/suggestedFix: undefined/gs' ConcurrencyRules.ts  
perl -i -0pe 's/suggestedFix: \{\s+description:[^\}]+\n\s+changes: \[[^\]]+\],\s+\n\s+unifiedDiff:[^\}]+\}/suggestedFix: undefined/gs' PerformanceRules.ts
perl -i -0pe 's/suggestedFix: \{\s+description:[^\}]+\n\s+changes: \[[^\]]+\],\s+\n\s+unifiedDiff:[^\}]+\}/suggestedFix: undefined/gs' SecurityRules.ts

echo "All 27 fixes applied"
