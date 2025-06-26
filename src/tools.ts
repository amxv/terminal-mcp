import { loadToolsConfig, loadMcpConfig, findMcpConfig, ToolsConfig } from "./config";
import { createClient, createClientFromUrl } from "./client";
import { safeConsoleLog } from "./cli-common";

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

    // Check if we have tools configuration to filter disabled tools
    const toolsConfig = loadToolsConfig();
    let filteredTools = tools;

    if (toolsConfig) {
      debugLog("Tools configuration found, filtering by enabled status");
      filteredTools = tools.filter(tool => {
        // Try to find this tool in our configuration
        for (const [alias, toolInfo] of Object.entries(toolsConfig.mcpTools)) {
          const aliasMatches = alias === tool.name || alias.endsWith(`__${tool.name}`);
          if (aliasMatches) {
            debugLog(`Found ${tool.name} in config as ${alias}, enabled: ${toolInfo.enabled}`);
            return toolInfo.enabled;
          }
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
        name: tool.name,
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

  // Check if we have tools configuration and if this tool is disabled
  const toolsConfig = loadToolsConfig();
  if (toolsConfig) {
    // Try to find the tool in our configuration using various alias patterns
    let foundToolInfo: any = null;
    let foundAlias: string | null = null;

    // Look for exact tool name match or server__toolname pattern
    for (const [alias, toolInfo] of Object.entries(toolsConfig.mcpTools)) {
      // Check if this alias matches the endpoint and tool name
      const aliasMatches = alias === toolName || alias.endsWith(`__${toolName}`);
      if (aliasMatches) {
        foundToolInfo = toolInfo;
        foundAlias = alias;
        break;
      }
    }

    if (foundToolInfo) {
      debugLog(`Found tool in configuration: ${foundAlias}`);
      if (!foundToolInfo.enabled) {
        console.error(`❌ Tool '${toolName}' is disabled in configuration.`);
        console.error("Enable it in tools.json or use a different tool.");
        process.exit(1);
      }
    } else {
      debugLog(`Tool '${toolName}' not found in configuration, allowing direct call`);
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
    debugLog("Making tool call...");
    const result = await client.callTool({
      name: toolName,
      arguments: parsedParams
    });

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

  // Create client and call tool
  const client = await createClient(serverConfig, debugLog);

  try {
    debugLog("Making tool call...");
    const result = await client.callTool({
      name: originalToolName,
      arguments: parsedParams
    });

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

