import { loadToolsConfig, loadMcpConfig, findMcpConfig, ToolsConfig } from "./config";
import { createClient, createClientFromUrl, createEphemeralClient } from "./client";
import { safeConsoleLog } from "./cli-common";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Extract server alias from endpoint URL by matching against configured servers
 */
function getServerAliasFromEndpoint(endpoint: string): string | null {
  const mcpConfig = loadMcpConfig();
  if (!mcpConfig) {
    return null;
  }

  // Try to find a matching server configuration
  for (const [serverAlias, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
    const serverUrl = serverConfig.url || serverConfig.serverUrl;
    if (serverUrl === endpoint) {
      return serverAlias;
    }
  }

  // If no exact match, try to extract a reasonable alias from the URL
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname;

    // Extract meaningful parts from hostname
    if (hostname.includes('context7')) return 'context7';
    if (hostname.includes('ref.tools') || hostname.includes('api.ref')) return 'ref';
    if (hostname.includes('deepwiki')) return 'deepwiki';

    // Fallback: use the first part of the hostname
    const parts = hostname.split('.');
    return parts[0] || 'server';
  } catch (error) {
    return 'server';
  }
}

/**
 * Enhanced error information for tool calls
 */
interface ToolCallError {
  message: string;
  type: 'connection' | 'http' | 'protocol' | 'timeout' | 'authentication' | 'rate_limit' | 'server_error' | 'tool_error' | 'unknown';
  httpStatus?: number;
  responseBody?: string;
  headers?: Record<string, string>;
  toolName?: string;
  originalError: any;
}

/**
 * Extract detailed error information from tool call errors
 */
