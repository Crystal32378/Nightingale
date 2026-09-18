import { describe, expect, it } from 'vitest'
import { DEMO_VISIT, MOCK_VENUE } from '../venue/mock'
import { deriveCue } from './cues'
import { detectBacktrack, step, TURN_GUIDANCE_TTL_MS } from './engine'
import type { Observation, Posture } from './types'

const t0 = 1_700_000_000_000
const TO_CLINIC = DEMO_VISIT[0]

function obs(nodeId: string, at = t0, source: Observation['source'] = 'QR'): Observation {
  const node = MOCK_VENUE.nodes[nodeId]
  return {
    nodeId,
    at,
    facingBearing: source === 'QR' ? node.qrFacingBearing : null,
    source,
  }
}

function run(lastObservation: Observation | null, now: number, posture: Posture = 'MOVING') {
  return step({ graph: MOCK_VENUE, leg: TO_CLINIC, lastObservation, posture, now })
}

describe('one step at a time', () => {
  it('discloses the next checkpoint and nothing further', () => {
    const out = run(obs('ENTRANCE'), t0)
    expect(out.nextCheckpointNodeId).toBe('REGISTRATION')
    expect(out.instruction.disclosedSteps).toBe(1)
  })

  it('does not carry the remaining route in the response at all', () => {
    const serialized = JSON.stringify(run(obs('ENTRANCE'), t0))
    for (const hidden of ['ELEVATOR_IN', 'ELEVATOR_OUT', 'CLINIC', 'CASHIER', 'PHARMACY', 'EXIT']) {
      expect(serialized).not.toContain(hidden)
    }
  })

  it('never returns an array of steps', () => {
    const out = run(obs('ENTRANCE'), t0)
    expect(Object.values(out).some((v) => Array.isArray(v))).toBe(false)
  })
})

describe('checkpoint and transit', () => {
  it('is at the checkpoint just after the observation, and READY', () => {
    const out = run(obs('ENTRANCE'), t0)
    expect(out.state.progress).toBe('AT_CHECKPOINT')
    expect(out.instruction.intent).toBe('GO')
    expect(deriveCue(out.state, out.instruction)).toBe('READY')
  })

  it('falls silent in transit between checkpoints', () => {
    const out = run(obs('ENTRANCE'), t0 + 60_000)
    expect(out.state.progress).toBe('IN_TRANSIT')
    expect(deriveCue(out.state, out.instruction)).toBe('QUIET')
  })
})

describe('turns', () => {
  it('turns right out of registration', () => {
    const out = run(obs('REGISTRATION'), t0)
    expect(out.instruction.intent).toBe('TURN')
    expect(out.instruction.turn).toBe('RIGHT')
    expect(deriveCue(out.state, out.instruction)).toBe('RIGHT')
  })

  it('turns left out of the lift', () => {
    const out = run(obs('ELEVATOR_OUT'), t0)
    expect(out.instruction.turn).toBe('LEFT')
    expect(deriveCue(out.state, out.instruction)).toBe('LEFT')
  })

  it('gives a TTL with every direction', () => {
    const out = run(obs('REGISTRATION'), t0)
    expect(out.instruction.turnExpiresAt).toBe(t0 + TURN_GUIDANCE_TTL_MS)
  })

  it('stops emitting left or right once the TTL has passed', () => {
    const out = run(obs('REGISTRATION'), t0 + TURN_GUIDANCE_TTL_MS + 1)
    expect(out.instruction.turn).toBeNull()
    expect(out.instruction.turnExpiresAt).toBeNull()
    expect(out.instruction.intent).toBe('GO')
    expect(deriveCue(out.state, out.instruction)).not.toBe('RIGHT')
  })

  it('claims no direction when the observation carries no facing prior', () => {
    const out = run(obs('REGISTRATION', t0, 'BUTTON_CONFIRM'), t0)
    expect(out.instruction.turn).toBeNull()
    expect(out.instruction.intent).toBe('GO')
  })

  it('claims no direction through the lift, which has no heading', () => {
    const out = run(obs('ELEVATOR_IN'), t0)
    expect(out.instruction.turn).toBeNull()
  })
})

describe('uncertainty', () => {
  it('stops guessing once confidence is UNKNOWN', () => {
    const out = run(obs('REGISTRATION'), t0 + 10 * 60_000)
    expect(out.state.band).toBe('UNKNOWN')
    expect(out.instruction.intent).toBe('ASK_DIRECTION')
    expect(out.instruction.turn).toBeNull()
    expect(out.nextCheckpointNodeId).toBeNull()
    expect(deriveCue(out.state, out.instruction)).toBe('ASK')
  })

  it('never describes the person as lost — only the system as unsure', () => {
    const out = run(obs('REGISTRATION'), t0 + 10 * 60_000)
    expect(out.state.posture).toBe('MOVING')
    expect(JSON.stringify(out)).not.toContain('LOST')
  })
})

describe('posture', () => {
  it('stays absolutely quiet while resting, and looks like idle', () => {
    const out = run(obs('REGISTRATION'), t0 + 5_000, 'RESTING')
    expect(out.instruction.intent).toBe('WAIT')
    expect(out.instruction.turn).toBeNull()
    expect(out.nextCheckpointNodeId).toBeNull()
    expect(deriveCue(out.state, out.instruction)).toBe('QUIET')
  })

  it('stays quiet while resting even once confidence has gone', () => {
    const out = run(obs('REGISTRATION'), t0 + 15 * 60_000, 'RESTING')
    expect(out.state.band).toBe('UNKNOWN')
    expect(deriveCue(out.state, out.instruction)).toBe('QUIET')
  })

  it('is never inferred by the engine — only time and observation move on their own', () => {
    for (const elapsed of [0, 60_000, 60 * 60_000]) {
      expect(run(obs('REGISTRATION'), t0 + elapsed).state.posture).toBe('MOVING')
    }
  })

  it('offers to ask when the person says they need help', () => {
    const out = run(obs('REGISTRATION'), t0, 'NEEDS_HELP')
    expect(out.instruction.intent).toBe('ASK_DIRECTION')
    expect(out.instruction.destinationId).toBe('NEUROSURGERY')
    expect(deriveCue(out.state, out.instruction)).toBe('ASK')
  })
})

describe('arrival', () => {
  it('arrives at the leg destination', () => {
    const out = run(obs('CLINIC'), t0)
    expect(out.state.progress).toBe('ARRIVED')
    expect(out.instruction.intent).toBe('ARRIVED')
    expect(deriveCue(out.state, out.instruction)).toBe('ARRIVED')
  })
})

describe('no observation yet', () => {
  it('says nothing at all before the visit starts', () => {
    const out = run(null, t0)
    expect(out.instruction.intent).toBe('NONE')
    expect(deriveCue(out.state, out.instruction)).toBe('QUIET')
  })
})

describe('backtracking', () => {
  it('is an event, not a state', () => {
    const event = detectBacktrack(MOCK_VENUE, 'ELEVATOR_IN', obs('REGISTRATION', t0 + 1), 'CLINIC')
    expect(event).toEqual({ type: 'BACKTRACKED', nodeId: 'REGISTRATION', at: t0 + 1 })
    const out = run(obs('REGISTRATION', t0 + 1), t0 + 1)
    expect(JSON.stringify(out)).not.toContain('BACKTRACK')
    expect(out.state.progress).toBe('AT_CHECKPOINT')
  })

  it('does not fire when moving forward', () => {
    expect(detectBacktrack(MOCK_VENUE, 'REGISTRATION', obs('ELEVATOR_IN', t0 + 1), 'CLINIC')).toBeNull()
  })
})
