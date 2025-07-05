#!/bin/bash

# Simple Stdio Server Test
# Tests the core stdio server functionality

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
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# Test configuration
TEST_DIR="/tmp/tmcp-stdio-test-$$"
TMCP_CMD="./dist/terminal-mcp-macos-arm64"
PROJECT_ROOT="/Users/ashray/code/amxv/terminal-mcp"

setup_test() {
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    log_info "Test directory: $TEST_DIR"

    # Source environment variables
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        source "$PROJECT_ROOT/.env"
        log_info "Loaded environment variables from .env"
    fi

    # Check if we have the required API key
    if [[ -z "$REF_API_KEY" ]]; then
        log_error "REF_API_KEY not found in environment"
        exit 1
    fi
}

cleanup_test() {
    cd /
    rm -rf "$TEST_DIR"
    # Clean up any remaining processes
    pkill -f "mcp-remote" 2>/dev/null || true
    log_info "Cleanup complete"
}

test_basic_stdio_parsing() {
    log_info "Testing basic stdio server command parsing..."

    # Test 1: Basic command parsing using actual Ref server
    cat > mcp-stdio-basic.json << EOF
{
  "mcpServers": {
    "Ref": {
      "command": "npx mcp-remote@0.1.0-0 https://api.ref.tools/mcp --header x-ref-api-key:$REF_API_KEY",
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    log_info "Running basic stdio server test..."
    local output
    output=$(timeout 60 "$PROJECT_ROOT/$TMCP_CMD" --configpath mcp-stdio-basic.json init 2>&1)
    if echo "$output" | grep -q "Generated tools configuration\|Discovering tools from Ref"; then
        log_success "Basic stdio server command parsing works"
        return 0
    else
        log_error "Basic stdio server command parsing failed"
        echo "Output: $output"
        return 1
    fi
}

test_command_string_parsing() {
    log_info "Testing command string parsing..."

    # Test 2: Single command string format (like in .mcp.json)
    cat > mcp-stdio-string.json << EOF
{
  "mcpServers": {
    "Ref": {
      "command": "npx mcp-remote@0.1.0-0 https://api.ref.tools/mcp --header x-ref-api-key:$REF_API_KEY",
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    log_info "Running command string parsing test..."
    local output
    output=$(timeout 60 "$PROJECT_ROOT/$TMCP_CMD" --configpath mcp-stdio-string.json init 2>&1)
    if echo "$output" | grep -q "Generated tools configuration\|Discovering tools from Ref"; then
        log_success "Command string parsing works"
        return 0
    else
        log_error "Command string parsing failed"
        echo "Output: $output"
        return 1
    fi
}

test_config_normalization() {
    log_info "Testing config normalization..."

    # Test 3: Config normalization - using command + args format
    cat > mcp-stdio-norm.json << EOF
{
  "mcpServers": {
    "Ref": {
      "command": "npx",
      "args": ["mcp-remote@0.1.0-0", "https://api.ref.tools/mcp", "--header", "x-ref-api-key:$REF_API_KEY"],
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    log_info "Running config normalization test..."
    local output
    output=$(timeout 60 "$PROJECT_ROOT/$TMCP_CMD" --configpath mcp-stdio-norm.json init 2>&1)
    if echo "$output" | grep -q "Generated tools configuration\|Discovering tools from Ref"; then
        # Check if servers.json was created with normalized config
        if [[ -f "terminal-mcp/servers.json" ]]; then
            if command -v jq &> /dev/null; then
                if jq -e '.mcpServers.Ref.command' terminal-mcp/servers.json > /dev/null 2>&1; then
                    log_success "Config normalization works"
                    return 0
                fi
            else
                log_success "Config normalization works (jq not available to verify)"
                return 0
            fi
        fi
    fi

    log_error "Config normalization failed"
    echo "Output: $output"
    return 1
}

test_stdio_tool_call() {
    log_info "Testing stdio server tool call..."

    # Test 4: Test actual tool call using the generated tools
    if [[ -f "terminal-mcp/tools.json" ]]; then
        # Find a ref tool to test with
        local ref_tool
        if command -v jq &> /dev/null; then
            ref_tool=$(jq -r '.mcpTools | to_entries[] | select(.key | startswith("Ref__")) | .key' "terminal-mcp/tools.json" | head -1 2>/dev/null || echo "")
        fi

        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            log_info "Testing tool call with: $ref_tool"
            local output
            output=$(timeout 60 "$PROJECT_ROOT/$TMCP_CMD" call "$ref_tool" '{"query": "React hooks", "keyWords": ["React", "hooks"]}' 2>&1)
            if echo "$output" | grep -q '"content"\|"result"\|"data"'; then
                log_success "Stdio server tool call works"
                return 0
            else
                log_error "Stdio server tool call failed"
                echo "Output: $output"
                return 1
            fi
        else
            log_error "No ref tools found for testing"
            return 1
        fi
    else
        log_error "No tools.json found"
        return 1
    fi
}

# Main test execution
main() {
    log_info "Starting Stdio Server Test"

    # Set up cleanup trap
    trap cleanup_test EXIT INT TERM

    setup_test

    local tests_passed=0
    local tests_total=4

    # Run tests
    if test_basic_stdio_parsing; then
        ((tests_passed++))
    fi

    if test_command_string_parsing; then
        ((tests_passed++))
    fi

    if test_config_normalization; then
        ((tests_passed++))
    fi

    if test_stdio_tool_call; then
        ((tests_passed++))
    fi

    # Print summary
    log_info "Test Results: $tests_passed/$tests_total tests passed"

    if [[ $tests_passed -eq $tests_total ]]; then
        log_success "All stdio server tests passed!"
        exit 0
    else
        log_error "Some stdio server tests failed"
        exit 1
    fi
}

# Run main function
main "$@"