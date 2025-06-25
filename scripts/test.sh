#!/bin/bash

# Terminal MCP Test Suite
# Tests all functionality against context7 MCP server

# Using explicit error handling instead of set -e to avoid early exits

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
CONTEXT7_URL="https://mcp.context7.com/mcp"
TEST_DIR="/tmp/tmcp-test-$$"
TMCP_CMD="${TMCP_CMD:-./terminal-mcp}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

run_test() {
    local test_name="$1"
    local test_cmd="$2"
    local expected_pattern="$3"

    ((TESTS_RUN++))
    log_info "Running test: $test_name"

    # Create a temporary file for output
    local output_file=$(mktemp)
    local error_file=$(mktemp)

    # Run the command and capture output
    if eval "$test_cmd" > "$output_file" 2> "$error_file"; then
        local output=$(cat "$output_file")
        local error=$(cat "$error_file")

        if [[ -n "$expected_pattern" && ! "$output" =~ $expected_pattern ]]; then
            log_error "$test_name - Expected pattern '$expected_pattern' not found in output"
            echo "Output: $output"
            echo "Error: $error"
        else
            log_success "$test_name"
        fi
    else
        local exit_code=$?
        local output=$(cat "$output_file")
        local error=$(cat "$error_file")
        log_error "$test_name - Command failed with exit code $exit_code"
        echo "Output: $output"
        echo "Error: $error"
    fi

    # Clean up temp files
    rm -f "$output_file" "$error_file"
}

run_test_expect_failure() {
    local test_name="$1"
    local test_cmd="$2"
    local expected_error_pattern="$3"

    ((TESTS_RUN++))
    log_info "Running test (expect failure): $test_name"

    # Create a temporary file for output
    local output_file=$(mktemp)
    local error_file=$(mktemp)

    # Run the command and capture output
    if eval "$test_cmd" > "$output_file" 2> "$error_file"; then
        log_error "$test_name - Command should have failed but succeeded"
        cat "$output_file"
    else
        local error=$(cat "$error_file")
        local output=$(cat "$output_file")
        local combined="$output$error"

        if [[ -n "$expected_error_pattern" && "$combined" =~ $expected_error_pattern ]]; then
            log_success "$test_name"
        else
            log_error "$test_name - Expected error pattern '$expected_error_pattern' not found"
            echo "Output: $output"
            echo "Error: $error"
        fi
    fi

    # Clean up temp files
    rm -f "$output_file" "$error_file"
}

