/**
 * Nightingale bird motion — Phase 1 state machine.
 *
 * Pure functions. No React, no DOM, no animations. Every behaviour is
 * derived from (cue, listenActive, l1Triggered, l2Triggered, now) and is
 * fully deterministic given a fixed `now` clock. Jitter tables are written
 * values — tests must be reproducible.
 *
 * Six studies, in Phase 1 scope:
 *   IDLE    L0 / L1 / L2
 *   LISTEN  L0 / L1 / L2
 *
 * The bird is the product, not a status icon. The same single character
 * across all six studies. Only the few regions that move (eye, head tilt,
 * chest 1px lift) actually change between frames.
 *
 * Treatment lives in docs/motion-treatment-phase1.md. This file is the
 * executable form of that document for Phase 1 only.
 *
 * Implementation contract:
 *   - input.cue + input.listenActive pick the sequence
 *   - L1/L2 triggers replace L0 ambient for ~600ms (L1) / ~2s (L2)
 *   - During L1/L2 HOLD, ambient breathing is paused
 *   - Lamp state is owned by birdPresentation.ts, NOT this file
 *
 * CSS layer A — ambient: applied by CSS animation, ambient is ON for IDLE_L0
 *   / LISTEN_L0 / LISTEN_L1 default, OFF during HOLD.
 * CSS layer B — sprite swap: applied by setting data-sprite on the .bird
 *   element. Idle frames use the BASE PNG until real sprite frames ship.
 */

import type { Cue } from '../engine/types'

// ─── sprite catalogue ─────────────────────────────────────────────────────
//
// These names map 1:1 to the sprite PNGs that the pixel artist must
// produce at the bird's native pixel grid. Until those ship, every frame
// falls back to BASE and only the CSS transform moves.

export type MotionSprite =
  | 'BASE'
  | 'INHALE'
  | 'EXHALE'
  | 'BLINK'
  | 'ATTEND_HEAD'
  | 'ATTEND_TILT'
  | 'GAZE_UP'
  | 'GAZE_AWAY'

// ─── sequence catalogue ───────────────────────────────────────────────────

export type MotionSequence =
  | 'IDLE_L0'
  | 'IDLE_L1'
  | 'IDLE_L2'
  | 'LISTEN_L0'
  | 'LISTEN_L1'
  | 'LISTEN_L2'

// ─── timing (constants, no jitter for sequence structure) ───────────────────
//
// Jitter only applies INSIDE a sequence (breath cycle, blink, L1 fire
// interval). Sequence-level timing is fixed so reviewers can compare L0 vs
// L1 vs L2 apples-to-apples.

/** IDLE L1 — quick glance: enter, hold, return. Total ~600ms. */
export const IDLE_L1_ENTER_MS = 200
export const IDLE_L1_HOLD_MS = 250
export const IDLE_L1_RETURN_MS = 200

/** IDLE L2 — gaze with release: enter, hold 1.2s, look-away, return. */
export const IDLE_L2_ENTER_MS = 200
export const IDLE_L2_HOLD_MS = 1200  // 1.2s is upper limit; shorter reads L1, longer reads staring
export const IDLE_L2_AWAY_MS = 150
export const IDLE_L2_RETURN_MS = 250

/** LISTEN L0 — settle and hold. */
export const LISTEN_L0_ENTER_MS = 250

/** LISTEN L1 — brief attention. */
export const LISTEN_L1_ENTER_MS = 200

/** LISTEN L2 — gaze with release. Shorter than IDLE L2 because listening
 *  demands more release, not less. */
export const LISTEN_L2_ENTER_MS = 300
export const LISTEN_L2_HOLD_MS = 1200
export const LISTEN_L2_RELEASE_MS = 200

// ─── jitter tables (seeded, deterministic) ─────────────────────────────────
//
// Used in cycle, NOT per-call. A single breath cycle pulls one index from
// the table, advances the pointer, loops. Same code path across reloads.

