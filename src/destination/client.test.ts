import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../remote/last300mClient'
import { DestinationClient } from './client'

/**
 * The screen asks through this. On a reviewer's laptop with no server, or on
 * Firebase before the proxy is deployed, the proxy is simply not there — the
 * screen must still work, on the mock, and say 模擬. When the proxy does
 * answer, the screen shows whichever interpreter it says decided, but never
 * trusts a place id it was not offered.
 */

const place = (placeId: string) => ({ kind: 'place', placeId })
const UNCERTAIN = { kind: 'uncertain' }

const proxyAnswering = (body: unknown, status = 200): FetchLike => async () =>
  new Response(JSON.stringify(body), { status })

describe('DestinationClient', () => {
  it('asks the indoor proxy with the sentence', async () => {
    let url = ''
    let init: RequestInit | undefined
    const fetchImpl: FetchLike = async (u, i) => {
      url = u
      init = i
      return new Response(JSON.stringify({ mode: 'nemotron', destination: place('PHARMACY') }))
    }
    await new DestinationClient({ baseUrl: 'https://proxy.example', fetchImpl }).interpret('我要去領藥')

    expect(url).toBe('https://proxy.example/indoor-api/destination')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual({ text: '我要去領藥' })
  })

  it('passes on what the proxy decided and which interpreter decided it', async () => {
    const client = new DestinationClient({ fetchImpl: proxyAnswering({ mode: 'nemotron', destination: place('PHARMACY') }) })
    expect(await client.interpret('我要去領藥')).toEqual({ mode: 'nemotron', destination: place('PHARMACY') })
  })

  it('passes on uncertain from the proxy as it is, without second-guessing on the mock', async () => {
    // Nemotron saying uncertain (or timing out on the server) is an answer, not
    // a missing proxy: the mock must not overrule it.
    const client = new DestinationClient({ fetchImpl: proxyAnswering({ mode: 'nemotron', destination: UNCERTAIN }) })
    expect(await client.interpret('我要去藥局')).toEqual({ mode: 'nemotron', destination: UNCERTAIN })
  })

  it('does not trust a place id the proxy should never have offered', async () => {
    const client = new DestinationClient({ fetchImpl: proxyAnswering({ mode: 'nemotron', destination: place('ELEVATOR_OUT') }) })
    expect(await client.interpret('電梯出口')).toEqual({ mode: 'nemotron', destination: UNCERTAIN })
  })

  describe('falls back to the mock, labelled mock, when the proxy cannot be used', () => {
    const viaMock = { mode: 'mock', destination: place('PHARMACY') }

    it('when there is no proxy to reach', async () => {
      const fetchImpl: FetchLike = async () => {
        throw new TypeError('Failed to fetch')
      }
      expect(await new DestinationClient({ fetchImpl }).interpret('我要去藥局')).toEqual(viaMock)
    })

    it.each([404, 500, 502])('when the proxy answers HTTP %i', async (status) => {
      // 404 is what Firebase Hosting answers while no proxy is deployed.
      const client = new DestinationClient({ fetchImpl: proxyAnswering({ error: 'x' }, status) })
      expect(await client.interpret('我要去藥局')).toEqual(viaMock)
    })

    it.each([
      ['not JSON', '<html>not found</html>'],
      ['an unknown mode', JSON.stringify({ mode: 'gpt', destination: { kind: 'place', placeId: 'PHARMACY' } })],
      ['no destination', JSON.stringify({ mode: 'nemotron' })],
    ])('when the answer is %s', async (_why, body) => {
      const fetchImpl: FetchLike = async () => new Response(body)
      expect(await new DestinationClient({ fetchImpl }).interpret('我要去藥局')).toEqual(viaMock)
    })

    it('when the proxy takes too long', async () => {
      const fetchImpl: FetchLike = (_u, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        })
      expect(await new DestinationClient({ fetchImpl, timeoutMs: 20 }).interpret('我要去藥局')).toEqual(viaMock)
    })
  })
})
