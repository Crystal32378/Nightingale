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
 * Words that turn the sentence against the place it names (不要去藥局). A
 * list, not every 不: 不知道藥局在哪 still wants the pharmacy.
 * ponytail: a list misses phrasings nobody added yet; add them here with a
 * test. A miss walks someone the wrong way only if they then confirm it.
 */
const NEGATIONS = ['不要', '不想', '不用', '不去', '不必', '不是', '不能', '不需要', '不可以', '不會', '不打算', '沒有要', '沒要', '別',
  // Doubt counts too. Not 可能: 藥局可能在幾樓 still wants the pharmacy.
  '也許', '或許', '說不定', '不確定要', '不一定要']

/** The English name of each place, as a whole word: exiting is not the exit. */
const WORDS_EN: Record<DestinationId, RegExp> = {
  ENTRANCE: /\bentrance\b/i,
  REGISTRATION: /\bregistration\b/i,
  ELEVATOR_IN: /\belevator\b/i,
  NEUROSURGERY: /\bneurosurgery\b/i,
  CASHIER: /\bcashier\b/i,
  PHARMACY: /\bpharmacy\b/i,
  EXIT: /\bexit\b/i,
}

/**
 * English negation or doubt, after dropping the phrases that still want the
 * place (I don't know where the pharmacy is), as 不知道 is not in the list
 * above. Any n't counts, so no contraction can be left off.
 * ponytail: same ceiling as NEGATIONS; add phrasings here with a test.
 */
const NOT_KNOWING_EN = /\b((do not|don't|dont) know|not sure) (where|how)\b/gi
const NEGATION_EN = /\b(no|not|never|cannot|dont|wont|cant|maybe|perhaps)\b|\w+n't\b/i

/**
 * Runs when there is no API key. It only spots words — no AI — and names a
 * place only when exactly one is mentioned; two places, none, or any negation
 * is uncertain.
 */
export class MockInterpreter implements DestinationInterpreter {
  readonly mode = 'mock'

  constructor(private readonly registry: PlaceRegistry = PLACE_REGISTRY) {}

  async interpret(text: string): Promise<Destination> {
    // Phone keyboards type ’ for '.
    const english = text.replace(/’/g, "'")
    if (NEGATIONS.some((word) => text.includes(word))) return UNCERTAIN
    if (NEGATION_EN.test(english.replace(NOT_KNOWING_EN, ''))) return UNCERTAIN
    const named = DESTINATION_IDS.filter((id) => text.includes(WORDS[id]) || WORDS_EN[id].test(english))
    if (named.length !== 1) return UNCERTAIN
    return parseDestination(named[0], this.registry)
  }
}
