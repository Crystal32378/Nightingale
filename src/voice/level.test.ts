import { describe, expect, it } from 'vitest'
import { SPOKEN_KEYS } from '../strings/keys'
import {
  atCeiling,
  atFloor,
  contextForKey,
  DEFAULT_LEVELS,
  gainFor,
  LEVEL_GAIN,
  LEVELS,
  levelAfterRepeat,
  louder,
  lower,
  needsCompression,
  parseLevels,
  raise,
  softer,
  type Level,
} from './level'

describe('the level ladder', () => {
  it('starts at unity, so the file is played as it was made', () => {
    expect(LEVEL_GAIN[0]).toBe(1)
  })

  it('only ever goes up as the level goes up', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVEL_GAIN[LEVELS[i]]).toBeGreaterThan(LEVEL_GAIN[LEVELS[i - 1]])
    }
  })

  it('spans a range worth having — about 12 dB from bottom to top', () => {
    const dB = 20 * Math.log10(LEVEL_GAIN[3] / LEVEL_GAIN[0])
    expect(dB).toBeGreaterThan(10)
    expect(dB).toBeLessThan(14)
  })

  it('climbs in even steps, so pressing the button twice feels like pressing it twice', () => {
    const steps = [1, 2, 3].map((i) => 20 * Math.log10(LEVEL_GAIN[i as Level] / LEVEL_GAIN[(i - 1) as Level]))
    for (const step of steps) expect(Math.abs(step - steps[0])).toBeLessThan(0.6)
  })

  it('stops at the top instead of running away', () => {
    expect(louder(3)).toBe(3)
    expect(atCeiling(louder(louder(3)))).toBe(true)
  })

  it('always leaves a way back down', () => {
    expect(softer(0)).toBe(0)
    expect(atFloor(softer(softer(1)))).toBe(true)
    expect(softer(louder(0))).toBe(0)
  })
})

describe('the two listening contexts', () => {
  it('starts the ask utterance louder, because it has a counter to cross', () => {
    expect(DEFAULT_LEVELS.PUBLIC).toBeGreaterThan(DEFAULT_LEVELS.PRIVATE)
  })

  it('sends the ask utterance to PUBLIC and everything else to PRIVATE', () => {
    expect(contextForKey('ask.utterance')).toBe('PUBLIC')
    for (const key of SPOKEN_KEYS.filter((k) => k !== 'ask.utterance')) {
      expect(contextForKey(key)).toBe('PRIVATE')
    }
  })

  it('raises one context without touching the other', () => {
    const raised = raise(DEFAULT_LEVELS, 'PRIVATE')
    expect(raised.PRIVATE).toBe(louder(DEFAULT_LEVELS.PRIVATE))
    expect(raised.PUBLIC).toBe(DEFAULT_LEVELS.PUBLIC)
  })

  it('lowers one context without touching the other', () => {
    const lowered = lower(DEFAULT_LEVELS, 'PUBLIC')
    expect(lowered.PUBLIC).toBe(softer(DEFAULT_LEVELS.PUBLIC))
    expect(lowered.PRIVATE).toBe(DEFAULT_LEVELS.PRIVATE)
  })

  it('reads a gain out of the level for a context', () => {
    expect(gainFor(DEFAULT_LEVELS, 'PRIVATE')).toBe(LEVEL_GAIN[DEFAULT_LEVELS.PRIVATE])
    expect(gainFor(DEFAULT_LEVELS, 'PUBLIC')).toBe(LEVEL_GAIN[DEFAULT_LEVELS.PUBLIC])
  })
})

describe('asking to hear it again', () => {
  it('is treated as evidence it was not heard, so the level goes up', () => {
    expect(levelAfterRepeat(0)).toBe(1)
    expect(levelAfterRepeat(1)).toBe(2)
  })

  it('does not keep climbing past the ceiling however many times it is pressed', () => {
    let level: Level = 0
    for (let i = 0; i < 10; i++) level = levelAfterRepeat(level)
    expect(level).toBe(3)
  })
})

describe('amplification is not allowed to break a consonant', () => {
  it('asks for compression for every level above unity', () => {
    expect(needsCompression(LEVEL_GAIN[0])).toBe(false)
    for (const level of [1, 2, 3] as Level[]) expect(needsCompression(LEVEL_GAIN[level])).toBe(true)
  })
})

describe('stored levels', () => {
  it('survives a round trip', () => {
    const stored = { PRIVATE: 2, PUBLIC: 3 }
    expect(parseLevels(stored)).toEqual(stored)
  })

  it('falls back to the default rather than throwing on anything it does not recognise', () => {
    expect(parseLevels(null)).toEqual(DEFAULT_LEVELS)
    expect(parseLevels('loud')).toEqual(DEFAULT_LEVELS)
    expect(parseLevels({ PRIVATE: 99, PUBLIC: 'x' })).toEqual(DEFAULT_LEVELS)
    expect(parseLevels({ PRIVATE: 2 })).toEqual({ PRIVATE: 2, PUBLIC: DEFAULT_LEVELS.PUBLIC })
  })
})
