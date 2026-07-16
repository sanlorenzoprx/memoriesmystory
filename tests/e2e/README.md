# End-to-End Tests

Playwright owns browser-level evidence for the phone-first experience. Run:

```bash
npx playwright install chromium
npm run test:e2e
```

The committed Packet 2 suite protects the approved first screen, both entry paths, local import and camera capture, IndexedDB reload recovery, camera-denial fallback, manual acceptance, truthful local-only language, keyboard order, and phone-width layout. Later packets extend this suite to prove upload recovery, voice playback, sharing, and the remaining accessibility outcomes in the Phase 1 specification.

Chromium automation is a CI gate. Current iPhone Safari and real Android device checks remain explicit release evidence; browser emulation is not a substitute for those checks.
