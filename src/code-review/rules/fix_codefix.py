import re

def fix_file(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern 1: Replace suggestedFix objects that only have description/changes/unifiedDiff
    # These are incomplete CodeFix objects that should be removed or simplified
    # Replace with a placeholder that compiles
    
    # Find suggestedFix blocks that start with description (not type/file/line)
    pattern = r'suggestedFix:\s*\{\s*description:[^\}]+changes:\s*\[[^\]]+\][,\s]*unifiedDiff:[^}]+\}'
    
    replacement = 'suggestedFix: undefined'
    
    content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Fixed {filename}")

for filename in ['ConcurrencyRules.ts', 'ConventionRules.ts', 'PerformanceRules.ts', 'SecurityRules.ts']:
    fix_file(filename)
