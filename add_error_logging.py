#!/usr/bin/env python3

file_path = r'C:\TrinityBots\trinitycore-mcp\src\tools\questchain.ts'

# Read file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add error logging in the catch block
old_code = """    } catch (error) {
      // Skip invalid chains
      continue;
    }"""

new_code = """    } catch (error) {
      // Skip invalid chains
      console.log(`[DEBUG] Failed to trace chain for quest ${starter.ID}:`, error instanceof Error ? error.message : String(error));
      continue;
    }"""

content = content.replace(old_code, new_code)

# Write back
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: Added error logging to questchain.ts")
