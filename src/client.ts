import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { McpServerConfig } from "./config";

/**
 * Create and connect to an MCP client with headers and environment variables
 */
export async function createClient(config: McpServerConfig, debugLog: (message: string, ...args: any[]) => void): Promise<Client> {
  const serverUrl = config.url || config.serverUrl || "";
  debugLog("Creating MCP client for endpoint:", serverUrl);

  if (!serverUrl) {
    throw new Error("Server URL not found in configuration");
  }

  try {
    // Set environment variables if specified
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        process.env[key] = value;
        debugLog("Set environment variable:", key);
      }
    }

    // Create transport with custom headers
    const transport = new StreamableHTTPClientTransport(new URL(serverUrl));

    // Add custom headers if specified
    if (config.headers) {
      // Note: The SDK might need to be extended to support custom headers
      // For now, we'll store them for potential future use
      debugLog("Custom headers specified:", config.headers);
    }

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
export async function createClientFromUrl(endpoint: string, debugLog: (message: string, ...args: any[]) => void): Promise<Client> {
  debugLog("Creating MCP client for endpoint:", endpoint);

  try {
    // Create transport
    const transport = new StreamableHTTPClientTransport(new URL(endpoint));

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