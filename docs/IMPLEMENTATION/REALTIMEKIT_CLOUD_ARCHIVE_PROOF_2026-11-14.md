# D03 — Isolated real-cloud archive verification candidate

Owner supplied a separate repository `CLOUDFLARE_API_TOKEN` after the existing RealtimeKit token was denied D1/R2 access. Read-only run 43626942755 verified Worker, D1 and R2 metadata access with the new token. This does not establish write permissions or archive durability.

The prior real provider-to-native run 43610597090 passed: actual consent/start/idempotent retry/guest stop routes, automatic alarms, composite plus two microphone originals, actual stored-byte hashes, unauthorized denial, full/ranged playback, decoded audio with nonzero signal, and provider/native cleanup. Its storage was ephemeral workerd D1/R2. That scope remains distinct from this cloud candidate.

## Concrete cloud check

The existing generated-media workflow gains `storage: isolated-cloud`. It creates a uniquely named synthetic Worker, D1 database and R2 bucket, never accepts existing resource IDs/names, and confirms the bucket has neither a public managed domain nor custom domains. A small fixture wrapper exposes only token-protected generation and object-metadata checks; ordinary recording/source routes remain the actual application code. The deployment token is never bound to the Worker. Session secrets are generated per run. RealtimeKit backend credentials use secret-text bindings; browser/preview/ffmpeg/ffprobe environments omit both API tokens.

Synthetic authorization records initialize the isolated D1 schema. The actual application then requires each participant's consent, starts both provider recorders through persistent alarms, accepts guest stop and preserves separate originals in real private R2 with D1 receipts. Source bytes are compared through authenticated application playback, an independent Cloudflare R2 object read and the stored receipt. R2 metadata is checked independently through the protected binding. A new deployment-generation marker must become active after redeployment; every original/receipt is checked again without reinitializing storage or starting replacement recording. Preserved media must decode and contain nonzero audio signal.

Cleanup first removes the synthetic Durable Object class/namespace through a migration and switches the newly created Worker to an authenticated bucket-emptying fixture. This prevents late imports while removing objects, including unreferenced attempts. Worker, bucket and database deletion are independent attempts; uncertain allocation or cleanup errors fail the check. Only resources created by this run are eligible. No production resource, existing archive, billing plan, DNS setting or real family media is changed. Ordinary bounded staging calling/recording/storage requests are within the existing authorized scope; paid upgrades are never attempted.

Local tests cover fresh-private-resource allocation, secret binding boundaries, independent object reads, redeployment without replacement namespace creation, cleanup after rejected allocation, and continuing cleanup after Worker deletion fails. The actual-route/native-alarm regression test also uses a new session secret and preserves the nested candidate layout. Type/lint and final CI results must be recorded before running the cloud candidate.

## Limits

Live cloud verification is pending. Success would prove synthetic source integrity, private retrieval and persistence across Worker redeployment on real Cloudflare resources, not production activation, long-term retention/stewardship, physical devices, distant networks, human consent acceptance or Clerk sign-in. The generated resources and media are intentionally removed after verification. Full V2/MVP v0.5 remains unfinished; no legal language, pricing or operative stewardship policy is approved by this test.

Anti-drift: source bytes/receipts remain immutable through verification; participant-microphone identity is not inferred human identity; no public archive or wider account rights; no guest registration; photo/session scope is preserved; no generated material becomes testimony; proof-only control routes are never part of the application deployment.

## Real cloud verification passed

PR #39 merged as `2896e5c17ccec4ca64fe8e4b6a7fbd3ae260b424` after CI 43627914312 passed 201 tests and 47 phone-browser checks. Real isolated-cloud run [43628170649](https://github.com/sanlorenzoprx/memoriesmystory/actions/runs/43628170649) completed successfully: both consent/start/idempotence routes, automatic real provider recorders, guest stop, all three real private R2 originals and D1 receipts, unauthorized denial, full/ranged private replay, independent hashes and decoded nonzero audio/video passed. A changed authenticated deployment-generation marker became active after redeployment and the originals/receipts were checked again without reinitialization. Provider cleanup and cloud Worker/D1/R2 cleanup were confirmed.

This closes the technical generated-media cloud-storage verification slice. It does not close physical two-phone/cross-region, uncoached human, consent/legal acceptance, long-term retention or production-release gates. The owner explicitly deferred camera/device testing until the full MVP v0.5 implementation milestone, so implementation continues to E01 private Chapters while those acceptance gates remain open. The full application has not been deployed or activated by this isolated proof.
