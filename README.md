# Nightingale

> **牠知道就帶你。牠不知道，就陪你問。**  
> If it knows, it guides you. If it doesn't, it stays with you and helps you ask.

Nightingale is a small physical companion for hospital wayfinding — built for the moments when finding the next step is harder than it should be.

It grows out of the Walk Me There principle:

> **Geographic truth must be deterministic. Language is presentation.**

When the system knows, it guides. When it does not know, it says so — and helps the person ask for the next step instead of pretending.

---

## Phase 1 — software spine (this repo, today)

The whole product loop runs in a phone browser with **no LLM, no Nemotron, no
BLE and no hardware**:

```
checkpoint → one next step → virtual bird cue → checkpoint
           → uncertainty → ask again → arrival
```

```bash
npm install
npm run dev        # open on a phone on the same network
npm run typecheck
npm test
npm run build
```

Everything in the walkthrough below is driven from the **dev panel** at the
bottom of the screen: simulate checkpoint, simulate short/long press, simulate
confidence decay, simulate arrival. The panel also shows the last cue, the last
bird event, and the raw engine response.

1. Start at `ENTRANCE`. Nightingale appears.
2. Only the next checkpoint is shown — `下一個：掛號櫃台`.
3. Simulate a checkpoint. The bird cues `RIGHT` and turns to face it, and the
   screen says `往右手邊走。`
4. Between checkpoints the bird is quiet. That is correct, not a bug.
5. Simulate confidence decay. The band reaches `UNKNOWN`, the bird stops
   guessing and the screen says `我不確定。我陪你問。`
6. Long-press the bird. The card shows `請問，神經外科？` and the phone says
   exactly that string.
7. Continue to `ARRIVED`.

## Locked product rules

1. One step at a time is the default — the engine response physically does not
   contain the remaining route.
2. Repeated asking is normal. `ASK` is a primary interaction, not error recovery.
3. Silence between checkpoints is correct.
4. Uncertainty is normal. When the system does not know, it stops guessing.
5. Describe the situation, never the person.
6. You own it. It does not manage you.
7. No red alerts, no nagging, no countdowns, no calling for help on someone's
   behalf, and never "are you OK?".
8. The **validator** protects truth. The **register lint** protects treatment.

## State model

Three orthogonal axes, not one enum. A person resting for fifteen minutes is
`posture: RESTING` *and* `band: UNKNOWN` at the same time, and those two demand
opposite behaviour — a single enum has to pick one and will pick wrong in front
of someone who is unwell.

```ts
interface NavState {
  progress:   'AT_CHECKPOINT' | 'IN_TRANSIT' | 'ARRIVED'  // changed by observation
  confidence: number                                       // changed by time
  band:       'FRESH' | 'DECAYING' | 'UNKNOWN'             // derived from confidence
  posture:    'MOVING' | 'RESTING' | 'NEEDS_HELP'          // changed ONLY by the person
}
```

`posture` is never inferred. No code path can mark someone as resting or needing
help unless they said so — that is a type-level guarantee, not a guideline.
There is no `LOST`: uncertainty describes the system, not the person.
`BACKTRACKED` is an event, never a stored state.

## Layout

```
src/
├── engine/        deterministic core — no React, no DOM, no adapters
│   ├── types.ts       NavState, Observation, Instruction, venue graph
│   ├── graph.ts       traversal + turn derivation + authoring checks
│   ├── confidence.ts  decay and band derivation
│   ├── engine.ts      observation → state + ONE next step
│   ├── cues.ts        (state, instruction) → Cue, a pure function
│   └── tuning.ts      every tunable number, all provisional
├── venue/mock.ts      synthetic venue. Not a real hospital.
├── registry/          verified places. The only source of proper nouns.
│                      Registry is data: every lookup takes one, so tests
│                      supply their own and the shipped one stays real.
├── strings/           hand-written zh-TW strings + the key inventory
├── render/            renderer (structured instruction → exact string) + validator
├── lint/register.ts   build-time register lint
├── adapters/          BirdAdapter contract + VirtualBirdAdapter
├── persistence/       visit snapshot in localStorage
└── ui/                bird, ask card, dev panel
```

`src/engine/` may not import React, the DOM or any adapter — enforced by a test
(`src/lint/enginePurity.test.ts`). If cue derivation ever ends up in a React
effect, the bird only works while that screen is open, and the hardware line
becomes impossible to finish.

