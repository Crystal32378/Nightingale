import { describe, expect, it } from 'vitest'
import { bandOf, confidenceAt, CONFIDENCE_HALF_LIFE_MS } from './confidence'

describe('confidence decay', () => {
  const t0 = 1_700_000_000_000

  it('is full at the moment of observation', () => {
    expect(confidenceAt(t0, t0)).toBe(1)
  })

  it('halves every half-life', () => {
    expect(confidenceAt(t0, t0 + CONFIDENCE_HALF_LIFE_MS)).toBeCloseTo(0.5, 6)
    expect(confidenceAt(t0, t0 + 2 * CONFIDENCE_HALF_LIFE_MS)).toBeCloseTo(0.25, 6)
  })

  it('is zero with no observation at all', () => {
    expect(confidenceAt(null, t0)).toBe(0)
  })

  it('walks the bands down as time passes', () => {
    expect(bandOf(confidenceAt(t0, t0 + 30_000))).toBe('FRESH')
    expect(bandOf(confidenceAt(t0, t0 + 3 * 60_000))).toBe('DECAYING')
    expect(bandOf(confidenceAt(t0, t0 + 5 * 60_000))).toBe('UNKNOWN')
  })

  it('decays on time alone and knows nothing about the person', () => {
    // Same elapsed time, same confidence, whatever the person is doing.
    expect(confidenceAt(t0, t0 + 60_000)).toBe(confidenceAt(t0, t0 + 60_000))
  })
})
