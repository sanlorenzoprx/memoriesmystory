# D03 — Generated media through actual recording and private archive routes

Base: current main after PR #36 (`87dab43`). This follow-up verifies the connection between previously proven provider outputs and native archive components. Live verification is pending; no provider/storage success is inferred from the harness alone.

The manual workflow pins application candidate `b0bd4acce90380dee5b6f6439b1f4a0cd8d37285`, including the full/ranged source playback correction. Two Chromium SDK contexts publish generated tones/video. A trusted operator creates synthetic session identities and initializes ephemeral workerd D1/R2, then uses the application's actual private routes: start before consent rejected; each participant agrees independently; host starts; repeating the same key returns the same group; real Durable Object alarms start both provider recorders; guest stops; alarms confirm stopped capture, import untouched outputs, independently verify R2 hashes and commit authorized D1 receipts. The operator checks unauthorized denial and authorized full/ranged source replay, compares playback bytes with the receipt and an independent R2 read, then requires decodable audio/video and known duration through ffprobe. The one-minute recording and 64 MiB per-source fixture limits are set in the native fixture configuration before allocation, leaving recorded authority immutable.

The operator, native runtime and browser remain distinct: browser/preview/ffprobe environments omit the provider API token. Provider credentials remain in trusted Node/native bindings; neither signed provider URLs nor API credentials enter playback metadata. No trace, screenshot, recording, JWT, private filename, raw provider response or source body is exported. Temporary native storage and files are removed.

Cleanup is explicitly registered before native allocation. The staging operator lists every recording for its unique private test meeting and attempts stops, even if the native callback failed. Recording cleanup failure does not prevent meeting/participant cleanup and never produces a passing overall result. A deterministic failure test covers this external-coordinator cleanup path and redaction.

Native harness testing caught two fixture/runtime distinctions: the mock provider request body is a stream and must be read asynchronously to assert the one-minute serialized limit; native R2 supplies normalized range metadata for a full read. The source route now emits HTTP 206 only when Range was requested. Actual native full/ranged playback is checked without relaxing expected status or byte equality.

Local focused verification passed typecheck, lint and 20 targeted tests, including the complete actual-route/automatic-alarm archive harness with simulated provider responses, private playback and cleanup failures. The earlier coordinator tests remain unchanged. Clean-install CI and the real manual workflow result are recorded separately after the committed candidate exists.

Limits: this fixture has actual server authorization/consent state transitions and genuine provider media when run live, but synthetic identities and generated sources. D1/R2 are ephemeral native bindings, not deployed permanent cloud storage. It does not establish Clerk sign-in, physical phones, distant networks, human consent/copy acceptance, historical speaker identity, complete session capture, legal policy or finished V2/MVP v0.5. No production deployment or recurring billing activation.

Anti-drift: original bytes and receipts remain immutable; source identity is participant-microphone provenance, not inferred human identity; human testimony and derivative content stay separate; no new provider or guest registration; no wider archive access or public artifact; no claim of save from provider status alone.

Initial clean-install CI 43609354017 passed 192 tests and 47 phone-browser tests. Before the paid synthetic run, the operator was additionally tightened to require nonzero decoded PCM audio in every preserved source and to fail on native-storage disposal errors. ffmpeg/ffprobe children continue to omit provider credentials. The amended operator needs its own passing CI; application candidate `b0bd4ac` remains pinned because these changes affect only the trusted operator and fixture disposal.

## First real integrated attempt — runner path failure, no archive claim

PR #37 merged as `bb061b16eeed20be3911f870dd347950a9981379` after amended CI 43609667361 passed (192 tests and 47 phone checks). Real workflow 43609943002 then stopped at native runtime initialization before the recording routes ran: relative virtual module paths resolved against the operator cwd rather than the nested pinned candidate, causing workerd's module-root escape error. Both synthetic call identities/meeting were cleaned up; recording/archive checks remained empty. This is not successful integrated archival evidence.

The runtime now resolves virtual Worker module paths absolutely under the candidate root. Its local integration fixture copies source into a nested candidate folder so this runner layout is exercised without changing production code, bypassing consent, manually ticking alarms or relaxing playback checks.

A separate read-only staging capability workflow checks whether the existing token can list Worker, D1 and R2 metadata. It emits only HTTP/access status and bounded matching-resource counts, never resource names/IDs/settings, secrets or private content. Read capability is separate from write/deployment permission; a completed check does not claim archive access. This avoids asking the owner to configure capabilities already present. Results remain pending.

Nested-checkout actual-route/alarm integration and all three read-only access/redaction tests passed locally, with typecheck and lint. The immutable application candidate remains `b0bd4ac`; the fix changes operator path resolution only. Clean-install CI and a corrected real run must still pass.

## Corrected real integrated run passed

Run [43610597090](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43610597090) passed the actual-route/automatic-alarm pipeline with real Cloudflare generated-media recordings. All three originals matched private playback, D1 hashes and an independent R2 read; unauthorized denial and full/ranged replay passed; composite video and all source audio decoded with nonzero signal. Provider and native-storage cleanup were confirmed. Storage remained ephemeral native bindings. The real-cloud candidate is documented separately in `REALTIMEKIT_CLOUD_ARCHIVE_PROOF_2026-11-14.md`.

Read-only access run 43610596966 confirmed the old token could not read D1/R2. After the owner added a separate archive token, run 43626942755 verified all three metadata capabilities. No token was copied into chat or local workspace; the updated workflow selects the archive token while preserving the separate RealtimeKit token.
