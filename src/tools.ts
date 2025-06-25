import { loadToolsConfig, loadMcpConfig, findMcpConfig, AvailableToolsConfig } from "./config";
import { createClient, createClientFromUrl } from "./client";

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

  console.log(JSON.stringify(result, null, 2));
}

/**
 * List tools directly from an MCP server URL
 */
export async function listToolsDirect(endpoint: string, debugLog: (message: string, ...args: any[]) => void) {
  debugLog("Listing tools directly from endpoint:", endpoint);

  const client = await createClientFromUrl(endpoint, debugLog);

  try {
    const toolsResponse = await client.listTools();
    const tools = toolsResponse.tools || [];

    // Note: Since allowed-tools.json only contains enabled tools, no filtering needed
    const result = {
      endpoint,
      tools: tools.map(tool => ({
        name: tool.name,
        description: tool.description || "No description available",
        schema: tool.inputSchema || { type: "object", properties: {} }
      })),
      total_count: tools.length
    };

    console.log(JSON.stringify(result, null, 2));
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
export async function callToolDirect(endpoint: string, toolName: string, params: string, debugLog: (message: string, ...args: any[]) => void) {
  debugLog("Calling tool directly:", toolName);
  debugLog("Endpoint:", endpoint);
  debugLog("Raw params:", params);

  // Note: Direct calls bypass configuration filtering since they're ad-hoc
  debugLog("Direct call - bypassing configuration checks");

  let parsedParams: Record<string, unknown>;
  try {
    parsedParams = JSON.parse(params);
    debugLog("Parsed params:", JSON.stringify(parsedParams, null, 2));
  } catch (error) {
    console.error("❌ Invalid JSON parameters:", error);
    console.error("Parameters must be valid JSON. Example: '{\"libraryName\": \"react\"}'");
    throw error;
  }

  const client = await createClientFromUrl(endpoint, debugLog);

  try {
    debugLog("Making tool call...");
    const result = await client.callTool({
      name: toolName,
      arguments: parsedParams
    });

    debugLog("✅ Tool call successful");
    console.log(JSON.stringify(result, null, 2));
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
      console.error(`  ${alias}`);
    });
    process.exit(1);
  }

  // Note: No need to check enabled status since allowed-tools.json only contains enabled tools

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

  // Create client and call tool
  const client = await createClient(serverConfig, debugLog);

  try {
    debugLog("Making tool call...");
    const result = await client.callTool({
      name: originalToolName,
      arguments: parsedParams
    });

    debugLog("✅ Tool call successful");
    console.log(JSON.stringify(result, null, 2));
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

