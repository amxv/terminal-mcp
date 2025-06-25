#!/bin/bash

# Terminal MCP Test Runner
# Builds the project and runs all tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

log_info "Starting Terminal MCP Test Runner"
log_info "Project root: $PROJECT_ROOT"

# Check if Bun is available
if ! command -v bun &> /dev/null; then
    log_error "Bun is required but not found. Please install Bun first."
    exit 1
fi

# Install dependencies
log_info "Installing dependencies..."
if ! bun install; then
    log_error "Failed to install dependencies"
    exit 1
fi
log_success "Dependencies installed"

# Build the project (both main and agent binaries)
log_info "Building project for current platform (main and agent)..."
if ! bun run build:current; then
    log_error "Build failed"
    exit 1
fi

if ! bun run build:agent-current; then
    log_error "Agent build failed"
    exit 1
fi

log_success "Build completed"

# Determine the built binary paths
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        BINARY_PATH="dist/terminal-mcp-macos-arm64"
        AGENT_BINARY_PATH="dist/terminal-mcp-agent-macos-arm64"
    else
        BINARY_PATH="dist/terminal-mcp-macos-x64"
        AGENT_BINARY_PATH="dist/terminal-mcp-agent-macos-x64"
    fi
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if [[ $(uname -m) == "aarch64" ]]; then
        BINARY_PATH="dist/terminal-mcp-linux-arm64"
        AGENT_BINARY_PATH="dist/terminal-mcp-agent-linux-arm64"
    else
        BINARY_PATH="dist/terminal-mcp-linux-x64"
        AGENT_BINARY_PATH="dist/terminal-mcp-agent-linux-x64"
    fi
else
    log_error "Unsupported platform: $OSTYPE"
    exit 1
fi

if [[ ! -f "$BINARY_PATH" ]]; then
    log_error "Built binary not found at: $BINARY_PATH"
    exit 1
fi

if [[ ! -f "$AGENT_BINARY_PATH" ]]; then
    log_error "Built agent binary not found at: $AGENT_BINARY_PATH"
    exit 1
fi

log_success "Main binary found at: $BINARY_PATH"
log_success "Agent binary found at: $AGENT_BINARY_PATH"

# Run tests
log_info "Running comprehensive tests..."
export TMCP_CMD="$(realpath "$PROJECT_ROOT/$BINARY_PATH")"
export TMCP_AGENT_CMD="$(realpath "$PROJECT_ROOT/$AGENT_BINARY_PATH")"

if "$SCRIPT_DIR/test.sh"; then
    log_success "All tests passed!"
    exit 0
else
    log_error "Some tests failed!"
    exit 1
fi