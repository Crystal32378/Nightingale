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
3. Simulate a checkpoint. The bird cues `RIGHT`, the screen says `右轉。`
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
│   └── cues.ts        (state, instruction) → Cue, a pure function
├── venue/mock.ts      synthetic venue. Not a real hospital.
├── registry/          verified places. The only source of proper nouns.
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

## Not in Phase 1, deliberately

Nemotron · Tavily · Toloka · Taigi · BLE · firmware · enclosure · real hospital
deployment · continuous indoor positioning · ASR · camera/VLM · speaker on the
bird · Firestore / Cloud Run / Nebius.
