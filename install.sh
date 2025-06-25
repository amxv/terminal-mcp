#!/bin/bash
set -e

# Configuration
REPO="zueai/terminal-mcp"  # Update this with your GitHub repo
VERSION="latest"
INSTALL_DIR="/usr/local/bin"
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
sudo mv "terminal-mcp-$PLATFORM" "$INSTALL_DIR/$BINARY_NAME"
sudo chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Cleanup
cd /
rm -rf "$TMP_DIR"

echo "✅ $BINARY_NAME installed successfully!"
echo "Run '$BINARY_NAME --help' to get started."