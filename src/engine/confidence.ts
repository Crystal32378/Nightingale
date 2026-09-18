import type { Band } from './types'

/** Confidence halves every this many ms since the last observation. */
export const CONFIDENCE_HALF_LIFE_MS = 120_000

export const BAND_FRESH_MIN = 0.5
export const BAND_DECAYING_MIN = 0.2

/**
 * Confidence is a function of time only. It never encodes anything about the
 * person — only how stale our last observation is.
 */
export function confidenceAt(lastObservedAt: number | null, now: number): number {
  if (lastObservedAt === null) return 0
  const dt = now - lastObservedAt
  if (dt <= 0) return 1
  return Math.pow(2, -dt / CONFIDENCE_HALF_LIFE_MS)
}

export function bandOf(confidence: number): Band {
  if (confidence >= BAND_FRESH_MIN) return 'FRESH'
  if (confidence >= BAND_DECAYING_MIN) return 'DECAYING'
  return 'UNKNOWN'
}
