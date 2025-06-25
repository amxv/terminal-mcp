# Direct Server Communication

For testing, exploration, or one-off interactions, you can communicate directly with MCP servers without any configuration files. This is particularly useful when you want to quickly test a server, explore its capabilities, or use tools from servers you don't want to add to your permanent configuration.

## Commands

### List Tools from a Server

To see what tools are available on any MCP server:

```bash
tmcp direct <server-url> list
```

This will connect to the server and display all available tools with their schemas and descriptions.

### Call Tools Directly

To call a specific tool on a server:

```bash
tmcp direct <server-url> call <tool-name> <json-params>
```

## Examples

### Basic Server Exploration

```bash
# List tools from Context7 MCP server
tmcp direct https://mcp.context7.com/mcp list

# List tools from a local development server
tmcp direct http://localhost:8123/mcp list

# List tools from Ref.tools MCP server
tmcp direct http://api.ref.tools/mcp list
```

### Tool Usage Examples

```bash
# Call a tool on Context7 server
tmcp direct https://mcp.context7.com/mcp call resolve-library-id '{"libraryName": "react"}'

# Call a tool with more complex parameters
tmcp direct https://mcp.context7.com/mcp call get-library-docs '{"context7CompatibleLibraryID": "/facebook/react", "topic": "hooks"}'

# Call a local server tool
tmcp direct http://localhost:8123/mcp call search-files '{"pattern": "*.ts", "directory": "./src"}'

# Call a tool with authentication headers (if needed)
tmcp direct http://api.ref.tools/mcp call search-documentation '{"query": "Next.js routing"}'
```

### Testing and Development Workflows

```bash
# Quickly test if a server is running and responsive
tmcp direct http://localhost:8123/mcp list

# Explore a new MCP server's capabilities
tmcp direct https://new-mcp-server.com/mcp list

# Test tool calls during development
tmcp direct http://localhost:8123/mcp call my-custom-tool '{"param1": "value1"}'

# Compare tools between different servers
tmcp direct https://server1.com/mcp list
tmcp direct https://server2.com/mcp list
```

## Authentication

If a server requires authentication, you'll need to use configuration-based usage instead of direct communication, as the direct mode doesn't support custom headers or authentication. However, many public MCP servers can be accessed directly without authentication.

For servers requiring authentication:
1. Create a configuration file with the necessary headers/API keys
2. Use `tmcp init` to set up the configuration
3. Use `tmcp call` with tool aliases instead

## Error Handling

Direct server communication will show clear error messages if:
- The server is unreachable
- The tool name doesn't exist
- Invalid JSON parameters are provided
- The server returns an error response

Example error scenarios:
```bash
# Server not reachable
tmcp direct http://nonexistent-server.com/mcp list
# Output: Error connecting to server...

# Tool doesn't exist
tmcp direct https://mcp.context7.com/mcp call nonexistent-tool '{}'
# Output: Tool 'nonexistent-tool' not found...

# Invalid JSON
tmcp direct https://mcp.context7.com/mcp call resolve-library-id 'invalid-json'
# Output: Invalid JSON parameters...
```

## When to Use Direct vs Configuration-Based

### Use Direct Communication When:
- Testing a new MCP server
- Quick one-off tool calls
- Exploring server capabilities
- Development and debugging
- Servers that don't require authentication

### Use Configuration-Based When:
- Regular workflow integration
- Servers requiring authentication
- Multiple servers in your project
- Tools you use frequently
- Team collaboration (shared config files)

## Performance Considerations

Direct communication has a slight overhead compared to configuration-based usage because:
- Tool discovery happens on each call
- No local caching of tool schemas
- No pre-established server connections

For frequent usage, configuration-based approach with `tmcp init` and tool aliases is more efficient.