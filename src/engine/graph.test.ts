import { describe, expect, it } from 'vitest'
import { MOCK_VENUE } from '../venue/mock'
import {
  deriveTurn,
  edgeBetween,
  findPath,
  nextNodeId,
  relativeAngle,
  validateVenueAuthoring,
} from './graph'
import type { VenueGraph } from './types'

describe('graph traversal', () => {
  it('finds the shortest path through the venue', () => {
    expect(findPath(MOCK_VENUE, 'ENTRANCE', 'CLINIC')).toEqual([
      'ENTRANCE',
      'REGISTRATION',
      'ELEVATOR_IN',
      'ELEVATOR_OUT',
      'CLINIC',
    ])
  })

  it('returns a single-element path when already there', () => {
    expect(findPath(MOCK_VENUE, 'CLINIC', 'CLINIC')).toEqual(['CLINIC'])
  })

  it('returns null for unknown nodes', () => {
    expect(findPath(MOCK_VENUE, 'ENTRANCE', 'NOWHERE')).toBeNull()
    expect(nextNodeId(MOCK_VENUE, 'NOWHERE', 'CLINIC')).toBeNull()
  })

  it('hands out one next node, never the route', () => {
    expect(nextNodeId(MOCK_VENUE, 'ENTRANCE', 'EXIT')).toBe('REGISTRATION')
    expect(nextNodeId(MOCK_VENUE, 'CLINIC', 'CLINIC')).toBeNull()
  })

  it('walks backwards too, so a backtrack is navigable', () => {
    expect(nextNodeId(MOCK_VENUE, 'CLINIC', 'ENTRANCE')).toBe('ELEVATOR_OUT')
  })

  it('has no dangling edges in the mock venue', () => {
    const warnings = validateVenueAuthoring(MOCK_VENUE)
    expect(warnings.filter((w) => w.kind === 'DANGLING_EDGE')).toEqual([])
  })
})

describe('turn derivation', () => {
  it('measures relative angle signed, right positive', () => {
    expect(relativeAngle(0, 90)).toBe(90)
    expect(relativeAngle(180, 90)).toBe(-90)
    expect(relativeAngle(350, 10)).toBe(20)
  })

  it('derives right and left from the installed facing prior', () => {
    expect(deriveTurn(0, 90)).toBe('RIGHT')
    expect(deriveTurn(180, 90)).toBe('LEFT')
  })

  it('emits no turn when the way is straight ahead', () => {
    expect(deriveTurn(0, 10)).toBeNull()
  })

  it('emits no turn when there is no facing prior — it does not guess', () => {
    expect(deriveTurn(null, 90)).toBeNull()
    expect(deriveTurn(90, null)).toBeNull()
  })

  it('emits no turn for a near reversal, where left and right are not distinguishable', () => {
    expect(deriveTurn(0, 178)).toBeNull()
  })
})

describe('venue authoring check', () => {
  const nearReversal: VenueGraph = {
    id: 'FIXTURE',
    nodes: {
      A: { id: 'A', placeId: 'ENTRANCE', qrFacingBearing: 0, edges: [{ to: 'B', bearing: 175 }] },
      B: { id: 'B', placeId: 'EXIT', qrFacingBearing: 0, edges: [] },
    },
  }

  it('warns about a near-180 turn instead of failing the build', () => {
    const warnings = validateVenueAuthoring(nearReversal)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].kind).toBe('NEAR_REVERSAL')
    expect(warnings[0].nodeId).toBe('A')
  })

  it('reports a dangling edge', () => {
    const broken: VenueGraph = {
      id: 'FIXTURE',
      nodes: {
        A: { id: 'A', placeId: 'ENTRANCE', qrFacingBearing: 0, edges: [{ to: 'GHOST', bearing: 0 }] },
      },
    }
    expect(validateVenueAuthoring(broken)[0].kind).toBe('DANGLING_EDGE')
  })
})

describe('edge lookup', () => {
  it('returns the edge or null', () => {
    expect(edgeBetween(MOCK_VENUE, 'ENTRANCE', 'REGISTRATION')?.bearing).toBe(0)
    expect(edgeBetween(MOCK_VENUE, 'ENTRANCE', 'CLINIC')).toBeNull()
  })
})
