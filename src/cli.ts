#!/usr/bin/env bun
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    endpoint: { type: "string", default: "https://my-mcp.example.com/mcp" },
  },
  allowPositionals: true,
});
const endpoint = values.endpoint as string;

/**
 * Send one JSON-RPC 2.0 request and stream the server’s replies.
 */
export async function rpc(method: string, params: unknown) {
  const id = crypto.randomUUID(); // unique id for this call
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });

  // The server MAY respond with JSON (one-shot) *or* SSE (stream)
  if (res.headers.get("content-type")?.startsWith("application/json")) {
    const body = await res.json();
    console.log(body.result ?? body.error);
    return;
  }

  // Stream via Server-Sent Events
  const stream = res.body!.pipeThrough(new TextDecoderStream());
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk;
    // SSE events are separated by double newline
    for (const event of buffer.split("\n\n")) {
      if (!event.trim()) continue;
      const dataLine = event.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        const payload = JSON.parse(dataLine.slice(5));
        console.log(payload.result ?? payload); // customise as you like
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
      await rpc("listTools", {});
      break;
    case "run":
      await rpc("runTool", { name: args[0], args: args.slice(1) });
      break;
    default:
      console.log(`terminal-mcp tools | run <tool> [...]   --endpoint=<url>`);
  }
})();

