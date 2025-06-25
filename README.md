# terminal-mcp

A minimal command-line MCP client that makes it easy to call tools from remote (Streamable HTTP) MCP servers using terminal commands. This project was created to add MCP support for coding agents like OpenAI's Codex.

The CLI supports both configuration-based usage for project workflows and direct server communication for testing and one-off interactions.

## Features

- 🚀 **Zero Dependencies**: Standalone executables that don't require Node.js, Bun, or any other runtime to be installed
- 🌐 **Cross-Platform**: Works on macOS (Intel & Apple Silicon), Linux (x64 & ARM64)
- 📡 **Streaming Support**: Handles both JSON and Server-Sent Events responses
- ⚡ **Fast Startup**: Launches in under 100ms
- 🔧 **Configuration-Based**: Support for `mcp.json` configuration files with tool aliases
- 🔐 **Authentication**: Support for custom headers and environment variables
- 🛠️ **Tool Discovery**: Automatic aggregation of tools from multiple MCP servers
- 🎯 **Direct Communication**: Connect to any MCP server without configuration

## Quick Start

**Step 1: Run the auto-install script**

```bash
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install.sh | bash
```

For detailed manual installation instructions, see: [Manual Installation Guide](docs/MANUAL_INSTALLATION.md)

**Step 2: Create MCP Config File**

If you already have a `./.cursor/mcp.json` or `./mcp.json` you can skip this step.

Create an MCP configuration file at `./terminal-mcp/servers.json` with your MCP servers in the following format:
```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp"
    },
    "ref": {
      "url": "http://api.ref.tools/mcp",
      "headers": {
        "x-ref-api-key": "your-api-key"
      }
    }
  }
}
```

### Supported Options

- **`url` or `serverUrl`**: The MCP server endpoint (both keys supported)
- **`headers`**: Custom HTTP headers to send with requests
- **`env`**: Environment variables to set before connecting (OAuth is currently not supported)

**Step 3: Initialize**

Run `tmcp init` to discover tools from your configured servers:
```bash
tmcp init
```

**Step 4: Start Using Tools**

List available tools and call them:
```bash
# See all available tools
tmcp list

# Call tools using server__tool-name format
tmcp call context7__resolve-library-id '{"libraryName": "react"}'
```

## Usage

### Command Line Options

The CLI supports several options that can be used with any command:

- **`-h, --help`**: Show help information and usage examples
- **`-v, --version`**: Display version information
- **`--debug`**: Enable detailed debug logging
- **`--configpath <path>`**: Specify a custom path for the MCP configuration file

Examples:
```bash
# Show help
tmcp --help
tmcp -h

# Show version
tmcp --version
tmcp -v

# Use custom config file
tmcp --configpath ./custom/mcp.json init
tmcp --configpath /path/to/config.json list

# Enable debug mode
tmcp --debug call tool-alias '{"param": "value"}'
```


## Commands

### `init` - Initialize Configuration

Discovers tools from your configured MCP servers and generates aliases.

```bash
# Use configuration from .cursor/mcp.json or mcp.json
tmcp init

# Use custom configuration file
tmcp --configpath /path/to/config.json init
```

**Generated Files:**

After running `tmcp init`, the following files are created in `./terminal-mcp/`:

- **`servers.json`**: Copy of your MCP server configuration
- **`tools.json`**: Aggregated tool information with schemas and examples

Example `tools.json` structure:
```json
{
  "mcpTools": {
    "context7__resolve-library-id": {
      "example_terminal_command": "tmcp call context7__resolve-library-id '<json-string-args>'",
      "enabled": true,
      "description": "Resolves a package/product name to a Context7-compatible library ID",
      "json_tool_schema": {
        "type": "object",
        "properties": {
          "libraryName": {
            "type": "string",
            "description": "Library name to search for"
          }
        },
        "required": ["libraryName"]
      }
    }
  }
}
```

### `list` - Show Available Tools

Displays all configured tools with their schemas and example usage.

```bash
# List all tools from configured servers
tmcp list

# List with custom config
tmcp --configpath ./config/mcp.json list
```

### `call` - Execute Tools

Call tools using their generated aliases (format: `server__tool-name`).

```bash
# Call a tool with JSON parameters
tmcp call context7__resolve-library-id '{"libraryName": "react"}'

# Call with debug output
tmcp --debug call ref__search-documentation '{"query": "React hooks"}'
```

### `direct` - Direct Server Communication

Communicate with MCP servers directly without configuration files.

```bash
# List tools from any server
tmcp direct https://mcp.context7.com/mcp list

# Call tools directly using original names
tmcp direct https://mcp.context7.com/mcp call resolve-library-id '{"libraryName": "react"}'
```

For detailed examples and advanced usage, see: [Direct Communication Guide](docs/DIRECT_COMMUNICATION.md)

## Documentation

- 📖 [Development Guide](docs/DEVELOPMENT.md) - Setup, development commands, and contributing guidelines
- 🔧 [Manual Installation](docs/MANUAL_INSTALLATION.md) - Detailed installation instructions for all platforms
- 🌐 [Direct Communication](docs/DIRECT_COMMUNICATION.md) - Using MCP servers without configuration files

## License

MIT

