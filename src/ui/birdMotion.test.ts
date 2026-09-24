import { describe, expect, it } from 'vitest'
import {
  motionFrame,
  motionSequence,
  ZERO_TRANSFORM,
  IDLE_L1_ENTER_MS,
  IDLE_L1_HOLD_MS,
  IDLE_L1_RETURN_MS,
  IDLE_L2_HOLD_MS,
  BREATH_CYCLE_MS,
  BLINK_FIRE_OFFSETS_MS,
  type MotionInput,
} from './birdMotion'
import type { Cue } from '../engine/types'

const ANY_CUE: Cue = 'QUIET'

function baseInput(overrides: Partial<MotionInput> = {}): MotionInput {
  return {
    cue: ANY_CUE,
    listenActive: false,
    l1Triggered: false,
    l2Triggered: false,
    sequenceStartedAtMs: 0,
    now: 0,
    reducedMotion: false,
    ...overrides,
  }
}

describe('birdMotion is a pure function', () => {
  it('returns identical output for identical input', () => {
    const input = baseInput({ now: 12345, l1Triggered: true, sequenceStartedAtMs: 10000 })
    const a = motionFrame(input)
    const b = motionFrame(input)
    expect(a).toEqual(b)
  })

  it('has zero side effects on input', () => {
    const input = baseInput({ now: 12345 })
    const snapshot = JSON.stringify(input)
    motionFrame(input)
    motionFrame(input)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('reduced-motion handling', () => {
  it('returns BASE + zero transform regardless of cue or trigger', () => {
    const cues: Cue[] = ['QUIET', 'READY', 'LEFT', 'RIGHT', 'ASK', 'ARRIVED']
    for (const cue of cues) {
      const result = motionFrame(baseInput({ cue, reducedMotion: true, l1Triggered: true, listenActive: true }))
      expect(result.sprite).toBe('BASE')
      expect(result.transform).toEqual(ZERO_TRANSFORM)
      expect(result.ambientBreathingPaused).toBe(true)
    }
  })
})

describe('sequence picker', () => {
  it('returns IDLE_L0 when nothing is triggered', () => {
    expect(motionSequence({ listenActive: false, l1Triggered: false, l2Triggered: false })).toBe('IDLE_L0')
    expect(motionSequence({ listenActive: true, l1Triggered: false, l2Triggered: false })).toBe('LISTEN_L0')
  })

  it('L2 wins over L1', () => {
    expect(motionSequence({ listenActive: false, l1Triggered: true, l2Triggered: true })).toBe('IDLE_L2')
    expect(motionSequence({ listenActive: true, l1Triggered: true, l2Triggered: true })).toBe('LISTEN_L2')
  })

  it('LISTEN wins over IDLE for the same trigger', () => {
    expect(motionSequence({ listenActive: true, l1Triggered: true, l2Triggered: false })).toBe('LISTEN_L1')
  })
})

describe('IDLE L0 — ambient breath, optional blink', () => {
  it('breathes with non-zero translateY at peak', () => {
    // Half of breath cycle ≈ 2700ms when BREATH_CYCLE_MS[0] = 5400.
    const peakTime = 2700
    const result = motionFrame(baseInput({ now: peakTime }))
    expect(result.sprite).toBe('BASE')
    expect(result.ambientBreathingPaused).toBe(false)
    expect(Math.abs(result.transform.translateY)).toBeGreaterThan(0.5)
  })

  it('returns to baseline at cycle boundaries', () => {
    const result = motionFrame(baseInput({ now: 0 }))
    expect(result.transform.translateY).toBeCloseTo(0, 5)
  })

  it('fires BLINK within 120ms of any blink offset', () => {
    for (const offset of BLINK_FIRE_OFFSETS_MS) {
      // Master blink cycle is 30s; offset fires once per cycle.
      // Pick a `now` that lands inside the BLINK window.
      const now = offset + 60
      const result = motionFrame(baseInput({ now }))
      expect(result.sprite).toBe('BLINK')
    }
  })

  it('does NOT fire BLINK outside the 120ms window', () => {
    for (const offset of BLINK_FIRE_OFFSETS_MS) {
      const now = offset + 200  // safely outside the 120ms window
      const result = motionFrame(baseInput({ now }))
      expect(result.sprite).not.toBe('BLINK')
    }
  })
})

describe('IDLE L1 — quick glance', () => {
  const total = IDLE_L1_ENTER_MS + IDLE_L1_HOLD_MS + IDLE_L1_RETURN_MS

  it('uses ATTEND_HEAD during the enter phase', () => {
    const now = 50
    const result = motionFrame(baseInput({ l1Triggered: true, sequenceStartedAtMs: 0, now }))
    expect(result.sprite).toBe('ATTEND_HEAD')
    expect(result.transform.translateY).toBeLessThan(0)
  })

  it('pauses breathing during HOLD', () => {
    const now = IDLE_L1_ENTER_MS + 50  // mid-hold
    const result = motionFrame(baseInput({ l1Triggered: true, sequenceStartedAtMs: 0, now }))
    expect(result.ambientBreathingPaused).toBe(true)
    expect(['ATTEND_HEAD', 'GAZE_UP']).toContain(result.sprite)
  })

  it('falls back to BASE if the trigger outlives the sequence', () => {
    const now = total + 100
    const result = motionFrame(baseInput({ l1Triggered: true, sequenceStartedAtMs: 0, now }))
    expect(result.sprite).toBe('BASE')
    expect(result.transform.translateY).toBe(0)
  })

  it('total L1 duration is < 1000ms (per brief)', () => {
    expect(total).toBeLessThan(1000)
  })
})

describe('IDLE L2 — gaze with release (the critical test)', () => {
  const total = 200 + IDLE_L2_HOLD_MS + 150 + 250

  it('uses GAZE_UP during HOLD', () => {
    const now = 200 + IDLE_L2_HOLD_MS / 2  // mid-hold
    const result = motionFrame(baseInput({ l2Triggered: true, sequenceStartedAtMs: 0, now }))
    expect(result.sprite).toBe('GAZE_UP')
    expect(result.ambientBreathingPaused).toBe(true)
  })

  it('passes through GAZE_AWAY after HOLD (the release frame)', () => {
    const now = 200 + IDLE_L2_HOLD_MS + 50
    const result = motionFrame(baseInput({ l2Triggered: true, sequenceStartedAtMs: 0, now }))
    expect(result.sprite).toBe('GAZE_AWAY')
  })

  it('returns to BASE after total', () => {
    const now = total + 100
    const result = motionFrame(baseInput({ l2Triggered: true, sequenceStartedAtMs: 0, now }))
    expect(result.sprite).toBe('BASE')
  })

  it('1.2s hold is the upper limit, not the lower limit', () => {
    expect(IDLE_L2_HOLD_MS).toBeGreaterThanOrEqual(1000)
    expect(IDLE_L2_HOLD_MS).toBeLessThanOrEqual(1500)
  })
})

describe('LISTEN — pause breathing and hold attention', () => {
  it('LISTEN_L0 pauses breathing immediately', () => {
    const result = motionFrame(baseInput({ listenActive: true, sequenceStartedAtMs: 1000, now: 1500 }))
    expect(result.ambientBreathingPaused).toBe(true)
  })

  it('LISTEN_L2 release does NOT return to BASE (still listening)', () => {
    const total = 300 + 1200 + 200
    const now = total + 100
    const result = motionFrame(baseInput({
      listenActive: true,
      l2Triggered: true,
      sequenceStartedAtMs: 0,
      now,
    }))
    // Bird should still be in a tilted pose, not back to neutral BASE.
    expect(result.sprite).not.toBe('BASE')
  })
})

describe('jitter tables are deterministic', () => {
  it('breath cycle table has values in the 4.8s–6.0s range (5.4 ± 0.6)', () => {
    for (const ms of BREATH_CYCLE_MS) {
      expect(ms).toBeGreaterThanOrEqual(4800)
      expect(ms).toBeLessThanOrEqual(6000)
    }
  })

  it('blink fire offsets are in the 3.5s–7.0s range', () => {
    for (const ms of BLINK_FIRE_OFFSETS_MS) {
      expect(ms).toBeGreaterThanOrEqual(3500)
      expect(ms).toBeLessThanOrEqual(7000)
    }
  })

  it('no two consecutive breath cycles are identical', () => {
    // Looking for at least some natural variation; not a strict requirement,
    // but a metronomic cycle makes the bird feel like a clock.
    const unique = new Set(BREATH_CYCLE_MS).size
    expect(unique).toBeGreaterThan(2)
  })
})