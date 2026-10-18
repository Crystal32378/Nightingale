/**
 * Nightingale — Google track presenter via Vertex AI (preferred transport).
 *
 * Same product contract as the API-key presenter: paraphrase only, guard
 * everything, fall back to deterministic. The difference is billing and auth:
 * Vertex AI bills to the GCP project (walk-me-there) through the service
 * account, so no AI Studio prepay credits are needed.
 *
 * Region note (verified 2026-09-22): publisher Gemini models serve from
 * us-central1 for this project. The Cloud Run service itself stays in
 * asia-east1 and calls across regions.
 */

import { guardPresentation } from './guard'
import { fallbackResult } from './types'
import type { PresentationInput, PresentationResult, Presenter } from './types'
import { buildGeminiPrompt, type FetchLike } from './googleGemini'

export const VERTEX_LOCATION = 'us-central1'
export const VERTEX_MODEL = 'gemini-2.5-flash'

export type TokenProvider = () => Promise<string | null>

async function metadataToken(fetchFn: FetchLike): Promise<string | null> {
  try {
    const res = await fetchFn(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      { headers: { 'Metadata-Flavor': 'Google' } },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { access_token?: string }
    return data.access_token ?? null
  } catch {
    return null
  }
}

export class VertexGeminiPresenter implements Presenter {
  readonly track = 'google' as const
  readonly source = 'gemini' as const

  constructor(
    private project: string,
    private tokenProvider: TokenProvider,
    private fetchFn: FetchLike = fetch,
    private location: string = VERTEX_LOCATION,
    private model: string = VERTEX_MODEL,
  ) {}

  async present(input: PresentationInput): Promise<PresentationResult> {
    const token = await this.tokenProvider().catch(() => null);
    if (token === null || token.trim() === '') {
      return fallbackResult(input.baseText, 'no vertex access token')
    }
    const url =
      `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.project}` +
      `/locations/${this.location}/publishers/google/models/${this.model}:generateContent`
    let candidate: string
    try {
      const res = await this.fetchFn(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: buildGeminiPrompt(input) }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 120 },
        }),
      })
      if (!res.ok) return fallbackResult(input.baseText, `vertex http ${res.status}`)
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      candidate = (data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '').trim()
    } catch (err) {
      return fallbackResult(input.baseText, `vertex error: ${err instanceof Error ? err.message : String(err)}`)
    }
    const verdict = guardPresentation(input, candidate)
    if (!verdict.ok) return fallbackResult(input.baseText, `guard: ${verdict.rejection}`)
    return { text: candidate, source: 'gemini', fallbackUsed: false, reason: null }
  }
}

/** Token from Cloud Run metadata server, or an explicit env token for local dev. */
export function defaultTokenProvider(fetchFn: FetchLike = fetch): TokenProvider {
  return async () => {
    const envToken = process.env.VERTEX_ACCESS_TOKEN
    if (envToken !== undefined && envToken.trim() !== '') return envToken
    return metadataToken(fetchFn)
  }
}
