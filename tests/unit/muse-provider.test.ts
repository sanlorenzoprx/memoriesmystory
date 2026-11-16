/// <reference types="@cloudflare/workers-types" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { phase1Config } from "../../config/phase-1";
import { CloudflareMuseTextProvider, createMuseTextProvider, MuseModelRefused } from "../../worker/providers/muse-provider";

type Call = { model: string; input: { messages: { role: string; content: string }[]; max_tokens: number }; options?: { gateway?: { id: string } } };
const request = { system: "You are Muse.", user: "Storyteller transcript: Abuela's kitchen.", maxTokens: 120, temperature: 0.4 };

function fakeAi(answer: (call: Call) => unknown) {
  const calls: Call[] = [];
  const ai = {
    run: async (model: string, input: Call["input"], options?: Call["options"]) => {
      const call = { model, input, options };
      calls.push(call);
      return answer(call);
    },
  } as unknown as Ai;
  return { ai, calls };
}

describe("Muse model routing (owner decision 2026-11-16: Gemini first)", () => {
  it("sends Muse to Gemini through AI Gateway and reads the Chat Completions reply", async () => {
    const { ai, calls } = fakeAi(() => ({ choices: [{ message: { content: "Who stood beside you at the stove?" } }] }));
    const text = await createMuseTextProvider({ AI: ai, AI_GATEWAY_ID: "memoriesmystory-staging" }).generate(request);
    expect(text).toBe("Who stood beside you at the stove?");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe("google/gemini-3-flash");
    expect(calls[0]!.options).toEqual({ gateway: { id: "memoriesmystory-staging" } });
    expect(calls[0]!.input.messages).toEqual([
      { role: "system", content: "You are Muse." },
      { role: "user", content: "Storyteller transcript: Abuela's kitchen." },
    ]);
    // Room for Gemini's reasoning; the guard still trims what is shown.
    expect(calls[0]!.input.max_tokens).toBe(120 + phase1Config.ai.museReasoningTokenAllowance);
  });

  it("uses Cloudflare's default gateway when none is configured", async () => {
    const { ai, calls } = fakeAi(() => ({ choices: [{ message: { content: [{ type: "text", text: "What do you smell?" }] } }] }));
    expect(await createMuseTextProvider({ AI: ai }).generate(request)).toBe("What do you smell?");
    expect(calls[0]!.options).toEqual({ gateway: { id: "default" } });
  });

  it("keeps listening on Workers AI when Gemini is unavailable or answers nothing", async () => {
    for (const failure of [() => { throw new Error("gateway outage"); }, () => ({ choices: [] })]) {
      const { ai, calls } = fakeAi((call) => (call.model.startsWith("@cf/") ? { response: "What happened next?" } : failure()));
      expect(await createMuseTextProvider({ AI: ai }).generate(request)).toBe("What happened next?");
      expect(calls.map((call) => call.model)).toEqual(["google/gemini-3-flash", "@cf/meta/llama-3.1-8b-instruct-fast"]);
      // Workers AI models are called without a gateway option and with the plain limit.
      expect(calls[1]!.options).toBeUndefined();
      expect(calls[1]!.input.max_tokens).toBe(120);
    }
  });

  it("throws when every model fails, so the caller uses its fixed question", async () => {
    const { ai } = fakeAi(() => { throw new Error("all down"); });
    await expect(createMuseTextProvider({ AI: ai }).generate(request)).rejects.toThrow("all down");
  });

  it("refuses a third-party model that may keep a family's words, without calling it", async () => {
    const { ai, calls } = fakeAi(() => ({ choices: [{ message: { content: "x" } }] }));
    await expect(new CloudflareMuseTextProvider(ai, "google/gemini-3.7-flash").generate(request)).rejects.toBeInstanceOf(MuseModelRefused);
    expect(calls).toHaveLength(0);
  });

  it("only lists zero-data-retention models, with the primary among them", () => {
    expect(phase1Config.ai.museZeroRetentionModels).toContain(phase1Config.ai.museModelId);
    expect(phase1Config.ai.museFallbackModelId.startsWith("@cf/")).toBe(true);
  });

  describe("direct to Google with the owner's own Gemini key", () => {
    const key = "synthetic-gemini-key-not-real";
    afterEach(() => vi.unstubAllGlobals());
    function stubGoogle(reply: () => Response) {
      const calls: { url: string; init: RequestInit }[] = [];
      vi.stubGlobal("fetch", async (url: string, init: RequestInit) => (calls.push({ url, init }), reply()));
      return calls;
    }

    it("calls Google directly, not AI Gateway, so usage draws on the owner's Gemini credits", async () => {
      const google = stubGoogle(() => Response.json({ choices: [{ message: { content: "What song was playing?" } }] }));
      const { ai, calls } = fakeAi(() => ({ response: "unused" }));
      const text = await createMuseTextProvider({ AI: ai, GEMINI_API_KEY: ` ${key} ` }).generate(request);
      expect(text).toBe("What song was playing?");
      expect(calls).toHaveLength(0);
      expect(google).toHaveLength(1);
      expect(google[0]!.url).toBe("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
      expect((google[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${key}`);
      const body = JSON.parse(String(google[0]!.init.body)) as Record<string, unknown>;
      expect(body).toMatchObject({ model: phase1Config.ai.museDirectGeminiModel, reasoning_effort: "low", temperature: 0.4 });
      expect(body.messages).toEqual([
        { role: "system", content: "You are Muse." },
        { role: "user", content: "Storyteller transcript: Abuela's kitchen." },
      ]);
    });

    it("falls back to Workers AI when Google refuses, without exposing the key or Google's reply", async () => {
      for (const status of [401, 429, 500]) {
        stubGoogle(() => new Response(JSON.stringify({ error: { message: `echo ${key}` } }), { status }));
        const { ai, calls } = fakeAi(() => ({ response: "Who else was there?" }));
        expect(await createMuseTextProvider({ AI: ai, GEMINI_API_KEY: key }).generate(request)).toBe("Who else was there?");
        expect(calls.map((call) => call.model)).toEqual(["@cf/meta/llama-3.1-8b-instruct-fast"]);
      }
      stubGoogle(() => new Response("{}", { status: 503 }));
      const { ai } = fakeAi(() => { throw new Error("workers ai down"); });
      const error = await createMuseTextProvider({ AI: ai, GEMINI_API_KEY: key }).generate(request).catch((reason: Error) => reason);
      expect(String(error)).not.toContain(key);
    });

    it("uses the gateway route when no key is set", async () => {
      const google = stubGoogle(() => Response.json({}));
      const { ai, calls } = fakeAi(() => ({ choices: [{ message: { content: "Where were you?" } }] }));
      expect(await createMuseTextProvider({ AI: ai, GEMINI_API_KEY: "  " }).generate(request)).toBe("Where were you?");
      expect(google).toHaveLength(0);
      expect(calls[0]!.model).toBe("google/gemini-3-flash");
    });
  });

  it("sends a photograph inline to Gemini on either route, and never to the text-only fallback", async () => {
    const image = { mimeType: "image/jpeg", base64: "CQk=" };
    const google: RequestInit[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => (google.push(init), Response.json({ choices: [{ message: { content: "A porch." } }] })));
    const direct = fakeAi(() => ({ response: "unused" }));
    expect(await createMuseTextProvider({ AI: direct.ai, GEMINI_API_KEY: "synthetic-key" }).generate({ ...request, image })).toBe("A porch.");
    const sent = JSON.parse(String(google[0]!.body)) as { messages: { content: unknown }[] };
    expect(sent.messages[1]!.content).toEqual([
      { type: "text", text: request.user },
      { type: "image_url", image_url: { url: "data:image/jpeg;base64,CQk=" } },
    ]);
    vi.unstubAllGlobals();
    const gateway = fakeAi((call) => { if (call.model.startsWith("@cf/")) throw new Error("must not be called"); throw new Error("gemini down"); });
    await expect(createMuseTextProvider({ AI: gateway.ai }).generate({ ...request, image })).rejects.toThrow();
    expect(gateway.calls.map((call) => call.model)).toEqual(["google/gemini-3-flash"]);
  });
});
