import { describe, expect, it } from 'vitest'
import {
  IDLE_L1_ENTER_MS,
  IDLE_L1_HOLD_MS,
  IDLE_L1_RETURN_MS,
  IDLE_L2_AWAY_MS,
  IDLE_L2_ENTER_MS,
  IDLE_L2_HOLD_MS,
  type MotionFrame,
  type MotionInput,
} from './birdMotion'
import { startMotionDriver, type MotionDriverDeps } from './motionDriver'

/**
 * Regression guard for the frozen-clock wiring bug: the component's
 * motionInput prop carries a `now` snapshot, and replaying that snapshot on
 * every rAF tick keeps L1/L2 stuck on their first frame forever. The pure
 * state-machine tests can never catch that — they always hand-advance `now`.
 * These tests drive the SAME driver the component mounts, with a fake rAF
 * queue and fake clock, and assert that time actually advances.
 */

function fakeScheduler(startMs: number) {
  let now = startMs
  let queue: Array<(t: number) => void> = []
  const deps: MotionDriverDeps = {
    raf: (cb) => {
      queue.push(cb)
      return queue.length
    },
    caf: () => {
      queue = []
    },
    clock: () => now,
  }
  return {
    deps,
    /** Advance the clock, then run every callback queued at this instant. */
    advance(ms: number) {
      now += ms
      const due = queue
      queue = []
      for (const cb of due) cb(now)
    },
  }
}

const T0 = 100_000

/** Deliberately stale `now: 0`, exactly as a render-time prop snapshot would be. */
const staleInput = (overrides: Partial<MotionInput>): MotionInput => ({
  cue: 'READY',
  listenActive: false,
  l1Triggered: false,
  l2Triggered: false,
  sequenceStartedAtMs: T0,
  now: 0,
  reducedMotion: false,
  ...overrides,
})

function collectFrames(input: MotionInput, startMs = T0) {
  const scheduler = fakeScheduler(startMs)
  const frames: MotionFrame[] = []
  const stop = startMotionDriver(() => input, (f) => frames.push(f), scheduler.deps)
  return { scheduler, frames, stop }
}

describe('motion driver clock ownership', () => {
  it('advances an IDLE L1 glance through enter → hold → back to BASE despite a stale input.now', () => {
    const { scheduler, frames } = collectFrames(staleInput({ l1Triggered: true }))

    scheduler.advance(0) // first tick, elapsed 0 → enter
    scheduler.advance(IDLE_L1_ENTER_MS + 50) // inside hold
    scheduler.advance(IDLE_L1_HOLD_MS + IDLE_L1_RETURN_MS) // past the sequence

    expect(frames[0]!.sprite).toBe('ATTEND_HEAD')
    expect(frames[1]!.sprite).toBe('GAZE_UP')
    expect(frames[1]!.ambientBreathingPaused).toBe(true)
    expect(frames[2]!.sprite).toBe('BASE')
    expect(frames[2]!.ambientBreathingPaused).toBe(false)
    // The actual regression assertion: the frame CHANGED across ticks.
    expect(new Set(frames.map((f) => f.sprite)).size).toBeGreaterThan(1)
  })

  it('advances an IDLE L2 gaze through hold → look-away → back to BASE', () => {
    const { scheduler, frames } = collectFrames(staleInput({ l2Triggered: true }))

    scheduler.advance(0) // enter
    scheduler.advance(IDLE_L2_ENTER_MS + 100) // hold
    scheduler.advance(IDLE_L2_HOLD_MS) // into away window
    scheduler.advance(IDLE_L2_AWAY_MS + 300) // past the sequence

    expect(frames[0]!.sprite).toBe('GAZE_UP')
    expect(frames[1]!.ambientBreathingPaused).toBe(true)
    expect(frames[2]!.sprite).toBe('GAZE_AWAY')
    expect(frames[3]!.sprite).toBe('BASE')
    expect(frames[3]!.ambientBreathingPaused).toBe(false)
  })

  it('reads fresh input every tick, so a cleared trigger takes effect without remounting', () => {
    let input = staleInput({ l1Triggered: true })
    const scheduler = fakeScheduler(T0)
    const frames: MotionFrame[] = []
    startMotionDriver(() => input, (f) => frames.push(f), scheduler.deps)

    scheduler.advance(0)
    input = staleInput({ l1Triggered: false })
    scheduler.advance(16)

    expect(frames[0]!.sprite).toBe('ATTEND_HEAD')
    expect(frames[1]!.sprite).toBe('BASE') // back on ambient the very next frame
  })

  it('stops cleanly: no frames after the stop function runs', () => {
    const { scheduler, frames, stop } = collectFrames(staleInput({ l1Triggered: true }))
    scheduler.advance(0)
    stop()
    scheduler.advance(500)
    expect(frames).toHaveLength(1)
  })
})
