const zeroD1Id = "00000000-0000-0000-0000-000000000000";

function exactHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.origin === value &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function exactHttpsOriginList(value) {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 && origins.every(exactHttpsOrigin);
}

const checks = [
  {
    name: "SESSION_SECRET",
    purpose: "peppered application sessions",
    validate: (value) => value.length >= 32
  },
  {
    name: "CLERK_SECRET_KEY",
    purpose: "server-side Clerk verification",
    validate: (value) => value.length >= 20
  },
  {
    name: "VITE_CLERK_PUBLISHABLE_KEY",
    purpose: "Clerk browser initialization",
    validate: (value) => value.length >= 20
  },
  {
    name: "CLERK_AUTHORIZED_PARTIES",
    purpose: "exact authorized application origins",
    validate: exactHttpsOriginList
  },
  {
    name: "MEMORIES_STAGING_ORIGIN",
    purpose: "isolated HTTPS staging origin",
    validate: exactHttpsOrigin
  },
  {
    name: "CLOUDFLARE_ACCOUNT_ID",
    purpose: "staging Cloudflare account selection",
    validate: (value) => value.length >= 16
  },
  {
    name: "CLOUDFLARE_API_TOKEN",
    purpose: "authorized staging provisioning/deployment",
    validate: (value) => value.length >= 20
  },
  {
    name: "MEMORIES_STAGING_D1_DATABASE_ID",
    purpose: "non-production D1 database",
    validate: (value) => /^[0-9a-f-]{36}$/i.test(value) && value !== zeroD1Id
  },
  {
    name: "MEMORIES_STAGING_R2_BUCKET_NAME",
    purpose: "private staging originals bucket",
    validate: (value) => /^memoriesmystory[-a-z0-9]*staging[-a-z0-9]*$/.test(value)
  },
  {
    name: "MEMORIES_STAGING_WORKER_NAME",
    purpose: "isolated staging Worker",
    validate: (value) => /^memoriesmystory[-a-z0-9]*staging[-a-z0-9]*$/.test(value)
  },
  {
    name: "CLERK_EMAIL_ENABLED",
    purpose: "email verification acceptance path",
    validate: (value) => value === "true"
  },
  {
    name: "CLERK_GOOGLE_ENABLED",
    purpose: "Google acceptance path",
    validate: (value) => value === "true"
  },
  {
    name: "CLERK_FACEBOOK_ENABLED",
    purpose: "Facebook acceptance path",
    validate: (value) => value === "true"
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

console.log("memoriesmystory Packet 4 identity staging preflight");
console.log("Values are intentionally redacted. No network request was made.");
for (const result of results) {
  console.log(`${result.name}: ${result.status} — ${result.purpose}`);
}

const optionalJwtKey = process.env.CLERK_JWT_KEY;
console.log(`CLERK_JWT_KEY: ${optionalJwtKey ? "present" : "optional"} — networkless JWT verification key`);

const failures = results.filter((result) => result.status !== "present");
if (failures.length > 0) {
  console.error(`Preflight blocked: ${failures.length} required item(s) are missing or invalid.`);
  process.exitCode = 1;
} else {
  console.log("Preflight ready: configuration shape is valid; live provider evidence is still required.");
}
