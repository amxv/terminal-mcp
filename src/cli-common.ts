import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

// Version will be injected at build time via --define
declare const BUILD_VERSION: string;

/**
 * Get package version - injected at build time or from package.json in dev
 */
export function getVersion(): string {
  // In production builds, BUILD_VERSION is defined via --define flag
  if (typeof BUILD_VERSION !== 'undefined') {
    return BUILD_VERSION;
  }

  // In development mode, read from package.json
  try {
    const packagePath = join(__dirname, "..", "package.json");
    if (existsSync(packagePath)) {
      const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
      return packageJson.version || "unknown";
    }
  } catch (error) {
    // Ignore error and fallback
  }

  return "unknown";
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

/**
 * Limit line length for output to ensure compatibility with coding agents
 * that have line length limitations (e.g., OpenAI Codex with 1600 byte limit)
 */
export function limitLineLength(text: string, maxLength: number = 1550): string {
  const lines = text.split('\n');
  const processedLines: string[] = [];

  for (const line of lines) {
    if (line.length <= maxLength) {
      processedLines.push(line);
    } else {
      // Split long lines at word boundaries when possible
      let remainingText = line;
      while (remainingText.length > maxLength) {
        let cutPoint = maxLength;

        // Try to find a good break point (space, comma, or other punctuation)
        const searchStart = Math.max(0, maxLength - 100);
        const breakChars = [' ', ',', ';', ':', '"', '}', ']', ')', '\t'];

        for (let i = maxLength - 1; i >= searchStart; i--) {
          if (breakChars.includes(remainingText[i])) {
            cutPoint = i + 1;
            break;
          }
        }

        // If no good break point found, force break at maxLength
        if (cutPoint === maxLength && remainingText.length > maxLength) {
          // Look for JSON-safe break points near the end
          for (let i = maxLength - 10; i < maxLength; i++) {
            if (remainingText[i] === '"' && remainingText[i + 1] === ',') {
              cutPoint = i + 2;
              break;
            }
          }
        }

        processedLines.push(remainingText.substring(0, cutPoint));
        remainingText = remainingText.substring(cutPoint);
      }

      // Add any remaining text
      if (remainingText.length > 0) {
        processedLines.push(remainingText);
      }
    }
  }

  return processedLines.join('\n');
}

/**
 * Safe console.log that ensures no line exceeds 1550 bytes for cloud environments
 * Applies line limiting to final output while preserving JSON validity
 */
export function safeConsoleLog(data: any): void {
  if (typeof data === 'string') {
    // For plain strings, apply standard line limiting
    const limitedOutput = limitLineLength(data);
    console.log(limitedOutput);
  } else {
    // For objects, first convert to JSON then apply smart line limiting
    const jsonString = JSON.stringify(data, null, 2);
    const safeLimitedJson = limitJsonLineLength(jsonString);
    console.log(safeLimitedJson);
  }
}

/**
 * Apply line length limiting to JSON output while preserving JSON structure
 * Uses a simpler approach that breaks long strings with escaped newlines
 */
function limitJsonLineLength(jsonString: string, maxLength: number = 1550): string {
  // Parse and re-stringify the JSON with line length limiting applied to string values
  try {
    const data = JSON.parse(jsonString);
    const processedData = processJsonForLineLength(data, maxLength);
    return JSON.stringify(processedData, null, 2);
  } catch (error) {
    // If JSON parsing fails, fall back to simple line limiting
    return limitLineLength(jsonString, maxLength);
  }
}

/**
 * Recursively process JSON data to ensure string values don't create overly long lines
 */
function processJsonForLineLength(data: any, maxLength: number): any {
  if (typeof data === 'string') {
    // Break long strings at word boundaries with \n characters
    return breakLongString(data, maxLength - 100); // Leave room for JSON formatting
  } else if (Array.isArray(data)) {
    return data.map(item => processJsonForLineLength(item, maxLength));
  } else if (data && typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = processJsonForLineLength(value, maxLength);
    }
    return result;
  }
  return data;
}

