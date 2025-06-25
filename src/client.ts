import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execSync } from "child_process";
import type { McpServerConfig } from "./config";
import { isStdioServer, validateServerConfig, getServerUrl } from "./config";

/**
 * Find the full path of a command
 */
function findCommand(command: string): string | null {
  try {
    const result = execSync(`which ${command}`, { encoding: 'utf8' }).trim();
    return result || null;
  } catch {
    return null;
  }
}

/**
 * Resolve command and args for stdio transport
 */
function resolveStdioCommand(command: string, args: string[] = []): { command: string; args: string[] } {
  let resolvedCommand = command;
  let resolvedArgs = [...args];

  // Handle common package runners
  if (command === "bunx") {
    // Try to find bun first
    const bunPath = findCommand("bun");
    if (bunPath) {
      resolvedCommand = bunPath;
      resolvedArgs = ["x", ...args];
    } else {
      // Fall back to npx if bun is not available
      const npxPath = findCommand("npx");
      if (npxPath) {
        resolvedCommand = npxPath;
        // bunx args are compatible with npx
      } else {
        throw new Error("Neither 'bun' nor 'npx' found in PATH. Please install Bun or Node.js.");
      }
    }
  } else {
    // Try to resolve other commands to full paths
    const fullPath = findCommand(command);
    if (fullPath) {
      resolvedCommand = fullPath;
    }
    // If we can't find it, let the original command through - it might work
  }

  return { command: resolvedCommand, args: resolvedArgs };
}

/**
 * Create and connect to an MCP client with headers and environment variables
 */
export async function createClient(config: McpServerConfig, debugLog: (message: string, ...args: any[]) => void): Promise<Client> {
  // Validate configuration
  validateServerConfig(config);

  // Set environment variables if specified
  if (config.env) {
    for (const [key, value] of Object.entries(config.env)) {
      process.env[key] = value;
      debugLog("Set environment variable:", key);
    }
  }

  // Create appropriate transport based on server type
  let transport;

  if (isStdioServer(config)) {
    // stdio server
    debugLog("Creating stdio MCP client for command:", config.command);

    if (!config.command) {
      throw new Error("Command not found in stdio server configuration");
    }

    const { command, args } = resolveStdioCommand(config.command, config.args);
    debugLog("Resolved command:", command, "args:", args);

    transport = new StdioClientTransport({
      command: command,
      args: args,
      env: config.env
    });
  } else {
    // HTTP server
    const serverUrl = getServerUrl(config);
    debugLog("Creating HTTP MCP client for endpoint:", serverUrl);

    if (!serverUrl) {
      throw new Error("Server URL not found in HTTP server configuration");
    }

    // Create transport with headers if specified
    const transportOptions: any = {};
    if (config.headers) {
      transportOptions.requestInit = {
        headers: config.headers
      };
      debugLog("Adding custom headers:", config.headers);
    }

    // Pass headers as the second parameter to StreamableHTTPClientTransport
    transport = new StreamableHTTPClientTransport(new URL(serverUrl), transportOptions);
  }

  try {
    // Create client
    const client = new Client({
      name: "terminal-mcp",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    // Connect to server
    await client.connect(transport);
    debugLog("✅ Successfully connected to MCP server");

    return client;
  } catch (error) {
    console.error("❌ Failed to connect to MCP server:", error);
    throw error;
  }
}

/**
 * Create and connect to an MCP client with endpoint URL (legacy method)
 */
export async function createClientFromUrl(endpoint: string, debugLog: (message: string, ...args: any[]) => void, headers?: Record<string, string>): Promise<Client> {
  debugLog("Creating MCP client for endpoint:", endpoint);

  try {
    // Create transport with optional headers
    const transportOptions: any = {};
    if (headers) {
      transportOptions.requestInit = {
        headers: headers
      };
      debugLog("Adding custom headers:", headers);
    }

    const transport = new StreamableHTTPClientTransport(new URL(endpoint), transportOptions);

    // Create client
    const client = new Client({
      name: "terminal-mcp",
      version: "1.0.0"
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    // Connect to server
    await client.connect(transport);
    debugLog("✅ Successfully connected to MCP server");

    return client;
  } catch (error) {
    console.error("❌ Failed to connect to MCP server:", error);
    throw error;
  }
}