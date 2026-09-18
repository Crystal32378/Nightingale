import type { Instruction } from '../engine/types'
import { isVerifiedPlace } from '../registry/types'
import { isStringKey, type StringRequest } from '../strings/keys'

/**
 * The validator protects truth. It runs at runtime, on every string, right
 * before it reaches a screen or a speech synthesiser.
 *
 * It is not a style check — that is the register lint, which runs at build time
 * and protects treatment instead.
 */
export type ValidationFailure =
  | 'UNKNOWN_KEY'
  | 'UNVERIFIED_PLACE'
  | 'UNRESOLVED_PLACEHOLDER'
  | 'UNSOURCED_NUMBER'
  | 'EXPIRED_TURN_DIRECTION'

export interface ValidationContext {
  /** The instruction this string claims to express. */
  instruction: Instruction | null
  now: number
}

export interface ValidationResult {
  ok: boolean
  failures: ValidationFailure[]
}

/** Arabic or full-width digits anywhere. The engine never supplies a number in Phase 1. */
const DIGITS = /[0-9０-９]/

/** Chinese numerals used as a distance / floor / count claim. */
const NUMERIC_CLAIM = /[一二三四五六七八九十兩百千]\s*(樓|層|公尺|公分|米|步|分鐘|秒|號|間|排|次)/

const DIRECTION_WORD = /[左右]/

const UNRESOLVED = /\{[a-zA-Z]+\}/

export function validate(request: StringRequest, text: string, ctx: ValidationContext): ValidationResult {
  const failures: ValidationFailure[] = []

  if (!isStringKey(request.key)) failures.push('UNKNOWN_KEY')

  const placeId = request.params?.placeId
  if (placeId !== undefined && !isVerifiedPlace(placeId)) failures.push('UNVERIFIED_PLACE')

  if (UNRESOLVED.test(text)) failures.push('UNRESOLVED_PLACEHOLDER')

  if (DIGITS.test(text) || NUMERIC_CLAIM.test(text)) failures.push('UNSOURCED_NUMBER')

  if (DIRECTION_WORD.test(text)) {
    const instruction = ctx.instruction
    const live =
      instruction !== null &&
      instruction.turn !== null &&
      instruction.turnExpiresAt !== null &&
      ctx.now < instruction.turnExpiresAt
    if (!live) failures.push('EXPIRED_TURN_DIRECTION')
  }

  return { ok: failures.length === 0, failures }
}
