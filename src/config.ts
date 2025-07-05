import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

// Configuration interfaces
export interface McpServerConfig {
  url?: string;
  serverUrl?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  // Support for stdio servers
  command?: string;
  args?: string[];
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface ToolInfo {
  enabled: boolean;
  example_terminal_command: string;
  description: string;
  parameters: any;
}

export interface ToolsConfig {
  mcpTools: Record<string, ToolInfo>;
}

/**
 * Generate example JSON string from a JSON schema
 */
function generateExampleFromSchema(schema: any): string {
  if (!schema || typeof schema !== 'object') {
    return '{}';
  }

  const example: Record<string, any> = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  // Only generate examples for required properties
  for (const prop of required) {
    if (properties[prop]) {
      example[prop] = generateExampleValue(properties[prop], prop);
    }
  }

  return JSON.stringify(example);
}

/**
 * Generate an example value based on property schema and name
 */
function generateExampleValue(propSchema: any, propName: string): any {
  if (!propSchema || typeof propSchema !== 'object') {
    return "VALUE";
  }

  const type = propSchema.type;

  switch (type) {
    case 'string':
      return "VALUE";

    case 'number':
    case 'integer':
      return 42;

    case 'boolean':
      return true;

    case 'array':
      const itemSchema = propSchema.items;
      if (itemSchema) {
        return [generateExampleValue(itemSchema, 'item')];
      }
      return ["VALUE"];

    case 'object':
      if (propSchema.properties) {
        const nestedExample: Record<string, any> = {};
        const nestedRequired = propSchema.required || [];

        // Add required properties
        for (const reqProp of nestedRequired.slice(0, 2)) {
          if (propSchema.properties[reqProp]) {
            nestedExample[reqProp] = generateExampleValue(propSchema.properties[reqProp], reqProp);
          }
        }

        return nestedExample;
      }
      return {};

    default:
      return "VALUE";
  }
}

/**
 * Find and read mcp.json configuration file
 */
export function findMcpConfig(customConfigPath?: string): McpConfig | null {
  let configPaths: string[];

  if (customConfigPath) {
    // If custom path is provided, only try that path
    configPaths = [customConfigPath];
  } else {
    // Default search paths
    configPaths = [
      "terminal-mcp/servers.json",
      ".cursor/mcp.json",
      "mcp.json",
      ".mcp.json",
    ];
  }

  for (const path of configPaths) {
    if (existsSync(path)) {
      try {
        const configContent = readFileSync(path, "utf-8");
        return JSON.parse(configContent) as McpConfig;
      } catch (error) {
        console.error(`❌ Failed to parse config file ${path}:`, error);
        return null;
      }
    }
  }

  if (customConfigPath) {
    console.error(`❌ Custom configuration file not found: ${customConfigPath}`);
  }

  return null;
}

/**
 * Get server URL from config, handling both 'url' and 'serverUrl' keys
 */
export function getServerUrl(config: McpServerConfig): string {
  return config.url || config.serverUrl || "";
}

/**
 * Check if a server config is for stdio (local) or HTTP (remote)
 */
export function isStdioServer(config: McpServerConfig): boolean {
  return !!config.command;
}

/**
 * Validate server configuration
 */
export function validateServerConfig(config: McpServerConfig): void {
  const hasUrl = !!(config.url || config.serverUrl);
  const hasCommand = !!config.command;

  if (!hasUrl && !hasCommand) {
    throw new Error("Server configuration must have either 'url'/'serverUrl' (for HTTP) or 'command' (for stdio)");
  }

  if (hasUrl && hasCommand) {
    throw new Error("Server configuration cannot have both URL and command - choose either HTTP or stdio");
  }
}

/**
 * Load tools configuration
 */
export function loadToolsConfig(): ToolsConfig | null {
  const toolsPath = "./terminal-mcp/tools.json";

  if (!existsSync(toolsPath)) {
    return null;
  }

  try {
    const toolsContent = readFileSync(toolsPath, "utf-8");
    return JSON.parse(toolsContent) as ToolsConfig;
  } catch (error) {
    console.error(`❌ Failed to parse tools configuration:`, error);
    return null;
  }
}

/**
 * Load MCP configuration
 */
export function loadMcpConfig(): McpConfig | null {
  const configPath = "./terminal-mcp/servers.json";

  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const configContent = readFileSync(configPath, "utf-8");
    return JSON.parse(configContent) as McpConfig;
  } catch (error) {
    console.error(`❌ Failed to parse MCP configuration:`, error);
    return null;
  }
}

