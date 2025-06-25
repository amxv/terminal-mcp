# Terminal MCP Testing

This document describes the testing setup for terminal-mcp and how to run tests for regression checking.

## Test Scripts

### 1. Comprehensive Test Suite

**Command:** `bun run test`

**Script:** `scripts/test-runner.sh` → `scripts/test.sh`

**Description:** Runs a complete test suite that verifies all functionality:

- Direct server communication (`tmcp direct <url> list/call`)
- Configuration-based usage (`tmcp init`, `tmcp list`, `tmcp call`)
- Agent safety controls (agent binary restrictions)
- Error handling and edge cases
- Help and usage commands

**Output:** Detailed test execution with individual test results (~30 tests total)

**Duration:** ~15-20 seconds

### 2. Quick Regression Test (CI)

**Command:** `bun run test:ci`

**Script:** `scripts/ci-test.sh`

**Description:** Fast smoke tests for core functionality:

- Build verification (both main and agent binaries)
- Basic direct functionality
- Basic configuration functionality
- Agent safety control verification

**Output:** Simple pass/fail indicators

**Duration:** ~8 seconds

## Test Server

**Server Used:** [Context7 MCP Server](https://mcp.context7.com/mcp)

- **URL:** `https://mcp.context7.com/mcp`
- **Authentication:** None required (unauthenticated)
- **Available Tools:**
  - `resolve-library-id` - Resolves library names to Context7 IDs
  - `get-library-docs` - Fetches documentation for libraries

## Test Coverage

### Direct Functionality Tests
- ✅ List tools from server
- ✅ Call tools with valid parameters
- ✅ Error handling for invalid tools
- ✅ Error handling for invalid URLs
- ✅ Error handling for invalid JSON
- ✅ Error handling for missing arguments

### Configuration-Based Tests
- ✅ Initialize configuration from mcp.json
- ✅ List configured tools
- ✅ Call tools using aliases
- ✅ Error handling for missing configuration
- ✅ Error handling for invalid tool aliases
- ✅ Error handling for invalid JSON parameters

### Agent Safety Control Tests
- ✅ Agent binary blocks `init` command
- ✅ Agent binary blocks `direct` command
- ✅ Agent binary blocks `--configpath` option
- ✅ Agent binary allows `list` command
- ✅ Agent binary allows `call` command
- ✅ Agent binary allows `--help` and `--version`
- ✅ Agent binary provides helpful error messages
- ✅ Agent binary requires proper configuration

### Error Condition Tests
- ✅ Commands without configuration
- ✅ Commands with missing files
- ✅ Invalid command handling

### Help and Usage Tests
- ✅ Help command display
- ✅ Invalid command error messages

## Running Tests

### Prerequisites

1. [Bun](https://bun.sh) installed
2. Internet connection (for Context7 server access)

### Quick Start

```bash
# Full test suite (includes agent safety tests)
bun run test

# Quick regression check
bun run test:ci

# Manual test of specific functionality
./dist/terminal-mcp-macos-arm64 direct https://mcp.context7.com/mcp list
./dist/terminal-mcp-agent-macos-arm64 list
```

### Environment Variables

- `TMCP_CMD` - Override the tmcp binary path for testing
- `TMCP_AGENT_CMD` - Override the tmcp agent binary path for testing

Example:
```bash
TMCP_CMD="/custom/path/to/tmcp" TMCP_AGENT_CMD="/custom/path/to/tmcp-agent" ./scripts/test.sh
```

## Test Structure

```
scripts/
├── test-runner.sh     # Main test runner (builds + runs tests)
├── test.sh           # Comprehensive test suite
└── ci-test.sh        # Quick regression tests
```

### Test Output Format

**Comprehensive Tests:**
```
[INFO] Running test: Test name
[PASS] Test name
[FAIL] Test name - Error details
```

**CI Tests:**
```
✓ Feature works
✗ Feature failed
```

## Agent Safety Controls

The test suite includes specific tests to verify that the agent binary (`terminal-mcp-agent`) implements proper security restrictions:

### Security Boundaries Tested

**🚫 Blocked Operations:**
- `tmcp init` - Cannot modify tool configurations
- `tmcp direct <url> <command>` - Cannot bypass pre-configured servers
- `--configpath <path>` - Cannot switch to different config files
- Unknown commands - Proper error handling

**✅ Allowed Operations:**
- `tmcp list` - View configured and enabled tools
- `tmcp call <tool-alias> <params>` - Execute specific tools
- `tmcp --help` - Show usage information
- `tmcp --version` - Show version information

### Test Methodology

1. **Positive Tests:** Verify agent binary accepts safe commands
2. **Negative Tests:** Verify agent binary rejects dangerous commands
3. **Error Message Tests:** Verify proper error messages for blocked operations
4. **Configuration Tests:** Verify agent requires proper configuration files

## Adding New Tests

### To add a new test to the comprehensive suite:

1. Add test function to `scripts/test.sh`
2. Call the function from the appropriate test section
3. Use `run_test` for success tests or `run_test_expect_failure` for error tests

### To add a new agent safety test:

1. Add test to `test_agent_safety_controls()` function in `scripts/test.sh`
2. Use `run_test_expect_failure` for blocked operations
3. Use `run_test` for allowed operations
4. Update CI tests in `scripts/ci-test.sh` if needed

### To add a new test to the CI suite:

1. Add test commands to `scripts/ci-test.sh`
2. Follow the pattern of build → test → cleanup

## Test Environment

- **Isolation:** Each test run uses temporary directories
- **Cleanup:** Automatic cleanup on exit (including interrupts)
- **Cross-platform:** Tests work on macOS and Linux
- **No side effects:** Tests don't modify the project directory
- **Dual Binary Testing:** Tests both main and agent binaries

## Future Enhancements

- [ ] Add authenticated server testing
- [ ] Add performance benchmarks
- [ ] Add integration tests with local MCP servers
- [ ] Add tests for custom headers and environment variables
- [ ] Add tests for agent binary installation scripts