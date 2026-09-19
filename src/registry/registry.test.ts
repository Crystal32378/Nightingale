import { describe, expect, it } from 'vitest'
import { isVerifiedEntry, PLACE_REGISTRY, placeName, type PlaceEntry } from './types'

/**
 * The registry's rule — no name without a source — used to be a promise in a
 * comment and a boolean somebody remembered to set. These are the tests that
 * make it a rule. They are deliberately unforgiving: a name that cannot be
 * checked is worth less than no name, because a person acts on it.
 */

const sourced = (name: string, asWritten: string): PlaceEntry => ({
  id: 'X',
  names: { 'zh-TW': name },
  source: { kind: 'web', url: 'https://example.org/depts', readOn: '2026-09-19', asWritten },
})

describe('every shipped entry carries a source', () => {
  it('has no entry with a null source', () => {
    for (const entry of Object.values(PLACE_REGISTRY)) {
      expect(entry.source, `${entry.id} has no source`).not.toBeNull()
    }
  })

  it('gives every generic entry a stated reason for being generic', () => {
    for (const entry of Object.values(PLACE_REGISTRY)) {
      if (entry.source?.kind !== 'generic') continue
      expect(entry.source.because.trim().length, `${entry.id} claims generic with no reason`).toBeGreaterThan(0)
    }
  })

  it('gives every web entry a URL, a read date and the wording it was read from', () => {
    for (const entry of Object.values(PLACE_REGISTRY)) {
      if (entry.source?.kind !== 'web') continue
      expect(entry.source.url, `${entry.id} cites no URL`).toMatch(/^https?:\/\//)
      expect(entry.source.readOn, `${entry.id} has no read date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(entry.source.asWritten.trim().length, `${entry.id} quotes nothing`).toBeGreaterThan(0)
    }
  })

  it('finds every web-sourced name still present, character for character, in what was quoted', () => {
    for (const entry of Object.values(PLACE_REGISTRY)) {
      if (entry.source?.kind !== 'web') continue
      expect(entry.source.asWritten, `${entry.id} is not in its own quote`).toContain(entry.names['zh-TW'])
    }
  })
})

describe('an entry that cannot be checked is not spoken', () => {
  it('refuses an entry with no source', () => {
    expect(isVerifiedEntry({ id: 'X', names: { 'zh-TW': '某某病房' }, source: null })).toBe(false)
  })

  it('refuses a generic claim with an empty reason', () => {
    expect(isVerifiedEntry({ id: 'X', names: { 'zh-TW': '某某科' }, source: { kind: 'generic', because: '  ' } })).toBe(
      false,
    )
  })

  it('refuses a web source whose quote no longer contains the name', () => {
    expect(isVerifiedEntry(sourced('心臟血管外科', '本院設有心臟內科、胸腔外科。'))).toBe(false)
  })

  it('accepts a web source whose quote still contains the name', () => {
    expect(isVerifiedEntry(sourced('心臟血管外科', '本院設有心臟血管外科、胸腔外科。'))).toBe(true)
  })

  it('will not hand out the name of an entry it refuses', () => {
    const registry = { WARD: { id: 'WARD', names: { 'zh-TW': '某某病房' }, source: null } }
    expect(placeName('WARD', 'zh-TW', registry)).toBeNull()
  })

  it('refuses a near-miss rather than accepting it — one wrong character is a different department', () => {
    expect(isVerifiedEntry(sourced('神經外科', '本院設有神經內科。'))).toBe(false)
  })
})
