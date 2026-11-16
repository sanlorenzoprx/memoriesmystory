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
//     node --experimental-strip-types scripts/muse-eval.ts [--model=@cf/...] [--runs=3]
import { readFileSync } from "node:fs";
import { museRememberingSystemPrompt } from "../worker/muse-prompts.ts";
import { normalizeQuestion } from "../worker/muse-guard.ts";
import { museViolations } from "../tests/eval/muse-invariants.ts";

type Scenario = { id: string; locale: string; transcript: string };
const flag = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const account = process.env.CLOUDFLARE_ACCOUNT_ID,
  token = process.env.CLOUDFLARE_API_TOKEN,
  model = flag("model") ?? "@cf/meta/llama-3.1-8b-instruct-fast",
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
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          { role: "system", content: museRememberingSystemPrompt },
          { role: "user", content: `Storyteller transcript:\n${scenario.transcript}` },
        ],
        max_tokens: 80,
        temperature: 0.4,
      }),
    });
    const ms = Math.round(performance.now() - started);
    const body = (await response.json().catch(() => null)) as { result?: { response?: string } } | null;
    const raw = body?.result?.response ?? "";
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