/** Breath cycle durations in ms. Mean ~5.4s, range 5.0–6.0s. */
export const BREATH_CYCLE_MS = [5400, 5800, 5000, 5400, 6000, 5200, 5600, 5000, 5800, 5400] as const

/** Blink: when each blink fires after sequence start. Mean ~5.3s. */
export const BLINK_FIRE_OFFSETS_MS = [3500, 5000, 6500, 4200, 7000, 5500, 3800] as const

/** L1 fire intervals in IDLE_L0 ambient (ms between L1 glances). */
export const IDLE_L1_FIRE_INTERVALS_MS = [2500, 4000, 6000, 3500, 5000, 4500] as const

// ─── ambient transform values (px, scale, degrees) ────────────────────────
//
// These describe motion in the bird's NATIVE pixel grid (target 64×64).
// CSS will translate to displayed px (≈ 4.4× at 280px display).

/** Breathing lift in native px. */
export const BREATH_LIFT_NATIVE_PX = 1

/** Attention head raise in native px. */
export const ATTEND_HEAD_LIFT_NATIVE_PX = 1

/** Gaze pupil shift in native px. */
export const GAZE_SHIFT_NATIVE_PX = 1

/** Maximum rotation, degrees. Pixel art doesn't survive large rotation. */
export const MAX_ROTATION_DEG = 0.4

// ─── output shape ─────────────────────────────────────────────────────────

export interface MotionTransform {
  translateX: number
  translateY: number
  scale: number
  rotate: number
}

export interface MotionFrame {
  sprite: MotionSprite
  transform: MotionTransform
  /** True while the bird should NOT be doing ambient breath animation —
   *  used during L1/L2 HOLD to simulate breath being held (true animals
   *  hold their breath when listening). */
  ambientBreathingPaused: boolean
}

export const ZERO_TRANSFORM: MotionTransform = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotate: 0,
}

// ─── input ────────────────────────────────────────────────────────────────

export interface MotionInput {
  /** Current Cue from the engine. */
  cue: Cue
  /** True while the user is speaking / AskCard is open / voice is active.
   *  Distinct from ASK cue — LISTEN is a transient sub-state. */
  listenActive: boolean
  /** User-triggered IDLE L1 glance. Resets when the caller clears the
   *  trigger; sequence ends naturally when sequenceStartedAtMs + total
   *  elapsed hits the return-to-base point. */
  l1Triggered: boolean
  /** User-triggered IDLE L2 hold. Same as L1 but longer. */
  l2Triggered: boolean
  /** When the current L1/L2 sequence began. Caller is responsible for
   *  setting this when transitioning L1/L2 trigger on. Not used in L0. */
  sequenceStartedAtMs: number
  /** Current time, ms. */
  now: number
  /** Honor prefers-reduced-motion. When true, return BASE + zero transform. */
  reducedMotion: boolean
}

// ─── entrypoint ───────────────────────────────────────────────────────────

/**
 * Compute the bird's current motion frame. Pure: same input → same output.
 * Caller must drive this at render frequency (≈ 60Hz via rAF) and apply
 * the returned transform via inline CSS.
 */
export function motionFrame(input: MotionInput): MotionFrame {
  if (input.reducedMotion) {
    return { sprite: 'BASE', transform: ZERO_TRANSFORM, ambientBreathingPaused: true }
  }

  if (input.l2Triggered) {
    return input.listenActive ? listenL2(input) : idleL2(input)
  }
  if (input.l1Triggered) {
    return input.listenActive ? listenL1(input) : idleL1(input)
  }
  return input.listenActive ? listenL0(input) : idleL0(input)
}

/** Choose a sequence without rendering it. Useful for telemetry / testing. */
export function motionSequence(input: Pick<MotionInput, 'listenActive' | 'l1Triggered' | 'l2Triggered'>): MotionSequence {
  if (input.l2Triggered) return input.listenActive ? 'LISTEN_L2' : 'IDLE_L2'
  if (input.l1Triggered) return input.listenActive ? 'LISTEN_L1' : 'IDLE_L1'
  return input.listenActive ? 'LISTEN_L0' : 'IDLE_L0'
}

