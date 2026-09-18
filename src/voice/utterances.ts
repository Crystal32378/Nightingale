import { PLACE_REGISTRY, type PlaceRegistry } from '../registry/types'
import { materialize } from '../render/renderer'
import { PLACE_BEARING_SPOKEN_KEYS, SPOKEN_KEYS, type SpokenKey } from '../strings/keys'

/**
 * The canonical set of things Nightingale can say out loud.
 *
 * This list is DERIVED, never hand-written: it comes from the spoken string
 * keys and the verified place registry. Add a place to the registry and the
 * list grows by exactly two; change a sentence and the text here changes with
 * it, which is what makes the manifest check meaningful.
 */
export interface CanonicalUtterance {
  /** stringKey, plus the place when the key takes one */
  id: string
  key: SpokenKey
  placeId: string | null
  text: string
  /** safe on every filesystem; `#` is not */
  fileStem: string
}

function bearsPlace(key: SpokenKey): boolean {
  return (PLACE_BEARING_SPOKEN_KEYS as readonly string[]).includes(key)
}

export function utteranceId(key: SpokenKey, placeId: string | null): string {
  return placeId === null ? key : `${key}#${placeId}`
}

export function fileStemFor(id: string): string {
  return id.replace('#', '__')
}

export function canonicalUtterances(registry: PlaceRegistry = PLACE_REGISTRY): CanonicalUtterance[] {
  const verifiedPlaceIds = Object.values(registry)
    .filter((entry) => entry.verified)
    .map((entry) => entry.id)
    .sort()

  const out: CanonicalUtterance[] = []

  for (const key of SPOKEN_KEYS) {
    const places = bearsPlace(key) ? verifiedPlaceIds : [null]
    for (const placeId of places) {
      const text = materialize({ key, params: placeId === null ? undefined : { placeId } }, { registry })
      if (text.trim().length === 0) continue // silence needs no file
      const id = utteranceId(key, placeId)
      out.push({ id, key, placeId, text, fileStem: fileStemFor(id) })
    }
  }

  return out
}

/**
 * Keys that share another key's audio because they are the same characters.
 * `fallback.safe` is `guidance.uncertain` — one recording, never two.
 */
export const SHARED_AUDIO: Record<string, string> = {
  'fallback.safe': 'guidance.uncertain',
}
