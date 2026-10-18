/**
 * Nightingale — Nebius track presenter (Nemotron via Token Factory).
 *
 * Used ONLY for the Nebius x NVIDIA Global AI Hackathon submission.
 * Never ships in the Google track.
 *
 * Token Factory exposes an OpenAI-compatible chat/completions endpoint, so the
 * call shape below mirrors that API. Same product contract as the Gemini
 * presenter: paraphrase only, guard everything, fall back to deterministic.
 *
 * Model choice: Nano for fast everyday paraphrases, 3 Ultra when the input
 * needs serious reasoning (e.g. ASK drafts). The caller picks; default is Nano.
 */

import { guardPresentation } from './guard'
import { fallbackResult } from './types'
import type { PresentationInput, PresentationResult, Presenter } from './types'

export const NEMOTRON_FAST_MODEL = 'nvidia/Nemotron-3-Nano-30B-A3B'
export const NEMOTRON_REASONING_MODEL = 'nvidia/Nemotron-3-Ultra-253B-A-4B'

export const TOKEN_FACTORY_ENDPOINT = 'https://api.tokenfactory.nebius.com/v1/chat/completions'

export type FetchLike = typeof fetch

export type NemotronModel = 'nano' | 'ultra'

function resolveModelId(model: NemotronModel): string {
  return model === 'ultra' ? NEMOTRON_REASONING_MODEL : NEMOTRON_FAST_MODEL
}

export function buildNemotronMessages(input: PresentationInput): Array<{ role: string; content: string }> {
  const placeLine =
    input.placeName !== null
      ? `The verified place name "${input.placeName}" MUST appear character-for-character in your paraphrase. Never invent another place name.`
      : 'Name no place. There is no place name in the source sentence.'
  const directionLine = input.turnLive
    ? 'The source sentence contains a live left/right turn. You may keep exactly that direction, never flip it.'
    : 'The source sentence contains NO direction. Never add 左, 右, or any cardinal/relative direction.'
  return [
    {
      role: 'system',
      content: [
        'You paraphrase ONE hospital-wayfinding instruction for a person who is unwell or tired.',
        'Paraphrase the SOURCE sentence only. Never add facts: no distances, times, floors, counts, or new steps.',
        placeLine,
        directionLine,
        'Companion first, action second. Calm, one short sentence, Traditional Chinese (zh-TW).',
        'Never red alerts, nagging, countdowns, or asking "are you OK?". Describe the situation, never the person.',
        'Reply with ONLY the paraphrase, no quotes, no explanation.',
      ].join('\n'),
    },
    { role: 'user', content: `SOURCE: ${input.baseText}` },
  ]
}

interface ChatCompletionsResponse {
  choices?: Array<{ message?: { content?: string } }>
}

export class NemotronPresenter implements Presenter {
  readonly track = 'nebius' as const
  readonly source = 'nemotron' as const
  private modelId: string

  constructor(
    private apiKey: string,
    model: NemotronModel = 'nano',
    private fetchFn: FetchLike = fetch,
    private endpoint: string = TOKEN_FACTORY_ENDPOINT,
  ) {
    this.modelId = resolveModelId(model)
  }

  async present(input: PresentationInput): Promise<PresentationResult> {
    if (this.apiKey.trim().length === 0) {
      return fallbackResult(input.baseText, 'missing NEBIUS_API_KEY')
    }
    let candidate: string
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.modelId,
          temperature: 0.4,
          max_tokens: 120,
          messages: buildNemotronMessages(input),
        }),
      })
      if (!res.ok) return fallbackResult(input.baseText, `nemotron http ${res.status}`)
      const data = (await res.json()) as ChatCompletionsResponse
      candidate = (data.choices?.[0]?.message?.content ?? '').trim()
    } catch (err) {
      return fallbackResult(input.baseText, `nemotron error: ${err instanceof Error ? err.message : String(err)}`)
    }
    const verdict = guardPresentation(input, candidate)
    if (!verdict.ok) return fallbackResult(input.baseText, `guard: ${verdict.rejection}`)
    return { text: candidate, source: 'nemotron', fallbackUsed: false, reason: null }
  }
}

/** Convenience: paraphrase with fallback to deterministic text. Never throws. */
export async function presentWithNemotron(
  input: PresentationInput,
  apiKey: string,
  model: NemotronModel = 'nano',
  fetchFn: FetchLike = fetch,
): Promise<PresentationResult> {
  try {
    return await new NemotronPresenter(apiKey, model, fetchFn).present(input)
  } catch (err) {
    return fallbackResult(input.baseText, `nemotron error: ${err instanceof Error ? err.message : String(err)}`)
  }
}