// ─── IDLE L0 — ambient breath, optional blink ─────────────────────────────

/** Master blink cycle. Longer than the longest blink offset so that the
 *  blink schedule reads as rare and unpredictable. 30s keeps blink from
 *  re-syncing with breath (5.4s avg) over reasonable observation. */
const BLINK_MASTER_CYCLE_MS = 30_000

/** How long a blink frame holds before returning to BASE. 120ms reads as
 *  a blink, not a frame glitch. */
const BLINK_FRAME_MS = 120

function idleL0(input: MotionInput): MotionFrame {
  const breathCycle = BREATH_CYCLE_MS[0]
  const breathT = input.now % breathCycle
  // Sine wave 0 → π → 0 over the cycle, amplitude 1 native px.
  const breathFraction = Math.sin((breathT / breathCycle) * Math.PI)
  const breathPx = breathFraction * BREATH_LIFT_NATIVE_PX

  // Blink — within BLINK_FRAME_MS of any fire point in the master cycle.
  const blinkT = input.now % BLINK_MASTER_CYCLE_MS
  const blinkActive = BLINK_FIRE_OFFSETS_MS.some(
    (offset) => blinkT >= offset && blinkT < offset + BLINK_FRAME_MS,
  )

  if (blinkActive) {
    return {
      sprite: 'BLINK',
      transform: { ...ZERO_TRANSFORM, translateY: breathPx },
      ambientBreathingPaused: false,
    }
  }
  return {
    sprite: 'BASE',
    transform: { ...ZERO_TRANSFORM, translateY: breathPx },
    ambientBreathingPaused: false,
  }
}

// ─── IDLE L1 — quick glance ───────────────────────────────────────────────

function idleL1(input: MotionInput): MotionFrame {
  const elapsed = input.now - input.sequenceStartedAtMs
  const total = IDLE_L1_ENTER_MS + IDLE_L1_HOLD_MS + IDLE_L1_RETURN_MS

  // Return to BASE if the caller forgot to clear the trigger.
  if (elapsed >= total) {
    return {
      sprite: 'BASE',
      transform: ZERO_TRANSFORM,
      ambientBreathingPaused: false,
    }
  }

  if (elapsed < IDLE_L1_ENTER_MS) {
    // Enter — head up + gaze up
    return {
      sprite: 'ATTEND_HEAD',
      transform: {
        translateX: 0,
        translateY: -ATTEND_HEAD_LIFT_NATIVE_PX,
        scale: 1,
        rotate: 0,
      },
      ambientBreathingPaused: false,
    }
  }
  if (elapsed < IDLE_L1_ENTER_MS + IDLE_L1_HOLD_MS) {
    // Hold — gaze up, breath paused
    return {
      sprite: 'GAZE_UP',
      transform: {
        translateX: 0,
        translateY: -ATTEND_HEAD_LIFT_NATIVE_PX,
        scale: 1,
        rotate: 0,
      },
      ambientBreathingPaused: true,
    }
  }
  // Return — back to BASE
  return {
    sprite: 'BASE',
    transform: ZERO_TRANSFORM,
    ambientBreathingPaused: false,
  }
}

// ─── IDLE L2 — gaze with release ──────────────────────────────────────────