/**
 * Break long strings at word boundaries using actual newlines
 */
function breakLongString(text: string, maxLength: number = 1450): string {
  if (text.length <= maxLength) {
    return text;
  }

  const lines: string[] = [];
  let currentLine = '';
  const words = text.split(' ');

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxLength) {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word itself is too long, force break it
        lines.push(word.substring(0, maxLength));
        currentLine = word.substring(maxLength);
      }
    } else {
      if (currentLine) {
        currentLine += ' ' + word;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  // Join with actual newlines (JSON.stringify will properly escape them)
  return lines.join('\n');
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  // Remove 'v' prefix if present
  const version1 = v1.replace(/^v/, '');
  const version2 = v2.replace(/^v/, '');

  const parts1 = version1.split(/[-.]/).map((part, index) => {
    if (index < 3) {
      return parseInt(part, 10) || 0;
    }
    return part; // prerelease parts
  });

  const parts2 = version2.split(/[-.]/).map((part, index) => {
    if (index < 3) {
      return parseInt(part, 10) || 0;
    }
    return part; // prerelease parts
  });

  // Compare major, minor, patch
  for (let i = 0; i < 3; i++) {
    const num1 = parts1[i] as number;
    const num2 = parts2[i] as number;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // If versions are equal up to patch, check prerelease
  const hasPrerelease1 = parts1.length > 3;
  const hasPrerelease2 = parts2.length > 3;

  // Stable version is greater than prerelease
  if (!hasPrerelease1 && hasPrerelease2) return 1;
  if (hasPrerelease1 && !hasPrerelease2) return -1;

  // Both are stable or both are prerelease
  if (!hasPrerelease1 && !hasPrerelease2) return 0;

  // Compare prerelease versions (simplified)
  return version1.localeCompare(version2);
}

/**
 * Fetch latest version from GitHub API
 */
export async function fetchLatestVersion(repo: string): Promise<{ version: string; url: string } | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);
    if (!response.ok) {
      throw new Error(`GitHub API responded with ${response.status}`);
    }

    const data = await response.json();
    return {
      version: data.tag_name,
      url: data.html_url
    };
  } catch (error) {
    console.error("Failed to fetch latest version:", error);
    return null;
  }
}

/**
 * Detect current platform for downloads
 */
export function detectPlatform(): string {
  const os = process.platform;
  const arch = process.arch;

  switch (os) {
    case 'darwin':
      return arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
    case 'linux':
      // process.arch uses different naming than uname -m
      return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
    default:
      throw new Error(`Unsupported platform: ${os}-${arch}`);
  }
}

/**
 * Check if running as agent binary
 */
export function isAgentBinary(): boolean {
  // Check if the binary name contains 'agent'
  const binaryPath = process.argv[0];
  return binaryPath.includes('agent') || binaryPath.includes('tmcp-agent');
}

/**
 * Get the install script URL based on binary type
 */
export function getInstallScriptUrl(repo: string): string {
  const isAgent = isAgentBinary();
  const scriptName = isAgent ? 'install-agent.sh' : 'install.sh';
  return `https://raw.githubusercontent.com/${repo}/main/${scriptName}`;
}

/**
 * Execute upgrade by downloading and running install script
 */
export async function executeUpgrade(repo: string, debugLog: (message: string, ...args: any[]) => void): Promise<void> {
  const installScriptUrl = getInstallScriptUrl(repo);
  debugLog("Install script URL:", installScriptUrl);

  try {
    console.log("🔄 Downloading latest version...");

    // Use curl to download and execute the install script
    const command = `curl -fsSL "${installScriptUrl}" | bash`;
    debugLog("Executing command:", command);

    execSync(command, {
      stdio: 'inherit',
      env: { ...process.env }
    });

    console.log("✅ Upgrade completed successfully!");
    console.log("You can now run 'tmcp --version' to verify the new version.");

  } catch (error) {
    console.error("❌ Upgrade failed:", error);
    console.error("You can try upgrading manually by running:");
    console.error(`curl -fsSL ${installScriptUrl} | bash`);
    throw error;
  }
}