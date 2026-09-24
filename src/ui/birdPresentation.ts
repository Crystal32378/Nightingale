import type { Cue } from '../engine/types'

/**
 * How the bird is presented for a given cue.
 *
 * Kept as pure functions, away from React, so the rule can be tested: the bird's
 * facing is a function of the cue and of nothing else.
 *
 * IMPORTANT — what the mirroring means.
 *
 * The canonical artwork faces to the viewer's right. On a LEFT cue it is
 * mirrored. That flip is a GESTURE — "this way, your left hand side" — in the
 * same breath as the arrow and the sentence beside it. It is not a claim about
 * compass orientation, about which way the building faces, or about which way
 * the person is facing.
 *
 * Three things keep it readable as a gesture rather than a heading:
 *
 *  1. It only ever happens while a turn is live. The cue carries a direction
 *     only while `instruction.turn` is set, which expires with the turn TTL, so
 *     the bird cannot hold a direction after the guidance has gone stale.
 *  2. Every other cue returns the bird to canonical. There is no resting pose
 *     that points anywhere, so a facing on screen always means "right now".
 *  3. It never appears alone. The arrow and the sentence carry the same single
 *     claim, and both come from the same instruction.
 */
export type BirdFacing = 'CANONICAL' | 'MIRRORED'

export type LampState = 'DIM' | 'STEADY' | 'BREATHING' | 'BLINKING'

export function birdFacing(cue: Cue): BirdFacing {
  return cue === 'LEFT' ? 'MIRRORED' : 'CANONICAL'
}

export function lampState(cue: Cue): LampState {
  switch (cue) {
    case 'QUIET':
      return 'DIM'
    case 'READY':
    case 'LEFT':
    case 'RIGHT':
      return 'STEADY'
    case 'ASK':
      return 'BREATHING'
    case 'ARRIVED':
      return 'BLINKING'
  }
}

/** True when the cue is a direction the bird is currently gesturing. */
export function isDirectionalCue(cue: Cue): boolean {
  return cue === 'LEFT' || cue === 'RIGHT'
}

/**
 * Body motion — the smallest signal that the bird is alive.
 *
 * Placeholder for the pixel-sprite work in docs/motion-study-brief.md: these
 * tokens map 1:1 onto the future sprite sheet ({ row, fps, mode }). Until that
 * sheet exists they drive CSS-only motion on the canonical artwork, at L0
 * (Quiet) intensity — the bird never seeks the viewer's attention here.
 *
 * Amplitude budget: ≤ 1.5% scale, ≤ 1.5° tilt, biological (not metronomic)
 * timing. Motion is ambient and self-directed; it carries no information —
 * facing, lamp and sentence do that — so prefers-reduced-motion can silence
 * it entirely without the product losing anything. Blinks and eye direction
 * need the sprite's eye frames and are deliberately absent from CSS.
 */
export type BirdMotionKind = 'BREATHE' | 'ATTEND' | 'SETTLE' | 'REST'

export type BirdMotionMode = 'LOOP' | 'ONCE'

export interface BirdMotion {
  kind: BirdMotionKind
  mode: BirdMotionMode
}

export function birdMotion(cue: Cue): BirdMotion {
  switch (cue) {
    case 'ASK':
      // Listening reads as oriented stillness, not as activity.
      return { kind: 'ATTEND', mode: 'LOOP' }
    case 'LEFT':
    case 'RIGHT':
      // One small settle after the turn gesture, then hold. Never loops.
      return { kind: 'SETTLE', mode: 'ONCE' }
    case 'ARRIVED':
      // Arrival reads as rest, not celebration: one exhale, then stillness.
      return { kind: 'REST', mode: 'ONCE' }
    default:
      return { kind: 'BREATHE', mode: 'LOOP' }
  }
}
