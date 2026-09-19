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
 *
 * An entry does not assert that it was verified — it says where it came from,
 * and the rule is checked rather than promised. A name read off a hospital's
 * own page carries that page's URL and the wording as it appeared there, so
 * anyone can open the link and see the same characters. Eight entries can be
 * held in one person's head; forty cannot.
 */
export type Locale = 'zh-TW'

export type PlaceSource =
  | {
      /**
       * A common facility or specialty word rather than a name belonging to one
       * building. `大門` is the same `大門` in every hospital in Taiwan, so there
       * is no page to cite — but the claim that it is generic is itself recorded.
       */
      kind: 'generic'
      because: string
    }
  | {
      /** Read off a page anyone else can open and check. */
      kind: 'web'
      url: string
      /** ISO date (YYYY-MM-DD) the page was read. */
      readOn: string
      /**
       * The wording as it appeared on that page. The registry name must occur
       * inside it character for character — that is what makes this a source
       * and not a memory.
       */
      asWritten: string
    }

export interface PlaceEntry {
  id: string
  names: Record<Locale, string>
  /**
   * Where the name came from. `null` means unsourced: the entry may exist, but
   * nothing about it may ever be spoken or shown.
   */
  source: PlaceSource | null
}

export type PlaceRegistry = Record<string, PlaceEntry>

const generic = (because: string): PlaceSource => ({ kind: 'generic', because })

const FACILITY = 'Standard facility wording, identical across Taiwanese hospitals; belongs to no one building.'
const SPECIALTY = 'Standard specialty name used across Taiwanese hospitals; belongs to no one building.'

export const PLACE_REGISTRY: PlaceRegistry = {
  ENTRANCE: { id: 'ENTRANCE', names: { 'zh-TW': '大門' }, source: generic(FACILITY) },
  REGISTRATION: { id: 'REGISTRATION', names: { 'zh-TW': '掛號櫃台' }, source: generic(FACILITY) },
  ELEVATOR_IN: { id: 'ELEVATOR_IN', names: { 'zh-TW': '電梯口' }, source: generic(FACILITY) },
  ELEVATOR_OUT: { id: 'ELEVATOR_OUT', names: { 'zh-TW': '電梯出口' }, source: generic(FACILITY) },
  NEUROSURGERY: { id: 'NEUROSURGERY', names: { 'zh-TW': '神經外科' }, source: generic(SPECIALTY) },
  CASHIER: { id: 'CASHIER', names: { 'zh-TW': '批價櫃台' }, source: generic(FACILITY) },
  PHARMACY: { id: 'PHARMACY', names: { 'zh-TW': '藥局' }, source: generic(FACILITY) },
  EXIT: { id: 'EXIT', names: { 'zh-TW': '出口' }, source: generic(FACILITY) },
}

/** A URL a person could actually open. Anything else is not a citation. */
function isFetchableUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * A date that exists. `2026-13-45` matches the shape of a date and is not one,
 * and a source dated to a day that never happened cannot be gone back to.
 */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

/**
 * The single gate. Everything that decides whether a name may be spoken lives
 * here, not in the tests that happen to iterate the shipped registry — a second
 * venue supplies its own registry at runtime and must meet the same bar.
 *
 * Note the empty name: `''.includes('')` is true, so a blank name would sail
 * through a containment check alone. A place with no name is not a place.
 */
export function isVerifiedEntry(entry: PlaceEntry | null): boolean {
  if (entry === null || entry.source === null) return false

  const name = entry.names['zh-TW']
  if (typeof name !== 'string' || name.trim().length === 0) return false

  if (entry.source.kind === 'generic') return entry.source.because.trim().length > 0

  const { url, readOn, asWritten } = entry.source
  if (!isFetchableUrl(url)) return false
  if (!isCalendarDate(readOn)) return false
  if (asWritten.trim().length === 0) return false
  return asWritten.includes(name)
}

export function lookupPlace(id: string | null, registry: PlaceRegistry = PLACE_REGISTRY): PlaceEntry | null {
  if (id === null) return null
  return registry[id] ?? null
}

export function isVerifiedPlace(id: string | null, registry: PlaceRegistry = PLACE_REGISTRY): boolean {
  return isVerifiedEntry(lookupPlace(id, registry))
}

export function placeName(
  id: string,
  locale: Locale = 'zh-TW',
  registry: PlaceRegistry = PLACE_REGISTRY,
): string | null {
  const entry = lookupPlace(id, registry)
  if (!isVerifiedEntry(entry)) return null
  return entry!.names[locale] ?? null
}
