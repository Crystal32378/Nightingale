/**
 * Nightingale — Google track presenter (Gemini).
 *
 * Used ONLY for the AI Builder Cup submission. Never ships in the Nebius track.
 *
 * Contract with the product rules:
 *  - The model receives the deterministic base string + verified place name and
 *    may only paraphrase it. Route truth stays in the engine.
 *  - Companion first, action second ("我陪你問", never action-first).
 *  - Describe the situation, never the person. No red alerts, no nagging,
 *    no countdowns, no "are you OK?".
 *  - Output must pass `guardPresentation`, otherwise the base text is kept.
 */

import { guardPresentation } from './guard'
import { deterministicResult, fallbackResult } from './types'
import type { PresentationInput, PresentationResult, Presenter } from './types'

export const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = (model: string, apiKey: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`

export type FetchLike = typeof fetch

export function buildGeminiPrompt(input: PresentationInput): string {
  const placeLine =
    input.placeName !== null
      ? `The verified place name "${input.placeName}" MUST appear character-for-character in your paraphrase. Never invent another place name.`
      : 'Name no place. There is no place name in the source sentence.'
  const directionLine = input.turnLive
    ? 'The source sentence contains a live left/right turn. You may keep exactly that direction, never flip it.'
    : 'The source sentence contains NO direction. Never add 左, 右, or any cardinal/relative direction.'
  return [
    'You paraphrase ONE hospital-wayfinding instruction for a person who is unwell or tired.',
    'Rules:',
    '1. Paraphrase the SOURCE sentence only. Never add facts: no distances, times, floors, counts, or new steps.',
    '2. ' + placeLine,
    '3. ' + directionLine,
    '4. Companion first, action second. Calm, one short sentence, Traditional Chinese (zh-TW).',
    '5. Never red alerts, nagging, countdowns, or asking "are you OK?". Describe the situation, never the person.',
    '6. Reply with ONLY the paraphrase, no quotes, no explanation.',
    `SOURCE: ${input.baseText}`,
  ].join('\n')
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
}

export class GeminiPresenter implements Presenter {
  readonly track = 'google' as const
  readonly source = 'gemini' as const
  private model: string

  constructor(
    private apiKey: string,
    private fetchFn: FetchLike = fetch,
    model: string = GEMINI_MODEL,
  ) {
    this.model = model
  }

  async present(input: PresentationInput): Promise<PresentationResult> {
    if (this.apiKey.trim().length === 0) {
      return fallbackResult(input.baseText, 'missing GEMINI_API_KEY')
    }
    let candidate: string
    try {
      const res = await this.fetchFn(GEMINI_ENDPOINT(this.model, this.apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildGeminiPrompt(input) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
        }),
      })
      if (!res.ok) return fallbackResult(input.baseText, `gemini http ${res.status}`)
      const data = (await res.json()) as GeminiResponse
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      candidate = text.trim()
    } catch (err) {
      return fallbackResult(input.baseText, `gemini error: ${err instanceof Error ? err.message : String(err)}`)
    }
    const verdict = guardPresentation(input, candidate)
    if (!verdict.ok) return fallbackResult(input.baseText, `guard: ${verdict.rejection}`)
    return { text: candidate, source: 'gemini', fallbackUsed: false, reason: null }
  }
}

/** Convenience: paraphrase with fallback to deterministic text. Never throws. */
export async function presentWithGemini(
  input: PresentationInput,
  apiKey: string,
  fetchFn: FetchLike = fetch,
): Promise<PresentationResult> {
  try {
    return await new GeminiPresenter(apiKey, fetchFn).present(input)
  } catch (err) {
    return fallbackResult(input.baseText, `gemini error: ${err instanceof Error ? err.message : String(err)}`)
  }
}

export { deterministicResult }
