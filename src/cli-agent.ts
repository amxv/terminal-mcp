#!/usr/bin/env bun
import { parseArgs } from "util";
import { showVersion, createDebugLogger, exitWithError } from "./cli-common";
import { listConfiguredTools, callToolByAlias } from "./tools";

// Display help information for agents
function showAgentHelp() {
  console.log(`terminal-mcp-agent v${require("../package.json").version || "unknown"}

A minimal command-line MCP client for calling tools from MCP servers (HTTP and stdio).

Usage: tmcp [options] <command> [arguments]

Options:
  -h, --help                          Show this help message
  -v, --version                       Show version information
  --debug                             Enable debug logging

Commands:
  list                                List all configured and enabled tools
  call <tool-alias> <json-params>     Call a tool using its alias

Examples:
  tmcp list
  tmcp call context7__resolve-library-id '{"libraryName": "react"}'
  tmcp call ref__ref_search_documentation '{"query": "React hooks"}'`);
}

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    debug: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
    version: { type: "boolean", short: "v", default: false },
  },
  allowPositionals: true,
});

const debug = values.debug as boolean;
const help = values.help as boolean;
const version = values.version as boolean;

const debugLog = createDebugLogger(debug);

// Handle help and version flags first
if (help) {
  showAgentHelp();
  process.exit(0);
}

if (version) {
  showVersion();
  process.exit(0);
}

// CLI entry point
(async () => {
  const [command, ...args] = positionals;

  debugLog("=== terminal-mcp-agent Starting ===");
  debugLog("Command:", command);
  debugLog("Arguments:", args);
  debugLog("Debug mode:", debug);

  try {
    switch (command) {
      case "list": {
        if (args.length > 0) {
          exitWithError(
            "List command does not accept arguments",
            "Usage: tmcp list"
          );
        }
        await listConfiguredTools(debugLog);
        break;
      }

      case "call": {
        if (args.length !== 2) {
          exitWithError(
            "Invalid arguments for call command",
            "Usage: tmcp call <tool-alias> <json-params>"
          );
        }
        const [toolAlias, params] = args;
        await callToolByAlias(toolAlias, params, debugLog);
        break;
      }

      case "help":
        showAgentHelp();
        break;

      default:
        if (command) {
          exitWithError(
            `Unknown command: ${command}`,
            "Available commands: list, call\nUse 'tmcp --help' for usage information."
          );
        } else {
          showAgentHelp();
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