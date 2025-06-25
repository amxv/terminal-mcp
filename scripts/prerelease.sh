#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not in a git repository"
    exit 1
fi

# Check if working directory is clean
if ! git diff-index --quiet HEAD --; then
    print_error "Working directory is not clean. Please commit or stash your changes."
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Determine prerelease type
PRERELEASE_TYPE=${1:-beta}
if [[ ! "$PRERELEASE_TYPE" =~ ^(alpha|beta|rc)$ ]]; then
    print_error "Invalid prerelease type: $PRERELEASE_TYPE"
    echo "Usage: $0 [alpha|beta|rc]"
    echo "  alpha: 1.0.0 -> 1.0.1-alpha.1"
    echo "  beta:  1.0.0 -> 1.0.1-beta.1 (default)"
    echo "  rc:    1.0.0 -> 1.0.1-rc.1"
    exit 1
fi

print_status "Prerelease type: $PRERELEASE_TYPE"

# Calculate new version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

# Check if current version is already a prerelease
if [[ "$CURRENT_VERSION" =~ -([a-z]+)\.([0-9]+)$ ]]; then
    CURRENT_PRERELEASE_TYPE="${BASH_REMATCH[1]}"
    CURRENT_PRERELEASE_NUM="${BASH_REMATCH[2]}"

    if [[ "$CURRENT_PRERELEASE_TYPE" == "$PRERELEASE_TYPE" ]]; then
        # Increment prerelease number
        NEW_PRERELEASE_NUM=$((CURRENT_PRERELEASE_NUM + 1))
        BASE_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-.*$//')
        NEW_VERSION="$BASE_VERSION-$PRERELEASE_TYPE.$NEW_PRERELEASE_NUM"
    else
        # Different prerelease type, start from 1
        BASE_VERSION=$(echo "$CURRENT_VERSION" | sed 's/-.*$//')
        NEW_VERSION="$BASE_VERSION-$PRERELEASE_TYPE.1"
    fi
else
    # Not a prerelease, bump patch and add prerelease
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH-$PRERELEASE_TYPE.1"
fi

print_status "New version: $NEW_VERSION"

# Confirm release
echo
print_warning "This will:"
echo "  1. Update package.json version to $NEW_VERSION"
echo "  2. Create a git commit with the version bump"
echo "  3. Create and push a git tag v$NEW_VERSION"
echo "  4. Trigger GitHub Actions to build and create a prerelease"
echo
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "Aborted"
    exit 1
fi

print_status "Starting prerelease process..."

# Update package.json version
print_status "Updating package.json version..."
if command -v jq >/dev/null 2>&1; then
    # Use jq if available (more reliable)
    jq ".version = \"$NEW_VERSION\"" package.json > package.json.tmp && mv package.json.tmp package.json
else
    # Fallback to sed
    sed -i.bak "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/" package.json
    rm -f package.json.bak
fi

# Verify the version was updated
UPDATED_VERSION=$(node -p "require('./package.json').version")
if [[ "$UPDATED_VERSION" != "$NEW_VERSION" ]]; then
    print_error "Failed to update package.json version"
    exit 1
fi

print_success "Updated package.json to version $NEW_VERSION"

# Create git commit
print_status "Creating git commit..."
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"

# Create and push tag
print_status "Creating git tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"

CURRENT_BRANCH=$(git branch --show-current)
print_status "Pushing changes and tag to origin..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

print_success "Prerelease process completed!"
print_status "GitHub Actions will now build and create the prerelease automatically."
print_status "You can monitor the progress at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"

echo
print_success "🚀 Prerelease v$NEW_VERSION is now being processed!"