function extractToolCallErrorDetails(error: any, toolName?: string): ToolCallError {
  const details: ToolCallError = {
    message: error.message || 'Unknown error',
    type: 'unknown',
    toolName,
    originalError: error
  };

    // Check for HTTP-related errors
  if (error.response) {
    details.httpStatus = error.response.status;
    details.responseBody = error.response.data || error.response.text;
    details.headers = error.response.headers;
  } else if (error.message?.includes('HTTP')) {
    // Extract HTTP status from error message (MCP SDK specific)
    const httpMatch = error.message.match(/HTTP (\d+)/);
    if (httpMatch) {
      details.httpStatus = parseInt(httpMatch[1]);
      // Extract response body if present
      const bodyMatch = error.message.match(/: (.+)$/);
      if (bodyMatch) {
        details.responseBody = bodyMatch[1];
      }
    }
  }

  // Categorize based on HTTP status (check both error.response.status and extracted status)
  const statusCode = details.httpStatus;
  if (statusCode) {
    // Categorize by HTTP status code
    if (statusCode === 401) {
      details.type = 'authentication';
      details.message = `Authentication failed when calling tool (HTTP ${statusCode}): ${details.message}`;
    } else if (statusCode === 429) {
      details.type = 'rate_limit';
      details.message = `Rate limited when calling tool (HTTP ${statusCode}): ${details.message}`;

      const retryAfter = error.response?.headers?.['retry-after'];
      if (retryAfter) {
        details.message += ` - Retry after ${retryAfter} seconds`;
      }
    } else if (statusCode >= 500) {
      details.type = 'server_error';
      details.message = `Server error when calling tool (HTTP ${statusCode}): ${details.message}`;
    } else if (statusCode >= 400) {
      details.type = 'http';
      details.message = `Client error when calling tool (HTTP ${statusCode}): ${details.message}`;
    }
  } else if (error.request) {
    details.type = 'connection';
    if (error.code === 'ECONNREFUSED') {
      details.message = `Connection refused when calling tool - Is the server running?`;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      details.type = 'timeout';
      details.message = `Network timeout when calling tool`;
    } else if (error.code === 'ECONNRESET') {
      details.message = `Connection reset by server when calling tool`;
    } else {
      details.message = `Network error when calling tool: ${error.message} (${error.code || 'unknown code'})`;
    }
  } else if (error.code === 'ConnectionRefused' || error.message?.includes('Unable to connect')) {
    // Bun-specific connection errors
    details.type = 'connection';
    if (error.message?.includes('Unable to connect')) {
      details.message = `Connection failed when calling tool ${toolName || 'unknown'} - ${error.message}`;
    } else if (error.code === 'ConnectionRefused') {
      details.message = `Connection refused when calling tool ${toolName || 'unknown'} to ${error.path || 'server'} - ${error.message || 'Port may not be listening'}`;
    }
  } else if (error.message?.includes('getaddrinfo') || error.message?.toLowerCase().includes('dns')) {
    // DNS resolution errors (Bun-specific)
    details.type = 'connection';
    details.message = `DNS resolution failed when calling tool ${toolName || 'unknown'} - ${error.message}`;
  } else if (error.name === 'AbortError') {
    details.type = 'timeout';
    details.message = 'Tool call timed out or was aborted';
  } else if (error.message?.includes('JSON-RPC')) {
    details.type = 'protocol';
    details.message = `Protocol error when calling tool: ${error.message}`;
  } else if (error.message?.includes('Tool not found') || error.message?.includes('Method not found')) {
    details.type = 'tool_error';
    details.message = `Tool '${toolName}' not found or not available`;
  } else if (error.message?.includes('Invalid params') || error.message?.includes('Invalid arguments')) {
    details.type = 'tool_error';
    details.message = `Invalid arguments provided to tool '${toolName}': ${error.message}`;
  }

  // Check for MCP-specific error codes
  if (error.code) {
    switch (error.code) {
      case -32601:
        details.type = 'tool_error';
        details.message = `Tool '${toolName}' not found`;
        break;
      case -32602:
        details.type = 'tool_error';
        details.message = `Invalid parameters for tool '${toolName}': ${error.message}`;
        break;
      case -32603:
        details.type = 'server_error';
        details.message = `Internal server error when calling tool '${toolName}': ${error.message}`;
        break;
    }
  }

  // Extract additional details from MCP SDK errors
  if (error.data) {
    try {
      const errorData = typeof error.data === 'string' ? JSON.parse(error.data) : error.data;
      if (errorData.error) {
        details.message += ` - ${errorData.error.message || errorData.error}`;
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
  }

  return details;
}

/**
 * Display detailed tool call error information
 */
function displayToolCallError(details: ToolCallError, debugLog: (message: string, ...args: any[]) => void) {
  console.error(`❌ Tool Call Error [${details.type.toUpperCase()}]: ${details.message}`);

  if (details.toolName) {
    console.error(`🔧 Tool: ${details.toolName}`);
  }

  if (details.httpStatus) {
    console.error(`📊 HTTP Status: ${details.httpStatus}`);
  }

  if (details.headers && Object.keys(details.headers).length > 0) {
    console.error(`📋 Response Headers:`, details.headers);
  }

  if (details.responseBody) {
    console.error(`📄 Response Body: ${details.responseBody.substring(0, 500)}${details.responseBody.length > 500 ? '...' : ''}`);
  }

  // Provide helpful suggestions based on error type
  switch (details.type) {
    case 'rate_limit':
      console.error(`💡 Suggestion: Tool calls are being rate limited. Wait before retrying, or check if you need an API key.`);
      break;
    case 'authentication':
      console.error(`💡 Suggestion: Check your API key, headers, or authentication configuration for the MCP server.`);
      break;
    case 'connection':
      console.error(`💡 Suggestion: The MCP server connection was lost. Verify the server is running and accessible.`);
      break;
    case 'timeout':
      console.error(`💡 Suggestion: The tool call timed out. Check your network connection or try again later.`);
      break;
    case 'server_error':
      console.error(`💡 Suggestion: The MCP server encountered an internal error. Try again later.`);
      break;
    case 'tool_error':
      console.error(`💡 Suggestion: Check the tool name and arguments. Run 'tmcp list' to see available tools.`);
      break;
  }

  // Log the full error details in debug mode
  debugLog("Full tool call error details:", details);
}

/**
 * List all configured tools from the tools configuration
 */
export async function listConfiguredTools(debugLog: (message: string, ...args: any[]) => void, customConfigPath?: string) {
  debugLog("Listing configured tools...");

  // Load tools configuration
  const toolsConfig = loadToolsConfig();
  if (!toolsConfig) {
    console.error("❌ No tools configuration found. Run 'tmcp init' first.");
    process.exit(1);
  }

  const tools = Object.entries(toolsConfig.mcpTools)
    .filter(([_, toolInfo]) => toolInfo.enabled)
    .map(([alias, toolInfo]) => ({
      alias,
      description: toolInfo.description,
      example_command: toolInfo.example_terminal_command,
      parameters: toolInfo.parameters
    }));

  if (tools.length === 0) {
    console.log("No tools configured. Run 'tmcp init' to discover tools from your MCP servers.");
    return;
  }

  const result = {
    configured_tools: tools,
    total_count: tools.length
  };

  safeConsoleLog(result);
}

/**
 * List tools directly from an MCP server URL
 */
export async function listToolsDirect(endpoint: string, debugLog: (message: string, ...args: any[]) => void, headers?: Record<string, string>) {
  debugLog("Listing tools directly from endpoint:", endpoint);

  const client = await createClientFromUrl(endpoint, debugLog, headers);

  try {
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.tools || [];

    // Get server alias for consistent naming
    const serverAlias = getServerAliasFromEndpoint(endpoint);
    debugLog("Server alias for endpoint:", serverAlias);

    // Check if we have tools configuration to filter disabled tools
    const toolsConfig = loadToolsConfig();
    let filteredTools = tools;

    if (toolsConfig) {
      debugLog("Tools configuration found, filtering by enabled status");
      filteredTools = tools.filter(tool => {
        // Create the expected alias format
        const expectedAlias = serverAlias ? `${serverAlias}__${tool.name}` : tool.name;

        // Try to find this tool in our configuration
        const toolInfo = toolsConfig.mcpTools[expectedAlias];
        if (toolInfo) {
          debugLog(`Found ${tool.name} in config as ${expectedAlias}, enabled: ${toolInfo.enabled}`);
          return toolInfo.enabled;
        }

        // Also try without server prefix for backwards compatibility
        const toolInfoDirect = toolsConfig.mcpTools[tool.name];
        if (toolInfoDirect) {
          debugLog(`Found ${tool.name} in config (direct), enabled: ${toolInfoDirect.enabled}`);
          return toolInfoDirect.enabled;
        }

        // If not found in config, allow it (for tools not yet discovered)
        debugLog(`Tool ${tool.name} not found in config, allowing`);
        return true;
      });
    } else {
      debugLog("No tools configuration found, showing all tools");
    }

    const result = {
      endpoint,
      tools: filteredTools.map(tool => ({
        name: serverAlias ? `${serverAlias}__${tool.name}` : tool.name,
        original_name: tool.name,
        description: tool.description || "No description available",
        schema: tool.inputSchema || { type: "object", properties: {} }
      })),
      total_count: filteredTools.length,
      ...(toolsConfig && {
        note: "Tools filtered by configuration. Disabled tools are hidden.",
        total_available: tools.length
      })
    };

    safeConsoleLog(result);
  } finally {
    // Clean up connection
    try {
      // @ts-ignore - accessing private transport property
      await client._transport?.close?.();
    } catch (e) {
      debugLog("Warning: Error during cleanup:", e);
    }
  }
}

/**
 * Call a tool directly on an MCP server URL
 */
export async function callToolDirect(endpoint: string, toolName: string, params: string, debugLog: (message: string, ...args: any[]) => void, headers?: Record<string, string>) {
  debugLog("Calling tool directly:", toolName);
  debugLog("Endpoint:", endpoint);
  debugLog("Raw params:", params);

  // Get server alias for consistent naming
  const serverAlias = getServerAliasFromEndpoint(endpoint);
  debugLog("Server alias for endpoint:", serverAlias);

  // Determine the actual tool name to call on the server
  let actualToolName = toolName;
  let configLookupName = toolName;

  // If toolName contains server alias prefix, extract the actual tool name
  if (toolName.includes('__')) {
    const [providedServerAlias, extractedToolName] = toolName.split('__', 2);
    if (extractedToolName) {
      actualToolName = extractedToolName;
      configLookupName = toolName; // Keep the full alias for config lookup
      debugLog(`Extracted tool name: ${actualToolName} from alias: ${toolName}`);
    }
  } else if (serverAlias) {
    // If no server prefix provided but we have a server alias, create the expected config lookup name
    configLookupName = `${serverAlias}__${toolName}`;
    debugLog(`Created config lookup name: ${configLookupName}`);
  }

  // Check if we have tools configuration and if this tool is disabled
  const toolsConfig = loadToolsConfig();
  if (toolsConfig) {
    // Try to find the tool in our configuration
    let foundToolInfo = toolsConfig.mcpTools[configLookupName];
    let foundAlias = configLookupName;

    // If not found with server prefix, try without it for backwards compatibility
    if (!foundToolInfo && configLookupName !== toolName) {
      foundToolInfo = toolsConfig.mcpTools[toolName];
      foundAlias = toolName;
      debugLog(`Trying direct tool name lookup: ${toolName}`);
    }

    if (foundToolInfo) {
      debugLog(`Found tool in configuration: ${foundAlias}`);
      if (!foundToolInfo.enabled) {
        console.error(`❌ Tool '${toolName}' is disabled in configuration.`);
        console.error("Enable it in tools.json or use a different tool.");
        process.exit(1);
      }
    } else {
      debugLog(`Tool '${configLookupName}' not found in configuration, allowing direct call`);
    }
  } else {
    debugLog("No tools configuration found, allowing direct call");
  }

  let parsedParams: Record<string, unknown>;
  try {
    parsedParams = JSON.parse(params);
    debugLog("Parsed params:", JSON.stringify(parsedParams, null, 2));
  } catch (error) {
    console.error("❌ Invalid JSON parameters:", error);
    console.error("Parameters must be valid JSON. Example: '{\"libraryName\": \"react\"}'");
    throw error;
  }

  const client = await createClientFromUrl(endpoint, debugLog, headers);

  try {
    debugLog("Making tool call with actual tool name:", actualToolName);
    const result = await callTool(client, actualToolName, parsedParams, debugLog);
    debugLog("✅ Tool call successful");
    safeConsoleLog(result);
  } finally {
    // Clean up connection
    try {
      // @ts-ignore - accessing private transport property
      await client._transport?.close?.();
    } catch (e) {
      debugLog("Warning: Error during cleanup:", e);
    }
  }
}

/**
 * Call a tool using the new alias system
 */
export async function callToolByAlias(toolAlias: string, params: string, debugLog: (message: string, ...args: any[]) => void, customConfigPath?: string) {
  debugLog("Calling tool by alias:", toolAlias);
  debugLog("Raw params:", params);

  // Load tools configuration
  const toolsConfig = loadToolsConfig();
  if (!toolsConfig) {
    console.error("❌ No tools configuration found. Run 'tmcp init' first.");
    process.exit(1);
  }

  // Find the tool
  const toolInfo = toolsConfig.mcpTools[toolAlias];
  if (!toolInfo) {
    console.error(`❌ Tool '${toolAlias}' not found.`);
    console.error("Available tools:");
    Object.keys(toolsConfig.mcpTools).forEach(alias => {
      if (toolsConfig.mcpTools[alias].enabled) {
        console.error(`  ${alias}`);
      }
    });
    process.exit(1);
  }

  if (!toolInfo.enabled) {
    console.error(`❌ Tool '${toolAlias}' is disabled.`);
    process.exit(1);
  }

  // Parse parameters
  let parsedParams: Record<string, unknown>;
  try {
    parsedParams = JSON.parse(params);
    debugLog("Parsed params:", JSON.stringify(parsedParams, null, 2));
  } catch (error) {
    console.error("❌ Invalid JSON parameters:", error);
    console.error("Parameters must be valid JSON. Example: '{\"param1\": \"value\"}'");
    throw error;
  }

  // Load MCP configuration
  const mcpConfig = loadMcpConfig();
  if (!mcpConfig) {
    console.error("❌ No MCP configuration found. Run 'tmcp init' first.");
    process.exit(1);
  }

  // Extract server alias and original tool name from alias
  const [serverAlias, originalToolName] = toolAlias.split('__', 2);
  if (!serverAlias || !originalToolName) {
    console.error(`❌ Invalid tool alias format: ${toolAlias}`);
    console.error("Expected format: <server-alias>__<tool-name>");
    process.exit(1);
  }

  // Get server configuration
  const serverConfig = mcpConfig.mcpServers[serverAlias];
  if (!serverConfig) {
    console.error(`❌ Server configuration for '${serverAlias}' not found.`);
    process.exit(1);
  }

  // Create ephemeral client and call tool
  const { client, cleanup } = await createEphemeralClient(serverConfig, debugLog);

  try {
    debugLog("Making tool call...");
    const result = await callTool(client, originalToolName, parsedParams, debugLog);
    debugLog("✅ Tool call successful");
    safeConsoleLog(result);
  } finally {
    // Clean up connection - this should properly terminate stdio servers
    debugLog("Cleaning up connection for tool call");
    await cleanup();
    debugLog("Cleanup completed for tool call");

    // Force exit for stdio servers that don't terminate properly
    // This is necessary because some stdio servers (like mcp-remote) are designed to run continuously
    if (serverConfig.command) {
      debugLog("Stdio server detected, forcing process exit");
      process.exit(0);
    }
  }
}

/**
 * Get available tools from MCP server
 */
export async function listTools(client: Client, debugLog: (message: string, ...args: any[]) => void): Promise<Tool[]> {
  try {
    const result = await client.listTools();
    return result.tools;
  } catch (error) {
    const details = extractToolCallErrorDetails(error);
    displayToolCallError(details, debugLog);
    throw error;
  }
}

/**
 * Call a specific tool with enhanced error handling
 */
export async function callTool(
  client: Client,
  toolName: string,
  args: any,
  debugLog: (message: string, ...args: any[]) => void
): Promise<any> {
  try {
    debugLog(`Calling tool: ${toolName} with args:`, args);
    const result = await client.callTool({
      name: toolName,
      arguments: args
    });
    debugLog(`Tool call successful:`, result);
    return result;
  } catch (error) {
    const details = extractToolCallErrorDetails(error, toolName);
    displayToolCallError(details, debugLog);
    throw error;
  }
}

/**
 * List available tools with their schemas and example usage
 */
export function formatToolsForDisplay(tools: Tool[]): string {
  if (tools.length === 0) {
    return "No tools available from this server.";
  }

  let output = `Available tools (${tools.length}):\n\n`;

  tools.forEach((tool, index) => {
    output += `${index + 1}. ${tool.name}\n`;
    if (tool.description) {
      output += `   Description: ${tool.description}\n`;
    }

    // Display input schema if available
    if (tool.inputSchema) {
      output += "   Parameters:\n";
      try {
        const schema = tool.inputSchema as any;
        if (schema.properties) {
          Object.entries(schema.properties).forEach(([param, def]: [string, any]) => {
            const required = schema.required?.includes(param) ? "*" : "";
            const type = def.type || "any";
            const description = def.description ? ` - ${def.description}` : "";
            output += `     ${param}${required} (${type})${description}\n`;
          });
        }
      } catch (e) {
        output += `     Schema: ${JSON.stringify(tool.inputSchema)}\n`;
      }
    }

    // Generate example usage
    const serverName = tool.name.split('__')[0] || 'server';
    const toolNameForCall = tool.name.includes('__') ? tool.name : `${serverName}__${tool.name}`;
    output += `   Example: tmcp call ${toolNameForCall} '{"param": "value"}'\n\n`;
  });

  return output;
}

