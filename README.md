# MCP CLI

A command-line tool for interacting with MCP (Model Context Protocol) Streamable-HTTP servers.

## Features

- 🚀 **Zero Dependencies**: Standalone executables that don't require Node.js or Bun to be installed
- 🌐 **Cross-Platform**: Works on macOS (Intel & Apple Silicon), Linux (x64 & ARM64)
- 📡 **Streaming Support**: Handles both JSON and Server-Sent Events responses
- ⚡ **Fast Startup**: Launches in under 100ms

## Installation

### Quick Install (Recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/your-username/mcp-cli/main/install.sh | bash
```

### Manual Installation

1. Download the appropriate binary for your platform from the [releases page](https://github.com/your-username/mcp-cli/releases)
2. Extract the archive: `tar -xzf mcp-cli-*.tar.gz`
3. Move to your PATH: `sudo mv mcp-cli-* /usr/local/bin/mcp-cli`
4. Make executable: `sudo chmod +x /usr/local/bin/mcp-cli`

### Available Platforms

- `mcp-cli-macos-arm64.tar.gz` - macOS Apple Silicon (M1/M2/M3)
- `mcp-cli-macos-x64.tar.gz` - macOS Intel
- `mcp-cli-linux-x64.tar.gz` - Linux x64
- `mcp-cli-linux-arm64.tar.gz` - Linux ARM64

## Usage

### Basic Commands

```bash
# List available tools from the server
mcp-cli tools

# Run a specific tool
mcp-cli run <tool-name> [arguments...]

# Use a custom endpoint
mcp-cli tools --endpoint=https://your-server.com/mcp
```

### Examples

```bash
# Connect to a local MCP server
mcp-cli tools --endpoint=http://localhost:8123/mcp

# Run a tool with arguments
mcp-cli run search-files "*.ts" --endpoint=http://localhost:8123/mcp
```

## Development

### Prerequisites

- [Bun](https://bun.sh) installed on your system

### Setup

```bash
git clone https://github.com/your-username/mcp-cli.git
cd mcp-cli
bun install
```

### Development Commands

```bash
# Run in development mode
bun run dev

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

Then in another terminal:
```bash
mcp-cli tools --endpoint=http://localhost:8123/mcp
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

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