## The bird contract

Shared by the virtual bird now and the BLE bird in Phase 3, unchanged:

```ts
type Cue = 'QUIET' | 'READY' | 'LEFT' | 'RIGHT' | 'ASK' | 'ARRIVED'
type BirdEvent = 'SHORT_PRESS' | 'LONG_PRESS'

interface BirdAdapter {
  send(cue: Cue): void
  on(handler: (e: BirdEvent) => void): () => void
  readonly connected: boolean
}
```

Every flow — including ask-for-me — is reachable from the adapter, not only from
the UI. The physical bird has one button and no screen.

There is no alarm cue and no red state anywhere in the design. While someone is
resting the bird looks *identical* to idle, because a visible "this person has a
problem" marker destroys the only reason the feature exists.

## Ask-for-me

Long press, or the button on screen. The destination comes from the verified
registry, deterministically. Screen and speech are the same string. Nothing is
recorded, no speech is transcribed, and no reply is parsed — what the member of
staff says goes to the person, not to us.

Full string list: [`docs/string-inventory.md`](docs/string-inventory.md).

## The screen

One user-facing screen — bird, next checkpoint, one instruction, where you are
and where you are going, and two actions: 幫我問 and 休息. Nothing else is
visible by default.

The dev panel is collapsed at the bottom, deliberately quiet, and is the only
place raw state appears. Every screen string comes from the string table, so a
component cannot introduce wording or a place name of its own.

There is no map tab. A map is the remaining route, and the remaining route is
the one thing this product does not show.

Tunable numbers all live in `src/engine/tuning.ts` and are **provisional** until
corridor testing.

Two of them look similar and are not the same thing:

| constant | concept | question it answers |
| --- | --- | --- |
| `TURN_GUIDANCE_TTL_MS` (45s) | navigation | how long is this left/right instruction still TRUE? |
| `HAPTIC_FAILSAFE_TIMEOUT_MS` (8s) | hardware safety | how long until the bird stops buzzing **on its own** if the link drops? |

They are deliberately different lengths and live in different places. The second
is a firmware dead-man switch and exists precisely so that it keeps working when
the software that owns the first has stopped running. Never merge them.

## The bird artwork

One canonical PNG, one pose (`src/assets/nightingale-canonical.png`). A LEFT cue
mirrors that same image rather than swapping in a second drawing, so the
character is identical both ways.

The mirroring is a **gesture**, not a compass claim — "this way, your left hand
side", said at the same moment as the arrow and the sentence. Three things keep
it readable that way, and all three are tested in
`src/ui/birdPresentation.test.ts`:

1. it only happens while a turn is live, so it expires with the guidance TTL;
2. every other cue returns the bird to canonical — there is no resting pose that
   points anywhere;
3. it never appears alone; the arrow and the sentence carry the same claim, from
   the same instruction.

The lamp is a separate layer over the chest and is never baked into the artwork,
exactly as on the physical bird.

## Voice

Two chosen voices, one female and one male, chosen by ear and recorded in
`src/voice/profiles.ts` with the settings they were approved at. Same words,
same register; only the speaker changes.

The set of things Nightingale can say out loud is **derived**, never written by
hand: `src/voice/utterances.ts` builds it from the spoken string keys and the
verified place registry. It comes to 20 utterances.

The manifest's `text` field is the comparison point, not documentation. A file
is only ever played when the text beside it is character-for-character what the
renderer produced, checked once at build time and again before playback. Edit a
sentence without re-recording and the tests fail.

Audio can come from the API (`scripts/voice.mjs --canonical`) or be made by hand
in a web interface and dropped in (`--from-files`, no API and no credits) — the
manifest and the tests treat both identically, because what is verified is the
text, not how the audio was made. Taigi will take the second path: see the doc
for why synthesis was rejected for it.

Details: [`docs/voice-architecture.md`](docs/voice-architecture.md).
Hand-generation guide: [`scripts/plan/download-guide.md`](scripts/plan/download-guide.md).

## Not in Phase 1, deliberately

Nemotron · Tavily · Toloka · Taigi · BLE · firmware · enclosure · real hospital
deployment · continuous indoor positioning · ASR · camera/VLM · speaker on the
bird · Firestore / Cloud Run / Nebius.
