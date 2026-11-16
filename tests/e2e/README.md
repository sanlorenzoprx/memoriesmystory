# End-to-End Tests

Playwright owns browser-level evidence for the phone-first experience. Run:

```bash
npx playwright install chromium
npm run test:e2e
```

The committed suite protects the approved first screen, both entry paths, camera/import capture, IndexedDB recovery, permission fallbacks, manual acceptance, truthful state language, keyboard order, and phone-width layout. Packet 3 runs the browser through local Wrangler D1/R2 bindings and proves that an offline photograph never blocks voice recording, ordered background synchronization resumes after reconnection, family-archive confirmation waits for both durable receipts, protected playback works, and reload recovers the same state. Later packets extend this suite through account recovery, processing, completion, and sharing.

Chromium automation is a CI gate. Current iPhone Safari and real Android device checks remain explicit release evidence; browser emulation is not a substitute for those checks.

The English/Spanish suite also verifies device language persistence, unchanged original-photo SHA-256 after switching/reload, translated account/error controls, unsaved transcript edits, original testimony that matches a catalog phrase, Spanish source-confirmed finish, and English/Spanish family-link revocation and deletion confirmations. Account/review/share API stubs are synthetic UI evidence; they do not establish live Clerk/provider acceptance.

The archival still suite uses synthetic camera streams and still blobs to verify original SHA-256/dimensions across reload, late-response cancellation, stopped permission grants, and Spanish device-picker recovery with an image-element decode fallback. Native camera/library selection, actual sensor resolution and physical print quality remain real-device evidence.

Separate-scan journeys verify corner selection/rotation with a synthetic color oracle, unchanged original SHA-256, local reload recovery, actual local Worker/D1/R2 preservation/private retrieval/deletion, Spanish invalid-corner recovery and original-only continuation. Accepted-photo retakes use a new draft so older uploaded sources cannot be selected accidentally. A three-shot capture remains one untouched candidate, with no claim of motion deblurring or real-device stabilization proof.

The navigation suite (`worker-navigation.spec.ts`) uses real browser navigations with no route stubs. It verifies that a family share address, shared media, a resource address and `/health` are answered by the Worker rather than the app shell, and that application deep links still open the app. The local Worker has no sharing secret, so it proves routing and the unavailable-link page, not a created share's content.

The family voice suite (`family-voice-contributions.spec.ts`) uses a synthetic oscillator microphone and stubbed contribution routes in English and Spanish. It verifies record, listen, a failed send that keeps the recording without a saved claim, a same-key retry with identical bytes, and that a spoken original offers no revise control. Real microphones, real storage and real voices remain device and human evidence.

The family photograph suite (`family-photo-contributions.spec.ts`) chooses the synthetic fixture image with stubbed contribution routes in English and Spanish. It verifies that the bytes sent equal the chosen file's SHA-256 (no resize or re-encode), that a failed send keeps the photograph without a saved claim, and that the retry reuses the same key.

The written-words suite (`family-written-words.spec.ts`) uses stubbed routes with separate speaker and owner contexts in English and Spanish. It verifies that a failed save keeps the typed words without a saved claim, that the retry reuses the same key, and that the owner can include but not edit the speaker's words.

The search suite (`family-search.spec.ts`) uses stubbed routes in English and Spanish for the owner's archive page and an invitation view. It verifies a recoverable failed search, the normalized query, named sources with "approximately", the no-results state, and that a member search is bound to its invitation and offers no links into a private archive. Authorization and matching are proven against the Worker in the integration suite.

The timeline suite (`family-timeline.spec.ts`) uses stubbed routes in English and Spanish. It verifies a recoverable failure, ascending years taken from the storyteller's words, approximate wording, and separate sections for memories remembered without a year and with no known date.

The export suite (`archive-export.spec.ts`) uses stubbed routes and synthetic bytes in English and Spanish. It downloads the real ZIP, reads it with an independent parser, and verifies that a same-length wrong-bytes file is left out with the export marked incomplete, and that a second run round-trips every original to its manifest hash.

The album export suite (`album-export.spec.ts`) uses stubbed routes in English and Spanish. It chooses one album and verifies that only that album's original is fetched and packaged, that a recollection the owner has not included for family is never fetched, and that the readable page is titled for the album.

The export check suite (`export-check.spec.ts`) builds exports with the app's own ZIP writer in English and Spanish and checks them in the browser: a matching export, a changed file named by its path, and a non-ZIP refused, with no request sent.

The share handoff case in `family-links.spec.ts` checks that the WhatsApp and Facebook links carry exactly the bounded share address, never the memory id, and that the reach of the link is stated. `referral-visit.spec.ts` checks that a referred visit is recorded once per session with only the opaque referral id.

`family-unsent-media.spec.ts` checks that a relative's unsent recording and photograph survive a reload, that a send after the reload reuses the same request key, and that a deletion message clears both.

`accessibility.spec.ts` runs axe-core WCAG 2.2 A/AA rules on 14 screens and states in English and Spanish and fails on any violation.

The album permission suite (`family-album-permission.spec.ts`) uses stubbed routes in English and Spanish. It verifies that a relative sees no album section without the owner's permission, that every album request from a permitted relative carries their invitation, that owner-only controls are not offered, and that the owner can turn the permission on and off.
