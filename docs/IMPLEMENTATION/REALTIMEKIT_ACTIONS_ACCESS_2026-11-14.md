# RealtimeKit access through GitHub Actions

Owner authorization: the owner saved repository Actions secret `REALTIMEKIT_API_TOKEN` and variable `REALTIMEKIT_ACCOUNT_ID` after explicitly requesting an alternative to attaching cloud-environment credentials. This does not make either value readable by the assistant. GitHub Actions consumes them inside the runner.

The manual **RealtimeKit access check** workflow performs one GET of the selected account's RealtimeKit app list. It requires no dependency install, creates no resources, sends no media and changes no billing/deployment. Secrets are injected only into its single probe step. There is no pull-request trigger, arbitrary command/ref input, raw response logging or uploaded credential artifact. The summary contains a constant status and, for failed HTTP requests, the status code only.

This establishes account-scoped read access only. It does not prove app creation/meeting write permissions, an isolated preset, browser media connectivity or recording/archive durability. PR #29 remains a separate draft development slice. No runtime credential is extracted from Actions into the assistant's terminal.

Verification: three deterministic tests cover absent/invalid configuration without network calls, the read-only endpoint, and exclusion of credentials/identifiers/provider error content from results. Run `npm test -- tests/unit/realtimekit-access.test.ts`, typecheck and lint before publication. Live run results will be recorded separately.

Preservation/privacy assessment (I-19, I-30): no source media, family data, participant tokens or private archive content is requested. This is the same active D03 access gate, not a new product packet. Failure is explicit and retryable by manual dispatch.
