# Automated Release System

This project includes a complete automated release system that handles version bumping, git tagging, building, and distribution with minimal manual intervention.

## Quick Start

### 🚀 Make a Release

```bash
# Patch release (0.1.0 -> 0.1.1)
bun run release

# Minor release (0.1.0 -> 0.2.0)
bun run release:minor

# Major release (0.1.0 -> 1.0.0)
bun run release:major
```

### 🧪 Make a Prerelease

```bash
# Beta prerelease (0.1.0 -> 0.1.1-beta.1)
bun run prerelease

# Alpha prerelease (0.1.0 -> 0.1.1-alpha.1)
bun run prerelease:alpha

# Release candidate (0.1.0 -> 0.1.1-rc.1)
bun run prerelease:rc
```

### 📊 Check Status

```bash
# See current version, git status, and available commands
bun run status

# Generate changelog since last release
bun run changelog
```

## How It Works

### 1. Release Process

When you run `bun run release`, here's what happens automatically:

1. **Validation**: Checks that you're in a git repo with clean working directory
2. **Version Calculation**: Determines the next version based on semver rules
3. **Confirmation**: Shows you what will happen and asks for confirmation
4. **Version Bump**: Updates `package.json` with the new version
5. **Git Operations**: Creates a commit and pushes a git tag
6. **GitHub Actions**: Automatically triggers the build and release workflow

### 2. GitHub Actions Workflow

The `.github/workflows/release.yml` workflow:

1. **Triggers**: On any tag push (e.g., `v1.0.0`)
2. **Builds**: Compiles executables for all supported platforms:
   - macOS ARM64 (Apple Silicon)
   - macOS x64 (Intel)
   - Linux x64
   - Linux ARM64
3. **Creates Release**: Automatically creates a GitHub release
4. **Uploads Assets**: Attaches compressed binaries to the release
5. **Prerelease Detection**: Automatically marks alpha/beta/rc versions as prereleases

### 3. Cross-Platform Building

The build system uses Bun's `--compile` flag with cross-compilation:

```bash
# Build for all platforms
bun run build

# Build for specific platform
bun run build:macos-arm64
bun run build:linux-x64
```

Built executables are:
- **Self-contained**: Include Bun runtime and all dependencies
- **Small**: 20-36MB (minified)
- **Fast**: Launch in <100ms
- **No dependencies**: Users don't need Node.js or Bun installed

## Available Commands

### Release Commands

| Command | Description | Example |
|---------|-------------|---------|
| `bun run release` | Patch release (default) | `0.1.0` → `0.1.1` |
| `bun run release:patch` | Same as above | `0.1.0` → `0.1.1` |
| `bun run release:minor` | Minor release | `0.1.0` → `0.2.0` |
| `bun run release:major` | Major release | `0.1.0` → `1.0.0` |

### Prerelease Commands

| Command | Description | Example |
|---------|-------------|---------|
| `bun run prerelease` | Beta prerelease (default) | `0.1.0` → `0.1.1-beta.1` |
| `bun run prerelease:alpha` | Alpha prerelease | `0.1.0` → `0.1.1-alpha.1` |
| `bun run prerelease:beta` | Beta prerelease | `0.1.0` → `0.1.1-beta.1` |
| `bun run prerelease:rc` | Release candidate | `0.1.0` → `0.1.1-rc.1` |

### Utility Commands

| Command | Description |
|---------|-------------|
| `bun run status` | Show current version, git status, and available commands |
| `bun run changelog` | Generate changelog since last release |
| `bun run build` | Build executables for all platforms |
| `bun run clean` | Clean build artifacts |
| `bun run dev` | Run CLI in development mode |

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Incompatible API changes (`1.0.0` → `2.0.0`)
- **MINOR**: New functionality, backwards compatible (`1.0.0` → `1.1.0`)
- **PATCH**: Bug fixes, backwards compatible (`1.0.0` → `1.0.1`)
- **PRERELEASE**: Pre-release versions (`1.0.0-beta.1`)

### Prerelease Progression

Prereleases increment automatically:
- `1.0.0` → `1.0.1-beta.1` (first beta)
- `1.0.1-beta.1` → `1.0.1-beta.2` (next beta)
- `1.0.1-beta.2` → `1.0.1-rc.1` (release candidate)

## Safety Features

### Pre-flight Checks

Before any release, the scripts verify:
- ✅ Clean working directory (no uncommitted changes)
- ✅ In a git repository
- ✅ On main/master branch (with override option)
- ✅ Version calculation is correct
- ✅ User confirmation before proceeding

### Error Handling

- Scripts exit immediately on any error (`set -e`)
- Colored output for clear status indication
- Detailed error messages with suggestions
- Rollback instructions if something goes wrong

## Distribution

### Install Script

Users can install your CLI with:

```bash
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install.sh | bash
```

The install script:
- Detects user's platform automatically
- Downloads the appropriate binary
- Installs to `/usr/local/bin`
- Makes it executable

### Manual Installation

Users can also download binaries directly from GitHub Releases:

1. Go to the [releases page](https://github.com/zueai/terminal-mcp/releases)
2. Download the appropriate `.tar.gz` for their platform
3. Extract and move to their PATH

## Troubleshooting

### Common Issues

**"Working directory is not clean"**
```bash
git status                    # See what's uncommitted
git add . && git commit -m "fix: pending changes"  # Commit changes
# or
git stash                     # Stash changes temporarily
```

**"Not on main/master branch"**
```bash
git checkout main             # Switch to main branch
# or continue anyway when prompted
```

**GitHub Actions not triggering**
- Ensure you have a GitHub repository set up
- Check that the workflow file is in `.github/workflows/release.yml`
- Verify you have the necessary GitHub permissions

### Manual Rollback

If something goes wrong:

```bash
# Remove the tag locally and remotely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Reset to previous commit
git reset --hard HEAD~1
```

## Customization

### Modify Release Scripts

All scripts are in the `scripts/` directory:
- `release.sh` - Main release logic
- `prerelease.sh` - Prerelease logic
- `build.sh` - Build process
- `status.sh` - Status display
- `changelog.sh` - Changelog generation

### GitHub Actions

Modify `.github/workflows/release.yml` to:
- Add additional build targets
- Include code signing
- Add deployment steps
- Customize release notes

### Install Script

Update `install.sh` to:
- Change installation directory
- Add additional setup steps
- Customize platform detection

---

## Example Workflow

Here's a typical development workflow:

```bash
# 1. Check current status
bun run status

# 2. Make your changes
# ... edit code ...

# 3. Test locally
bun run dev tools --endpoint=http://localhost:8123/mcp

# 4. Commit your changes
git add .
git commit -m "feat: add new functionality"

# 5. Create a prerelease for testing
bun run prerelease:beta

# 6. Test the prerelease
# ... download and test the beta ...

# 7. Make a full release
bun run release:minor

# 8. Check the release
bun run status
```

That's it! Your CLI tool is now automatically built, packaged, and distributed to users. 🎉