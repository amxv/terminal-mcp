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
TMCP_AGENT_CMD="${TMCP_AGENT_CMD:-./terminal-mcp-agent}"

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

    # Get the project root directory
    PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

    # Create test directory
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"

    # Source .env file if it exists in the project root
    if [[ -f "$PROJECT_ROOT/.env" ]]; then
        log_info "Loading environment variables from .env file"
        source "$PROJECT_ROOT/.env"
        export REF_API_KEY
    fi

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

    # Check if tmcp-agent command exists
    if [[ "$TMCP_AGENT_CMD" == /* ]] || [[ "$TMCP_AGENT_CMD" == ./* ]]; then
        # Absolute or relative path - check if file exists and is executable
        if [[ ! -f "$TMCP_AGENT_CMD" ]]; then
            log_error "tmcp-agent command not found at: $TMCP_AGENT_CMD"
            log_info "Please build the project first or set TMCP_AGENT_CMD environment variable"
            exit 1
        elif [[ ! -x "$TMCP_AGENT_CMD" ]]; then
            log_error "tmcp-agent command at $TMCP_AGENT_CMD is not executable"
            exit 1
        fi
    else
        # Command name - check if it's in PATH
        if ! command -v "$TMCP_AGENT_CMD" &> /dev/null; then
            log_error "tmcp-agent command not found in PATH: $TMCP_AGENT_CMD"
            log_info "Please build the project first or set TMCP_AGENT_CMD environment variable"
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

test_authenticated_functionality() {
    log_info "=== Testing Authenticated MCP Server Functionality ==="

    # Check if we have the required environment variable
    if [[ -z "$REF_API_KEY" ]]; then
        log_warning "REF_API_KEY not set, skipping authenticated server tests"
        return
    fi

    # Test authenticated configuration-based functionality
    # Create test mcp.json with authenticated ref server
    cat > mcp-auth.json << EOF
{
  "mcpServers": {
    "context7": {
      "url": "$CONTEXT7_URL"
    },
    "ref": {
      "command": "bunx",
      "args": ["ref-tools-mcp@latest"],
      "env": {
        "REF_API_KEY": "$REF_API_KEY"
      }
    }
  }
}
EOF

    # Test initialization with authenticated server
    run_test "Initialize with authenticated server" \
        "$TMCP_CMD --configpath mcp-auth.json init" \
        "Initialization complete|Generated tools configuration"

    # Test listing tools from authenticated server
    if [[ -f "terminal-mcp/tools.json" ]]; then
        run_test "List tools includes authenticated server tools" \
            "$TMCP_CMD --configpath mcp-auth.json list" \
            '"configured_tools".*"total_count"'

        # Try to find a ref tool to test with
        local ref_tool
        if command -v jq &> /dev/null; then
            ref_tool=$("$TMCP_CMD" --configpath mcp-auth.json list 2>/dev/null | jq -r '.configured_tools[] | select(.alias | startswith("ref__")) | .alias' | head -1 2>/dev/null || echo "")
        fi

        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            # Test calling authenticated tool
            run_test "Call authenticated tool ($ref_tool)" \
                "$TMCP_CMD --configpath mcp-auth.json call $ref_tool '{\"query\": \"React hooks\"}'" \
                '"content"|"result"|"data"'
        else
            log_warning "No ref tools found in configuration, skipping authenticated tool call test"
        fi
    fi

    # Test that agent binary works with authenticated servers when configured
    # Copy the authenticated config to the default location for agent testing
    if [[ -f "terminal-mcp/tools.json" ]]; then
        # Backup existing config
        [[ -f "terminal-mcp/servers.json" ]] && cp "terminal-mcp/servers.json" "terminal-mcp/servers.json.backup"

        # Copy authenticated config to default location
        cp mcp-auth.json mcp.json
        "$TMCP_CMD" init > /dev/null 2>&1

        run_test "Agent works with authenticated server config" \
            "$TMCP_AGENT_CMD list" \
            '"configured_tools".*"total_count"|No tools configuration found"'

        # Test agent can call authenticated tools
        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            run_test "Agent can call authenticated tool ($ref_tool)" \
                "$TMCP_AGENT_CMD call $ref_tool '{\"query\": \"React hooks\"}'" \
                '"content"|"result"|"data"|Tool.*not found"'
        fi

        # Restore original config
        [[ -f "terminal-mcp/servers.json.backup" ]] && mv "terminal-mcp/servers.json.backup" "terminal-mcp/servers.json"
    fi

    # Test behavior with missing authentication
    # Note: Some servers may work without authentication or have fallback modes
    # So we test that the functionality still works, but may be limited
    cat > mcp-no-auth.json << EOF
{
  "mcpServers": {
    "ref": {
      "command": "bunx",
      "args": ["ref-tools-mcp@latest"]
    }
  }
}
EOF

    # Test server behavior without authentication (may succeed or fail depending on server implementation)
    run_test "Server behavior without authentication (may work with limited functionality)" \
        "$TMCP_CMD --configpath mcp-no-auth.json init" \
        "Initialization complete|Generated tools configuration|Error|Failed|Authentication|API.*key"

    # Clean up test files
    rm -f mcp-auth.json mcp-no-auth.json
}

test_custom_headers_functionality() {
    log_info "=== Testing Custom Headers Functionality ==="

    # Check if we have the required environment variable for the ref server
    if [[ -z "$REF_API_KEY" ]]; then
        log_warning "REF_API_KEY not set, skipping custom headers tests"
        return
    fi

    # Test HTTP header-based authentication (as opposed to environment variables)
    # Create test mcp.json with headers-based ref server configuration
    cat > mcp-headers.json << EOF
{
  "mcpServers": {
    "context7": {
      "url": "$CONTEXT7_URL"
    },
    "ref": {
      "url": "https://api.ref.tools/mcp",
      "headers": {
        "x-ref-api-key": "$REF_API_KEY"
      }
    }
  }
}
EOF

    # Test initialization with headers-based authentication
    run_test "Initialize with custom headers authentication" \
        "$TMCP_CMD --configpath mcp-headers.json init" \
        "Initialization complete|Generated tools configuration"

    # Test listing tools from server using custom headers
    if [[ -f "terminal-mcp/tools.json" ]]; then
        run_test "List tools includes header-authenticated server tools" \
            "$TMCP_CMD --configpath mcp-headers.json list" \
            '"configured_tools".*"total_count"'

        # Try to find a ref tool to test with
        local ref_tool
        if command -v jq &> /dev/null; then
            ref_tool=$("$TMCP_CMD" --configpath mcp-headers.json list 2>/dev/null | jq -r '.configured_tools[] | select(.alias | startswith("ref__")) | .alias' | head -1 2>/dev/null || echo "")
        fi

        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            # Test calling header-authenticated tool
            run_test "Call header-authenticated tool ($ref_tool)" \
                "$TMCP_CMD --configpath mcp-headers.json call $ref_tool '{\"query\": \"React hooks\"}'" \
                '"content"|"result"|"data"'
        else
            log_warning "No ref tools found in header configuration, skipping header-authenticated tool call test"
        fi
    fi

    # Test that headers work with direct communication too
    run_test "Direct communication with custom headers" \
        "$TMCP_CMD direct https://api.ref.tools/mcp --headers '{\"x-ref-api-key\": \"$REF_API_KEY\"}' list" \
        '"tools".*"total_count"'

    # Test direct tool call with custom headers
    run_test "Direct tool call with custom headers" \
        "$TMCP_CMD direct https://api.ref.tools/mcp --headers '{\"x-ref-api-key\": \"$REF_API_KEY\"}' call ref__search_documentation '{\"query\": \"React hooks\"}'" \
        '"content"|"result"|"data"'

    # Test behavior with missing headers (should fail with 401)
    run_test_expect_failure "Server fails without required headers" \
        "$TMCP_CMD direct https://api.ref.tools/mcp list" \
        "401|Unauthorized|Authentication.*required"

    # Test behavior with invalid headers
    run_test_expect_failure "Server fails with invalid headers" \
        "$TMCP_CMD direct https://api.ref.tools/mcp --headers '{\"x-ref-api-key\": \"invalid-key-123\"}' list" \
        "401|403|Unauthorized|Invalid.*key|Authentication.*failed"

    # Test multiple headers
    cat > mcp-multi-headers.json << EOF
{
  "mcpServers": {
    "ref": {
      "url": "https://api.ref.tools/mcp",
      "headers": {
        "x-ref-api-key": "$REF_API_KEY",
        "User-Agent": "terminal-mcp-test/1.0",
        "Accept": "application/json"
      }
    }
  }
}
EOF

    run_test "Initialize with multiple custom headers" \
        "$TMCP_CMD --configpath mcp-multi-headers.json init" \
        "Initialization complete|Generated tools configuration"

    # Test that agent binary works with header-authenticated servers when configured
    # Copy the header-authenticated config to the default location for agent testing
    if [[ -f "terminal-mcp/tools.json" ]]; then
        # Backup existing config
        [[ -f "terminal-mcp/servers.json" ]] && cp "terminal-mcp/servers.json" "terminal-mcp/servers.json.backup"

        # Copy header-authenticated config to default location
        cp mcp-headers.json mcp.json
        "$TMCP_CMD" init > /dev/null 2>&1

        run_test "Agent works with header-authenticated server config" \
            "$TMCP_AGENT_CMD list" \
            '"configured_tools".*"total_count"|No tools configuration found"'

        # Test agent can call header-authenticated tools
        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            run_test "Agent can call header-authenticated tool ($ref_tool)" \
                "$TMCP_AGENT_CMD call $ref_tool '{\"query\": \"React hooks\"}'" \
                '"content"|"result"|"data"|Tool.*not found"'
        fi

        # Restore original config
        [[ -f "terminal-mcp/servers.json.backup" ]] && mv "terminal-mcp/servers.json.backup" "terminal-mcp/servers.json"
    fi

    # Clean up test files
    rm -f mcp-headers.json mcp-multi-headers.json
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

test_agent_safety_controls() {
    log_info "=== Testing Agent Safety Controls ==="

    # First create configuration using full CLI for the agent tests
    cat > mcp.json << EOF
{
  "mcpServers": {
    "context7": {
      "url": "$CONTEXT7_URL"
    }
  }
}
EOF

    # Initialize configuration with full CLI
    "$TMCP_CMD" init > /dev/null 2>&1 || log_warning "Could not initialize config for agent tests"

    # Test that agent binary blocks dangerous commands
    run_test_expect_failure "Agent blocks init command" \
        "$TMCP_AGENT_CMD init" \
        "Unknown command.*init|Available commands.*list.*call"

    run_test_expect_failure "Agent blocks direct command" \
        "$TMCP_AGENT_CMD direct $CONTEXT7_URL list" \
        "Unknown command.*direct|Available commands.*list.*call"

    run_test_expect_failure "Agent blocks configpath option" \
        "$TMCP_AGENT_CMD --configpath /tmp/test.json list" \
        "Unknown option|configpath"

    # Test that agent binary allows safe commands
    if [[ -f "terminal-mcp/tools.json" ]]; then
        run_test "Agent allows list command" \
            "$TMCP_AGENT_CMD list" \
            '"configured_tools".*"total_count"|No tools configuration found"'

        # Get a tool alias for testing
        local tool_alias
        tool_alias=$("$TMCP_AGENT_CMD" list 2>/dev/null | jq -r '.configured_tools[0].alias' 2>/dev/null || echo "context7__resolve-library-id")

        if [[ "$tool_alias" != "null" && -n "$tool_alias" ]]; then
            run_test "Agent allows call command ($tool_alias)" \
                "$TMCP_AGENT_CMD call $tool_alias '{\"libraryName\": \"react\"}'" \
                '"content"'
        else
            # Test with fallback if tools.json parsing fails
            run_test "Agent allows call command (fallback)" \
                "$TMCP_AGENT_CMD call context7__resolve-library-id '{\"libraryName\": \"react\"}'" \
                '"content"|Tool.*not found"'
        fi
    else
        # Test agent behavior without configuration
        run_test_expect_failure "Agent requires configuration for list" \
            "$TMCP_AGENT_CMD list" \
            "No tools configuration found"

        run_test_expect_failure "Agent requires configuration for call" \
            "$TMCP_AGENT_CMD call some__tool '{\"param\": \"value\"}'" \
            "No tools configuration found"
    fi

    # Test agent help and version work
    run_test "Agent allows help command" \
        "$TMCP_AGENT_CMD --help" \
        "Usage.*tmcp.*Commands.*list.*call"

    run_test "Agent allows version command" \
        "$TMCP_AGENT_CMD --version" \
        "terminal-mcp.*v"

    # Test that agent provides appropriate error messages for blocked commands
    run_test_expect_failure "Agent provides helpful error for unknown commands" \
        "$TMCP_AGENT_CMD invalid-command" \
        "Unknown command.*invalid-command.*Available commands.*list.*call"
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
        "MCP JSON configuration file not found"

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

test_stdio_functionality() {
    log_info "=== Testing Stdio Server Functionality ==="

    # Test 0: Basic stdio server command parsing (no network required)
    log_info "Testing basic stdio server command parsing..."
    cat > mcp-stdio-basic.json << EOF
{
  "mcpServers": {
    "test": {
      "command": "echo hello world",
      "type": "stdio"
    }
  }
}
EOF

    # Test basic command parsing without network calls
    run_test "Basic stdio server command parsing" \
        "timeout 30 $TMCP_CMD --configpath mcp-stdio-basic.json init" \
        "Initialization complete|Generated tools configuration|Failed to connect"

    # Check if we have the required environment variable for stdio server testing
    if [[ -z "$REF_API_KEY" ]]; then
        log_warning "REF_API_KEY not set, skipping network-dependent stdio server tests"
        rm -f mcp-stdio-basic.json
        return
    fi

    # Test 1: Stdio server configuration with command and args format
    log_info "Testing stdio server with command + args format..."
    cat > mcp-stdio-args.json << EOF
{
  "mcpServers": {
    "ref": {
      "command": "npx",
      "args": ["mcp-remote@0.1.0-0", "https://api.ref.tools/mcp", "--header", "x-ref-api-key:$REF_API_KEY"],
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with stdio server (command + args format) - with timeout
    run_test "Initialize stdio server (command + args)" \
        "timeout 60 $TMCP_CMD --configpath mcp-stdio-args.json init" \
        "Initialization complete|Generated tools configuration"

    # Test 2: Stdio server configuration with single command string format (Claude Code style)
    log_info "Testing stdio server with single command string format..."
    cat > mcp-stdio-string.json << EOF
{
  "mcpServers": {
    "ref": {
      "command": "npx mcp-remote@0.1.0-0 https://api.ref.tools/mcp --header x-ref-api-key:$REF_API_KEY",
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with stdio server (single command string format) - with timeout
    run_test "Initialize stdio server (single command string)" \
        "timeout 60 $TMCP_CMD --configpath mcp-stdio-string.json init" \
        "Initialization complete|Generated tools configuration"

    # Test 3: Stdio server with environment variables
    log_info "Testing stdio server with environment variables..."
    cat > mcp-stdio-env.json << EOF
{
  "mcpServers": {
    "ref": {
      "command": "npx",
      "args": ["mcp-remote@0.1.0-0", "https://api.ref.tools/mcp"],
      "env": {
        "REF_API_KEY": "$REF_API_KEY"
      },
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with stdio server using environment variables - with timeout
    run_test "Initialize stdio server (with env vars)" \
        "timeout 60 $TMCP_CMD --configpath mcp-stdio-env.json init" \
        "Initialization complete|Generated tools configuration"

    # Test 4: Test that stdio servers are properly normalized in servers.json
    if [[ -f "terminal-mcp/servers.json" ]]; then
        run_test "Stdio server config normalized properly" \
            "jq '.mcpServers.ref.command' terminal-mcp/servers.json" \
            "npx"
    fi

    # Test 5: Test stdio server tool calls
    log_info "Testing stdio server tool calls..."

    # Use the normalized stdio config for tool calls
    if [[ -f "terminal-mcp/tools.json" ]]; then
        # Find a ref tool to test with
        local ref_tool
        if command -v jq &> /dev/null; then
            ref_tool=$(jq -r '.mcpTools | to_entries[] | select(.key | startswith("ref__")) | .key' "terminal-mcp/tools.json" | head -1 2>/dev/null || echo "")
        fi

        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            run_test "Call stdio server tool ($ref_tool)" \
                "timeout 60 $TMCP_CMD call $ref_tool '{\"query\": \"React hooks\", \"keyWords\": [\"React\", \"hooks\"]}'" \
                '"content"|"result"|"data"'
        else
            log_warning "No ref tools found for stdio server testing"
        fi
    fi

    # Test 6: Test stdio server process cleanup (ensure no hanging processes)
    log_info "Testing stdio server process cleanup..."

    # Run a quick tool call and check that no mcp-remote processes are left hanging
    local pre_process_count=$(pgrep -f "mcp-remote" 2>/dev/null | wc -l)

    # Make a tool call (this should start and clean up a stdio process)
    if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
        timeout 30 "$TMCP_CMD" call "$ref_tool" '{"query": "test", "keyWords": ["test"]}' > /dev/null 2>&1 || true
    fi

    # Wait a moment for cleanup
    sleep 2

    local post_process_count=$(pgrep -f "mcp-remote" 2>/dev/null | wc -l)

    if [[ $post_process_count -le $pre_process_count ]]; then
        log_success "Stdio server process cleanup working (no hanging processes)"
        ((TESTS_PASSED++))
    else
        log_error "Stdio server process cleanup failed (processes still running)"
        ((TESTS_FAILED++))
    fi
    ((TESTS_RUN++))

    # Test 7: Test bunx command resolution
    log_info "Testing bunx command resolution..."
    cat > mcp-stdio-bunx.json << EOF
{
  "mcpServers": {
    "ref": {
      "command": "bunx",
      "args": ["mcp-remote@0.1.0-0", "https://api.ref.tools/mcp", "--header", "x-ref-api-key:$REF_API_KEY"],
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with bunx (should fall back to npx if bun not available) - with timeout
    run_test "Initialize stdio server (bunx fallback)" \
        "timeout 60 $TMCP_CMD --configpath mcp-stdio-bunx.json init" \
        "Initialization complete|Generated tools configuration"

    # Test 8: Test stdio server error handling
    log_info "Testing stdio server error handling..."
    cat > mcp-stdio-invalid.json << EOF
{
  "mcpServers": {
    "invalid": {
      "command": "non-existent-command",
      "args": ["some", "args"],
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with invalid stdio command - with timeout
    run_test_expect_failure "Initialize stdio server (invalid command)" \
        "timeout 30 $TMCP_CMD --configpath mcp-stdio-invalid.json init" \
        "Failed to connect|Error|Command not found|No such file"

    # Test 9: Test mixed HTTP and stdio servers
    log_info "Testing mixed HTTP and stdio servers..."
    cat > mcp-mixed.json << EOF
{
  "mcpServers": {
    "context7": {
      "url": "$CONTEXT7_URL"
    },
    "ref": {
      "command": "npx",
      "args": ["mcp-remote@0.1.0-0", "https://api.ref.tools/mcp", "--header", "x-ref-api-key:$REF_API_KEY"],
      "env": {},
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with mixed server types - with timeout
    run_test "Initialize mixed HTTP and stdio servers" \
        "timeout 90 $TMCP_CMD --configpath mcp-mixed.json init" \
        "Initialization complete|Generated tools configuration"

    # Test that both server types are discovered
    if [[ -f "terminal-mcp/tools.json" ]]; then
        run_test "Mixed servers: context7 tools discovered" \
            "jq '.mcpTools | keys[]' terminal-mcp/tools.json" \
            "context7__"

        run_test "Mixed servers: ref tools discovered" \
            "jq '.mcpTools | keys[]' terminal-mcp/tools.json" \
            "ref__"
    fi

    # Test 10: Test stdio server configuration validation
    log_info "Testing stdio server configuration validation..."
    cat > mcp-stdio-invalid-config.json << EOF
{
  "mcpServers": {
    "invalid": {
      "command": "",
      "type": "stdio"
    }
  }
}
EOF

    # Test initialization with invalid stdio configuration - with timeout
    run_test_expect_failure "Initialize stdio server (empty command)" \
        "timeout 30 $TMCP_CMD --configpath mcp-stdio-invalid-config.json init" \
        "Invalid configuration|Command not found|Empty command"

    # Test 11: Test that agent binary works with stdio servers
    log_info "Testing agent binary with stdio servers..."

    # Copy stdio config to default location for agent testing
    if [[ -f "terminal-mcp/tools.json" ]]; then
        # Backup existing config
        [[ -f "terminal-mcp/servers.json" ]] && cp "terminal-mcp/servers.json" "terminal-mcp/servers.json.backup"

        # Copy stdio config to default location
        cp mcp-stdio-args.json mcp.json
        timeout 60 "$TMCP_CMD" init > /dev/null 2>&1 || true

        run_test "Agent works with stdio server config" \
            "$TMCP_AGENT_CMD list" \
            '"configured_tools".*"total_count"|No tools configuration found"'

        # Test agent can call stdio server tools
        if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
            run_test "Agent can call stdio server tool ($ref_tool)" \
                "timeout 60 $TMCP_AGENT_CMD call $ref_tool '{\"query\": \"React hooks\", \"keyWords\": [\"React\", \"hooks\"]}'" \
                '"content"|"result"|"data"|Tool.*not found"'
        fi

        # Restore original config
        [[ -f "terminal-mcp/servers.json.backup" ]] && mv "terminal-mcp/servers.json.backup" "terminal-mcp/servers.json"
    fi

    # Test 12: Test stdio server timeout and interrupt handling
    log_info "Testing stdio server timeout handling..."

    # Test that stdio server calls can be interrupted/timeout properly
    # This tests the cleanup mechanism when a call is interrupted
    if [[ -n "$ref_tool" && "$ref_tool" != "null" ]]; then
        # Start a call in background and kill it after a short time
        timeout 5 "$TMCP_CMD" call "$ref_tool" '{"query": "test", "keyWords": ["test"]}' > /dev/null 2>&1 &
        local bg_pid=$!

        # Wait a moment then kill the background process
        sleep 1
        kill $bg_pid 2>/dev/null || true
        wait $bg_pid 2>/dev/null || true

        # Check that no stdio processes are left hanging
        sleep 2
        local hanging_processes=$(pgrep -f "mcp-remote" 2>/dev/null | wc -l)

        if [[ $hanging_processes -eq 0 ]]; then
            log_success "Stdio server interrupt cleanup working"
            ((TESTS_PASSED++))
        else
            log_error "Stdio server interrupt cleanup failed (processes still running)"
            ((TESTS_FAILED++))
        fi
        ((TESTS_RUN++))
    fi

    # Force cleanup any remaining processes before finishing
    log_info "Cleaning up any remaining stdio processes..."
    pkill -f "mcp-remote" 2>/dev/null || true
    sleep 1

    # Clean up test files
    rm -f mcp-stdio-basic.json mcp-stdio-args.json mcp-stdio-string.json mcp-stdio-env.json mcp-stdio-bunx.json mcp-stdio-invalid.json mcp-mixed.json mcp-stdio-invalid-config.json

    log_success "Stdio server functionality tests completed"
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
    log_info "Using tmcp-agent command: $TMCP_AGENT_CMD"

    # Set up cleanup trap
    trap cleanup_test_env EXIT INT TERM

    setup_test_env

    # Run test suites
    log_info "Running direct functionality tests..."
    test_direct_functionality
    log_info "Running configuration functionality tests..."
    test_configuration_functionality
    log_info "Running stdio server functionality tests..."
    test_stdio_functionality
    log_info "Running authenticated server tests..."
    test_authenticated_functionality
    log_info "Running custom headers tests..."
    test_custom_headers_functionality
    log_info "Running agent safety control tests..."
    test_agent_safety_controls
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