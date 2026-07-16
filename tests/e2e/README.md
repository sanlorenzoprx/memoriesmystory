# End-to-End Tests

Playwright owns browser-level evidence for the phone-first experience. Run:

```bash
npx playwright install chromium
npm run test:e2e
```

The committed smoke test protects the approved first screen and both capture entry paths. Later packets must extend this folder to prove the complete first-five-minute capture, recovery, playback, sharing, and accessibility outcomes in the Phase 1 specification.

Chromium automation is a CI gate. Current iPhone Safari and real Android device checks remain explicit release evidence; browser emulation is not a substitute for those checks.
