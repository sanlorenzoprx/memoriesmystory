import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawOrigin = process.env.MEMORIES_PUBLIC_ORIGIN?.trim();
if (!rawOrigin) throw new Error("Set MEMORIES_PUBLIC_ORIGIN to the authorized public https origin before generating MCP Registry metadata.");

const origin = new URL(rawOrigin);
if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash) {
  throw new Error("MEMORIES_PUBLIC_ORIGIN must be an https origin with no path, query, or fragment.");
}

const manifest = {
  $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  name: "io.github.sanlorenzoprx/memories-my-story",
  title: "Memories: My Story — Family Story Starter",
  description: "Create gentle family-story questions and interview starters, then hand the person into a human-controlled Living Memory experience without exposing a private family archive.",
  version: "1.0.0",
  remotes: [{ type: "streamable-http", url: `${origin.origin}/mcp` }]
};

const output = path.join(ROOT, "server.json");
await fs.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Generated ${output} for ${origin.origin}.`);
