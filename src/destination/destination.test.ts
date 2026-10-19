import { describe, expect, it } from 'vitest'
import { PLACE_REGISTRY, type PlaceRegistry } from '../registry/types'
import { DESTINATION_IDS, parseDestination } from './destination'

/**
 * A model's answer is untrusted text. The bird walks a person toward whatever
 * comes out of here, so the only two outcomes are a place the registry vouches
 * for, or uncertain — which opens "我陪你問" instead of inventing a route.
 * Every test below is a way a model answer can be wrong; all of them must end
 * in uncertain, never in a guess.
 */

const UNCERTAIN = { kind: 'uncertain' }

describe('an answer that names an offered place becomes that destination', () => {
  it.each(DESTINATION_IDS)('%s', (id) => {
    expect(parseDestination(id)).toEqual({ kind: 'place', placeId: id })
  })

  it('tolerates the whitespace and newline a model often wraps around one token', () => {
    expect(parseDestination('  PHARMACY\n')).toEqual({ kind: 'place', placeId: 'PHARMACY' })
  })
})

describe('the elevator is where you board it', () => {
  it('offers ELEVATOR_IN and not ELEVATOR_OUT', () => {
    expect(DESTINATION_IDS).toContain('ELEVATOR_IN')
    expect(DESTINATION_IDS).not.toContain('ELEVATOR_OUT')
  })

  it('treats ELEVATOR_OUT as uncertain even though the registry knows it', () => {
    // "我要去電梯" means the place you get in. The exit upstairs is only ever
    // reached by riding there, so it is never a destination someone asks for.
    expect(PLACE_REGISTRY.ELEVATOR_OUT).toBeDefined()
    expect(parseDestination('ELEVATOR_OUT')).toEqual(UNCERTAIN)
  })
})

describe('an id that is not on the list is uncertain', () => {
  it.each(['ICU', 'NEUROSURGERY_2', 'CLINIC'])('%s', (id) => {
    // CLINIC is the map node for 神經外科, not a place id — the model answers
    // in place ids and the route is found from there.
    expect(parseDestination(id)).toEqual(UNCERTAIN)
  })

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'does not mistake the object prototype for a place: %s',
    (id) => {
      expect(parseDestination(id)).toEqual(UNCERTAIN)
    },
  )

  it('refuses a registry place whose name has no source', () => {
    const unsourced: PlaceRegistry = {
      ...PLACE_REGISTRY,
      PHARMACY: { ...PLACE_REGISTRY.PHARMACY, source: null },
    }
    expect(parseDestination('PHARMACY', unsourced)).toEqual(UNCERTAIN)
  })
})

describe('an answer in the wrong format is uncertain', () => {
  it.each([
    'pharmacy',
    'PHARMACY.',
    '"PHARMACY"',
    '{"placeId":"PHARMACY"}',
    'PHARMACY CASHIER',
    'PHARMACY\nCASHIER',
    'The destination is PHARMACY',
    '我想去藥局',
    'UNCERTAIN',
  ])('%j', (raw) => {
    expect(parseDestination(raw)).toEqual(UNCERTAIN)
  })
})

describe('an empty answer is uncertain', () => {
  it.each(['', '   ', '\n'])('blank string %j', (raw) => {
    expect(parseDestination(raw)).toEqual(UNCERTAIN)
  })

  it.each([null, undefined, 42, {}, ['PHARMACY']])('non-string %j', (raw) => {
    expect(parseDestination(raw)).toEqual(UNCERTAIN)
  })
})
