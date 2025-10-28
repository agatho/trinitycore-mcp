---
name: Bug Report
about: Report a bug in TrinityCore MCP Server
title: '[BUG] '
labels: bug
assignees: ''
---

## 🐛 Bug Description
A clear and concise description of what the bug is.

## 📋 Steps to Reproduce
1. Install MCP server (npm install)
2. Configure .env with...
3. Run `node dist/index.js`
4. Execute tool '...'
5. See error

## ✅ Expected Behavior
What should happen?

## ❌ Actual Behavior
What actually happens? Include error messages.

## 🖥️ Environment
- **OS:** [Windows 11 / Ubuntu 22.04 / macOS 13]
- **Node.js version:** [e.g., 20.10.0]
- **npm version:** [e.g., 10.2.0]
- **MCP Client:** [Claude Code / Claude Desktop / Other]
- **MCP Server version:** [e.g., v1.0.0-alpha]

## 📝 Error Messages
```
Paste complete error messages here, including stack traces
```

## 🔧 Configuration
<details>
<summary>Click to expand .env configuration (remove passwords!)</summary>

```env
TRINITY_DB_HOST=localhost
TRINITY_DB_PORT=3306
TRINITY_DB_USER=trinity
# Password removed
GT_PATH=...
```
</details>

## 📸 Screenshots
If applicable, add screenshots to help explain your problem.

## 🔍 Additional Context
- Are you using remote or local database?
- Have GameTable files been configured?
- Any custom modifications to the code?
- Does this happen consistently or intermittently?

## ✨ Possible Solution
If you have ideas on how to fix this, please share!
