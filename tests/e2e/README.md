# End-to-End Tests

Playwright owns browser-level evidence for the phone-first experience. Run:

```bash
npx playwright install chromium
npm run test:e2e
```

The committed suite protects the approved first screen, both entry paths, camera/import capture, IndexedDB recovery, permission fallbacks, manual acceptance, truthful state language, keyboard order, and phone-width layout. Packet 3 runs the browser through local Wrangler D1/R2 bindings and proves that an offline photograph never blocks voice recording, ordered background synchronization resumes after reconnection, family-archive confirmation waits for both durable receipts, protected playback works, and reload recovers the same state. Later packets extend this suite through account recovery, processing, completion, and sharing.

Chromium automation is a CI gate. Current iPhone Safari and real Android device checks remain explicit release evidence; browser emulation is not a substitute for those checks.
