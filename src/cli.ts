#!/usr/bin/env bun
import { parseArgs } from "util";
import { readFileSync } from "fs";
import { join } from "path";
import { initConfig } from "./config";
import { callToolByAlias, listConfiguredTools, listToolsDirect, callToolDirect } from "./tools";

// Get package version
function getVersion(): string {
  try {
    const packagePath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return packageJson.version || "unknown";
  } catch (error) {
    return "unknown";
  }
}

// Display version information
function showVersion() {
  const version = getVersion();
  console.log(`terminal-mcp v${version}`);
  console.log("CLI tool for interacting with MCP servers (HTTP and stdio)");
  console.log("License: MIT");
  console.log("Repository: https://github.com/zueai/terminal-mcp");
}

// Display help information
function showHelp() {
  const version = getVersion();
  console.log(`terminal-mcp (tmcp) v${version}

A minimal command-line MCP client for calling tools from MCP servers (HTTP and stdio).

Usage: tmcp [options] <command> [arguments]

Options:
  -h, --help                          Show this help message
  -v, --version                       Show version information
  --debug                             Enable debug logging
  --configpath <path>                 Specify custom path for mcp.json

Commands:
  init                                Initialize configuration from mcp.json
  call <tool-alias> <json-params>     Call a tool using configured alias
  list                                List all configured tools
  direct <url> <subcommand>           Direct server communication
    list                              List tools from the server
    call <tool-name> <json-params>    Call a specific tool

Setup:
  1. Create mcp.json with HTTP servers (url) and/or stdio servers (command)
  2. Run 'tmcp init' to discover and configure tools
  3. Use 'tmcp call <tool-alias> <json-params>' to call tools

Examples:
  tmcp init
  tmcp list
  tmcp call context7__resolve-library-id '{"libraryName": "react"}'
  tmcp call context7__get-library-docs '{"context7CompatibleLibraryID": "/facebook/react"}'

  # Using custom config path
  tmcp --configpath ./custom/mcp.json init
  tmcp --configpath ./custom/mcp.json call tool-alias <json-args>

  # Direct server communication (no config needed)
  tmcp direct https://mcp.context7.com/mcp list
  tmcp direct https://mcp.context7.com/mcp call resolve-library-id '{"libraryName": "react"}'

  tmcp --debug call tool-alias <json-args>

For more information, visit: https://github.com/zueai/terminal-mcp`);
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    debug: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
    configpath: { type: "string", default: "" },
  },
  allowPositionals: true,
});

const debug = values.debug as boolean;
const help = values.help as boolean;
const version = values.version as boolean;
const configPath = values.configpath as string;

// Debug logging function
function debugLog(...args: any[]) {
  if (debug) {
    console.error("[DEBUG]", ...args);
  }
}

// Handle help and version flags first
if (help) {
  showHelp();
  process.exit(0);
}

if (version) {
  showVersion();
  process.exit(0);
}

// CLI entry point
(async () => {
  const [command, ...args] = positionals;

  debugLog("=== terminal-mcp Starting ===");
  debugLog("Command:", command);
  debugLog("Arguments:", args);
  debugLog("Debug mode:", debug);
  debugLog("Config path:", configPath || "default");

  try {
    switch (command) {
      case "init": {
        await initConfig(debugLog, configPath);
        break;
      }

      case "call": {
        if (args.length !== 2) {
          console.error("❌ Invalid arguments for call command");
          console.error("Usage: tmcp call <tool-alias> <json-params>");
          process.exit(1);
        }
        const [toolAlias, params] = args;
        await callToolByAlias(toolAlias, params, debugLog, configPath);
        break;
      }

      case "list": {
        if (args.length > 0) {
          console.error("❌ List command does not accept arguments");
          console.error("Usage: tmcp list");
          console.error("This will list all configured tools from your terminal-mcp configuration.");
          process.exit(1);
        }
        await listConfiguredTools(debugLog, configPath);
        break;
      }

      case "direct": {
        if (args.length < 2) {
          console.error("❌ Invalid arguments for direct command");
          console.error("Usage: tmcp direct <url> <subcommand>");
          console.error("Subcommands:");
          console.error("  list                           List tools from the server");
          console.error("  call <tool-name> <json-params> Call a specific tool");
          process.exit(1);
        }

        const [url, subcommand, ...subArgs] = args;

        switch (subcommand) {
          case "list": {
            await listToolsDirect(url, debugLog);
            break;
          }

          case "call": {
            if (subArgs.length !== 2) {
              console.error("❌ Invalid arguments for direct call");
              console.error("Usage: tmcp direct <url> call <tool-name> <json-params>");
              process.exit(1);
            }
            const [toolName, params] = subArgs;
            await callToolDirect(url, toolName, params, debugLog);
            break;
          }

          default: {
            console.error(`❌ Unknown direct subcommand: ${subcommand}`);
            console.error("Available subcommands: list, call");
            process.exit(1);
          }
        }
        break;
      }

      case "help":
        showHelp();
        break;

      default:
        if (command) {
          console.error(`❌ Unknown command: ${command}`);
          console.error("Use 'tmcp --help' for usage information.");
          process.exit(1);
        } else {
          showHelp();
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

