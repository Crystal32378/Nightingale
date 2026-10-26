import { describe, expect, it } from 'vitest'
import { tavilyExtract } from './tavily'

const PAGE = 'https://webreg.tpech.gov.tw/'

/** A Tavily stand-in that counts calls: each one is a credit. */
function fakeTavily(body: unknown, status = 200) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }
  return { fetchImpl, calls }
}

describe('Tavily extract', () => {
  it('sends the key in a header, never in the URL or the body', async () => {
    const { fetchImpl, calls } = fakeTavily({ results: [{ url: PAGE, raw_content: 'page' }] })
    await tavilyExtract('tvly-secret', fetchImpl)(PAGE)
    expect(calls[0].url).toBe('https://api.tavily.com/extract')
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe('Bearer tvly-secret')
    expect(String(calls[0].init?.body)).not.toContain('tvly-secret')
  })

  it('spends one credit per page per hour, not one per person asking', async () => {
    const { fetchImpl, calls } = fakeTavily({ results: [{ url: PAGE, raw_content: 'page' }] })
    const extract = tavilyExtract('k', fetchImpl)
    expect(await extract(PAGE)).toBe('page')
    expect(await extract(PAGE)).toBe('page')
    expect(calls).toHaveLength(1)
  })

  it('fetches again once the hour is up', async () => {
    const { fetchImpl, calls } = fakeTavily({ results: [{ url: PAGE, raw_content: 'page' }] })
    const extract = tavilyExtract('k', fetchImpl, 0)
    await extract(PAGE)
    await extract(PAGE)
    expect(calls).toHaveLength(2)
  })

  it.each([
    ['an HTTP error', { results: [] }, 401],
    ['a page Tavily could not read', { results: [], failed_results: [{ url: PAGE, error: 'Failed to fetch url' }] }, 200],
  ])('throws on %s and does not cache it', async (_why, body, status) => {
    const { fetchImpl, calls } = fakeTavily(body, status)
    const extract = tavilyExtract('k', fetchImpl)
    await expect(extract(PAGE)).rejects.toThrow()
    await expect(extract(PAGE)).rejects.toThrow()
    expect(calls).toHaveLength(2)
  })
})
