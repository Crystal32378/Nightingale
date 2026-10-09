# Fixed help-card voices

The outdoor “Help me ask” card now uses the selected Leda or Puck voice in English or Traditional Chinese. Its visible question is unchanged. Four new Gemini 2.5 Flash TTS recordings are registered separately from the existing 88 route-guidance WAVs, whose bytes remain unchanged.

The player only accepts the exact registered question. It does not call a model, send a route observation, record a microphone or parse a bystander's answer. A quiet selection, missing recording, failed download or failed decode retains the text card and stays silent. It does not fall back to device speech. The earlier indoor prototype retains its existing playback path.

The existing four public-volume levels control a Web Audio GainNode below or at unity. Volume changes take effect during playback, and “Say it again” raises one level before replaying. Close, Escape, page hide or unmount cancels pending/playing audio. A late download cannot start after close. Focus containment and return remain in the shared help card.

## Evidence

- 356 frontend tests and typecheck pass.
- Actual desktop Chromium and WebKit decode/play the four WAVs. Checks cover voice/language choice, live gain changes, louder replay, close cancellation, quiet/missing-file silence, delayed-download cancellation and page-hide cancellation.
- Opening/replaying the card sends no backend observations and invokes no device speech.
- All four generated recordings transcribe to the registered sentence after punctuation normalization. These are machine content checks, not a claim of individual human listening acceptance.
- The bilingual route regression still completes in both desktop engines with unchanged confirmation and recovery behavior. Browser test APIs are scripted fixtures; this is not a new iPhone or outdoor acceptance.

`scripts/check-help-voice-browser.cjs` exercises the actual UI and Web Audio implementation. Use `PLAYWRIGHT_MODULE` to point at an installed Playwright module and `NIGHTINGALE_UI_URL` for the target local build. The script mocks route API responses, not the audio assets or player.

The English limited-preview backend remains `nightingale-english20261008`. No backend/model/route change or production promotion is part of this change. Preview expiry is 2026-11-08 12:29 Asia/Taipei; this is separate from model retirement and billing availability.
