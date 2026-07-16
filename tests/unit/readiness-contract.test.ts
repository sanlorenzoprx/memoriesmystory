import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import bindings from "../../config/cloudflare-bindings.example.json";

describe("production-readiness configuration contract", () => {
  it("uses the Phase 1 Cloudflare binding names consistently", () => {
    expect(bindings.d1.binding).toBe("DB");
    expect(bindings.r2.binding).toBe("MEDIA_BUCKET");
    expect(bindings.ai.binding).toBe("AI");
    expect(bindings.queue.binding).toBe("PROCESSING_QUEUE");
  });

  it("declares secret names without committing values", () => {
    const example = readFileSync(new URL("../../.dev.vars.example", import.meta.url), "utf8");
    const secretNames = [
      "SESSION_SECRET",
      "SHARE_TOKEN_PEPPER",
      "EMAIL_PROVIDER_API_KEY",
      "GOOGLE_CLIENT_SECRET",
      "FACEBOOK_APP_SECRET",
      "TURNSTILE_SECRET_KEY",
      "TRANSCRIPTION_FALLBACK_API_KEY"
    ];

    for (const name of secretNames) {
      expect(example).toContain(`${name}=`);
      expect(example).not.toMatch(new RegExp(`^${name}=.+$`, "m"));
    }
  });

  it("ignores local Cloudflare secret files while keeping the template", () => {
    const gitignore = readFileSync(new URL("../../.gitignore", import.meta.url), "utf8");

    expect(gitignore).toContain(".dev.vars.*");
    expect(gitignore).toContain("!.dev.vars.example");
  });
});
