Below is a concise “recipe” to get from TypeScript source → tiny, self‑contained binaries that run on both Linux and macOS and talk to your remote MCP Streamable‑HTTP server.

⸻

1 Project layout (suggested)

mcp-cli/
├─ src/
│  └─ cli.ts         # entry point (see §2 for a starter)
├─ bunfig.toml       # optional Bun settings
├─ package.json
└─ README.md

You can keep using Bun as your package manager (bun install etc.); the same runtime is what will be embedded into the final executable.

⸻

2 Minimal CLI skeleton

#!/usr/bin/env bun
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: { endpoint: { type: "string", default: "https://my‑mcp.example.com/mcp" } }
});
const endpoint = values.endpoint as string;

/**
 * Send one JSON‑RPC 2.0 request and stream the server’s replies.
 */
export async function rpc(method: string, params: unknown) {
  const id = crypto.randomUUID();   // unique id for this call
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream"
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params })
  });

  // The server MAY respond with JSON (one‑shot) *or* SSE (stream) – MCP §Streamable HTTP
  if (res.headers.get("content-type")?.startsWith("application/json")) {
    const body = await res.json();
    console.log(body.result ?? body.error);
    return;
  }

  // Stream via Server‑Sent Events
  const stream = res.body!.pipeThrough(new TextDecoderStream());
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    // SSE events are separated by double newline
    for (const event of buffer.split("\n\n")) {
      if (!event.trim()) continue;
      const dataLine = event.split("\n").find(l => l.startsWith("data:"));
      if (dataLine) {
        const payload = JSON.parse(dataLine.slice(5));
        console.log(payload.result ?? payload);   // customise as you like
      }
    }
    buffer = buffer.endsWith("\n\n") ? "" : buffer;
  }
}

// CLI entry
(async () => {
  const [cmd, ...args] = positionals;
  switch (cmd) {
    case "tools":
      await rpc("listTools", {});          // example RPC exposed by your server
      break;
    case "run":
      await rpc("runTool", { name: args[0], args: args.slice(1) });
      break;
    default:
      console.log(`mcp-cli tools | run <tool> [...]   --endpoint=<url>`);
  }
})();

Why it works
	•	MCP Streamable‑HTTP requires each JSON‑RPC call be a fresh POST; if the server chooses streaming it replies with Content-Type: text/event-stream and pushes JSON‑RPC messages in SSE frames  ￼.
	•	Bun already ships fetch, ReadableStream, crypto, etc. – no external deps.

⸻

3 Building single‑file executables with Bun

# Inside project root
bun build ./src/cli.ts --compile \
  --target=bun-linux-x64       --outfile dist/mcp-linux
bun build ./src/cli.ts --compile \
  --target=bun-darwin-arm64    --outfile dist/mcp-macos-arm
bun build ./src/cli.ts --compile \
  --target=bun-darwin-x64      --outfile dist/mcp-macos-x64

	•	--compile bundles all JS/TS code + a trimmed Bun runtime into one file  ￼.
	•	Each binary is typically 5–12 MB and launches in ≪ 100 ms – far smaller & faster than Node/SEA.
	•	Cross‑compiling works from any host: Bun downloads Zig under the hood; no extra setup needed  ￼.

Distribute the binaries however you like (GitHub Releases, Homebrew tap, a curl | sh script that drops it into /usr/local/bin, etc.).

⸻

4 Testing against a reference MCP server

Until your own server is ready, you can point the CLI at the open‑source reference implementation:

git clone https://github.com/invariantlabs-ai/mcp-streamable-http
cd mcp-streamable-http/typescript-example/server
bun install && bun run build && bun run start
# default endpoint: http://localhost:8123/mcp

The repo also ships a simple TypeScript client you can compare with  ￼.
