import { describe, expect, it } from "vitest";
import { handleAgentRoute } from "../../worker/agent-routes";
import { handleDiscoveryRoute } from "../../worker/discovery-routes";
import type { Env } from "../../worker/index";

const env = {} as Env;

describe("ASC-01 public Worker surface", () => {
  it("publishes product identity without private archive access", async () => {
    const response = await handleAgentRoute(new Request("https://memories.example/api/v1/product"), env);
    expect(response).not.toBeNull();
    const body = await response!.json() as {
      product: string;
      private_archive_access: boolean;
      muse_boundary: string;
      public_capabilities: string[];
    };
    expect(body.product).toBe("Memories: My Story");
    expect(body.private_archive_access).toBe(false);
    expect(body.muse_boundary).toContain("does not invent");
    expect(body.public_capabilities).not.toContain("/archive");
  });

  it("returns a Story Starter without requiring DB, R2, auth, or archive state", async () => {
    const request = new Request("https://memories.example/api/v1/legacy-story-starter", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Agent-Client": "test-client" },
      body: JSON.stringify({
        relationship: "grandfather",
        themes: ["childhood", "work"],
        language: "en",
        prompt_count: 5
      })
    });
    const response = await handleAgentRoute(request, env);
    expect(response?.status).toBe(200);
    const body = await response!.json() as { questions: string[]; start_living_memory_url: string };
    expect(body.questions).toHaveLength(5);
    expect(body.start_living_memory_url).toMatch(/^https:\/\/memories\.example\/\?source=agent&starter_id=/);
  });

  it("publishes only the approved MCP tools under the current stateless revision", async () => {
    const request = new Request("https://memories.example/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/list"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    const response = await handleAgentRoute(request, env);
    expect(response?.status).toBe(200);
    const body = await response!.json() as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map(tool => tool.name)).toEqual([
      "memories.explain_living_memory",
      "memories.create_story_starter",
      "memories.create_interview_plan",
      "memories.create_photo_story_prompts",
      "memories.create_family_story_questions",
      "memories.start_living_memory"
    ]);
    expect(JSON.stringify(body)).not.toMatch(/search_family_archive|read_private_memory|list_user_memories|voice_recordings/);
  });

  it("rejects MCP routing header/body disagreement", async () => {
    const request = new Request("https://memories.example/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": "2026-07-28",
        "Mcp-Method": "tools/call",
        "Mcp-Name": "memories.start_living_memory"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "memories.explain_living_memory", arguments: {} }
      })
    });
    const response = await handleAgentRoute(request, env);
    expect(response?.status).toBe(400);
  });

  it("generates robots and sitemap from the active origin rather than an invented production host", async () => {
    const robots = handleDiscoveryRoute(new Request("https://staging.memories.example/robots.txt"));
    expect(await robots?.text()).toContain("https://staging.memories.example/sitemap.xml");
    const sitemap = handleDiscoveryRoute(new Request("https://staging.memories.example/sitemap.xml"));
    const xml = await sitemap?.text();
    expect(xml).toContain("https://staging.memories.example/llms.txt");
    expect(xml).not.toContain("example.com");
  });
});
