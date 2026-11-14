# Real Cloudflare media / synthetic browser proof

Owner-authorized continuation of D03. The preceding [staging API run 43593728473](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43593728473) passed after PR #31 merged as `2ddd18ed9f0bb01e54e7d37df9a8995187b02b3d`: fixed staging app/preset created, persisted unrecorded flags checked, two scoped short-lived grants refreshed, synthetic meeting deactivated and participant absence verified. No media was transmitted by that API-only run.

## Browser experiment

A separate manual workflow checks out the reviewed PR #29 call candidate at immutable `d90afd5f184469e636b50f721d567973b077de1e` into a subdirectory. Dependencies/build/Chromium installation run before credential injection. Only the trusted probe step consumes the repository token. The candidate preview server and browser child environment omit that API secret. Participant JWTs remain in runner/browser memory and are not put in URLs, files, traces, screenshots or uploaded artifacts.

Two isolated Chromium contexts load the actual photo-led call UI. App session/photo/list endpoints use synthetic fixtures and a synthetic photograph; the meeting token endpoint returns the real scoped provider tokens to the matching browser context. Media is real Cloudflare RealtimeKit/SFU traffic, not a mocked WebRTC transport. Devices produce a generated 440 Hz tone and Chromium's synthetic video pattern. No family or physical-device media is used.

The probe checks:

- Both people join despite declined recording consent; no microphone/camera acquisition precedes their explicit controls.
- Both receive decoded video frames and nonzero incoming audio energy; remote video is ready and the SDK's audio playback element is running.
- Audio packet counts keep increasing after one person disables the camera.
- Leaving releases acquired media tracks; guest rejoin restores two-way media.
- Deleting the active guest's provider participant removes them and releases their captured tracks.
- Provider cleanup runs after success or browser failure, including idempotent removal of the already-deleted guest.

Checks return bounded stages/booleans only. No provider bodies or browser errors are printed. The synthetic meeting is deactivated and known participant absence verified afterward. The staging app/preset remain. Ordinary calling minutes are consumed by this bounded synthetic call; it starts no recording, plan upgrade, billing activation or production deployment.

## Evidence boundaries

This is two browser contexts on one Linux runner. It cannot establish physical iPhone/Android behavior, hardware audibility, cross-region latency, cellular handoff, full app/Worker/Clerk deployment, or saved originals. Real app session/invitation authorization still has its existing deterministic tests; those fixtures are not hosted-auth acceptance evidence. Physical testing remains deferred to the owner's MVP v0.5 milestone. Remote recording/private archive integration remains next and unimplemented by this experiment.

Local type/lint checks and the staging-probe tests include private grant delivery to the browser callback and guaranteed cleanup after callback failure. Full CI and the manual live workflow result must be recorded separately before reporting a passing real-call result. No conditional skip converts missing credentials or transport failure into a pass.

I-10, I-17–I-19, I-25 and I-30: synthetic source only, no false preservation claim, no new guest account, no second provider, no recording without consent, and explicit interruption/release evidence. This extends the same active D03 gate; no locked product behavior changes.

## Live result — November 14

[Run 43594590337](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43594590337) **passed** against candidate `d90afd5f184469e636b50f721d567973b077de1e`. The result reported `browserStage: complete`, `cleanupConfirmed: true` and all six browser assertions passed: joining with recording declined and no early device requests; bidirectional decoded video/nonzero audio with SDK playback running; audio after camera disable; track release on leave; media after guest rejoin; active guest removal/track release through provider deletion. Provider meeting cleanup and absence of both participant records also passed.

The application candidate is live-media proven within the synthetic boundary described above. It is not a deployed application or physical/cross-region acceptance. The SDK, app and Worker sources remain unchanged when bringing the candidate up to current main; operational workflows/docs are added separately. No recording, original archive asset or production resource was created by this experiment.
