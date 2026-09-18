import { describe, expect, it } from 'vitest'
import { VirtualBirdAdapter } from './adapters/virtual'
import { deriveCue } from './engine/cues'
import { step } from './engine/engine'
import type { Observation, Posture } from './engine/types'
import { renderAsk, renderGuidance, renderNextCheckpoint } from './render/renderer'
import { loadVisit, MemoryStorage, saveVisit } from './persistence/visitStore'
import { DEMO_VISIT, MOCK_VENUE } from './venue/mock'

/**
 * The Phase 1 acceptance flow, end to end, with no LLM anywhere in it:
 *
 *   checkpoint -> one next step -> bird cue -> checkpoint -> uncertainty
 *   -> ask again -> arrival
 */
const t0 = 1_700_000_000_000

function scan(nodeId: string, at: number): Observation {
  return { nodeId, at, facingBearing: MOCK_VENUE.nodes[nodeId].qrFacingBearing, source: 'QR' }
}

describe('Phase 1 acceptance loop', () => {
  it('runs the whole visit with zero model calls', () => {
    const bird = new VirtualBirdAdapter()
    const storage = new MemoryStorage()
    const leg = DEMO_VISIT[0]
    let posture: Posture = 'MOVING'

    const at = (observation: Observation, now: number) => {
      const out = step({ graph: MOCK_VENUE, leg, lastObservation: observation, posture, now })
      bird.send(deriveCue(out.state, out.instruction))
      return out
    }

    // 1-3. Start at the entrance; only the next checkpoint is disclosed.
    let now = t0
    let observation = scan('ENTRANCE', now)
    let out = at(observation, now)
    expect(renderNextCheckpoint(out.nextCheckpointPlaceId, now)?.screen).toBe('下一個：掛號櫃台')
    expect(JSON.stringify(out)).not.toContain('ELEVATOR')
    expect(bird.lastCue).toBe('READY')

    // 4-5. Arrive at registration; the bird says which way.
    now += 40_000
    observation = scan('REGISTRATION', now)
    out = at(observation, now)
    expect(renderGuidance(out.instruction, now).screen).toBe('右轉。')
    expect(bird.lastCue).toBe('RIGHT')

    // 6. Continue. Between checkpoints the bird is quiet.
    now += 60_000
    out = at(observation, now)
    expect(bird.lastCue).toBe('QUIET')

    // Next checkpoint, and out of the lift it is a left.
    now += 30_000
    observation = scan('ELEVATOR_IN', now)
    at(observation, now)
    now += 60_000
    observation = scan('ELEVATOR_OUT', now)
    out = at(observation, now)
    expect(renderGuidance(out.instruction, now).screen).toBe('左轉。')
    expect(bird.lastCue).toBe('LEFT')

    // The person stops for a while. Persistence holds the step.
    saveVisit(
      { version: 1, venueId: MOCK_VENUE.id, legIndex: 0, lastObservation: observation, posture, startedAt: t0 },
      storage,
    )
    expect(loadVisit(storage)?.lastObservation?.nodeId).toBe('ELEVATOR_OUT')

    // 7-8. Confidence decays to UNKNOWN. Nightingale stops guessing.
    now += 10 * 60_000
    out = at(observation, now)
    expect(out.state.band).toBe('UNKNOWN')
    expect(out.instruction.turn).toBeNull()
    expect(renderGuidance(out.instruction, now).screen).toBe('我不確定。我陪你問。')
    expect(bird.lastCue).toBe('ASK')

    // 9-11. Long press the bird; the same verified string is shown and spoken.
    const asked: Array<{ screen: string; speech: string }> = []
    bird.on((event) => {
      if (event !== 'LONG_PRESS') return
      const ask = renderAsk(leg.destinationId, now)
      asked.push({ screen: ask.screen, speech: ask.speech })
    })
    bird.emit('LONG_PRESS')
    expect(asked).toEqual([{ screen: '請問，神經外科？', speech: '請問，神經外科？' }])

    // 12. Continue to arrival.
    now += 60_000
    observation = scan('CLINIC', now)
    out = at(observation, now)
    expect(out.state.progress).toBe('ARRIVED')
    expect(renderGuidance(out.instruction, now).screen).toBe('神經外科，到了。')
    expect(bird.lastCue).toBe('ARRIVED')

    // An explicit rest, at any point, is silence — indistinguishable from idle.
    posture = 'RESTING'
    out = at(scan('CASHIER', now), now)
    expect(renderGuidance(out.instruction, now).screen).toBe('')
    expect(bird.lastCue).toBe('QUIET')
  })
})
