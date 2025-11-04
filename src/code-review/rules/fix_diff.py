import re
import sys

def fix_suggested_fix(content):
    # Pattern to match suggestedFix blocks with changes and unifiedDiff
    # and replace with diff: ''
    pattern = r"(suggestedFix:\s*\{[^}]*)(changes:\s*\[[^\]]*\][^}]*unifiedDiff:\s*`[^`]*`)"
    
    def replace_with_diff(match):
        prefix = match.group(1)
        # Extract description if it exists
        desc_match = re.search(r"description:\s*'([^']*)'", prefix)
        if desc_match:
            description = desc_match.group(1)
            # Keep everything up to description and add diff: ''
            return f"{prefix}diff: ''"
        else:
            return f"{prefix}diff: ''"
    
    # This is complex - let me use a simpler approach
    # Replace the entire changes/unifiedDiff block with just diff: ''
    result = re.sub(
        r"changes:\s*\[[^\]]*\][,\s]*unifiedDiff:\s*`[^`]*`",
        "diff: ''",
        content
    )
    
    return result

if __name__ == '__main__':
    filename = sys.argv[1]
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    fixed = fix_suggested_fix(content)
    
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(fixed)
    
    print(f"Fixed {filename}")

