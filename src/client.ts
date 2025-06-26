import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execSync } from "child_process";
import type { McpServerConfig } from "./config";
import { isStdioServer, validateServerConfig, getServerUrl } from "./config";

/**
 * Enhanced error information for better debugging
 */
interface DetailedError {
  message: string;
  type: 'connection' | 'http' | 'protocol' | 'timeout' | 'authentication' | 'rate_limit' | 'server_error' | 'unknown';
  httpStatus?: number;
  responseBody?: string;
  headers?: Record<string, string>;
  serverUrl?: string;
  originalError: any;
}

/**
 * Extract detailed error information from various error types
 */
function extractErrorDetails(error: any, serverUrl?: string): DetailedError {
  const details: DetailedError = {
    message: error.message || 'Unknown error',
    type: 'unknown',
    serverUrl,
    originalError: error
  };

  // Check for HTTP-related errors
  if (error.response) {
    // Response received but with error status
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
      details.message = `Authentication failed (HTTP ${statusCode}): ${details.message}`;
    } else if (statusCode === 429) {
      details.type = 'rate_limit';
      details.message = `Rate limited (HTTP ${statusCode}): ${details.message}`;

      // Check for retry-after header
      const retryAfter = error.response?.headers?.['retry-after'];
      if (retryAfter) {
        details.message += ` - Retry after ${retryAfter} seconds`;
      }
    } else if (statusCode >= 500) {
      details.type = 'server_error';
      details.message = `Server error (HTTP ${statusCode}): ${details.message}`;
    } else if (statusCode >= 400) {
      details.type = 'http';
      details.message = `Client error (HTTP ${statusCode}): ${details.message}`;
    }
  } else if (error.request) {
    // Request made but no response received
    details.type = 'connection';
    if (error.code === 'ECONNREFUSED') {
      details.message = `Connection refused to ${serverUrl || 'server'} - Is the server running?`;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      details.type = 'timeout';
      details.message = `Network timeout or DNS resolution failed for ${serverUrl || 'server'}`;
    } else if (error.code === 'ECONNRESET') {
      details.message = `Connection reset by server ${serverUrl || ''}`;
    } else {
      details.message = `Network error: ${error.message} (${error.code || 'unknown code'})`;
    }
  } else if (error.name === 'AbortError') {
    details.type = 'timeout';
    details.message = 'Request timed out or was aborted';
  } else if (error.message?.includes('JSON-RPC')) {
    details.type = 'protocol';
    details.message = `Protocol error: ${error.message}`;
  }

  // Check for fetch-specific errors (StreamableHTTPClientTransport uses fetch)
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    details.type = 'connection';
    details.message = `Network connection failed: ${error.message}`;
  }

  // Check for Bun-specific connection errors
  if (error.code === 'ConnectionRefused' || error.message?.includes('Unable to connect')) {
    details.type = 'connection';
    if (error.message?.includes('Unable to connect')) {
      details.message = `Connection failed to ${serverUrl || 'server'} - ${error.message}`;
    } else if (error.code === 'ConnectionRefused') {
      details.message = `Connection refused to ${serverUrl || error.path || 'server'} - ${error.message || 'Port may not be listening'}`;
    }
  }

  // Check for DNS resolution errors (Bun-specific)
  if (error.message?.includes('getaddrinfo') || error.message?.toLowerCase().includes('dns')) {
    details.type = 'connection';
    details.message = `DNS resolution failed for ${serverUrl || 'server'} - ${error.message}`;
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
 * Display detailed error information in a user-friendly format
 */
function displayDetailedError(details: DetailedError, debugLog: (message: string, ...args: any[]) => void) {
  console.error(`❌ MCP Error [${details.type.toUpperCase()}]: ${details.message}`);

  if (details.serverUrl) {
    console.error(`🔗 Server URL: ${details.serverUrl}`);
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
      console.error(`💡 Suggestion: You're being rate limited. Wait before retrying, or check if you need an API key.`);
      break;
    case 'authentication':
      console.error(`💡 Suggestion: Check your API key, headers, or authentication configuration.`);
      break;
    case 'connection':
      console.error(`💡 Suggestion: Verify the server URL is correct and the server is running.`);
      break;
    case 'timeout':
      console.error(`💡 Suggestion: Check your network connection or try again later.`);
      break;
    case 'server_error':
      console.error(`💡 Suggestion: This appears to be a server-side issue. Try again later.`);
      break;
  }

  // Log the full error details in debug mode
  debugLog("Full error details:", details);
}

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
  const serverUrl = isStdioServer(config) ? `stdio:${config.command}` : getServerUrl(config);

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
    const details = extractErrorDetails(error, serverUrl);
    displayDetailedError(details, debugLog);
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
    const details = extractErrorDetails(error, endpoint);
    displayDetailedError(details, debugLog);
    throw error;
  }
}