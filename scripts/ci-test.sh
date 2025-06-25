#!/bin/bash

# CI Test Script for Terminal MCP
# Quick regression test for all functionality

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Terminal MCP - Quick Regression Test${NC}"
echo "====================================="

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Quick smoke tests
echo -e "\n${BLUE}1. Building project...${NC}"
if bun run build:current >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi

# Build agent binary
bun run build:agent-current >/dev/null 2>&1

# Determine binary paths
if [[ "$OSTYPE" == "darwin"* ]]; then
    if [[ $(uname -m) == "arm64" ]]; then
        BINARY="dist/terminal-mcp-macos-arm64"
        AGENT_BINARY="dist/terminal-mcp-agent-macos-arm64"
    else
        BINARY="dist/terminal-mcp-macos-x64"
        AGENT_BINARY="dist/terminal-mcp-agent-macos-x64"
    fi
else
    if [[ $(uname -m) == "aarch64" ]]; then
        BINARY="dist/terminal-mcp-linux-arm64"
        AGENT_BINARY="dist/terminal-mcp-agent-linux-arm64"
    else
        BINARY="dist/terminal-mcp-linux-x64"
        AGENT_BINARY="dist/terminal-mcp-agent-linux-x64"
    fi
fi

if [[ ! -f "$AGENT_BINARY" ]]; then
    echo -e "${RED}✗ Agent binary not found: $AGENT_BINARY${NC}"
    exit 1
fi

echo -e "\n${BLUE}2. Testing direct functionality...${NC}"
if "$BINARY" direct https://mcp.context7.com/mcp list >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Direct list works${NC}"
else
    echo -e "${RED}✗ Direct list failed${NC}"
    exit 1
fi

if "$BINARY" direct https://mcp.context7.com/mcp call resolve-library-id '{"libraryName": "react"}' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Direct call works${NC}"
else
    echo -e "${RED}✗ Direct call failed${NC}"
    exit 1
fi

echo -e "\n${BLUE}3. Testing configuration functionality...${NC}"
# Test in temporary directory
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

# Create test config
cat > mcp.json << EOF
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp"
    }
  }
}
EOF

if "$PROJECT_ROOT/$BINARY" init >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Configuration init works${NC}"
else
    echo -e "${RED}✗ Configuration init failed${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
fi

if "$PROJECT_ROOT/$BINARY" list >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Configuration list works${NC}"
else
    echo -e "${RED}✗ Configuration list failed${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
fi

if "$PROJECT_ROOT/$BINARY" call context7__resolve-library-id '{"libraryName": "react"}' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Configuration call works${NC}"
else
    echo -e "${RED}✗ Configuration call failed${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
fi

echo -e "\n${BLUE}4. Testing agent safety controls...${NC}"

# Test that agent blocks dangerous commands
if "$PROJECT_ROOT/$AGENT_BINARY" init >/dev/null 2>&1; then
    echo -e "${RED}✗ Agent should block init command${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
else
    echo -e "${GREEN}✓ Agent blocks init command${NC}"
fi

if "$PROJECT_ROOT/$AGENT_BINARY" direct https://mcp.context7.com/mcp list >/dev/null 2>&1; then
    echo -e "${RED}✗ Agent should block direct command${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
else
    echo -e "${GREEN}✓ Agent blocks direct command${NC}"
fi

# Test that agent allows safe commands
if "$PROJECT_ROOT/$AGENT_BINARY" list >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Agent allows list command${NC}"
else
    echo -e "${RED}✗ Agent should allow list command${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
fi

if "$PROJECT_ROOT/$AGENT_BINARY" call context7__resolve-library-id '{"libraryName": "react"}' >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Agent allows call command${NC}"
else
    echo -e "${RED}✗ Agent should allow call command${NC}"
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    exit 1
fi

# Cleanup
cd "$PROJECT_ROOT"
rm -rf "$TEST_DIR"

echo -e "\n${GREEN}🎉 All regression tests passed!${NC}"
echo ""
echo "For comprehensive testing, run: bun run test"