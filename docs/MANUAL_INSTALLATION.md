# Manual Installation Guide

If you prefer to install terminal-mcp manually or the quick install script doesn't work for your system, follow these steps:

## Download Binary

1. Download the appropriate binary for your platform from the [releases page](https://github.com/zueai/terminal-mcp/releases)

## Available Platforms

- `terminal-mcp-macos-arm64.tar.gz` - macOS Apple Silicon
- `terminal-mcp-macos-x64.tar.gz` - macOS Intel
- `terminal-mcp-linux-x64.tar.gz` - Linux x64
- `terminal-mcp-linux-arm64.tar.gz` - Linux ARM64

## Installation Steps

### For macOS and Linux

1. **Extract the archive**:
   ```bash
   tar -xzf terminal-mcp-*.tar.gz
   ```

2. **Move to your PATH**:
   ```bash
   sudo mv terminal-mcp-* /usr/local/bin/terminal-mcp
   ```

3. **Make executable**:
   ```bash
   sudo chmod +x /usr/local/bin/terminal-mcp
   ```

### Verify Installation

After installation, verify that terminal-mcp is working correctly:

```bash
# Check version
terminal-mcp --version

# Show help
terminal-mcp --help
```

### Alternative Installation Locations

If you don't have sudo access or prefer not to install globally, you can:

1. **Install to user directory**:
   ```bash
   mkdir -p ~/.local/bin
   mv terminal-mcp-* ~/.local/bin/terminal-mcp
   chmod +x ~/.local/bin/terminal-mcp
   ```

2. **Add to PATH** (add this to your `~/.bashrc`, `~/.zshrc`, or equivalent):
   ```bash
   export PATH="$HOME/.local/bin:$PATH"
   ```

3. **Reload your shell** or run:
   ```bash
   source ~/.bashrc  # or ~/.zshrc
   ```

## Quick Install Alternative

For most users, we recommend using the quick install script instead:

```bash
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install.sh | bash
```

This script automatically detects your platform and handles the installation process.