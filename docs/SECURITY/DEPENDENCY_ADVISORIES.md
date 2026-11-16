# Dependency advisories

CI runs `npm audit --omit=dev --audit-level=high` after `npm ci`. Any high or critical advisory in a dependency that ships in the Worker or the app fails the build. Development tooling is reviewed in this file at each dependency update.

## 2026-11-16 update (L7.4)

| Package | Was | Now | Advisory | Where it runs |
| --- | --- | --- | --- | --- |
| `react-router` | 8.2.0 | 8.5.1 | High: RSC-mode CSRF bypass. The app does not use RSC mode; updated anyway. | App |
| `vite` | 8.1.4 | 8.3.8 | High: dev-server cross-origin script execution and file serving; `launch-editor` | Build and local dev only |
| `vitest` | 4.1.10 | 4.1.12 | Moderate: mocker path traversal and code injection | Tests only |
| `wrangler`, `miniflare`, `workers-types` and other tooling | — | latest within existing ranges | Picked up when the lockfile was regenerated | Local dev, tests, deploy |

`npm audit fix` and `npm update` fail on npm 10.9 (`Cannot read properties of null (reading 'edgesOut')`). The lockfile was resolved with npm 11.6.2 and then completed with npm 10, so `npm ci` works on CI's Node 22 npm.

## Accepted, with reason

| Advisory | Severity | Path | Why accepted | Review by |
| --- | --- | --- | --- | --- |
| `uuid` missing buffer bounds check (GHSA-w5hq-g745-h8pq) | Moderate | `@cloudflare/realtimekit` → `uuid` | The flaw needs a caller-supplied buffer. Our code never calls `uuid`. The only "fix" npm offers downgrades RealtimeKit to 0.0.2, which removes the shared-conversation feature. | Next RealtimeKit release, or before launch |
| `minimatch`, `sharp`, `undici` and related advisories | Moderate–high | ESLint, typescript-eslint and the local Workers simulator | Development tools only; never shipped. Re-check at each tooling update. | Each dependency update |
