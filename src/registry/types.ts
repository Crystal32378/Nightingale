/**
 * The verified place registry.
 *
 * Nothing may be spoken or shown about a place that is not in here. This is the
 * only source of proper nouns in the product: no model, no route file and no UI
 * string may introduce one.
 *
 * The registry is data, not a singleton: every lookup takes one, so a test (or
 * a second venue) can supply its own without the shipped registry carrying
 * entries that exist only for tests.
 */
export type Locale = 'zh-TW'

export interface PlaceEntry {
  id: string
  /** Only verified entries may ever be interpolated into guidance. */
  verified: boolean
  names: Record<Locale, string>
}

export type PlaceRegistry = Record<string, PlaceEntry>

export const PLACE_REGISTRY: PlaceRegistry = {
  ENTRANCE: { id: 'ENTRANCE', verified: true, names: { 'zh-TW': '大門' } },
  REGISTRATION: { id: 'REGISTRATION', verified: true, names: { 'zh-TW': '掛號櫃台' } },
  ELEVATOR_IN: { id: 'ELEVATOR_IN', verified: true, names: { 'zh-TW': '電梯口' } },
  ELEVATOR_OUT: { id: 'ELEVATOR_OUT', verified: true, names: { 'zh-TW': '電梯出口' } },
  NEUROSURGERY: { id: 'NEUROSURGERY', verified: true, names: { 'zh-TW': '神經外科' } },
  CASHIER: { id: 'CASHIER', verified: true, names: { 'zh-TW': '批價櫃台' } },
  PHARMACY: { id: 'PHARMACY', verified: true, names: { 'zh-TW': '藥局' } },
  EXIT: { id: 'EXIT', verified: true, names: { 'zh-TW': '出口' } },
}

export function lookupPlace(id: string | null, registry: PlaceRegistry = PLACE_REGISTRY): PlaceEntry | null {
  if (id === null) return null
  return registry[id] ?? null
}

export function isVerifiedPlace(id: string | null, registry: PlaceRegistry = PLACE_REGISTRY): boolean {
  const entry = lookupPlace(id, registry)
  return entry !== null && entry.verified
}

export function placeName(
  id: string,
  locale: Locale = 'zh-TW',
  registry: PlaceRegistry = PLACE_REGISTRY,
): string | null {
  const entry = lookupPlace(id, registry)
  if (!entry || !entry.verified) return null
  return entry.names[locale] ?? null
}
