#!/bin/bash
##
# Changelog Generation Script
# Generates a changelog from git commits since last tag
#
# Usage:
#   bash scripts/generate-changelog.sh [since_tag]
##

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the previous tag (or use argument)
SINCE_TAG=${1:-$(git describe --tags --abbrev=0 2>/dev/null)}

if [ -z "$SINCE_TAG" ]; then
  echo -e "${YELLOW}No previous tag found, generating full changelog${NC}"
  COMMITS=$(git log --pretty=format:"%h %s" --reverse)
else
  echo -e "${GREEN}Generating changelog since ${SINCE_TAG}${NC}"
  COMMITS=$(git log ${SINCE_TAG}..HEAD --pretty=format:"%h %s" --reverse)
fi

# Generate changelog
echo "# Changelog"
echo ""
echo "## [Unreleased]"
echo ""

# Categorize commits
echo "### Features"
echo "$COMMITS" | grep -i "^[a-f0-9]* feat" | sed 's/^/- /' || echo "- No new features"
echo ""

echo "### Bug Fixes"
echo "$COMMITS" | grep -i "^[a-f0-9]* fix" | sed 's/^/- /' || echo "- No bug fixes"
echo ""

echo "### Documentation"
echo "$COMMITS" | grep -i "^[a-f0-9]* docs" | sed 's/^/- /' || echo "- No documentation changes"
echo ""

echo "### Performance"
echo "$COMMITS" | grep -i "^[a-f0-9]* perf" | sed 's/^/- /' || echo "- No performance improvements"
echo ""

echo "### Refactoring"
echo "$COMMITS" | grep -i "^[a-f0-9]* refactor" | sed 's/^/- /' || echo "- No refactoring"
echo ""

echo "### Tests"
echo "$COMMITS" | grep -i "^[a-f0-9]* test" | sed 's/^/- /' || echo "- No test changes"
echo ""

echo "### Chores"
echo "$COMMITS" | grep -i "^[a-f0-9]* chore" | sed 's/^/- /' || echo "- No chore updates"
echo ""

echo "### Other Changes"
echo "$COMMITS" | grep -iv "^[a-f0-9]* \(feat\|fix\|docs\|perf\|refactor\|test\|chore\)" | sed 's/^/- /' || echo "- No other changes"

echo ""
echo -e "${GREEN}✅ Changelog generated${NC}"
