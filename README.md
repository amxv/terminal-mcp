# terminal-mcp

## A minimal, zero-dependency terminal MCP client built for coding agents.

---
This project was created to provide coding agents access to local and remote MCP servers, such as OpenAI's Codex Cloud SWE Agent.

## Features

- 🚀 **Zero Dependencies**: Standalone executable that doesn't require Node.js, Python, or any other runtime to be installed
- 🌐 **Cross-Platform**: Works on Linux (x64 & ARM64) and macOS (Intel & Apple Silicon)
- ⚡ **Fast Startup**: Launches in under 100ms
- 🔧 **Configuration-Based**: Support for common `mcp.json` configuration files (such as Cursor's mcp.json).
- 🔐 **Authentication**: Support for custom headers and environment variables
- 🎯 **Direct Communication**: Connect to any MCP server without configuration
- 📦 **Agent-Safe Binary**: Zero risk of config changes or bypassing security controls because your agent literally gets a different binary that allows listing and calling pre-configured tools.

---

## Quick Start for Devs

### Step 1: Install the Full Developer Version

Run the auto-install script to install the developer version of `tmcp` for your OS (Mac/Linux) with full control:

```bash
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install.sh | bash
```

**Note:** This installs the complete developer version that includes `init`, `direct`, and configuration management commands.

Your agent will use a different install script to install the agent-safe binary that only allows safe operations. See [AI Agent Setup](#ai-agent-setup) below.

For detailed manual installation instructions, see: [Manual Installation Guide](docs/MANUAL_INSTALLATION.md)

### Step 2: Create MCP Config JSON file (Optional)

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

**Supported Options**

- **`url` or `serverUrl`**: The MCP server endpoint
- **`headers`**: Custom HTTP headers to send with requests
- **`env`**: Environment variables to set before connecting (OAuth is currently not supported)

### Step 3: Initialize and Discover Tools

Run this command to parse your MCP config and create a `tools.json` file with all tools from all servers in your config:
```bash
tmcp init
```

This will create `terminal-mcp/tools.json` file with the following structure:
```json
{
  "mcpTools": {
    "context7__resolve-library-id": {
      "enabled": true,
      "example_terminal_command": "tmcp call context7__resolve-library-id '<json-string-args>'",
      "description": "Finds the Context7 library ID for a package",
      "parameters": { ... }
    }
  }
}
```

### Step 4: Disable Tools (Optional)

Edit the generated `./terminal-mcp/tools.json` file to disable tools you don't want your agent to use by setting `enabled: false`.

### Step 5: Modify your Agent's Instructions File

For example, OpenAI's Codex Cloud SWE Agent uses `AGENTS.md` to understand how to work with your codebase. Here's an example prompt you can add:

````markdown
## Using MCP Tools

You have access to MCP (Model Context Protocol) tools via the `tmcp` CLI. These tools allow you to:

- Search documentation and code repositories
- Access various APIs and services
- Perform specialized tasks

### How to Use MCP Tools

1. **List available tools**: Run `tmcp list` to see all available tools with their descriptions and parameters
2. **Call a tool**: Use `tmcp call <tool-name> '<json-parameters>'`

### Available Tools

<describe the tools here to help your agent understand what they can do and when to use them>

### Example Usage

```bash
# List all available tools
tmcp list

# Search documentation (example with ref tool)
tmcp call ref__search-documentation '{"query": "React useState hook examples"}'

# Resolve a library ID (example with context7 tool)
tmcp call context7__resolve-library-id '{"libraryName": "express"}'
```

### Important Notes

- Tool names use the format `server__tool-name` (double underscore)
- Parameters must be valid JSON strings
- Use single quotes around the JSON parameter string
- Check `tmcp list` output for exact parameter names and types for each tool.
````

### Step 6: Install the agent version of the terminal-mcp CLI

Add this install command to your agent's setup script that will be run before every task:

```bash
# Add this line to your setup script (agent-safe version)
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install-agent.sh | bash
```

In Codex, you can add this in the `Setup Script` section when configuring your environment.

---

### What's Different in the Agent Version?

The agent version is a separate, security-focused binary that:

**✅ Allows Only Safe Operations:**
- `tmcp list` - View configured and enabled tools
- `tmcp call <tool-alias> <params>` - Execute specific tools

**🚫 Blocks Developer Operations:**
- `tmcp init` - Cannot modify tool configurations
- `tmcp direct` - Cannot bypass pre-configured servers
- `--configpath` - Cannot switch to different config files

**🔒 Security Benefits:**
- Agents can only use tools you've explicitly enabled
- No way to discover or access unauthorized servers
- Cannot modify which tools are available
- Smaller binary footprint with only essential features

This ensures AI agents stay within the boundaries you've set as a developer while still having full access to the tools they need to be productive.

---

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

---

## Commands

### `init` - Initialize Configuration

Discovers tools from your configured MCP servers and generates tools.json with all available tools.

```bash
# Use configuration from .cursor/mcp.json or mcp.json
tmcp init

# Use custom configuration file
tmcp --configpath /path/to/config.json init
```

### `list` - Show Available Tools

Displays all enabled tools with their schemas and example usage. Disabled tools are automatically filtered out.

```bash
# List all enabled tools from configured servers
tmcp list

# List with custom config
tmcp --configpath ./config/mcp.json list
```

### `call` - Execute Tools

Call tools using their generated aliases (format: `server__tool-name`). Only enabled tools can be called.

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

---

## Documentation

- 📖 [Development Guide](docs/DEVELOPMENT.md) - Setup, development commands, and contributing guidelines
- 🔧 [Manual Installation](docs/MANUAL_INSTALLATION.md) - Detailed installation instructions for all platforms
- 🌐 [Direct Communication](docs/DIRECT_COMMUNICATION.md) - Using MCP servers without configuration files

---

## License

MIT

