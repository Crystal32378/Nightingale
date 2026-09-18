/**
 * The verified place registry.
 *
 * Nothing may be spoken or shown about a place that is not in here. This is the
 * only source of proper nouns in the product: no model, no route file and no UI
 * string may introduce one.
 */
export type Locale = 'zh-TW'

export interface PlaceEntry {
  id: string
  /** Only verified entries may ever be interpolated into guidance. */
  verified: boolean
  names: Record<Locale, string>
}

export const PLACE_REGISTRY: Record<string, PlaceEntry> = {
  ENTRANCE: { id: 'ENTRANCE', verified: true, names: { 'zh-TW': '大門' } },
  REGISTRATION: { id: 'REGISTRATION', verified: true, names: { 'zh-TW': '掛號櫃台' } },
  ELEVATOR_IN: { id: 'ELEVATOR_IN', verified: true, names: { 'zh-TW': '電梯口' } },
  ELEVATOR_OUT: { id: 'ELEVATOR_OUT', verified: true, names: { 'zh-TW': '電梯出口' } },
  NEUROSURGERY: { id: 'NEUROSURGERY', verified: true, names: { 'zh-TW': '神經外科' } },
  CASHIER: { id: 'CASHIER', verified: true, names: { 'zh-TW': '批價櫃台' } },
  PHARMACY: { id: 'PHARMACY', verified: true, names: { 'zh-TW': '藥局' } },
  EXIT: { id: 'EXIT', verified: true, names: { 'zh-TW': '出口' } },
  /** Present but deliberately unverified: used to prove the validator refuses it. */
  UNVERIFIED_WARD: { id: 'UNVERIFIED_WARD', verified: false, names: { 'zh-TW': '某某病房' } },
}

export function lookupPlace(id: string | null): PlaceEntry | null {
  if (id === null) return null
  return PLACE_REGISTRY[id] ?? null
}

export function isVerifiedPlace(id: string | null): boolean {
  const entry = lookupPlace(id)
  return entry !== null && entry.verified
}

export function placeName(id: string, locale: Locale = 'zh-TW'): string | null {
  const entry = lookupPlace(id)
  if (!entry || !entry.verified) return null
  return entry.names[locale] ?? null
}
