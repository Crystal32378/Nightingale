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
 * Words that may turn the sentence against the place it names (不要去藥局).
 * ponytail: plain word list, so 不知道藥局在哪 is uncertain too — a false
 * uncertain only costs a 我陪你問; Nemotron handles the real sentences.
 */
const NEGATIONS = ['不要', '不想', '不用', '不去', '不必', '不是', '別']

/**
 * Runs when there is no API key. It only spots words — no AI — and names a
 * place only when exactly one is mentioned; two places, none, or any negation
 * is uncertain.
 */
export class MockInterpreter implements DestinationInterpreter {
  readonly mode = 'mock'

  constructor(private readonly registry: PlaceRegistry = PLACE_REGISTRY) {}

  async interpret(text: string): Promise<Destination> {
    if (NEGATIONS.some((word) => text.includes(word))) return UNCERTAIN
    const named = DESTINATION_IDS.filter((id) => text.includes(WORDS[id]))
    if (named.length !== 1) return UNCERTAIN
    return parseDestination(named[0], this.registry)
  }
}
