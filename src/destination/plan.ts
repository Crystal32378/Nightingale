import type { VisitLeg } from '../engine/types'
import { DEMO_VISIT } from '../venue/mock'
import type { Destination } from './destination'

/** What to do once the person has confirmed a destination. */
export type Plan = { kind: 'walk'; legIndex: number } | { kind: 'ask'; placeId: string } | { kind: 'uncertain' }

/**
 * A place the demo visit walks to starts the visit at that leg; the engine
 * still works out the route. Anywhere else (大門, 掛號, 電梯) is asked about
 * on the ask card rather than walked to. Nothing here makes an Observation.
 */
export function planFor(destination: Destination, visit: VisitLeg[] = DEMO_VISIT): Plan {
  if (destination.kind === 'uncertain') return { kind: 'uncertain' }
  const legIndex = visit.findIndex((leg) => leg.destinationId === destination.placeId)
  return legIndex >= 0 ? { kind: 'walk', legIndex } : { kind: 'ask', placeId: destination.placeId }
}