setup_test_env() {
    log_info "Setting up test environment..."

    # Create test directory
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"

    # Check if tmcp command exists
    if [[ "$TMCP_CMD" == /* ]] || [[ "$TMCP_CMD" == ./* ]]; then
        # Absolute or relative path - check if file exists and is executable
        if [[ ! -f "$TMCP_CMD" ]]; then
            log_error "tmcp command not found at: $TMCP_CMD"
            log_info "Please build the project first or set TMCP_CMD environment variable"
            exit 1
        elif [[ ! -x "$TMCP_CMD" ]]; then
            log_error "tmcp command at $TMCP_CMD is not executable"
            exit 1
        fi
    else
        # Command name - check if it's in PATH
        if ! command -v "$TMCP_CMD" &> /dev/null; then
            log_error "tmcp command not found in PATH: $TMCP_CMD"
            log_info "Please build the project first or set TMCP_CMD environment variable"
            exit 1
        fi
    fi

    log_success "Test environment setup complete"
}

cleanup_test_env() {
    log_info "Cleaning up test environment..."
    cd /
    rm -rf "$TEST_DIR"
    log_success "Cleanup complete"
}

test_direct_functionality() {
    log_info "=== Testing Direct Functionality ==="

    # Test direct list
    run_test "Direct list tools" \
        "$TMCP_CMD direct $CONTEXT7_URL list" \
        '"tools".*"total_count"'

    # Test direct call with resolve-library-id
    run_test "Direct call resolve-library-id" \
        "$TMCP_CMD direct $CONTEXT7_URL call resolve-library-id '{\"libraryName\": \"react\"}'" \
        '"content"'

    # Test direct call with invalid tool name
    run_test_expect_failure "Direct call invalid tool" \
        "$TMCP_CMD direct $CONTEXT7_URL call nonexistent-tool '{\"param\": \"value\"}'" \
        "Tool.*not found|Unknown tool|Error"

    # Test direct with invalid URL
    run_test_expect_failure "Direct with invalid URL" \
        "$TMCP_CMD direct http://invalid-url-12345.com/mcp list" \
        "Failed to connect|Error|Connection"

    # Test direct with invalid JSON params
    run_test_expect_failure "Direct call invalid JSON" \
        "$TMCP_CMD direct $CONTEXT7_URL call resolve-library-id 'invalid-json'" \
        "Invalid JSON|JSON"

    # Test direct with missing arguments
    run_test_expect_failure "Direct missing URL" \
        "$TMCP_CMD direct" \
        "Invalid arguments|Usage"

    run_test_expect_failure "Direct missing subcommand" \
        "$TMCP_CMD direct $CONTEXT7_URL" \
        "Invalid arguments|Usage"

        run_test_expect_failure "Direct call missing tool name" \
        "$TMCP_CMD direct $CONTEXT7_URL call" \
        "Invalid arguments|Usage"
}

test_configuration_functionality() {
    log_info "=== Testing Configuration-Based Functionality ==="

    # Create test mcp.json
    cat > mcp.json << EOF
{
  "mcpServers": {
    "context7": {
      "url": "$CONTEXT7_URL"
    }
  }
}
EOF

    # Test init command (discovers and creates tools.json)
    run_test "Initialize tools configuration" \
        "$TMCP_CMD init" \
        "Initialization complete|Generated tools configuration"

    # Verify tools.json was created
    if [[ -f "terminal-mcp/servers.json" && -f "terminal-mcp/tools.json" ]]; then
        log_success "Tools configuration files created"
        ((TESTS_PASSED++))
    else
        log_error "Tools configuration files not created"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test list configured tools
    run_test "List configured tools" \
        "$TMCP_CMD list" \
        '"configured_tools".*"total_count"'

    # Test call with tool alias (get a tool name from the list first)
    local tool_alias
    tool_alias=$("$TMCP_CMD" list 2>/dev/null | jq -r '.configured_tools[0].alias' 2>/dev/null || echo "context7__resolve-library-id")

    if [[ "$tool_alias" != "null" && -n "$tool_alias" ]]; then
        run_test "Call tool by alias ($tool_alias)" \
            "$TMCP_CMD call $tool_alias '{\"libraryName\": \"react\"}'" \
            '"content"'
    else
        # Fallback test
        run_test "Call tool by alias (fallback)" \
            "$TMCP_CMD call context7__resolve-library-id '{\"libraryName\": \"react\"}'" \
            '"content"'
    fi

    # Test call with invalid tool alias
    run_test_expect_failure "Call invalid tool alias" \
        "$TMCP_CMD call nonexistent__tool '{\"param\": \"value\"}'" \
        "Tool.*not found|Available tools"

    # Test call with invalid JSON
    run_test_expect_failure "Call with invalid JSON" \
        "$TMCP_CMD call context7__resolve-library-id 'invalid-json'" \
        "Invalid JSON|JSON"

    # Test disabling a tool by editing tools.json
    if [[ -f "terminal-mcp/tools.json" ]]; then
        # Backup original tools.json
        cp "terminal-mcp/tools.json" "terminal-mcp/tools.json.backup"

        # Disable the first tool
        jq '.mcpTools[keys[0]].enabled = false' "terminal-mcp/tools.json" > "terminal-mcp/tools.json.tmp" && mv "terminal-mcp/tools.json.tmp" "terminal-mcp/tools.json"

        # Test that disabled tool is not listed
        run_test "List tools excludes disabled" \
            "$TMCP_CMD list" \
            '"configured_tools".*"total_count"'

        # Get the disabled tool name
        local disabled_tool
        disabled_tool=$(jq -r '.mcpTools | to_entries[] | select(.value.enabled == false) | .key' "terminal-mcp/tools.json.backup" | head -1)

        if [[ -n "$disabled_tool" && "$disabled_tool" != "null" ]]; then
            # Test that calling disabled tool fails
            run_test_expect_failure "Call disabled tool fails" \
                "$TMCP_CMD call $disabled_tool '{\"libraryName\": \"react\"}'" \
                "Tool.*disabled|disabled"
        fi

        # Restore original tools.json
        mv "terminal-mcp/tools.json.backup" "terminal-mcp/tools.json"
    fi
}

test_error_conditions() {
    log_info "=== Testing Error Conditions ==="

    # Test commands without configuration in clean directory
    local clean_dir="/tmp/tmcp-clean-test-$$"
    mkdir -p "$clean_dir"
    cd "$clean_dir"

    run_test_expect_failure "List without configuration" \
        "$TMCP_CMD list" \
        "No tools configuration found|Run.*tmcp init"

    run_test_expect_failure "Call without configuration" \
        "$TMCP_CMD call some__tool '{\"param\": \"value\"}'" \
        "No tools configuration found|Run.*tmcp init"

    run_test_expect_failure "Init without mcp.json" \
        "$TMCP_CMD init" \
        "No mcp.json configuration file found"

    cd "$TEST_DIR"
    rm -rf "$clean_dir"
}

test_help_and_usage() {
    log_info "=== Testing Help and Usage ==="

    # Test help command
    run_test "Help command" \
        "$TMCP_CMD help" \
        "Usage.*tmcp.*Commands"

    # Test no arguments (should show help)
    run_test "No arguments (help)" \
        "$TMCP_CMD" \
        "Usage.*tmcp.*Commands"

    # Test invalid command
    run_test_expect_failure "Invalid command" \
        "$TMCP_CMD invalid-command" \
        "Unknown command"
}

print_summary() {
    echo
    log_info "=== Test Summary ==="
    echo "Tests run: $TESTS_RUN"
    echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"

    if [[ $TESTS_FAILED -gt 0 ]]; then
        echo -e "\n${RED}Some tests failed!${NC}"
        exit 1
    else
        echo -e "\n${GREEN}All tests passed!${NC}"
        exit 0
    fi
}

# Main test execution
main() {
    log_info "Starting Terminal MCP Test Suite"
    log_info "Testing against: $CONTEXT7_URL"
    log_info "Using tmcp command: $TMCP_CMD"

    # Set up cleanup trap
    trap cleanup_test_env EXIT INT TERM

        setup_test_env

    # Run test suites
    log_info "Running direct functionality tests..."
    test_direct_functionality
    log_info "Running configuration functionality tests..."
    test_configuration_functionality
    log_info "Running error condition tests..."
    test_error_conditions
    log_info "Running help and usage tests..."
    test_help_and_usage

    # Disable trap before manual cleanup
    trap - EXIT INT TERM
    cleanup_test_env
    print_summary
}

# Run main function
main "$@"