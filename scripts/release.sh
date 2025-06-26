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

# Check if we're on main/master branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
    print_warning "You're not on main/master branch (currently on: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted"
        exit 1
    fi
fi

# Parse arguments
RELEASE_TYPE="patch"
AUTO_YES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -y|--yes)
            AUTO_YES=true
            shift
            ;;
        major|minor|patch)
            RELEASE_TYPE=$1
            shift
            ;;
        *)
            print_error "Unknown argument: $1"
            echo "Usage: $0 [major|minor|patch] [-y|--yes]"
            echo "  major: 1.0.0 -> 2.0.0"
            echo "  minor: 1.0.0 -> 1.1.0"
            echo "  patch: 1.0.0 -> 1.0.1 (default)"
            echo "  -y, --yes: Skip interactive prompts"
            exit 1
            ;;
    esac
done

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

print_status "Release type: $RELEASE_TYPE"

# Calculate new version
IFS='.' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}

case $RELEASE_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
print_status "New version: $NEW_VERSION"

# Confirm release
if [[ "$AUTO_YES" != true ]]; then
    echo
    print_warning "This will:"
    echo "  1. Update package.json version to $NEW_VERSION"
    echo "  2. Create a git commit with the version bump"
    echo "  3. Create and push a git tag v$NEW_VERSION"
    echo "  4. Trigger GitHub Actions to build and create a release"
    echo
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "Aborted"
        exit 1
    fi
else
    print_status "Auto-yes mode: Skipping confirmation prompt"
fi

print_status "Starting release process..."

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

print_status "Pushing changes and tag to origin..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

print_success "Release process completed!"
print_status "GitHub Actions will now build and create the release automatically."
print_status "You can monitor the progress at: https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/actions"

echo
print_success "🎉 Release v$NEW_VERSION is now being processed!"