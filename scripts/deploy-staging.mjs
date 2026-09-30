// Builds and deploys the isolated staging Worker from committed configuration
// plus the owner's ignored .env.staging.local. No staging identifier or secret
// is committed; the generated Wrangler file is ignored by Git.
//
//   npm run deploy:staging              # build, verify, deploy
//   npm run deploy:staging -- --dry-run # build, verify, stop before upload
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const generatedConfig = "wrangler.staging.generated.jsonc";

const required = [
  "MEMORIES_STAGING_WORKER_NAME",
  "MEMORIES_STAGING_D1_DATABASE_ID",
  "MEMORIES_STAGING_R2_BUCKET_NAME",
  "MEMORIES_STAGING_QUEUE_NAME",
  "VITE_CLERK_PUBLISHABLE_KEY"
];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(`Staging deploy blocked: set ${missing.join(", ")} in .env.staging.local.`);
  process.exit(1);
}

const env = (name) => process.env[name].trim();
if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(env("MEMORIES_STAGING_D1_DATABASE_ID"))) {
  console.error("Staging deploy blocked: MEMORIES_STAGING_D1_DATABASE_ID is the committed placeholder.");
  process.exit(1);
}

// wrangler.jsonc carries whole-line // comments only.
const base = JSON.parse(
  readFileSync(join(root, "wrangler.jsonc"), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
);
const queue = env("MEMORIES_STAGING_QUEUE_NAME");
const config = {
  ...base,
  name: env("MEMORIES_STAGING_WORKER_NAME"),
  d1_databases: base.d1_databases.map((database) => ({
    ...database,
    database_name: process.env.MEMORIES_STAGING_D1_DATABASE_NAME?.trim() || database.database_name,
    database_id: env("MEMORIES_STAGING_D1_DATABASE_ID")
  })),
  r2_buckets: base.r2_buckets.map((bucket) => ({ ...bucket, bucket_name: env("MEMORIES_STAGING_R2_BUCKET_NAME") })),
  queues: {
    producers: base.queues.producers.map((producer) => ({ ...producer, queue })),
    consumers: base.queues.consumers.map((consumer) => ({ ...consumer, queue }))
  }
};
writeFileSync(join(root, generatedConfig), `${JSON.stringify(config, null, 2)}\n`);

const run = (command, args) =>
  execFileSync(command, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });

// Vite reads .env.staging.local only in staging mode. Without it the Clerk
// publishable key is missing from the browser bundle (2026-09-23 regression).
run("npx", ["vite", "build", "--mode", "staging"]);
run("npx", ["tsc", "-p", "tsconfig.worker.json", "--noEmit"]);

const assetsDirectory = join(root, "dist", "assets");
const bundled = readdirSync(assetsDirectory)
  .filter((name) => name.endsWith(".js"))
  .some((name) => readFileSync(join(assetsDirectory, name), "utf8").includes(env("VITE_CLERK_PUBLISHABLE_KEY")));
if (!bundled) {
  console.error("Staging deploy blocked: the Clerk publishable key is not in the browser bundle.");
  process.exit(1);
}
console.log("Clerk publishable key present in the browser bundle.");

// --keep-vars preserves plain variables already set on the staging Worker;
// secrets are always preserved by Wrangler.
run("npx", ["wrangler", "deploy", "--config", generatedConfig, "--keep-vars", ...(dryRun ? ["--dry-run"] : [])]);
console.log(dryRun ? "Dry run complete; nothing was uploaded." : `Deployed ${config.name}.`);
