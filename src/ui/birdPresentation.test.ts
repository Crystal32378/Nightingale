import { describe, expect, it } from 'vitest'
import { deriveCue } from '../engine/cues'
import { step, TURN_GUIDANCE_TTL_MS } from '../engine/engine'
import type { Cue, Observation } from '../engine/types'
import { DEMO_VISIT, MOCK_VENUE } from '../venue/mock'
import { birdFacing, birdMotion, isDirectionalCue, lampState } from './birdPresentation'

const ALL_CUES: Cue[] = ['QUIET', 'READY', 'LEFT', 'RIGHT', 'ASK', 'ARRIVED']

describe('bird facing is a gesture, never a compass claim', () => {
  it('mirrors only for LEFT — every other cue faces canonical', () => {
    for (const cue of ALL_CUES) {
      expect(birdFacing(cue)).toBe(cue === 'LEFT' ? 'MIRRORED' : 'CANONICAL')
    }
  })

  it('depends on the cue and on nothing else', () => {
    // Same cue, called repeatedly, always the same facing: no hidden state, no
    // orientation of its own.
    expect(birdFacing('RIGHT')).toBe(birdFacing('RIGHT'))
    expect(birdFacing('QUIET')).toBe('CANONICAL')
  })

  it('has no resting pose that points anywhere', () => {
    for (const cue of ALL_CUES) {
      if (!isDirectionalCue(cue)) expect(birdFacing(cue)).toBe('CANONICAL')
    }
  })
})

describe('the bird cannot hold a direction after the guidance expires', () => {
  const t0 = 1_700_000_000_000
  const leg = DEMO_VISIT[0]
  const observation: Observation = {
    nodeId: 'ELEVATOR_OUT',
    at: t0,
    facingBearing: MOCK_VENUE.nodes.ELEVATOR_OUT.qrFacingBearing,
    source: 'QR',
  }

  const facingAt = (now: number) => {
    const out = step({ graph: MOCK_VENUE, leg, lastObservation: observation, posture: 'MOVING', now })
    return birdFacing(deriveCue(out.state, out.instruction))
  }

  it('gestures left while the turn is live', () => {
    expect(facingAt(t0)).toBe('MIRRORED')
  })

  it('returns to canonical the moment the turn TTL passes', () => {
    expect(facingAt(t0 + TURN_GUIDANCE_TTL_MS + 1)).toBe('CANONICAL')
  })

  it('is canonical while resting, whatever happened before', () => {
    const out = step({ graph: MOCK_VENUE, leg, lastObservation: observation, posture: 'RESTING', now: t0 })
    expect(birdFacing(deriveCue(out.state, out.instruction))).toBe('CANONICAL')
  })
})

describe('the lamp is the only part that changes', () => {
  it('is dark when quiet — resting is indistinguishable from idle', () => {
    expect(lampState('QUIET')).toBe('DIM')
  })

  it('is steady at a checkpoint and on a direction', () => {
    expect(lampState('READY')).toBe('STEADY')
    expect(lampState('LEFT')).toBe('STEADY')
    expect(lampState('RIGHT')).toBe('STEADY')
  })

  it('breathes while unsure and blinks on arrival', () => {
    expect(lampState('ASK')).toBe('BREATHING')
    expect(lampState('ARRIVED')).toBe('BLINKING')
  })

  it('has no alarm state at all', () => {
    const states = ALL_CUES.map(lampState)
    expect(states).not.toContain('ALARM')
    expect(new Set(states).size).toBe(4)
  })
})

describe('body motion is ambient and never carries information', () => {
  it('is a function of the cue and nothing else', () => {
    expect(birdMotion('ASK')).toEqual(birdMotion('ASK'))
    expect(birdMotion('QUIET')).toEqual({ kind: 'BREATHE', mode: 'LOOP' })
  })

  it('gestures and arrivals are one-shot; ambient states loop', () => {
    expect(birdMotion('LEFT')).toEqual({ kind: 'SETTLE', mode: 'ONCE' })
    expect(birdMotion('RIGHT')).toEqual({ kind: 'SETTLE', mode: 'ONCE' })
    expect(birdMotion('ARRIVED')).toEqual({ kind: 'REST', mode: 'ONCE' })
    for (const cue of ['QUIET', 'READY', 'ASK'] as Cue[]) {
      expect(birdMotion(cue).mode).toBe('LOOP')
    }
  })

  it('listening reads as attention, not activity', () => {
    expect(birdMotion('ASK').kind).toBe('ATTEND')
  })

  it('has no alarm or celebration motion vocabulary at all', () => {
    const kinds = [...new Set(ALL_CUES.map((cue) => birdMotion(cue).kind))].sort()
    expect(kinds).toEqual(['ATTEND', 'BREATHE', 'REST', 'SETTLE'])
  })
})
