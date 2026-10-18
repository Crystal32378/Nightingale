/**
 * Nightingale — presentation guard.
 *
 * The last gate between a cloud model and the screen. Pure function, no I/O.
 *
 * A paraphrase is accepted only when ALL of these hold:
 *  1. non-empty, within length bounds (a paraphrase is not an essay);
 *  2. preserves the verified place name when the base text carries one;
 *  3. introduces no digits / numeric claims (the engine never supplies numbers);
 *  4. introduces no 左/右 unless a turn is live (same rule as the validator);
 *  5. contains no unresolved {placeholder};
 *  6. is actually different from the base text (otherwise the call was pointless,
 *     keep the deterministic string and say so).
 *
 * On any failure the caller keeps the deterministic base text.
 */

import type { PresentationInput } from './types'

export type GuardRejection =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'NOT_A_PARAPHRASE'
  | 'DROPPED_PLACE'
  | 'UNSOURCED_NUMBER'
  | 'UNLIVE_DIRECTION'
  | 'UNRESOLVED_PLACEHOLDER'

export interface GuardVerdict {
  ok: boolean
  rejection: GuardRejection | null
}

/** Hard cap: a one-step instruction never needs more than this. */
export const MAX_PRESENTATION_CHARS = 120

const DIGITS = /[0-9０-９]/
const NUMERIC_CLAIM = /[一二三四五六七八九十兩百千]\s*(樓|層|公尺|公分|米|步|分鐘|秒|號|間|排|次)/
const DIRECTION_WORD = /[左右]/
const UNRESOLVED = /\{[a-zA-Z]+\}/

function normalize(text: string): string {
  return text.replace(/\s+/g, '').replace(/[。．.！!？?，,、；;：:「」『』（）()]/g, '')
}

export function guardPresentation(input: PresentationInput, candidate: string): GuardVerdict {
  const text = candidate.trim()
  if (text.length === 0) return { ok: false, rejection: 'EMPTY' }
  if (text.length > MAX_PRESENTATION_CHARS) return { ok: false, rejection: 'TOO_LONG' }
  if (UNRESOLVED.test(text)) return { ok: false, rejection: 'UNRESOLVED_PLACEHOLDER' }
  if (DIGITS.test(text) || NUMERIC_CLAIM.test(text)) return { ok: false, rejection: 'UNSOURCED_NUMBER' }
  if (DIRECTION_WORD.test(text) && !input.turnLive)
    return { ok: false, rejection: 'UNLIVE_DIRECTION' }
  if (input.placeName !== null && !text.includes(input.placeName))
    return { ok: false, rejection: 'DROPPED_PLACE' }
  if (normalize(text) === normalize(input.baseText))
    return { ok: false, rejection: 'NOT_A_PARAPHRASE' }
  return { ok: true, rejection: null }
}
