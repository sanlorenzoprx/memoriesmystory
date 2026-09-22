import type {
  AgentSurfaceProtocol,
  PhotoStoryPromptInput,
  StoryStarterInput
} from "../app/domain/agent-surface";
import { buildStoryStarter } from "../app/services/agent/story-starter";
import { buildInterviewPlan } from "../app/services/agent/interview-plan";
import { buildPhotoStoryPrompts } from "../app/services/agent/photo-story-prompts";
import type { Env } from "./index";

const MAX_REQUEST_BYTES = 12_000;
const MCP_PROTOCOL_VERSION = "2026-07-28";

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function publicHeaders(cache = false): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": cache ? "public, max-age=300" : "no-store"
  };
}

function json(body: unknown, status = 200, cache = false): Response {
  return new Response(JSON.stringify(body), { status, headers: publicHeaders(cache) });
}

function clean(value: unknown, max = 80): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : undefined;
}

function protocol(value: unknown, fallback: AgentSurfaceProtocol): AgentSurfaceProtocol {
  return value === "api" || value === "mcp" || value === "search" || value === "webmcp" || value === "a2a"
    ? value
    : fallback;
}

function publicOrigin(request: Request): string {
  return new URL(request.url).origin;
}

function safeEvent(
  tool: string,
  id: string,
  source: { client?: string; protocol?: AgentSurfaceProtocol },
  success: boolean
): void {
  console.log("agent_surface_event", {
    product: "memoriesmystory",
    channel: "agent",
    tool,
    starter_id: id,
    agent_client: source.client || "unknown-agent",
    protocol: source.protocol || "api",
    success
  });
}

async function readJson<T>(request: Request): Promise<T | Response> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_REQUEST_BYTES) return json({ error: "Request too large" }, 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return json({ error: "Request too large" }, 413);
  try {
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return json({ error: "Request body must be valid JSON" }, 400);
  }
}

function sourceContext(
  body: { agent?: { client?: string; protocol?: AgentSurfaceProtocol } },
  request: Request,
  fallback: AgentSurfaceProtocol
) {
  return {
    client: clean(body.agent?.client) || clean(request.headers.get("X-Agent-Client")),
    protocol: protocol(body.agent?.protocol, fallback)
  };
}

function productMetadata(request: Request) {
  const origin = publicOrigin(request);
  return {
    product: "Memories: My Story",
    technical_name: "memoriesmystory",
    purpose: "Preserve a photograph together with the authentic human voice and story that give it meaning.",
    concept: {
      name: "Living Memory",
      includes: [
        "photograph",
        "authentic human voice",
        "story",
        "context",
        "provenance",
        "family contribution"
      ]
    },
    public_capabilities: [
      "/api/v1/legacy-story-starter",
      "/api/v1/interview-plan",
      "/api/v1/photo-story-prompts",
      "/mcp"
    ],
    private_archive_access: false,
    muse_boundary: "Muse helps someone remember. It does not invent the memory.",
    openapi: `${origin}/openapi.json`
  };
}

async function storyStarter(request: Request): Promise<Response> {
  const body = await readJson<StoryStarterInput>(request);
  if (body instanceof Response) return body;
  if (!body || typeof body !== "object") return json({ error: "Request body must be a JSON object" }, 400);
  const id = crypto.randomUUID();
  const source = sourceContext(body, request, "api");
  const result = buildStoryStarter(body, { id, publicOrigin: publicOrigin(request) });
  safeEvent("memories.create_story_starter", id, source, true);
  return json(result);
}

async function interviewPlan(request: Request): Promise<Response> {
  const body = await readJson<StoryStarterInput>(request);
  if (body instanceof Response) return body;
  if (!body || typeof body !== "object") return json({ error: "Request body must be a JSON object" }, 400);
  const id = crypto.randomUUID();
  const source = sourceContext(body, request, "api");
  const result = buildInterviewPlan(body, { id, publicOrigin: publicOrigin(request) });
  safeEvent("memories.create_interview_plan", id, source, true);
  return json(result);
}

