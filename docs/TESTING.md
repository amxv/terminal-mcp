# Terminal MCP Testing

This document describes the testing setup for terminal-mcp and how to run tests for regression checking.

## Test Scripts

### 1. Comprehensive Test Suite

**Command:** `bun run test`

**Script:** `scripts/test-runner.sh` → `scripts/test.sh`

**Description:** Runs a complete test suite that verifies all functionality:

- Direct server communication (`tmcp direct <url> list/call`)
- Configuration-based usage (`tmcp init`, `tmcp list`, `tmcp call`)
- Error handling and edge cases
- Help and usage commands

**Output:** Detailed test execution with individual test results (20 tests total)

**Duration:** ~10-15 seconds

### 2. Quick Regression Test (CI)

**Command:** `bun run test:ci`

**Script:** `scripts/ci-test.sh`

**Description:** Fast smoke tests for core functionality:

- Build verification
- Basic direct functionality
- Basic configuration functionality

**Output:** Simple pass/fail indicators

**Duration:** ~5 seconds

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
# Full test suite
bun run test

# Quick regression check
bun run test:ci

# Manual test of specific functionality
./dist/terminal-mcp-macos-arm64 direct https://mcp.context7.com/mcp list
```

### Environment Variables

- `TMCP_CMD` - Override the tmcp binary path for testing

Example:
```bash
TMCP_CMD="/custom/path/to/tmcp" ./scripts/test.sh
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

## Adding New Tests

### To add a new test to the comprehensive suite:

1. Add test function to `scripts/test.sh`
2. Call the function from the appropriate test section
3. Use `run_test` for success tests or `run_test_expect_failure` for error tests

### To add a new test to the CI suite:

1. Add test commands to `scripts/ci-test.sh`
2. Follow the pattern of build → test → cleanup

## Test Environment

- **Isolation:** Each test run uses temporary directories
- **Cleanup:** Automatic cleanup on exit (including interrupts)
- **Cross-platform:** Tests work on macOS and Linux
- **No side effects:** Tests don't modify the project directory

## Future Enhancements

- [ ] Add authenticated server testing
- [ ] Add performance benchmarks
- [ ] Add integration tests with local MCP servers
- [ ] Add tests for custom headers and environment variables