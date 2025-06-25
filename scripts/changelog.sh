#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [ -z "$LATEST_TAG" ]; then
    print_status "No previous tags found, showing all commits"
    COMMIT_RANGE="HEAD"
else
    print_status "Latest tag: $LATEST_TAG"
    COMMIT_RANGE="$LATEST_TAG..HEAD"
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

echo "# Changelog"
echo
echo "## [$CURRENT_VERSION] - $(date +%Y-%m-%d)"
echo

# Generate changelog from commits
git log "$COMMIT_RANGE" --pretty=format:"- %s" --reverse | while read line; do
    # Skip version bump commits
    if [[ ! "$line" =~ "chore: bump version" ]]; then
        echo "$line"
    fi
done

echo
echo "**Full Changelog**: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/compare/$LATEST_TAG...v$CURRENT_VERSION"

print_success "Changelog generated for version $CURRENT_VERSION"