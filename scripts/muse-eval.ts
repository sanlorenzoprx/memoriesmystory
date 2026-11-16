// Muse evaluation against the live model (lane L6, B01/B02).
//
// Runs the synthetic scenarios in tests/fixtures/muse/scenarios.json through
// Workers AI with Muse's real prompt and guard, and reports for each: the raw
// answer, what a storyteller would see, any invariant violations, and
// latency. Only synthetic transcripts are sent. Never point this at real
// family data.
//
// Usage (the operator's own shell; never commit or paste the token):
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... \
//     node --experimental-strip-types scripts/muse-eval.ts [--model=google/gemini-3-flash|@cf/...] [--runs=3]
//
// The default is Muse's configured model. Gemini models go through AI Gateway
// with unified billing (no Google key); set AI_GATEWAY_ID to use a named gateway.
import { readFileSync } from "node:fs";
import { museRememberingSystemPrompt } from "../worker/muse-prompts.ts";
import { normalizeQuestion } from "../worker/muse-guard.ts";
import { museViolations } from "../tests/eval/muse-invariants.ts";
import { phase1Config } from "../config/phase-1.ts";
import { isThirdPartyModel, modelText } from "../worker/providers/model-output.ts";

type Scenario = { id: string; locale: string; transcript: string };
const flag = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const account = process.env.CLOUDFLARE_ACCOUNT_ID,
  token = process.env.CLOUDFLARE_API_TOKEN,
  model = flag("model") ?? phase1Config.ai.museModelId,
  thirdParty = isThirdPartyModel(model),
  runs = Number(flag("runs") ?? 3);
if (!account || !token) {
  console.error("Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your shell. Nothing was sent.");
  process.exit(2);
}
const { scenarios } = JSON.parse(readFileSync(new URL("../tests/fixtures/muse/scenarios.json", import.meta.url), "utf8")) as { scenarios: Scenario[] };

const results: { scenario: string; raw: string; shown: string; fallback: boolean; violations: string[]; rawViolations: string[]; ms: number }[] = [];
for (const scenario of scenarios)
  for (let run = 0; run < runs; run++) {
    const started = performance.now();
    const messages = [
      { role: "system", content: museRememberingSystemPrompt },
      { role: "user", content: `Storyteller transcript:\n${scenario.transcript}` },
    ];
    const response = await fetch(
      thirdParty
        ? `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`
        : `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(thirdParty && process.env.AI_GATEWAY_ID ? { "cf-aig-gateway-id": process.env.AI_GATEWAY_ID } : {}),
        },
        body: JSON.stringify(
          thirdParty
            ? { model, messages, max_tokens: 80 + phase1Config.ai.museReasoningTokenAllowance, temperature: 0.4 }
            : { messages, max_tokens: 80, temperature: 0.4 },
        ),
      },
    );
    const ms = Math.round(performance.now() - started);
    const body = (await response.json().catch(() => null)) as { result?: unknown } | null;
    // OpenAI-compatible replies are bare; the older Workers AI route wraps them in `result`.
    const raw = modelText(body) || modelText(body?.result);
    const shown = normalizeQuestion(raw, scenario.locale, scenario.transcript);
    results.push({
      scenario: scenario.id,
      raw,
      shown,
      fallback: shown !== raw.trim(),
      violations: museViolations(shown, scenario.locale, scenario.transcript),
      rawViolations: museViolations(raw, scenario.locale, scenario.transcript),
      ms,
    });
  }

const latencies = results.map((result) => result.ms).sort((a, b) => a - b);
const percentile = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length))];
console.log(JSON.stringify({
  model,
  runs: results.length,
  shownViolations: results.filter((result) => result.violations.length).length,
  rawViolations: results.filter((result) => result.rawViolations.length).length,
  fallbacks: results.filter((result) => result.fallback).length,
  latencyMs: { p50: percentile(50), p95: percentile(95) },
  results,
}, null, 2));
