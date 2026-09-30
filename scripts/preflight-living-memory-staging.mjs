import { readFileSync } from "node:fs";

const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const phase1 = readFileSync(new URL("../config/phase-1.ts", import.meta.url), "utf8");

const checks = [
  {
    name: "ELEVENLABS_API_KEY",
    purpose: "ElevenLabs Scribe v2 transcription",
    validate: (value) => value.length >= 20
  },
  {
    name: "SHARE_TOKEN_PEPPER",
    purpose: "private family-share token protection",
    validate: (value) => value.length >= 32
  },
  {
    name: "MEMORIES_STAGING_QUEUE_NAME",
    purpose: "isolated staging processing queue",
    validate: (value) => /^memoriesmystory[-a-z0-9]*staging[-a-z0-9]*$/.test(value)
  },
  {
    name: "MEMORIES_STAGING_D1_DATABASE_ID",
    purpose: "isolated staging D1 database",
    validate: (value) =>
      /^[0-9a-f-]{36}$/i.test(value) &&
      value !== "00000000-0000-0000-0000-000000000000"
  },
  {
    name: "MEMORIES_STAGING_R2_BUCKET_NAME",
    purpose: "isolated staging media bucket",
    validate: (value) => /^memoriesmystory[-a-z0-9]*staging[-a-z0-9]*$/.test(value)
  },
  {
    name: "MEMORIES_STAGING_WORKER_NAME",
    purpose: "isolated staging Worker",
    validate: (value) => /^memoriesmystory[-a-z0-9]*staging[-a-z0-9]*$/.test(value)
  }
];

const results = checks.map((check) => {
  const value = process.env[check.name] ?? "";
  return {
    name: check.name,
    purpose: check.purpose,
    status: value ? (check.validate(value) ? "present" : "invalid") : "missing"
  };
});

const staticChecks = [
  {
    name: "AI_BINDING",
    purpose: "Muse model-provider binding",
    status: /"ai"\s*:\s*\{[\s\S]*?"binding"\s*:\s*"AI"/m.test(wrangler)
      ? "present"
      : "missing"
  },
  {
    name: "PROCESSING_QUEUE_BINDING",
    purpose: "transcription queue producer binding",
    status: /"binding"\s*:\s*"PROCESSING_QUEUE"/m.test(wrangler)
      ? "present"
      : "missing"
  },
  {
    name: "ELEVENLABS_PROVIDER_CONFIG",
    purpose: "selected transcription provider/model",
    status:
      /transcriptionProvider:\s*"elevenlabs"/m.test(phase1) &&
      /transcriptionModelId:\s*"scribe_v2"/m.test(phase1)
        ? "present"
        : "missing"
  }
];

console.log("memoriesmystory Living Memory staging preflight");
console.log("Values are intentionally redacted. No network request was made.");

for (const result of [...results, ...staticChecks]) {
  console.log(`${result.name}: ${result.status} — ${result.purpose}`);
}

const failures = [...results, ...staticChecks].filter(
  (result) => result.status !== "present"
);

if (failures.length > 0) {
  console.error(
    `Living Memory staging preflight blocked: ${failures.length} item(s) are missing or invalid.`
  );
  process.exitCode = 1;
} else {
  console.log(
    "Living Memory staging preflight ready: configuration shape is valid; live ElevenLabs/Muse evidence is still required."
  );
}