function idleL2(input: MotionInput): MotionFrame {
  const elapsed = input.now - input.sequenceStartedAtMs
  const total = IDLE_L2_ENTER_MS + IDLE_L2_HOLD_MS + IDLE_L2_AWAY_MS + IDLE_L2_RETURN_MS

  if (elapsed >= total) {
    return { sprite: 'BASE', transform: ZERO_TRANSFORM, ambientBreathingPaused: false }
  }

  if (elapsed < IDLE_L2_ENTER_MS) {
    return {
      sprite: 'GAZE_UP',
      transform: { ...ZERO_TRANSFORM, translateY: -GAZE_SHIFT_NATIVE_PX },
      ambientBreathingPaused: false,
    }
  }
  if (elapsed < IDLE_L2_ENTER_MS + IDLE_L2_HOLD_MS) {
    // HOLD — critical. Look at user, breath paused.
    return {
      sprite: 'GAZE_UP',
      transform: { ...ZERO_TRANSFORM, translateY: -GAZE_SHIFT_NATIVE_PX },
      ambientBreathingPaused: true,
    }
  }
  if (elapsed < IDLE_L2_ENTER_MS + IDLE_L2_HOLD_MS + IDLE_L2_AWAY_MS) {
    // GAZE_AWAY — release frame. Bird deliberately looks away.
    return {
      sprite: 'GAZE_AWAY',
      transform: ZERO_TRANSFORM,
      ambientBreathingPaused: true,
    }
  }
  // Return — back to BASE ambient
  return { sprite: 'BASE', transform: ZERO_TRANSFORM, ambientBreathingPaused: false }
}

// ─── LISTEN L0 — settle and hold ──────────────────────────────────────────

function listenL0(input: MotionInput): MotionFrame {
  // LISTEN L0 has a one-shot enter. After that the bird is held still
  // until listenActive flips false. Breathing is paused for the whole
  // duration (real animals hold their breath when listening).
  const elapsed = input.now - input.sequenceStartedAtMs
  if (elapsed < LISTEN_L0_ENTER_MS) {
    return {
      sprite: 'ATTEND_TILT',
      transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG },
      ambientBreathingPaused: true,
    }
  }
  return {
    sprite: 'ATTEND_TILT',
    transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG },
    ambientBreathingPaused: true,
  }
}

// ─── LISTEN L1 — brief attention ──────────────────────────────────────────

function listenL1(input: MotionInput): MotionFrame {
  const elapsed = input.now - input.sequenceStartedAtMs
  const total = LISTEN_L1_ENTER_MS + 200 + 100  // enter + tiny hold + return

  if (elapsed >= total) {
    return listenL0(input)
  }

  if (elapsed < LISTEN_L1_ENTER_MS) {
    return {
      sprite: 'ATTEND_TILT',
      transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG, translateY: -ATTEND_HEAD_LIFT_NATIVE_PX },
      ambientBreathingPaused: true,
    }
  }
  // Eyes meet — gaze + tilt
  return {
    sprite: 'GAZE_UP',
    transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG, translateY: -ATTEND_HEAD_LIFT_NATIVE_PX },
    ambientBreathingPaused: true,
  }
}

// ─── LISTEN L2 — gaze with release ────────────────────────────────────────

function listenL2(input: MotionInput): MotionFrame {
  const elapsed = input.now - input.sequenceStartedAtMs
  const total = LISTEN_L2_ENTER_MS + LISTEN_L2_HOLD_MS + LISTEN_L2_RELEASE_MS

  if (elapsed >= total) {
    // After L2 release, bird stays in ATTEND_TILT (still listening) until
    // listenActive goes false. NOT back to BASE — that would mean "I stopped
    // listening", which is wrong.
    return listenL0(input)
  }

  if (elapsed < LISTEN_L2_ENTER_MS) {
    return {
      sprite: 'GAZE_UP',
      transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG, translateY: -GAZE_SHIFT_NATIVE_PX },
      ambientBreathingPaused: true,
    }
  }
  if (elapsed < LISTEN_L2_ENTER_MS + LISTEN_L2_HOLD_MS) {
    return {
      sprite: 'GAZE_UP',
      transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG, translateY: -GAZE_SHIFT_NATIVE_PX },
      ambientBreathingPaused: true,
    }
  }
  // Release — gaze away but stay tilted
  return {
    sprite: 'GAZE_AWAY',
    transform: { ...ZERO_TRANSFORM, rotate: MAX_ROTATION_DEG },
    ambientBreathingPaused: true,
  }
}