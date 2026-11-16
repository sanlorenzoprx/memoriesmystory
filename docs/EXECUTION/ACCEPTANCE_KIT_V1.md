# V1 acceptance kit — devices and people

**Status:** Prepared 2026-11-16 (lane L8 item 5). Use it on **staging** with **synthetic or consenting testers' own material only**. Never use real family media without the person's agreement.
**Feeds:** launch gate line 6 ("Device and human acceptance is recorded with dates, devices and findings fixed") in `V1_LAUNCH_PARALLEL_HANDOFF_2026-11-16.md`.

The automated suites prove behaviour on a simulated phone screen. This kit is for what they cannot prove: real cameras and microphones, real mail apps, real networks, and real people who have never seen the app.

## 1. Devices

Test every journey in section 3 on each row, in English on one device and Spanish (Puerto Rico) on another.

| Device | Browser | Why |
| --- | --- | --- |
| iPhone, current iOS | Safari | HEIC photographs, Safari audio recording, share sheet |
| iPhone, iOS one version back | Safari | Older WebKit |
| Mid-range Android, current | Chrome | Most common family phone |
| Older Android (3+ years) | Chrome | Slow CPU, low memory, large recordings |
| Laptop | Chrome, Firefox or Safari | Owners who organize albums on a computer |

Also test on a slow connection (turn on "Low Data Mode" or a 3G throttle) for the capture and contribution journeys.

## 2. Before each session

1. Staging is deployed at a recorded commit, with all migrations applied.
2. Tester accounts exist in the staging Clerk instance. Use a separate account for each role: owner, invited viewer, invited contributor.
3. Email sending is on for staging only, to the testers' own addresses (needs Resend or Cloudflare Email configured).
4. Fill in the session header of the evidence form (section 5).

## 3. Journeys

Each step has a **pass** condition. Record anything else as a finding.

### J1 First memory (owner, new account)

1. Open the first screen. **Pass:** the promise and the two buttons are readable without scrolling on the phone.
2. Tap the camera button and photograph a printed photo. **Pass:** guidance appears; a manual override works in poor light.
3. Record about 20 seconds of voice. **Pass:** playback is your real voice.
4. Turn on airplane mode before saving, then reload. **Pass:** the photo and voice are still there; nothing says "saved".
5. Turn the network back on and finish. **Pass:** "saved" appears only after confirmation; the memory is in My stories after a reload.
6. On an iPhone, use a HEIC photograph. **Pass:** the memory page shows the photo; a downloaded export contains the original HEIC.

### J2 Sharing

1. From a finished memory, tap Share with family. **Pass:** the one-time agreement appears; Facebook is absent until Public is chosen.
2. Agree to friends and family; create a link; send it with WhatsApp. **Pass:** WhatsApp opens with the message and link; the recipient's phone opens the memory without signing in.
3. Choose Public; share on Facebook. **Pass:** the Facebook composer opens with the link; the preview shows nothing private.
4. Revoke the link. **Pass:** the recipient's reload shows the link is unavailable.
5. Share again from the same account. **Pass:** the agreement is not asked again.

### J3 Family invitation and contribution

1. As owner, invite the contributor by email with "Also email the invitation link". **Pass:** the email arrives in English and Spanish, with no memory title or names in it.
2. Forward the email to a different account and try to accept. **Pass:** refused.
3. Accept as the invited contributor. **Pass:** only the shared memory is visible.
4. Record a voice recollection, reload before sending, then send. **Pass:** the recording survives the reload; it is saved once.
5. As owner, include it for family. **Pass:** the viewer sees it, attributed to the contributor.

### J4 Albums, search and export

1. Make an album with a Chapter; add memories; open a person's album. **Pass:** only linked memories appear.
2. Search for a remembered word. **Pass:** results name their source.
3. Export the album; open the ZIP on a computer; open its `index.html`. **Pass:** it reads in Chapter order without the app.
4. In the app, use Check an export on the ZIP. **Pass:** every file matches; edit one file in the ZIP and check again; the changed file is named.

### J5 Email choices

1. Turn on reminders, choose Every week. **Pass:** saved only after confirmation.
2. Wait for (or trigger on staging) a reminder. **Pass:** its link opens straight into starting a memory.
3. Use the email's unsubscribe link. **Pass:** opening it changes nothing; pressing the button stops reminders; Email choices shows reminders off.

### J6 Shared conversation (Our Living Legacy)

Run only when remote recording is enabled on staging. Follow `../OPERATIONS/REMOTE_VIDEO_STAGING_SETUP.md`. **Pass:** both people consent before recording; either can stop; the recording appears in the archive and in an export.

### J7 Deletion

1. Delete a memory that has a family contribution and an unsent recording on another tab. **Pass:** confirmation is asked; the memory, its media and the unsent recording are gone; a shared link to it is closed.

### J8 Accessibility

On one iPhone (VoiceOver) and one Android (TalkBack), complete J1 steps 1–5 and J2 steps 1–2 with the screen reader. With text size set to the largest, check that no button text is cut off. **Pass:** every control is announced with its purpose; no step needs sight of the screen.

## 4. Uncoached people (launch gate evidence)

Recruit at least five adults who have never used the app. Include at least two over 65 and at least two who prefer Spanish.

- **Consent.** Before starting, say aloud and record their agreement: what is being tested, that their photo and voice stay in a test account and are deleted afterwards, and that they can stop at any time.
- **Task.** Give one sentence only: "Please use this to save a story about one of your photographs, then send it to someone in your family." Do not demonstrate or help unless they are stuck for two minutes; note every help given.
- **Observe:** time to the first recording; any moment of hesitation, confusion or worry; whether they believed it was saved and why; whether they understood who could open the link.
- **Afterwards,** ask three questions:
  - "What do you think happened to your photograph and voice?"
  - "Who can see it now?"
  - "Would you do this again, and for whom?"
- **Delete their test memories** with them watching, and record that you did.

## 5. Evidence form

Copy this block once per session into `docs/IMPLEMENTATION/ACCEPTANCE_<date>_<tester-or-device>.md`.

```markdown
# Acceptance session — <date>

- Staging commit: <sha>
- Tester: <role or anonymous id>, coached: yes/no
- Device / OS / browser: <...>
- Language: en-US / es-PR
- Network: normal / slow / offline steps

| Journey step | Pass / Finding | Notes (no private content) |
| --- | --- | --- |
| J1.1 | | |

## Findings

| # | Severity (high/medium/low) | What happened | Expected | Fixed in (PR) |
| --- | --- | --- | --- | --- |

## Uncoached observations (section 4 only)

- Time to first recording:
- Help given:
- Belief about saving:
- Understanding of who can see it:
- Answers to the three questions:
- Test memories deleted with the tester present: yes/no
```

A finding marked **high** blocks launch until it is fixed and the step passes again on the same device.
