#!/usr/bin/env bun
import { parseArgs } from "util";
import { showVersion, getVersion, createDebugLogger, exitWithError, compareVersions, fetchLatestVersion, executeUpgrade } from "./cli-common";
import { initConfig } from "./config";
import { callToolByAlias, listConfiguredTools, listToolsDirect, callToolDirect } from "./tools";

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
  --headers <headers>                 Specify custom headers for direct commands

Commands:
  init                                Initialize configuration from mcp.json
  call <tool-alias> <json-params>     Call a tool using configured alias
  list                                List all configured tools
  upgrade                             Upgrade to the latest version
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
  tmcp upgrade
  tmcp call context7__resolve-library-id '{"libraryName": "react"}'
  tmcp call context7__get-library-docs '{"context7CompatibleLibraryID": "/facebook/react"}'

  # Using custom config path
  tmcp --configpath ./custom/mcp.json init
  tmcp --configpath ./custom/mcp.json call tool-alias <json-args>

  # Direct server communication (no config needed)
  tmcp direct https://mcp.context7.com/mcp list
  tmcp direct https://mcp.context7.com/mcp call resolve-library-id '{"libraryName": "react"}'

  # With custom headers for authentication
  tmcp direct https://api.ref.tools/mcp --headers '{"x-ref-api-key": "your-key"}' list
  tmcp direct https://api.ref.tools/mcp --headers '{"x-ref-api-key": "your-key"}' call search_documentation '{"query": "React"}'

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
    headers: { type: "string", default: "" },
  },
  allowPositionals: true,
});

const debug = values.debug as boolean;
const help = values.help as boolean;
const version = values.version as boolean;
const configPath = values.configpath as string;
const headersJson = values.headers as string;

const debugLog = createDebugLogger(debug);

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

      case "upgrade": {
        if (args.length > 0) {
          exitWithError(
            "Upgrade command does not accept arguments",
            "Usage: tmcp upgrade"
          );
        }

        const REPO = "zueai/terminal-mcp";
        const currentVersion = getVersion();

        console.log(`Current version: ${currentVersion}`);
        console.log("🔍 Checking for updates...");

                const latestInfo = await fetchLatestVersion(REPO);
        if (!latestInfo) {
          exitWithError("Failed to check for updates. Please try again later.");
          return; // This won't execute but satisfies TypeScript
        }

        const latestVersion = latestInfo.version;
        debugLog("Latest version:", latestVersion);
        debugLog("Current version:", currentVersion);

        const comparison = compareVersions(latestVersion, currentVersion);

        if (comparison > 0) {
          console.log(`📦 New version available: ${latestVersion}`);
          console.log(`🔗 Release notes: ${latestInfo.url}`);
          console.log();

          await executeUpgrade(REPO, debugLog);
        } else if (comparison === 0) {
          console.log(`✅ You're already on the latest version (${currentVersion})!`);
        } else {
          console.log(`🔄 You're on a newer version (${currentVersion}) than the latest release (${latestVersion})`);
          console.log("This might be a development or prerelease version.");
        }
        break;
      }

      case "direct": {
        if (args.length < 2) {
          console.error("❌ Invalid arguments for direct command");
          console.error("Usage: tmcp direct <url> <subcommand>");
          console.error("       tmcp direct <url> --headers <json> <subcommand>");
          console.error("Subcommands:");
          console.error("  list                           List tools from the server");
          console.error("  call <tool-name> <json-params> Call a specific tool");
          process.exit(1);
        }

        const [url, subcommand, ...subArgs] = args;

        // Parse headers if provided
        let headers: Record<string, string> | undefined;
        if (headersJson) {
          try {
            headers = JSON.parse(headersJson);
            debugLog("Parsed headers:", headers);
          } catch (error) {
            console.error("❌ Invalid JSON in --headers option");
            console.error("Headers must be valid JSON, e.g.: '{\"x-api-key\": \"your-key\"}'");
            process.exit(1);
          }
        }

        switch (subcommand) {
          case "list": {
            await listToolsDirect(url, debugLog, headers);
            break;
          }

          case "call": {
            if (subArgs.length !== 2) {
              console.error("❌ Invalid arguments for direct call");
              console.error("Usage: tmcp direct <url> call <tool-name> <json-params>");
              process.exit(1);
            }
            const [toolName, params] = subArgs;
            await callToolDirect(url, toolName, params, debugLog, headers);
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

