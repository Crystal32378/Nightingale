import { describe, expect, it } from 'vitest'
import { DEMO_VISIT } from '../venue/mock'
import { planFor } from './plan'

/**
 * What happens after the person confirms where they want to go. It only picks
 * where the walk starts in the demo visit — the route is still the engine's,
 * and where the person is still comes from a QR scan or a button. A place the
 * demo visit does not walk to is asked about instead of guessed at.
 */

describe('planFor', () => {
  it.each([
    ['NEUROSURGERY', 0],
    ['CASHIER', 1],
    ['PHARMACY', 2],
    ['EXIT', 3],
  ])('walks the demo visit from the %s leg', (placeId, legIndex) => {
    expect(planFor({ kind: 'place', placeId })).toEqual({ kind: 'walk', legIndex })
    // The leg it picks really is the one that ends there.
    expect(DEMO_VISIT[legIndex].destinationId).toBe(placeId)
  })

  it.each(['ENTRANCE', 'REGISTRATION', 'ELEVATOR_IN'])(
    'asks someone about %s, which the demo visit never walks to',
    (placeId) => {
      expect(planFor({ kind: 'place', placeId })).toEqual({ kind: 'ask', placeId })
    },
  )

  it('stays uncertain when nobody knows where the person wants to go', () => {
    expect(planFor({ kind: 'uncertain' })).toEqual({ kind: 'uncertain' })
  })
})
