#!/usr/bin/env python3
import re

file_path = r'C:\TrinityBots\trinitycore-mcp\web-ui\app\api\zones\route.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all lines with unescaped apostrophes in zone/map names
# Pattern: matches lines like "123: 'Name with ' apostrophe',"
# We need to escape apostrophes that appear INSIDE the string (not the delimiters)

def fix_apostrophes_in_line(match):
    """Fix apostrophes within a map/zone name string"""
    full_line = match.group(0)
    number = match.group(1)
    name_content = match.group(2)

    # Escape any unescaped apostrophes within the name
    # Replace ' with \' but avoid replacing already escaped ones
    fixed_name = name_content.replace("\\'", "ESCAPED_APOSTROPHE_PLACEHOLDER")
    fixed_name = fixed_name.replace("'", "\\'")
    fixed_name = fixed_name.replace("ESCAPED_APOSTROPHE_PLACEHOLDER", "\\'")

    return f"{number}: '{fixed_name}',"

# Pattern to match map/zone entries: "  123: 'Some Name with potential ' apostrophe',"
pattern = r"(\s+\d+): '([^']+(?:'[^']*)*)',"

content = re.sub(pattern, fix_apostrophes_in_line, content)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Fixed all apostrophes using regex pattern matching")
