import type { Observation, Posture } from '../engine/types'

/**
 * Visit persistence.
 *
 * A person may rest for fifteen minutes, lock the phone, or reload the page.
 * When they come back the app resumes exactly where it was — with no "welcome
 * back", no recap, and no summary of what happened while they were away.
 */
export const VISIT_STORAGE_KEY = 'nightingale.visit.v1'

export interface VisitSnapshot {
  version: 1
  venueId: string
  legIndex: number
  lastObservation: Observation | null
  posture: Posture
  startedAt: number
}

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** In-memory storage, used in tests and whenever the browser refuses localStorage. */
export class MemoryStorage implements StorageLike {
  private map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

export function defaultStorage(): StorageLike {
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Private mode, blocked site data — fall through.
  }
  return new MemoryStorage()
}

function isPosture(value: unknown): value is Posture {
  return value === 'MOVING' || value === 'RESTING' || value === 'NEEDS_HELP'
}

function isObservation(value: unknown): value is Observation {
  if (value === null || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    typeof o.nodeId === 'string' &&
    typeof o.at === 'number' &&
    (o.facingBearing === null || typeof o.facingBearing === 'number') &&
    (o.source === 'QR' || o.source === 'BUTTON_CONFIRM')
  )
}

export function saveVisit(snapshot: VisitSnapshot, storage: StorageLike = defaultStorage()): void {
  try {
    storage.setItem(VISIT_STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // Persistence is best effort. A visit that cannot be saved still runs.
  }
}

export function loadVisit(storage: StorageLike = defaultStorage()): VisitSnapshot | null {
  let raw: string | null = null
  try {
    raw = storage.getItem(VISIT_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed === null || typeof parsed !== 'object') return null

  const s = parsed as Record<string, unknown>
  if (s.version !== 1) return null
  if (typeof s.venueId !== 'string') return null
  if (typeof s.legIndex !== 'number' || !Number.isInteger(s.legIndex) || s.legIndex < 0) return null
  if (typeof s.startedAt !== 'number') return null
  if (!isPosture(s.posture)) return null
  if (s.lastObservation !== null && !isObservation(s.lastObservation)) return null

  return {
    version: 1,
    venueId: s.venueId,
    legIndex: s.legIndex,
    lastObservation: (s.lastObservation as Observation | null) ?? null,
    posture: s.posture,
    startedAt: s.startedAt,
  }
}

export function clearVisit(storage: StorageLike = defaultStorage()): void {
  try {
    storage.removeItem(VISIT_STORAGE_KEY)
  } catch {
    // ignore
  }
}
