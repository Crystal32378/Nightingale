# Nightingale — Integration & Technical Spec

**If it knows, it guides you. If it does not, it stays with you and helps you ask.**

[English indoor demo](https://nightingale-indoor.web.app/?lang=en) · [Source code](https://github.com/Crystal32378/Nightingale)

Nightingale is a bilingual hospital-wayfinding prototype: one next step, an on-screen bird and an easy way to ask for help. Language understanding is separated from deterministic route guidance.

## Architecture and integrations

The React frontend is served through **Firebase Hosting**. A **Hono proxy on Cloud Run** keeps provider credentials server-side and connects to two cloud services:

| Component | Role and boundary |
| --- | --- |
| NVIDIA Nemotron through Nebius Token Factory | `nvidia/nemotron-3-super-120b-a12b` interprets an English or Traditional Chinese destination request. Its output must match an allowed destination or return uncertainty. It does not generate routes, distances or floor numbers. |
| Tavily Extract | Retrieves public campus/department information from Taipei City Hospital's official registration site. Users choose a campus, search departments and open official registration links. Lookup results do not become navigation routes. |
| Deterministic navigation engine | Controls checkpoints, the next instruction, confidence/uncertainty and bird cues. The person confirms an interpreted destination before a demonstration route starts. |
| Bilingual help | English and Traditional Chinese interfaces preserve the active interaction when language changes. Selectable male/female help recordings use Kokoro-generated English and MiniMax Chinese audio; recording selection matches the displayed text. Device speech is a fallback. |

The clinic lookup is not symptom triage, appointment booking or clinical advice. Implementation references: [destination interpreter](https://github.com/Crystal32378/Nightingale/blob/main/src/destination/nemotron.ts), [proxy routes](https://github.com/Crystal32378/Nightingale/blob/main/server/app.ts), [help playback](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/speech.ts).

## Runtime behavior and safeguards

- **Request-driven inference:** destination-form submission calls the model; waiting, checkpoint progression and recorded help do not continuously invoke it. The [guidance/confidence timer](https://github.com/Crystal32378/Nightingale/blob/main/src/ui/useNightingale.ts) runs in the browser, with visit state saved locally where storage is available.
- **On-demand lookup:** opening clinic lookup and choosing a campus trigger retrieval. The [per-instance Tavily cache](https://github.com/Crystal32378/Nightingale/blob/main/server/tavily.ts) lasts one hour; expiry alone does not trigger a refresh.
- **Explicit uncertainty:** a working Nemotron proxy returns uncertainty for model failures/timeouts. A separately labeled keyword-based **Mock** interpreter is available for development and some proxy connection failures; a Mock result is not evidence of a live model call.
- **Abuse controls:** the proxy has input/request limits, a daily model-call counter and a kill switch. The counter is in memory and is not a guaranteed spending cap across restarts or multiple instances. See [setup and failure behavior](https://github.com/Crystal32378/Nightingale/blob/main/docs/indoor-setup.md).
- **Demo data:** use synthetic destination requests, not personal or medical information. Destination text is sent to the cloud interpreter; local/private inference is not implemented in this demo.

## Demonstration scope

The deployed demo includes real Nemotron interpretation and Tavily lookup. **Navigation remains simulated:** the [venue source](https://github.com/Crystal32378/Nightingale/blob/main/src/venue/mock.ts) models one clinical department, neurosurgery, plus registration, elevator, cashier, pharmacy and exit checkpoints. It is not a map of a real hospital.

There is no continuous indoor positioning. Developer controls simulate checkpoint progression. The bird is on screen; physical hardware is not required. These integrations and implementation evidence do **not** establish clinical validation, hospital partnership or production navigation readiness.

## Quick walkthrough

1. Enter **“I need to pick up my medicine.”** Check the interpreter label and confirm the destination.
2. Use developer controls to advance checkpoints and demonstrate uncertainty.
3. Open **Help me ask** and try both voices.
4. Open clinic lookup, choose a campus, search a department and inspect its official source/link.

Further implementation evidence: [English UI](https://github.com/Crystal32378/Nightingale/pull/7), [Tavily integration](https://github.com/Crystal32378/Nightingale/pull/8), [help-card voices](https://github.com/Crystal32378/Nightingale/pull/12).
