import type { Instruction } from '../engine/types'
import { placeName, PLACE_REGISTRY, type Locale, type PlaceRegistry } from '../registry/types'
import type { StringKey, StringRequest } from '../strings/keys'
import { ZH_TW } from '../strings/zh-TW'
import { validate, type ValidationFailure } from './validator'

const TABLES: Record<Locale, Record<StringKey, string>> = {
  'zh-TW': ZH_TW,
}

export interface RenderOptions {
  locale?: Locale
  registry?: PlaceRegistry
}

export interface Rendered {
  key: StringKey
  /** screen and speech are always the same string. TTS may not rewrite a character. */
  screen: string
  speech: string
  fallbackUsed: boolean
  failures: ValidationFailure[]
}

/** Raw table lookup plus interpolation from the verified registry. No checks. */
export function materialize(request: StringRequest, options: RenderOptions = {}): string {
  const locale = options.locale ?? 'zh-TW'
  const registry = options.registry ?? PLACE_REGISTRY
  const template = TABLES[locale][request.key] ?? ''
  const placeId = request.params?.placeId
  if (placeId === undefined) return template
  const name = placeName(placeId, locale, registry)
  if (name === null) return template // leaves {place} unresolved, which the validator rejects
  return template.replace('{place}', name)
}

function safeFallback(locale: Locale): Rendered {
  const key: StringKey = 'fallback.safe'
  const text = TABLES[locale][key]
  return { key, screen: text, speech: text, fallbackUsed: true, failures: [] }
}

/** Materialize, validate, and fall back to a static safe string when validation fails. */
export function render(
  request: StringRequest,
  ctx: { instruction: Instruction | null; now: number },
  options: RenderOptions = {},
): Rendered {
  const locale = options.locale ?? 'zh-TW'
  const text = materialize(request, options)
  const result = validate(request, text, { ...ctx, registry: options.registry })
  if (!result.ok) {
    return { ...safeFallback(locale), failures: result.failures }
  }
  return { key: request.key, screen: text, speech: text, fallbackUsed: false, failures: [] }
}

/** Structured instruction -> which string to say. The renderer never decides route truth. */
export function requestForInstruction(instruction: Instruction): StringRequest {
  switch (instruction.intent) {
    case 'GO':
      return { key: 'guidance.go' }
    case 'TURN':
      return instruction.turn === 'LEFT' ? { key: 'guidance.turn.left' } : { key: 'guidance.turn.right' }
    case 'ASK_DIRECTION':
      return { key: 'guidance.uncertain' }
    case 'ARRIVED':
      return { key: 'guidance.arrived', params: { placeId: instruction.destinationId ?? undefined } }
    case 'WAIT':
      return { key: 'guidance.wait' }
    case 'NONE':
      return { key: 'guidance.none' }
  }
}

export function renderGuidance(instruction: Instruction, now: number, options: RenderOptions = {}): Rendered {
  return render(requestForInstruction(instruction), { instruction, now }, options)
}

/**
 * The ask-for-me utterance. Deterministic, from the verified registry, zero LLM.
 * Nothing is recorded, nothing is transcribed, no answer is parsed.
 */
export function renderAsk(destinationId: string | null, now: number, options: RenderOptions = {}): Rendered {
  return render(
    { key: 'ask.utterance', params: { placeId: destinationId ?? undefined } },
    { instruction: null, now },
    options,
  )
}

export function renderNextCheckpoint(
  placeId: string | null,
  now: number,
  options: RenderOptions = {},
): Rendered | null {
  if (placeId === null) return null
  return render({ key: 'checkpoint.next', params: { placeId } }, { instruction: null, now }, options)
}

/**
 * A bare place name, for a screen label. Returns null rather than a fallback
 * sentence: an unverified place should leave a quiet gap, not put an apology
 * where a place name belongs.
 */
export function renderPlace(placeId: string | null, now: number, options: RenderOptions = {}): string | null {
  if (placeId === null) return null
  const rendered = render({ key: 'place.bare', params: { placeId } }, { instruction: null, now }, options)
  return rendered.fallbackUsed ? null : rendered.screen
}

/** UI chrome labels. Held to the same table and the same register lint. */
export function label(key: Extract<StringKey, `label.${string}`>, options: RenderOptions = {}): string {
  return materialize({ key }, options)
}
