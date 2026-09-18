import { describe, expect, it } from 'vitest'
import { clearVisit, loadVisit, MemoryStorage, saveVisit, VISIT_STORAGE_KEY, type VisitSnapshot } from './visitStore'

const snapshot: VisitSnapshot = {
  version: 1,
  venueId: 'MOCK_CLINIC_BUILDING',
  legIndex: 1,
  lastObservation: { nodeId: 'ELEVATOR_OUT', at: 1_700_000_000_000, facingBearing: 180, source: 'QR' },
  posture: 'RESTING',
  startedAt: 1_699_999_000_000,
}

describe('visit persistence', () => {
  it('restores the exact step after a reload', () => {
    const storage = new MemoryStorage()
    saveVisit(snapshot, storage)
    expect(loadVisit(storage)).toEqual(snapshot)
  })

  it('restores an explicit rest as a rest — posture survives the reload', () => {
    const storage = new MemoryStorage()
    saveVisit(snapshot, storage)
    expect(loadVisit(storage)?.posture).toBe('RESTING')
  })

  it('returns null when there is nothing stored', () => {
    expect(loadVisit(new MemoryStorage())).toBeNull()
  })

  it('returns null rather than half a visit when the payload is malformed', () => {
    const storage = new MemoryStorage()
    storage.setItem(VISIT_STORAGE_KEY, '{not json')
    expect(loadVisit(storage)).toBeNull()

    storage.setItem(VISIT_STORAGE_KEY, JSON.stringify({ version: 99 }))
    expect(loadVisit(storage)).toBeNull()

    storage.setItem(VISIT_STORAGE_KEY, JSON.stringify({ ...snapshot, posture: 'CONFUSED' }))
    expect(loadVisit(storage)).toBeNull()

    storage.setItem(VISIT_STORAGE_KEY, JSON.stringify({ ...snapshot, lastObservation: { nodeId: 7 } }))
    expect(loadVisit(storage)).toBeNull()
  })

  it('clears a visit on request', () => {
    const storage = new MemoryStorage()
    saveVisit(snapshot, storage)
    clearVisit(storage)
    expect(loadVisit(storage)).toBeNull()
  })

  it('survives storage that throws, because a visit matters more than a save', () => {
    const hostile = {
      getItem() {
        throw new Error('blocked')
      },
      setItem() {
        throw new Error('blocked')
      },
      removeItem() {
        throw new Error('blocked')
      },
    }
    expect(() => saveVisit(snapshot, hostile)).not.toThrow()
    expect(loadVisit(hostile)).toBeNull()
  })
})
