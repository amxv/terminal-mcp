#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
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

# Default values
INSTALL_DIR="/usr/local/bin"
REPO="zueai/terminal-mcp"
BINARY_NAME="tmcp"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        --help)
            echo "Terminal MCP Agent Installer"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --install-dir DIR    Install directory (default: /usr/local/bin)"
            echo "  --help              Show this help message"
            echo ""
            echo "This script installs the agent-safe version of terminal-mcp that only"
            echo "allows 'list' and 'call' commands for AI agents. Supports Linux and macOS."
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

print_info "Installing terminal-mcp-agent..."

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64|amd64)
        ARCH="x64"
        ;;
    aarch64|arm64)
        ARCH="arm64"
        ;;
    *)
        print_error "Unsupported architecture: $ARCH"
        print_error "Supported architectures: x86_64, amd64, aarch64, arm64"
        exit 1
        ;;
esac

# Support Linux and macOS (macOS for local testing)
OS=$(uname -s)
case $OS in
    Linux)
        PLATFORM="linux-$ARCH"
        ;;
    Darwin)
        PLATFORM="macos-$ARCH"
        ;;
    *)
        print_error "Unsupported OS: $OS"
        print_error "Supported OS: Linux, macOS"
        print_error "Note: Production AI agents typically run in Linux environments."
        exit 1
        ;;
esac
print_info "Detected platform: $PLATFORM"

# Get latest release info
print_info "Fetching latest release information..."
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")

if [[ -z "$LATEST_RELEASE" ]]; then
    print_error "Failed to fetch release information"
    exit 1
fi

VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
if [[ -z "$VERSION" ]]; then
    print_error "Failed to parse version from release information"
    exit 1
fi

print_info "Latest version: $VERSION"

# Download URL
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/terminal-mcp-agent-$PLATFORM.tar.gz"
print_info "Download URL: $DOWNLOAD_URL"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Download and extract
print_info "Downloading terminal-mcp-agent..."
if ! curl -L -o "$TEMP_DIR/terminal-mcp-agent.tar.gz" "$DOWNLOAD_URL"; then
    print_error "Failed to download terminal-mcp-agent"
    print_error "URL: $DOWNLOAD_URL"
    exit 1
fi

print_info "Extracting archive..."
if ! tar -xzf "$TEMP_DIR/terminal-mcp-agent.tar.gz" -C "$TEMP_DIR"; then
    print_error "Failed to extract archive"
    exit 1
fi

# Install binary
print_info "Installing to $INSTALL_DIR..."

# Create install directory if it doesn't exist
if [[ ! -d "$INSTALL_DIR" ]]; then
    print_info "Creating install directory: $INSTALL_DIR"
    if ! mkdir -p "$INSTALL_DIR"; then
        print_error "Failed to create install directory. You may need sudo privileges."
        print_error "Try: sudo $0"
        exit 1
    fi
fi

# Copy binary
BINARY_PATH="$INSTALL_DIR/$BINARY_NAME"
if ! cp "$TEMP_DIR/terminal-mcp-agent-$PLATFORM" "$BINARY_PATH"; then
    print_error "Failed to copy binary. You may need sudo privileges."
    print_error "Try: sudo $0"
    exit 1
fi

# Make executable
if ! chmod +x "$BINARY_PATH"; then
    print_error "Failed to make binary executable"
    exit 1
fi

# Verify installation
if ! command -v "$BINARY_NAME" >/dev/null 2>&1; then
    print_warning "$BINARY_NAME is not in your PATH"
    print_warning "You may need to add $INSTALL_DIR to your PATH"
    print_warning "Or use the full path: $BINARY_PATH"
else
    print_success "$BINARY_NAME is now available in your PATH"
fi

print_success "Terminal MCP Agent installed successfully!"
print_info "Version: $VERSION"
print_info "Location: $BINARY_PATH"
print_info ""
print_info "Usage:"
print_info "  $BINARY_NAME list                                    # List available tools"
print_info "  $BINARY_NAME call <tool-alias> '<json-params>'      # Call a tool"
print_info ""
print_info "Example:"
print_info "  $BINARY_NAME list"
print_info "  $BINARY_NAME call context7__resolve-library-id '{\"libraryName\": \"react\"}'"
print_info ""