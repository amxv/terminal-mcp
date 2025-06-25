# Development Guide

## Development

### Prerequisites

- [Bun](https://bun.sh) installed on your system

### Setup

```bash
git clone https://github.com/zueai/terminal-mcp.git
cd terminal-mcp
bun install
```

### Development Commands

```bash
# Run in development mode
bun run dev

# Run with CLI flags in development
bun run src/cli.ts --help
bun run src/cli.ts --version
bun run src/cli.ts --debug init

# Build for all platforms
bun run build

# Build for specific platform
bun run build:macos-arm64
bun run build:linux-x64

# Clean build artifacts
bun run clean
```

### Testing Against Reference Server

You can test against the reference MCP server:

```bash
git clone https://github.com/invariantlabs-ai/mcp-streamable-http
cd mcp-streamable-http/typescript-example/server
bun install && bun run build && bun run start
```

Then you can use either approach:

**Configuration-based approach:**
```bash
# Create mcp.json
echo '{
  "mcpServers": {
    "local": {
      "url": "http://localhost:8123/mcp"
    }
  }
}' > mcp.json

# Initialize and use
tmcp init
tmcp list
```

**Direct communication approach:**
```bash
# No configuration needed
tmcp direct http://localhost:8123/mcp list
tmcp direct http://localhost:8123/mcp call <tool-name> <json-params>
```

## How It Works

This CLI tool implements the MCP Streamable-HTTP protocol:

1. **JSON-RPC 2.0**: Each command sends a JSON-RPC request to the server
2. **Dual Response Modes**: Servers can respond with either:
   - `application/json` for immediate responses
   - `text/event-stream` for streaming responses via Server-Sent Events
3. **Standalone Execution**: The binary includes the Bun runtime and all dependencies

## Protocol Details

The tool sends HTTP POST requests with JSON-RPC 2.0 payloads:

```json
{
  "jsonrpc": "2.0",
  "id": "unique-request-id",
  "method": "listTools",
  "params": {}
}
```

Servers respond with either:
- Immediate JSON response
- Streaming SSE events with `data:` prefixed JSON payloads

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request