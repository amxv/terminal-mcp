import { readFileSync } from "fs";
import { join } from "path";

/**
 * Get package version from package.json
 */
export function getVersion(): string {
  try {
    const packagePath = join(__dirname, "..", "package.json");
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    return packageJson.version || "unknown";
  } catch (error) {
    return "unknown";
  }
}

/**
 * Create debug logging function
 */
export function createDebugLogger(debug: boolean) {
  return (...args: any[]) => {
    if (debug) {
      console.error("[DEBUG]", ...args);
    }
  };
}

/**
 * Display version information
 */
export function showVersion() {
  const version = getVersion();
  console.log(`terminal-mcp v${version}`);
  console.log("CLI tool for interacting with MCP servers (HTTP and stdio)");
  console.log("License: MIT");
  console.log("Repository: https://github.com/zueai/terminal-mcp");
}

/**
 * Exit with error message and usage
 */
export function exitWithError(message: string, usage?: string) {
  console.error(`❌ ${message}`);
  if (usage) {
    console.error(usage);
  }
  process.exit(1);
}