/**
 * Initialize terminal-mcp configuration
 */
export async function initConfig(debugLog: (message: string, ...args: any[]) => void, customConfigPath?: string) {
  debugLog("Initializing terminal-mcp configuration...");

  // Find mcp.json config
  const config = findMcpConfig(customConfigPath);
  if (!config) {
    if (customConfigPath) {
      console.error(`❌ Configuration file not found: ${customConfigPath}`);
    } else {
      console.error("❌ No mcp.json configuration file found");
      console.error("Expected locations: terminal-mcp/servers.json, .cursor/mcp.json, mcp.json, or .mcp.json");
    }
    process.exit(1);
  }

  // Create terminal-mcp directory
  const terminalMcpDir = "./terminal-mcp";
  if (!existsSync(terminalMcpDir)) {
    mkdirSync(terminalMcpDir, { recursive: true });
    debugLog("Created directory:", terminalMcpDir);
  }

  // Copy config to terminal-mcp/servers.json
  const configPath = join(terminalMcpDir, "servers.json");
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ Copied configuration to", configPath);

  // Import createClient here to avoid circular dependencies
  const { createClient } = await import("./client");

  // Aggregate tools from all servers
  const toolsConfig: ToolsConfig = { mcpTools: {} };

  for (const [serverAlias, serverConfig] of Object.entries(config.mcpServers)) {
    // Validate server configuration before attempting connection
    try {
      validateServerConfig(serverConfig);
    } catch (error) {
      console.error(`❌ Invalid configuration for server '${serverAlias}':`, error);
      continue;
    }

    const serverDescription = isStdioServer(serverConfig)
      ? `${serverConfig.command} ${(serverConfig.args || []).join(' ')}`
      : getServerUrl(serverConfig);
    console.log(`🔍 Discovering tools from ${serverAlias} (${serverDescription})...`);

    try {
      const client = await createClient(serverConfig, debugLog);

      try {
        const toolsResponse = await client.listTools();
        const tools = toolsResponse.tools || [];

        for (const tool of tools) {
          const toolAlias = `${serverAlias}__${tool.name}`;
          const exampleJson = generateExampleFromSchema(tool.inputSchema);

          // Clean up the schema by removing metadata properties that aren't useful for AI agents
          const cleanSchema = tool.inputSchema ? { ...tool.inputSchema } : { type: "object", properties: {} };
          if ('$schema' in cleanSchema) delete (cleanSchema as any).$schema;
          if ('additionalProperties' in cleanSchema) delete (cleanSchema as any).additionalProperties;

          toolsConfig.mcpTools[toolAlias] = {
            enabled: true,
            example_terminal_command: `tmcp call ${toolAlias} '${exampleJson}'`,
            description: tool.description || "No description available",
            parameters: cleanSchema
          };

          console.log(`  ✅ Added tool: ${toolAlias}`);
        }
      } finally {
        // Clean up connection
        try {
          // @ts-ignore - accessing private transport property
          await client._transport?.close?.();
        } catch (e) {
          debugLog("Warning: Error during cleanup:", e);
        }
      }
    } catch (error) {
      console.error(`❌ Failed to connect to server ${serverAlias}:`, error);
    }
  }

  // Write tools configuration
  const toolsPath = join(terminalMcpDir, "tools.json");
  writeFileSync(toolsPath, JSON.stringify(toolsConfig, null, 2));

  const toolCount = Object.keys(toolsConfig.mcpTools).length;
  console.log(`✅ Generated tools configuration with ${toolCount} tools at ${toolsPath}`);

  if (toolCount === 0) {
    console.warn("⚠️  No tools were discovered. Check your server configurations.");
  } else {
    console.log("\n🎉 Initialization complete! You can now use:");
    console.log("  tmcp call <tool-alias> '<json-args>'");
    console.log("\nExample tools:");
    Object.keys(toolsConfig.mcpTools).slice(0, 3).forEach(alias => {
      console.log(`  tmcp call ${alias} <json-args>`);
    });
  }
}