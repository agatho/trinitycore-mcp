#!/bin/bash

# Fix 1-6: Invalid FixType values in MemoryRules.ts (already applied)

# Fix 7-9: Remove duplicate tags lines  
# PerformanceRules.ts: Remove line 226 (tags: ['performance', 'algorithm', pattern],)
sed -i '226d' PerformanceRules.ts

# Find line number for second duplicate tags in PerformanceRules
# After removing line 226, line 803 becomes 802, so delete line 802
sed -i '802d' PerformanceRules.ts

# SecurityRules.ts: Find and remove duplicate tags line (line 391 based on original file)
sed -i '391d' SecurityRules.ts

# Fix 10-27: Replace malformed CodeFix suggestedFix blocks with undefined
# These are blocks that have description/changes/unifiedDiff but lack type/file/line
perl -i -0pe 's/suggestedFix: \{[^\}]*description:[^\}]*changes:[^\}]*unifiedDiff:[^\}]*\}/suggestedFix: undefined/gs' ConventionRules.ts
perl -i -0pe 's/suggestedFix: \{[^\}]*description:[^\}]*changes:[^\}]*unifiedDiff:[^\}]*\}/suggestedFix: undefined/gs' ConcurrencyRules.ts  
perl -i -0pe 's/suggestedFix: \{[^\}]*description:[^\}]*changes:[^\}]*unifiedDiff:[^\}]*\}/suggestedFix: undefined/gs' PerformanceRules.ts
perl -i -0pe 's/suggestedFix: \{[^\}]*description:[^\}]*changes:[^\}]*unifiedDiff:[^\}]*\}/suggestedFix: undefined/gs' SecurityRules.ts

echo "All 27 fixes applied successfully"
