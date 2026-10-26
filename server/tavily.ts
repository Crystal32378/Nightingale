import type { FetchLike } from '../src/remote/last300mClient'

/** Fetches a public page through Tavily Extract and returns it as markdown. */
export type Extract = (url: string) => Promise<string>

/**
 * One Tavily credit per page fetched. The hospital lists change at most daily,
 * so a page is reused for an hour.
 * ponytail: per-instance memory; a restart refetches, which costs one credit per page.
 */
export function tavilyExtract(apiKey: string, fetchImpl: FetchLike = (input, init) => fetch(input, init), ttlMs = 60 * 60 * 1000): Extract {
  const cache = new Map<string, { at: number; markdown: string }>()
  return async (url) => {
    const hit = cache.get(url)
    if (hit && Date.now() - hit.at < ttlMs) return hit.markdown
    const res = await fetchImpl('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ urls: [url], extract_depth: 'basic', format: 'markdown' }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Tavily ${res.status}`)
    const body = (await res.json()) as { results?: Array<{ url: string; raw_content?: string }> }
    const markdown = body.results?.find((r) => r.url === url)?.raw_content
    if (!markdown) throw new Error('Tavily could not read the page')
    cache.set(url, { at: Date.now(), markdown })
    return markdown
  }
}
