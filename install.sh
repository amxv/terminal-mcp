#!/bin/bash
set -e

# Terminal MCP - Full Developer Version Installer
# For AI agents, use install-agent.sh instead

# Configuration
REPO="zueai/terminal-mcp"  # Update this with your GitHub repo
VERSION="latest"
DEFAULT_INSTALL_DIR="$HOME/bin"
BINARY_NAME="terminal-mcp"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $OS in
    darwin)
        case $ARCH in
            arm64) PLATFORM="macos-arm64" ;;
            x86_64) PLATFORM="macos-x64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    linux)
        case $ARCH in
            x86_64) PLATFORM="linux-x64" ;;
            aarch64|arm64) PLATFORM="linux-arm64" ;;
            *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
        esac
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

echo "Detected platform: $OS-$ARCH -> $PLATFORM"

# Prompt for installation directory
echo ""
echo "Choose installation directory:"
read -p "Install directory [$DEFAULT_INSTALL_DIR]: " INSTALL_DIR
INSTALL_DIR=${INSTALL_DIR:-$DEFAULT_INSTALL_DIR}

# Expand tilde if present
INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"

# Create installation directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download URL
if [ "$VERSION" = "latest" ]; then
    DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/terminal-mcp-$PLATFORM.tar.gz"
else
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/terminal-mcp-$PLATFORM.tar.gz"
fi

# Create temporary directory
TMP_DIR=$(mktemp -d)
cd "$TMP_DIR"

echo "Downloading $BINARY_NAME..."
curl -fsSL "$DOWNLOAD_URL" -o "$BINARY_NAME.tar.gz"

echo "Extracting..."
tar -xzf "$BINARY_NAME.tar.gz"

echo "Installing to $INSTALL_DIR..."
mv "terminal-mcp-$PLATFORM" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo "Creating tmcp alias..."
ln -sf "$INSTALL_DIR/$BINARY_NAME" "$INSTALL_DIR/tmcp"

# Add to PATH if not already present
if ! echo "$PATH" | grep -q "$INSTALL_DIR"; then
    # Detect shell and update appropriate config file
    SHELL_NAME=$(basename "$SHELL")
    case $SHELL_NAME in
        zsh)
            SHELL_CONFIG="$HOME/.zshrc"
            ;;
        bash)
            if [ -f "$HOME/.bash_profile" ]; then
                SHELL_CONFIG="$HOME/.bash_profile"
            else
                SHELL_CONFIG="$HOME/.bashrc"
            fi
            ;;
        fish)
            SHELL_CONFIG="$HOME/.config/fish/config.fish"
            ;;
        *)
            SHELL_CONFIG="$HOME/.profile"
            ;;
    esac

    echo "Adding $INSTALL_DIR to PATH in $SHELL_CONFIG..."
    echo "" >> "$SHELL_CONFIG"
    echo "# Added by terminal-mcp installer" >> "$SHELL_CONFIG"
    echo "export PATH=\"$INSTALL_DIR:\$PATH\"" >> "$SHELL_CONFIG"

    # Update PATH for current session
    export PATH="$INSTALL_DIR:$PATH"

    echo "📝 Updated PATH in $SHELL_CONFIG"
fi

# Cleanup
cd /
rm -rf "$TMP_DIR"

echo ""
echo "✅ $BINARY_NAME installed successfully!"
echo "📍 Installed to: $INSTALL_DIR"
echo ""
if ! command -v "$BINARY_NAME" >/dev/null 2>&1; then
    echo "🔄 Please restart your terminal or run: source $SHELL_CONFIG"
    echo "Then run '$BINARY_NAME --help' to get started."
else
    echo "Run '$BINARY_NAME --help' to get started."
fi