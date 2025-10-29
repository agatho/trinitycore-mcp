# Repository Rules Issue - Branch Protection Too Strict

## Problem

The current repository ruleset applies to **ALL branches** (`~ALL`) and requires status checks even for creating new branches. This prevents:
- Creating feature branches
- Pushing branches for pull requests
- Normal development workflow

## Current Rules

```json
{
  "conditions": {
    "ref_name": {
      "include": ["~ALL"]  // ← This applies to EVERY branch
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "do_not_enforce_on_create": false  // ← This requires checks even for new branches
      }
    }
  ]
}
```

## Solution Options

### Option 1: Modify Ruleset via Web Interface (Recommended)

**1. Go to Repository Rules:**
https://github.com/agatho/trinitycore-mcp/settings/rules/9264406

**2. Click "Edit" on the ruleset**

**3. Change "Target branches":**
- Current: `Include all branches` (~ALL)
- Change to: `Include by pattern`
- Pattern: `master` (or add `main` if needed)

**4. Scroll to "Require status checks to pass"**
- Check: ✅ "Do not enforce on creation"
- This allows creating feature branches without checks

**5. Click "Save changes"**

---

### Option 2: Temporarily Disable Ruleset

**Quick Fix for Immediate Development:**

1. Go to: https://github.com/agatho/trinitycore-mcp/settings/rules/9264406
2. Click "Edit"
3. Change "Enforcement status" to **Disabled**
4. Push your changes
5. Re-enable when done

---

### Option 3: Delete and Recreate with Correct Settings

**1. Delete current ruleset:**
https://github.com/agatho/trinitycore-mcp/settings/rules/9264406
- Click "Delete ruleset"

**2. Create new ruleset:**
Go to: https://github.com/agatho/trinitycore-mcp/settings/rules

Click "New ruleset" → "New branch ruleset"

**Settings:**
- **Ruleset Name:** `Protect Master Branch`
- **Enforcement status:** Active
- **Target branches:**
  - ✅ Add target: `master`
  - (Optional) Add target: `main`
  - ❌ Do NOT select "All branches"

**Rules to Enable:**
- ✅ Restrict deletions
- ✅ Restrict force pushes
- ✅ Require pull request before merging
  - Required approvals: 0 (or 1 if you have collaborators)
  - ❌ Dismiss stale pull request approvals when new commits are pushed
  - ✅ Require review from Code Owners: No
- ✅ Require status checks to pass before merging
  - ✅ **Do not enforce on create** ← IMPORTANT!
  - ✅ Require branches to be up to date before merging
  - Add required checks:
    - `build`
    - `quality-checks`

**3. Click "Create"**

---

## After Fixing Rules

Once you've updated the rules using any option above, continue with:

```bash
cd C:\TrinityBots\trinitycore-mcp

# The branch already exists locally with changes committed
git push origin docs/add-readme-badges

# Create PR
gh pr create --title "docs: Add status badges to README" \
  --body "Adds professional status badges to README for better project visibility." \
  --base master
```

---

## What We're Trying to Push

**Branch:** `docs/add-readme-badges`
**Changes:** Added 8 status badges to README.md
**Commit:** Already committed locally (25f81d5)

**Badges Added:**
- Build status
- Code quality
- Version
- License
- TypeScript
- Node.js
- Issues count
- PRs welcome

---

## Recommended Configuration

For a typical open-source project:

**Branch Protection (Master only):**
- ✅ Require pull requests
- ✅ Require status checks (with "Do not enforce on create")
- ✅ Restrict force pushes
- ✅ Restrict deletions

**Feature Branches:**
- ❌ No restrictions
- ❌ No required checks on creation
- ✅ Can push freely

This allows:
- Normal development on feature branches
- Protection only when merging to master
- Status checks run on PRs before merge
- Developers can iterate on feature branches

---

## Quick Fix Command (After Web Changes)

Once you've fixed the rules:

```bash
# Just push the existing branch
cd C:\TrinityBots\trinitycore-mcp
git push origin docs/add-readme-badges
gh pr create --title "docs: Add status badges to README" --body "Professional status badges for project visibility" --base master
```

---

## Current State

✅ **Local changes committed:** README badges added (commit 25f81d5)
⏸️ **Blocked:** Cannot push due to ruleset
🎯 **Next:** Fix repository rules using Option 1 above

---

**Recommendation:** Use **Option 1** - it's the cleanest and maintains proper branch protection while allowing development.
