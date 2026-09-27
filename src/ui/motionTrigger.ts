import {
  IDLE_L1_ENTER_MS,
  IDLE_L1_HOLD_MS,
  IDLE_L1_RETURN_MS,
  IDLE_L2_AWAY_MS,
  IDLE_L2_ENTER_MS,
  IDLE_L2_HOLD_MS,
  IDLE_L2_RETURN_MS,
} from './birdMotion'

/**
 * Single-shot acceptance triggers for the DevPanel IDLE buttons.
 *
 * Pure functions, no React, no clock. The wall-clock never enters here —
 * callers pass `nowMs` in, which keeps the rules testable with a fake clock
 * and keeps this file honest: it decides arming and consumption, never time.
 *
 * Contract: one press arms one play. Pressing the same button again while
 * its sequence is still mid-flight is ignored (it must not restart, and it
 * must never look like a loop). Pressing after the sequence finished arms
 * a fresh single play. Pressing the other button mid-flight switches to the
 * new sequence, once.
 */

export type IdleTriggerKind = 'L1' | 'L2'

export interface IdleTrigger {
  kind: IdleTriggerKind
  startedAtMs: number
}

export interface IdleTriggerEvent {
  kind: IdleTriggerKind
  pressedAtMs: number
}

/** Full sequence length, kept in one place so App and tests agree. */
export function idleSequenceTotalMs(kind: IdleTriggerKind): number {
  return kind === 'L1' ? IDLE_L1_TOTAL_MS : IDLE_L2_TOTAL_MS
}

export const IDLE_L1_TOTAL_MS = IDLE_L1_ENTER_MS + IDLE_L1_HOLD_MS + IDLE_L1_RETURN_MS

export const IDLE_L2_TOTAL_MS =
  IDLE_L2_ENTER_MS + IDLE_L2_HOLD_MS + IDLE_L2_AWAY_MS + IDLE_L2_RETURN_MS

export type TriggerConsumption = 'PLAYING' | 'DONE'

/** Has the armed sequence finished by `nowMs`? Null trigger counts as done. */
export function consumeIdleTrigger(trigger: IdleTrigger | null, nowMs: number): TriggerConsumption {
  if (trigger === null) return 'DONE'
  return nowMs - trigger.startedAtMs >= idleSequenceTotalMs(trigger.kind) ? 'DONE' : 'PLAYING'
}

/**
 * Fold a button press into the armed trigger. Same-kind press mid-flight is
 * ignored; anything else arms a fresh single play stamped at press time.
 */
export function reduceIdleTrigger(
  current: IdleTrigger | null,
  event: IdleTriggerEvent,
  nowMs: number,
): IdleTrigger {
  if (current !== null && current.kind === event.kind && consumeIdleTrigger(current, nowMs) === 'PLAYING') {
    return current
  }
  return { kind: event.kind, startedAtMs: event.pressedAtMs }
}
