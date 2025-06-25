#!/usr/bin/env bun
import { parseArgs } from "util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    debug: { type: "boolean", default: false },
  },
  allowPositionals: true,
});
const debug = values.debug as boolean;

// Debug logging function
function debugLog(...args: any[]) {
  if (debug) {
    console.error("[DEBUG]", ...args);
  }
}

/**
 * Create and connect to an MCP client
 */
async function createClient(endpoint: string): Promise<Client> {
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

/**
 * List all available tools, resources, and prompts from an MCP server
 */
async function listCapabilities(endpoint: string) {
  debugLog("Listing capabilities for endpoint:", endpoint);

  const client = await createClient(endpoint);

  try {
    const [tools, resources, prompts] = await Promise.all([
      client.listTools().catch(() => ({ tools: [] })),
      client.listResources().catch(() => ({ resources: [] })),
      client.listPrompts().catch(() => ({ prompts: [] }))
    ]);

    const result = {
      endpoint,
      capabilities: {
        tools: tools.tools || [],
        resources: resources.resources || [],
        prompts: prompts.prompts || []
      }
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
 * Call a specific tool on an MCP server
 */
async function callTool(endpoint: string, toolName: string, params: string) {
  debugLog("Calling tool:", toolName);
  debugLog("Endpoint:", endpoint);
  debugLog("Raw params:", params);

  let parsedParams: Record<string, unknown>;
  try {
    parsedParams = JSON.parse(params);
    debugLog("Parsed params:", JSON.stringify(parsedParams, null, 2));
  } catch (error) {
    console.error("❌ Invalid JSON parameters:", error);
    console.error("Parameters must be valid JSON. Example: '{\"libraryName\": \"react\"}'");
    throw error;
  }

  const client = await createClient(endpoint);

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

// CLI entry point
(async () => {
  const [command, ...args] = positionals;

  debugLog("=== terminal-mcp Starting ===");
  debugLog("Command:", command);
  debugLog("Arguments:", args);
  debugLog("Debug mode:", debug);

  try {
    switch (command) {
      case "list": {
        const endpoint = args[0];
        if (!endpoint) {
          console.error("❌ Endpoint URL is required");
          console.error("Usage: terminal-mcp list <endpoint-url>");
          process.exit(1);
        }
        await listCapabilities(endpoint);
        break;
      }

      case "call": {
        const endpoint = args[0];
        const toolName = args[1];
        const params = args[2];

        if (!endpoint || !toolName || !params) {
          console.error("❌ Missing required arguments");
          console.error("Usage: terminal-mcp call <endpoint-url> <tool-name> <json-params>");
          console.error("Example: terminal-mcp call https://mcp.context7.com/mcp resolve-library-id '{\"libraryName\": \"react\"}'");
          process.exit(1);
        }

        await callTool(endpoint, toolName, params);
        break;
      }

      default:
        console.log(`terminal-mcp

Usage: terminal-mcp <command> [options]

Commands:
  list <endpoint-url>                           List all available tools, resources, and prompts
  call <endpoint-url> <tool-name> <json-params> Call a specific tool with JSON parameters

Options:
  --debug                                       Enable debug logging

Examples:
  terminal-mcp list https://mcp.context7.com/mcp
  terminal-mcp call https://mcp.context7.com/mcp resolve-library-id '{"libraryName": "react"}'
  terminal-mcp call https://mcp.context7.com/mcp get-library-docs '{"context7CompatibleLibraryID": "/facebook/react"}'
  terminal-mcp --debug list https://mcp.context7.com/mcp
`);
        if (command && command !== "help") {
          console.error(`❌ Unknown command: ${command}`);
          process.exit(1);
        }
    }
  } catch (error) {
    console.error("❌ Command failed:", error);

    if (debug && error instanceof Error && error.stack) {
      console.error("Full stack trace:", error.stack);
    }

    process.exit(1);
  }
})();