async function photoPrompts(request: Request): Promise<Response> {
  const body = await readJson<PhotoStoryPromptInput>(request);
  if (body instanceof Response) return body;
  if (!body || typeof body !== "object") return json({ error: "Request body must be a JSON object" }, 400);
  const id = crypto.randomUUID();
  const source = sourceContext(body, request, "api");
  const result = buildPhotoStoryPrompts(body, { id, publicOrigin: publicOrigin(request) });
  safeEvent("memories.create_photo_story_prompts", id, source, true);
  return json(result);
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown, status = 200): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, result }), {
    status,
    headers: publicHeaders(false)
  });
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string, status = 400): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }), {
    status,
    headers: publicHeaders(false)
  });
}

function toolResult(value: unknown, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    structuredContent: value,
    ...(isError ? { isError: true } : {})
  };
}

const MCP_TOOLS = [
  {
    name: "memories.explain_living_memory",
    description: "Explain the Living Memory concept, authentic-voice principle, private archive boundary, and Muse behavior.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "memories.create_story_starter",
    description: "Create warm, non-factual prompts to help a person begin a family story. This public tool has no archive access.",
    inputSchema: {
      type: "object",
      properties: {
        relationship: { type: "string" },
        occasion: { type: "string" },
        themes: { type: "array", items: { type: "string" }, maxItems: 6 },
        language: { type: "string" },
        time_available_minutes: { type: "number" },
        prompt_count: { type: "number", minimum: 3, maximum: 12 }
      },
      additionalProperties: false
    }
  },
  {
    name: "memories.create_interview_plan",
    description: "Create a gentle interview sequence that is guidance, not a required questionnaire.",
    inputSchema: {
      type: "object",
      properties: {
        relationship: { type: "string" },
        occasion: { type: "string" },
        themes: { type: "array", items: { type: "string" }, maxItems: 6 },
        language: { type: "string" },
        time_available_minutes: { type: "number" },
        prompt_count: { type: "number", minimum: 3, maximum: 12 }
      },
      additionalProperties: false
    }
  },
  {
    name: "memories.create_photo_story_prompts",
    description: "Create prompts from a caller-supplied general photo context. This public tool never receives or inspects private photograph bytes.",
    inputSchema: {
      type: "object",
      properties: {
        photo_context: { type: "string", maxLength: 280 },
        relationship: { type: "string" },
        language: { type: "string" },
        prompt_count: { type: "number", minimum: 2, maximum: 8 }
      },
      additionalProperties: false
    }
  },
  {
    name: "memories.create_family_story_questions",
    description: "Return a concise set of family-story questions from the same deterministic Story Starter library.",
    inputSchema: {
      type: "object",
      properties: {
        relationship: { type: "string" },
        themes: { type: "array", items: { type: "string" }, maxItems: 6 },
        language: { type: "string" },
        prompt_count: { type: "number", minimum: 3, maximum: 12 }
      },
      additionalProperties: false
    }
  },
  {
    name: "memories.start_living_memory",
    description: "Return a human start URL for Memories: My Story. The tool does not create, upload, share, or mutate a private Memory Story.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  }
] as const;

function mcpHeaders(request: Request, rpc: JsonRpcRequest): Response | null {
  if (request.headers.get("MCP-Protocol-Version") !== MCP_PROTOCOL_VERSION) {
    return rpcError(rpc.id, -32020, `MCP-Protocol-Version must be ${MCP_PROTOCOL_VERSION}`);
  }
  if (request.headers.get("Mcp-Method") !== rpc.method) {
    return rpcError(rpc.id, -32020, "Mcp-Method header must match the JSON-RPC method");
  }
  if (rpc.method === "tools/call") {
    const bodyName = typeof rpc.params?.name === "string" ? rpc.params.name : "";
    if (request.headers.get("Mcp-Name") !== bodyName) {
      return rpcError(rpc.id, -32020, "Mcp-Name header must match params.name");
    }
  }
  return null;
}

function mcpClient(rpc: JsonRpcRequest): string | undefined {
  const meta = rpc.params?._meta;
  if (!meta || typeof meta !== "object") return undefined;
  const info = (meta as Record<string, unknown>)["io.modelcontextprotocol/clientInfo"];
  if (!info || typeof info !== "object") return undefined;
  return clean((info as Record<string, unknown>).name);
}

async function mcpToolCall(request: Request, rpc: JsonRpcRequest): Promise<Response> {
  const name = typeof rpc.params?.name === "string" ? rpc.params.name : "";
  const args = rpc.params?.arguments && typeof rpc.params.arguments === "object"
    ? rpc.params.arguments as Record<string, unknown>
    : {};
  const client = mcpClient(rpc);
  const source = { client, protocol: "mcp" as const };
  const origin = publicOrigin(request);

  if (name === "memories.explain_living_memory") {
    return rpcResult(rpc.id, toolResult(productMetadata(request)));
  }
  if (name === "memories.start_living_memory") {
    const id = crypto.randomUUID();
    safeEvent(name, id, source, true);
    return rpcResult(rpc.id, toolResult({
      starter_id: id,
      url: `${origin}/?${new URLSearchParams({ source: "agent", starter_id: id }).toString()}`,
      requires_user_action: true
    }));
  }
  if (name === "memories.create_photo_story_prompts") {
    const id = crypto.randomUUID();
    const value = buildPhotoStoryPrompts(args as PhotoStoryPromptInput, { id, publicOrigin: origin });
    safeEvent(name, id, source, true);
    return rpcResult(rpc.id, toolResult(value));
  }
  if (name === "memories.create_story_starter" || name === "memories.create_family_story_questions") {
    const id = crypto.randomUUID();
    const value = buildStoryStarter(args as StoryStarterInput, { id, publicOrigin: origin });
    safeEvent(name, id, source, true);
    return rpcResult(rpc.id, toolResult(name === "memories.create_family_story_questions" ? {
      starter_id: value.starter_id,
      opening_question: value.opening_question,
      questions: value.questions,
      follow_up_prompts: value.follow_up_prompts,
      start_living_memory_url: value.start_living_memory_url
    } : value));
  }
  if (name === "memories.create_interview_plan") {
    const id = crypto.randomUUID();
    const value = buildInterviewPlan(args as StoryStarterInput, { id, publicOrigin: origin });
    safeEvent(name, id, source, true);
    return rpcResult(rpc.id, toolResult(value));
  }
  return rpcResult(rpc.id, toolResult({ error: `Unknown tool: ${name}` }, true));
}

async function mcp(request: Request): Promise<Response> {
  const body = await readJson<JsonRpcRequest>(request);
  if (body instanceof Response) return body;
  if (body.jsonrpc !== "2.0" || !body.method) return rpcError(body.id, -32600, "Invalid Request");
  const headerError = mcpHeaders(request, body);
  if (headerError) return headerError;

  if (body.method === "server/discover") {
    return rpcResult(body.id, {
      protocolVersion: MCP_PROTOCOL_VERSION,
      serverInfo: { name: "memoriesmystory", version: "asc-01" },
      capabilities: { tools: {} }
    });
  }
  if (body.method === "tools/list") return rpcResult(body.id, { tools: MCP_TOOLS });
  if (body.method === "tools/call") return mcpToolCall(request, body);
  return rpcError(body.id, -32601, "Method not found");
}

export async function handleAgentRoute(request: Request, _env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if ((url.pathname === "/mcp" || url.pathname.startsWith("/api/v1/")) && request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Agent-Client, MCP-Protocol-Version, Mcp-Method, Mcp-Name",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  if (url.pathname === "/api/v1/product" && request.method === "GET") return json(productMetadata(request), 200, true);
  if (url.pathname === "/api/v1/legacy-story-starter" && request.method === "POST") return storyStarter(request);
  if (url.pathname === "/api/v1/interview-plan" && request.method === "POST") return interviewPlan(request);
  if (url.pathname === "/api/v1/photo-story-prompts" && request.method === "POST") return photoPrompts(request);
  if (url.pathname === "/mcp" && request.method === "POST") return mcp(request);
  return null;
}
