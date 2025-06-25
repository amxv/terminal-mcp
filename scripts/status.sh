#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_header() {
    echo -e "${CYAN}=== $1 ===${NC}"
}

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo -e "${CYAN}🚀 MCP CLI Release Status${NC}"
echo

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Current version
print_header "Current Version"
CURRENT_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
print_status "Version: $CURRENT_VERSION"

# Git status
print_header "Git Status"
CURRENT_BRANCH=$(git branch --show-current)
print_status "Branch: $CURRENT_BRANCH"

# Check if working directory is clean
if git diff-index --quiet HEAD --; then
    print_success "Working directory is clean"
else
    print_warning "Working directory has uncommitted changes"
fi

# Check for unpushed commits
UNPUSHED=$(git log --oneline origin/$CURRENT_BRANCH..$CURRENT_BRANCH 2>/dev/null | wc -l)
if [ "$UNPUSHED" -gt 0 ]; then
    print_warning "$UNPUSHED unpushed commits"
else
    print_success "All commits are pushed"
fi

# Recent tags
print_header "Recent Tags"
git tag --sort=-version:refname | head -5 | while read tag; do
    if [ ! -z "$tag" ]; then
        TAG_DATE=$(git log -1 --format=%ai "$tag" 2>/dev/null)
        print_status "$tag (${TAG_DATE%% *})"
    fi
done

# Available release commands
print_header "Available Commands"
echo -e "${GREEN}Release Commands:${NC}"
echo "  bun run release          # Patch release (e.g., 1.0.0 -> 1.0.1)"
echo "  bun run release:patch    # Same as above"
echo "  bun run release:minor    # Minor release (e.g., 1.0.0 -> 1.1.0)"
echo "  bun run release:major    # Major release (e.g., 1.0.0 -> 2.0.0)"

echo
echo -e "${YELLOW}Prerelease Commands:${NC}"
echo "  bun run prerelease       # Beta prerelease (e.g., 1.0.0 -> 1.0.1-beta.1)"
echo "  bun run prerelease:alpha # Alpha prerelease (e.g., 1.0.0 -> 1.0.1-alpha.1)"
echo "  bun run prerelease:beta  # Beta prerelease (same as above)"
echo "  bun run prerelease:rc    # Release candidate (e.g., 1.0.0 -> 1.0.1-rc.1)"

echo
echo -e "${BLUE}Build Commands:${NC}"
echo "  bun run build            # Build all platforms"
echo "  bun run clean            # Clean build artifacts"
echo "  bun run dev              # Run in development mode"

# Show next version predictions
print_header "Next Version Predictions"
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
if [ ${#VERSION_PARTS[@]} -eq 3 ]; then
    MAJOR=${VERSION_PARTS[0]}
    MINOR=${VERSION_PARTS[1]}
    PATCH=${VERSION_PARTS[2]}

    # Remove any prerelease suffix for calculation
    PATCH=$(echo "$PATCH" | sed 's/-.*$//')

    echo "  Patch:  $MAJOR.$MINOR.$((PATCH + 1))"
    echo "  Minor:  $MAJOR.$((MINOR + 1)).0"
    echo "  Major:  $((MAJOR + 1)).0.0"
    echo "  Beta:   $MAJOR.$MINOR.$((PATCH + 1))-beta.1"
fi

echo