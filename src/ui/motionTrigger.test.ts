import { describe, expect, it } from 'vitest'
import {
  consumeIdleTrigger,
  IDLE_L1_TOTAL_MS,
  IDLE_L2_TOTAL_MS,
  idleSequenceTotalMs,
  reduceIdleTrigger,
  type IdleTrigger,
  type IdleTriggerEvent,
} from './motionTrigger'

/**
 * Single-shot acceptance triggers (DevPanel only): press once, play once,
 * land on BASE, never replay. The state machine already returns to BASE
 * past the sequence end — these tests pin the wiring contract around it:
 * arming, consumption timing (no restart mid-flight), and event reduction.
 */

describe('idle sequence durations match the state machine constants', () => {
  it('L1 total equals enter + hold + return', () => {
    expect(idleSequenceTotalMs('L1')).toBe(IDLE_L1_TOTAL_MS)
    expect(IDLE_L1_TOTAL_MS).toBeGreaterThan(0)
  })

  it('L2 total equals enter + hold + away + return, and is longer than L1', () => {
    expect(idleSequenceTotalMs('L2')).toBe(IDLE_L2_TOTAL_MS)
    expect(IDLE_L2_TOTAL_MS).toBeGreaterThan(IDLE_L1_TOTAL_MS)
  })
})

describe('consumeIdleTrigger — a press plays at most once', () => {
  const armedAt = 10_000

  it('reports remaining time while the sequence is mid-flight', () => {
    const trigger: IdleTrigger = { kind: 'L1', startedAtMs: armedAt }
    expect(consumeIdleTrigger(trigger, armedAt)).toBe('PLAYING')
    expect(consumeIdleTrigger(trigger, armedAt + IDLE_L1_TOTAL_MS - 1)).toBe('PLAYING')
  })

  it('reports done exactly when the sequence has finished', () => {
    const trigger: IdleTrigger = { kind: 'L1', startedAtMs: armedAt }
    expect(consumeIdleTrigger(trigger, armedAt + IDLE_L1_TOTAL_MS)).toBe('DONE')
    expect(consumeIdleTrigger(trigger, armedAt + IDLE_L1_TOTAL_MS + 60_000)).toBe('DONE')
  })

  it('reports done when there is no armed trigger at all', () => {
    expect(consumeIdleTrigger(null, armedAt)).toBe('DONE')
  })

  it('does not restart when the same button is pressed again mid-flight', () => {
    // The old error: pressing twice re-armed startedAtMs, so the glance
    // re-played from the top and could look like it was looping.
    const first: IdleTrigger = { kind: 'L1', startedAtMs: armedAt }
    const midFlight = armedAt + Math.floor(IDLE_L1_TOTAL_MS / 2)
    const secondPress: IdleTriggerEvent = { kind: 'L1', pressedAtMs: midFlight }
    expect(reduceIdleTrigger(first, secondPress, midFlight)).toEqual(first)
  })

  it('a cleared trigger does not replay: DONE stays DONE across ticks', () => {
    // The old error this guards: if the caller arms once and never clears,
    // the state machine returns to BASE by itself — but the effect kept the
    // same motionInput object, so a re-render could look like "press once,
    // replay forever" to a reviewer watching the phone. The contract is:
    // consumption is a pure function of (trigger, now); nothing re-arms
    // without a fresh press event.
    const trigger: IdleTrigger = { kind: 'L2', startedAtMs: armedAt }
    const end = armedAt + IDLE_L2_TOTAL_MS
    expect(consumeIdleTrigger(trigger, end - 1)).toBe('PLAYING')
    expect(consumeIdleTrigger(trigger, end)).toBe('DONE')
    expect(consumeIdleTrigger(trigger, end + 3_600_000)).toBe('DONE')
  })

  it('a press after the sequence finished arms a fresh single play', () => {
    const finished: IdleTrigger = { kind: 'L1', startedAtMs: armedAt }
    const later = armedAt + IDLE_L1_TOTAL_MS + 5_000
    const press: IdleTriggerEvent = { kind: 'L2', pressedAtMs: later }
    expect(reduceIdleTrigger(finished, press, later)).toEqual({ kind: 'L2', startedAtMs: later })
  })

  it('a different button mid-flight switches to the new sequence, once', () => {
    const first: IdleTrigger = { kind: 'L1', startedAtMs: armedAt }
    const midFlight = armedAt + Math.floor(IDLE_L1_TOTAL_MS / 2)
    const press: IdleTriggerEvent = { kind: 'L2', pressedAtMs: midFlight }
    const next = reduceIdleTrigger(first, press, midFlight)
    expect(next).toEqual({ kind: 'L2', startedAtMs: midFlight })
    // …and pressing L2 again mid-flight does not restart it either.
    const again: IdleTriggerEvent = { kind: 'L2', pressedAtMs: midFlight + 100 }
    expect(reduceIdleTrigger(next, again, midFlight + 100)).toEqual(next)
  })
})
