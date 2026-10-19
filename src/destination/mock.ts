import { PLACE_REGISTRY, type PlaceRegistry } from '../registry/types'
import { DESTINATION_IDS, parseDestination, UNCERTAIN, type Destination, type DestinationInterpreter, type DestinationId } from './destination'

/** The word that names each place. Each also matches its longer form (批價 in 批價櫃台). */
const WORDS: Record<DestinationId, string> = {
  ENTRANCE: '大門',
  REGISTRATION: '掛號',
  ELEVATOR_IN: '電梯',
  NEUROSURGERY: '神經外科',
  CASHIER: '批價',
  PHARMACY: '藥局',
  EXIT: '出口',
}

/**
 * Runs when there is no API key. It only spots words — no AI — and names a
 * place only when exactly one is mentioned; two places, or none, is uncertain.
 */
export class MockInterpreter implements DestinationInterpreter {
  readonly mode = 'mock'

  constructor(private readonly registry: PlaceRegistry = PLACE_REGISTRY) {}

  async interpret(text: string): Promise<Destination> {
    const named = DESTINATION_IDS.filter((id) => text.includes(WORDS[id]))
    if (named.length !== 1) return UNCERTAIN
    return parseDestination(named[0], this.registry)
  }
}
