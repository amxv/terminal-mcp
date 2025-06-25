# terminal-mcp

A minimal, zero-dependency terminal-based MCP client that makes it easy to call tools from MCP servers (both remote HTTP and local stdio) using terminal commands.

This project was created to add MCP support for coding agents that do not currently support MCP, such as OpenAI's Codex Cloud SWE Agent.

## Features

- 🚀 **Zero Dependencies**: Standalone executable that doesn't require Node.js, Python, or any other runtime to be installed
- 🌐 **Cross-Platform**: Works on Linux (x64 & ARM64) and macOS (Intel & Apple Silicon)
- 📡 **Streaming Support**: Handles both JSON and Server-Sent Events responses
- ⚡ **Fast Startup**: Launches in under 100ms
- 🔧 **Configuration-Based**: Support for `mcp.json` configuration files with tool aliases (see [servers.json](./terminal-mcp/servers.json) for an example)
- 🔐 **Authentication**: Support for custom headers and environment variables
- 🛠️ **Tool Discovery**: Automatic aggregation of tools from multiple MCP servers (see [tools.json](./terminal-mcp/tools.json) for an example)
- 🎯 **Direct Communication**: Connect to any MCP server without configuration

---

## Quick Start

### Step 1: Run the auto-install script

```bash
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install.sh | bash
```

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

Run `tmcp init` to discover tools from all configured servers and create the `tools.json` file:
```bash
tmcp init
```

This will create a `terminal-mcp/tools.json` file with the following structure:
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

Edit the generated `./terminal-mcp/tools.json` file to disable any tools you don't want available to AI agents by setting `enabled: false`.

### Step 5: Start Using Tools

List available tools and call them:
```bash
# See all available tools (only shows enabled tools)
tmcp list

# Call tools using server__tool-name format
tmcp call context7__resolve-library-id '{"libraryName": "react"}'
```

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

## How to Set Up with OpenAI Codex

OpenAI Codex Cloud SWE Agent can use terminal-mcp to access MCP tools. Here's how to set it up:

### 1. Configure Your Tools (One-Time Setup)

Follow the Quick Start guide steps 1-4 to decide which tools to make available to Codex:

1. Install terminal-mcp using the auto-install script
2. Create your MCP configuration file (`servers.json`)
3. Run `tmcp init` to discover all available tools and create `tools.json`
4. Edit `tools.json` to disable any tools you don't want Codex to use (set `enabled: false`)

### 2. Commit Configuration to Version Control

Once you have your `tools.json` configured, commit the entire `terminal-mcp/` folder to your repository:

```bash
git add terminal-mcp/
git commit -m "Add terminal-mcp configuration and allowed tools"
```

### 3. Add Installation to Setup Script

Add the terminal-mcp installation command to your setup script that runs for every Codex task:

```bash
# Add this line to your setup script
curl -fsSL https://raw.githubusercontent.com/zueai/terminal-mcp/main/install.sh | bash
```

### 4. Update Your agents.md File

Add instructions to your `agents.md` file explaining how Codex should use the MCP tools. Here's an example prompt you can add:

````markdown
## MCP Tools Available

You have access to MCP (Model Context Protocol) tools via the `tmcp` command. These tools allow you to:
- Search documentation and code repositories
- Access various APIs and services
- Perform specialized tasks

### How to Use MCP Tools

1. **List available tools**: Run `tmcp list` to see all available tools with their descriptions and parameters
2. **Call a tool**: Use `tmcp call <tool-name> '<json-parameters>'`

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
- Check `tmcp list` output for exact parameter names and types for each tool
- Only enabled tools will be shown in `tmcp list` output
````

That's it! Codex will now be able to use the MCP tools you've configured whenever it needs to access external APIs, search documentation, or perform specialized tasks.

---

## Documentation

- 📖 [Development Guide](docs/DEVELOPMENT.md) - Setup, development commands, and contributing guidelines
- 🔧 [Manual Installation](docs/MANUAL_INSTALLATION.md) - Detailed installation instructions for all platforms
- 🌐 [Direct Communication](docs/DIRECT_COMMUNICATION.md) - Using MCP servers without configuration files

---

## License

MIT

