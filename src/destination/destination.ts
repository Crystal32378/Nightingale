import { isVerifiedPlace, PLACE_REGISTRY, type PlaceRegistry } from '../registry/types'

/**
 * Where a person said they want to go — a place id, or uncertain.
 *
 * This only ever names a destination. Where the person *is* comes from a QR
 * scan or a button they pressed; nothing derived from what they typed may
 * become an Observation.
 */
export type Destination = { kind: 'place'; placeId: string } | { kind: 'uncertain' }

export const UNCERTAIN: Destination = { kind: 'uncertain' }

/**
 * The place ids a person can ask for. ELEVATOR_OUT is left out on purpose:
 * "電梯" means where you get in, and the exit upstairs is only reached by
 * riding there.
 */
export const DESTINATION_IDS = [
  'ENTRANCE',
  'REGISTRATION',
  'ELEVATOR_IN',
  'NEUROSURGERY',
  'CASHIER',
  'PHARMACY',
  'EXIT',
] as const

export type DestinationId = (typeof DESTINATION_IDS)[number]

/**
 * Turns what a person typed into a destination. The mock and Nemotron both
 * implement this; `mode` is what the screen shows (模擬 / Nemotron) so nobody
 * mistakes one for the other.
 */
export interface DestinationInterpreter {
  readonly mode: 'mock' | 'nemotron'
  interpret(text: string): Promise<Destination>
}

/**
 * The one gate a model's answer passes through. The answer must be exactly one
 * offered id (surrounding whitespace aside) whose registry entry is verified;
 * anything else — another id, a sentence, JSON, blank, not a string — is
 * uncertain. Fail closed: a wrong place sends someone walking the wrong way.
 */
export function parseDestination(raw: unknown, registry: PlaceRegistry = PLACE_REGISTRY): Destination {
  if (typeof raw !== 'string') return UNCERTAIN
  const id = raw.trim()
  if (!(DESTINATION_IDS as readonly string[]).includes(id)) return UNCERTAIN
  if (!isVerifiedPlace(id, registry)) return UNCERTAIN
  return { kind: 'place', placeId: id }
}
