# Contributing to TrinityCore MCP Server

Thank you for your interest in contributing! 🎉

We welcome contributions from the community and are pleased to have you join us.

---

## 📋 Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Ways to Contribute](#ways-to-contribute)
3. [Development Setup](#development-setup)
4. [Development Workflow](#development-workflow)
5. [Code Standards](#code-standards)
6. [Testing Guidelines](#testing-guidelines)
7. [Documentation](#documentation)
8. [Submitting Changes](#submitting-changes)
9. [Issue and PR Guidelines](#issue-and-pr-guidelines)

---

## 🤝 Code of Conduct

### Our Pledge
We are committed to providing a welcoming and inclusive environment for all contributors.

### Our Standards
- ✅ Be respectful and constructive
- ✅ Focus on what is best for the community
- ✅ Show empathy towards other community members
- ✅ Accept constructive criticism gracefully

### Unacceptable Behavior
- ❌ Harassment or discriminatory language
- ❌ Trolling or insulting comments
- ❌ Personal or political attacks
- ❌ Publishing others' private information

---

## 💡 Ways to Contribute

### 1. Report Bugs 🐛
Found a bug? Please use our [Bug Report template](.github/ISSUE_TEMPLATE/bug_report.md).

**Good bug reports include:**
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details
- Error messages

### 2. Suggest Features ✨
Have an idea? Use our [Feature Request template](.github/ISSUE_TEMPLATE/feature_request.md).

**Good feature requests include:**
- Clear use case
- Proposed solution
- Alternatives considered
- Implementation notes

### 3. Implement TODOs 📝
Check [DEVELOPMENT_TODOS.md](../DEVELOPMENT_TODOS.md) for tracked items.

**Look for:**
- Issues labeled `good-first-issue`
- Issues labeled `help-wanted`
- Medium complexity items (8-40 hours)

### 4. Improve Documentation 📚
Documentation improvements are always welcome!

**Areas needing help:**
- Installation guides for more platforms
- Usage examples for tools
- Troubleshooting guides
- Code comments

### 5. Review Pull Requests 👀
Help review others' contributions!

**What to check:**
- Code quality and style
- Functionality correctness
- Documentation completeness
- Test coverage

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js:** 18.0.0 or higher
- **npm:** 9.0.0 or higher
- **Git:** Latest version
- **MySQL:** 8.0+ (for testing database features)
- **TrinityCore:** Local or remote server for testing

### Installation Steps

**1. Fork the Repository**
Click the "Fork" button on GitHub to create your copy.

**2. Clone Your Fork**
```bash
git clone https://github.com/YOUR_USERNAME/trinitycore-mcp.git
cd trinitycore-mcp
```

**3. Add Upstream Remote**
```bash
git remote add upstream https://github.com/ORIGINAL_OWNER/trinitycore-mcp.git
git remote -v
```

**4. Install Dependencies**
```bash
npm install
```

**5. Configure Environment**
```bash
cp .env.template .env
# Edit .env with your database credentials and paths
```

**6. Build**
```bash
npm run build
```

**7. Verify Setup**
```bash
node dist/index.js
# Should output: "TrinityCore MCP Server running on stdio"
```

---

## 🔄 Development Workflow

### 1. Sync Your Fork
Before starting work, sync with upstream:
```bash
git checkout master
git fetch upstream
git merge upstream/master
git push origin master
```

### 2. Create a Branch
Use descriptive branch names:
```bash
# For features
git checkout -b feature/add-spell-parsing

# For bug fixes
git checkout -b fix/database-connection

# For documentation
git checkout -b docs/update-installation

# For TODOs
git checkout -b todo/issue-123-quest-rewards
```

### 3. Make Changes
- Write clean, well-documented code
- Follow existing patterns and conventions
- Add comments for complex logic
- Update documentation as needed

### 4. Test Locally
```bash
# Build
npm run build

# Check for errors
npm run build 2>&1 | grep "error TS"

# Manual testing
node dist/index.js
# Test your changes
```

### 5. Commit Changes
Use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Feature
git commit -m "feat: Add spell attribute parsing

Implements #123

- Added SpellAttr flag constants
- Implemented bitfield parsing
- Returns human-readable attribute names
- Removed TODO comment from spell.ts:176"

# Bug fix
git commit -m "fix: Resolve database connection timeout

Fixes #456

- Increased connection timeout to 10s
- Added retry logic for transient failures
- Improved error messages"

# Documentation
git commit -m "docs: Update installation guide for macOS

- Added macOS-specific instructions
- Fixed path examples
- Added troubleshooting section"

# Refactor
git commit -m "refactor: Simplify quest routing algorithm

- Reduced complexity from O(n²) to O(n log n)
- Improved readability
- No functional changes"
```

**Commit Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Formatting (no code change)
- `refactor:` - Code restructuring
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Maintenance tasks

### 6. Push Changes
```bash
git push origin feature/your-branch-name
```

### 7. Create Pull Request
1. Go to your fork on GitHub
2. Click "Compare & pull request"
3. Fill out the PR template completely
4. Link related issues
5. Submit for review

---

## 📏 Code Standards

### TypeScript Guidelines

**1. Use Strict Mode**
Always enable TypeScript strict mode:
```typescript
// tsconfig.json must have
{
  "compilerOptions": {
    "strict": true
  }
}
```

**2. Full Type Safety**
```typescript
// ✅ Good
function getQuest(questId: number): QuestInfo | null {
  // ...
}

// ❌ Bad
function getQuest(questId: any): any {
  // ...
}
```

**3. Comprehensive JSDoc**
```typescript
/**
 * Optimizes quest route for a specific zone
 *
 * @param zoneId - The zone ID to optimize
 * @param playerLevel - Current player level
 * @param maxQuests - Maximum quests to include (default: 30)
 * @returns Optimized quest route with efficiency metrics
 * @throws {Error} If zone not found or database error
 *
 * @example
 * ```typescript
 * const route = await optimizeQuestRoute(14, 20, 30);
 * console.log(`XP/hour: ${route.xpPerHour}`);
 * ```
 */
export async function optimizeQuestRoute(
  zoneId: number,
  playerLevel: number,
  maxQuests: number = 30
): Promise<QuestRoute> {
  // Implementation
}
```

**4. Interface Before Implementation**
```typescript
// Define interfaces first
export interface QuestRoute {
  routeId: string;
  zoneName: string;
  totalXP: number;
  efficiency: number;
}

// Then implement
export function createQuestRoute(/* ... */): QuestRoute {
  // Implementation
}
```

### Code Style

**1. Naming Conventions**
```typescript
// PascalCase for types/interfaces
interface QuestInfo { }
type PlayerClass = string;

// camelCase for functions/variables
const questId = 123;
function getQuest() { }

// UPPER_CASE for constants
const MAX_QUEST_LEVEL = 70;
const DEFAULT_TIMEOUT = 5000;
```

**2. Error Handling**
```typescript
// ✅ Always handle errors gracefully
export async function getQuest(questId: number): Promise<QuestInfo> {
  try {
    const result = await queryWorld('SELECT * FROM quest_template WHERE ID = ?', [questId]);
    if (!result || result.length === 0) {
      return {
        questId,
        name: "Quest not found",
        error: `Quest ${questId} not found in database`
      };
    }
    return result[0];
  } catch (error) {
    return {
      questId,
      name: "Error",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// ❌ Don't throw unhandled errors
export async function getQuest(questId: number): Promise<QuestInfo> {
  const result = await queryWorld('SELECT * FROM quest_template WHERE ID = ?', [questId]);
  return result[0]; // May throw if no result!
}
```

**3. Performance Considerations**
```typescript
// ✅ Use connection pooling
const pool = getWorldPool();
const [rows] = await pool.execute(sql, params);

// ✅ Limit query results
SELECT * FROM quest_template LIMIT 100

// ✅ Use prepared statements
await pool.execute('SELECT * FROM quest WHERE id = ?', [questId]);

// ❌ Don't load unlimited data
SELECT * FROM quest_template -- No limit!
```

**4. Comments**
```typescript
// ✅ Comment complex logic
// Calculate XP per hour using traveling salesman optimization
// This reduces O(n!) to O(n² × 2^n) using dynamic programming
const xpPerHour = calculateOptimalRoute(quests);

// ❌ Don't state the obvious
// Set x to 5
const x = 5;
```

### TODO Comments

**Link TODOs to Issues:**
```typescript
// ✅ Good - Tracked
// TODO: Implement spell attribute parsing
// See: https://github.com/YOUR_USERNAME/trinitycore-mcp/issues/3
// Priority: Medium, Effort: 8-16 hours
function parseAttributes(spell: any): string[] {
  return [];
}

// ❌ Bad - Untracked
// TODO: Fix this later
function doSomething() {
  // ...
}
```

---

## 🧪 Testing Guidelines

### Manual Testing

**1. Build Test**
```bash
npm run build
# Verify no errors
```

**2. Functionality Test**
```bash
# Start server
node dist/index.js

# Test your changes manually
# Verify expected behavior
```

**3. Integration Test**
Test with actual MCP client (Claude Code):
```
Use the TrinityCore MCP to [test your feature]
```

### What to Test

**For New Features:**
- ✅ Happy path (normal usage)
- ✅ Edge cases (empty input, max values)
- ✅ Error cases (invalid input, database errors)
- ✅ Performance (reasonable response times)

**For Bug Fixes:**
- ✅ Reproducer no longer fails
- ✅ Fix doesn't break other functionality
- ✅ Related issues also resolved

---

## 📚 Documentation

### Update Documentation When:
- Adding new MCP tools
- Changing configuration options
- Modifying installation steps
- Resolving TODOs
- Adding features

### Files to Update:

**For New Tools:**
- `README.md` - Add tool to list
- `PHASE_X_COMPLETE.md` - Add details
- Code - Add JSDoc comments

**For TODOs:**
- `DEVELOPMENT_TODOS.md` - Mark as completed
- Code - Remove TODO comment
- Related issues - Reference in commit

**For Configuration:**
- `.env.template` - Add new variables
- `INSTALLATION.md` - Update setup instructions
- `README.md` - Update configuration section

---

## 📤 Submitting Changes

### Before Submitting PR

**Checklist:**
- [ ] Code builds without errors
- [ ] Manually tested changes
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] TODO comments linked to issues (or removed)
- [ ] No hardcoded paths or credentials
- [ ] TypeScript strict mode compliant

### Pull Request Process

**1. Create PR**
- Use the PR template
- Fill out all sections completely
- Link related issues

**2. Address Review Comments**
- Respond to all feedback
- Make requested changes
- Push updates to same branch

**3. After Approval**
- Squash commits if needed
- Wait for maintainer to merge

**4. After Merge**
- Delete your branch
- Sync your fork
- Close related issues

---

## 📋 Issue and PR Guidelines

### Creating Issues

**Be Specific:**
- ✅ "Spell attribute parsing returns empty array"
- ❌ "Spells don't work"

**Provide Context:**
- Environment details
- Steps to reproduce
- Expected behavior
- Actual behavior

**Search First:**
- Check if issue already exists
- Link to related issues
- Reference relevant documentation

### Creating PRs

**One Feature Per PR:**
- ✅ PR for feature X
- ✅ Separate PR for feature Y
- ❌ PR with features X, Y, Z, and bug fixes

**Link Issues:**
```markdown
Closes #123
Fixes #456
Related to #789
```

**Complete Template:**
- Don't skip sections
- Provide all requested information
- Add screenshots if applicable

---

## ❓ Questions?

- 💬 [Open a Discussion](https://github.com/YOUR_USERNAME/trinitycore-mcp/discussions)
- 🐛 [Report an Issue](https://github.com/YOUR_USERNAME/trinitycore-mcp/issues/new/choose)
- 📧 Contact maintainers (see README.md)

---

## 🎉 Thank You!

Your contributions make this project better for everyone. We appreciate your time and effort!

**Happy coding!** 🚀
