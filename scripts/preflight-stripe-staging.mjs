const checks = [];

function present(name, value, predicate = (candidate) => Boolean(candidate)) {
  const ok = typeof value === "string" && predicate(value.trim());
  checks.push({ name, ok });
  return ok;
}

present("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY, (value) => value.startsWith("sk_test_") && value.length > 20);
present("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET, (value) => value.startsWith("whsec_") && value.length > 20);
present("VITE_STRIPE_PUBLISHABLE_KEY", process.env.VITE_STRIPE_PUBLISHABLE_KEY, (value) => value.startsWith("pk_test_") && value.length > 20);
present("VITE_CLERK_PUBLISHABLE_KEY", process.env.VITE_CLERK_PUBLISHABLE_KEY, (value) => value.startsWith("pk_") && value.length > 20);
present("SESSION_SECRET", process.env.SESSION_SECRET, (value) => value.length >= 32);
present("MEMORIES_STAGING_ORIGIN", process.env.MEMORIES_STAGING_ORIGIN, (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
});

console.log("Stripe staging preflight (values intentionally redacted; no network request made):");
for (const check of checks) {
  console.log(`${check.name}: ${check.ok ? "present/valid-shape" : "missing/invalid-shape"}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error(`Stripe staging preflight blocked: ${failed.length} required configuration item(s) missing or invalid.`);
  process.exitCode = 1;
} else {
  console.log("Stripe staging preflight ready for sandbox checkout acceptance.");
}
