import { describe, expect, it } from 'vitest'
import type { FetchLike } from '../remote/last300mClient'
import { NEMOTRON_ENDPOINT, NEMOTRON_MODEL, NemotronInterpreter } from './nemotron'

/**
 * Nemotron runs behind the server proxy with a real key and real credit. The
 * screen trusts what comes back to start walking someone somewhere, so every
 * way the call can go wrong — HTTP error, network drop, timeout, an answer
 * that is not one offered id — must land on uncertain (我陪你問), never on a
 * guessed place and never on a thrown error that freezes the screen.
 */

const place = (placeId: string) => ({ kind: 'place', placeId })
const UNCERTAIN = { kind: 'uncertain' }

/** A Token Factory reply whose message content is `content`. */
const reply = (content: unknown, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), { status })

const answering = (content: unknown): FetchLike => async () => reply(content)

const nemotron = (fetchImpl: FetchLike, timeoutMs?: number) =>
  new NemotronInterpreter({ apiKey: 'test-key', fetchImpl, timeoutMs })

describe('NemotronInterpreter', () => {
  it('says it is Nemotron, so the screen can label it', () => {
    expect(nemotron(answering('PHARMACY')).mode).toBe('nemotron')
  })

  it('asks the chosen model at Token Factory, with the key only in the auth header', async () => {
    let url = ''
    let init: RequestInit | undefined
    const fetchImpl: FetchLike = async (u, i) => {
      url = u
      init = i
      return reply('PHARMACY')
    }
    await nemotron(fetchImpl).interpret('我要去領藥')

    expect(url).toBe(NEMOTRON_ENDPOINT)
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer test-key')
    const body = JSON.parse(init?.body as string)
    expect(body.model).toBe(NEMOTRON_MODEL)
    expect(body.temperature).toBe(0)
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: '我要去領藥' })
    expect(init?.body).not.toContain('test-key')
  })

  it('tells the model to pick the first stop only when the order is clear', async () => {
    // 先去批價再去藥局 should start at 批價: DEMO_VISIT walks on to 藥局 after
    // it anyway, and the screen asks the person to confirm before walking.
    // 藥局還是批價？ has no first stop, so it stays uncertain.
    let system = ''
    const fetchImpl: FetchLike = async (_u, init) => {
      system = JSON.parse(init?.body as string).messages[0].content
      return reply('CASHIER')
    }
    await nemotron(fetchImpl).interpret('先去批價再去藥局')
    expect(system).toContain('先後順序清楚')
    expect(system).toContain('第一個要去的地點')
    expect(system).toMatch(/順序不清楚.*UNCERTAIN/)
  })

  it('names the place the model answered, ignoring the newlines it puts first', async () => {
    expect(await nemotron(answering('\n\nPHARMACY')).interpret('我要去領藥')).toEqual(place('PHARMACY'))
  })

  it.each([
    ['UNCERTAIN', 'the model is unsure'],
    ['ELEVATOR_OUT', 'an id that is never offered'],
    ['PHARMACY, then CASHIER', 'a sentence instead of one id'],
    ['', 'an empty answer'],
    [null, 'no content at all'],
  ])('is uncertain when the model answers %j (%s)', async (content, _why) => {
    expect(await nemotron(answering(content)).interpret('我要去藥局')).toEqual(UNCERTAIN)
  })

  it.each([429, 500, 503])('is uncertain when Token Factory answers HTTP %i', async (status) => {
    // 429 is what running out of credit or rate limit looks like.
    const fetchImpl: FetchLike = async () => reply('PHARMACY', status)
    expect(await nemotron(fetchImpl).interpret('我要去藥局')).toEqual(UNCERTAIN)
  })

  it('is uncertain when the network fails', async () => {
    const fetchImpl: FetchLike = async () => {
      throw new TypeError('fetch failed')
    }
    expect(await nemotron(fetchImpl).interpret('我要去藥局')).toEqual(UNCERTAIN)
  })

  it('is uncertain when the reply is not the JSON it expects', async () => {
    const fetchImpl: FetchLike = async () => new Response('<html>bad gateway</html>', { status: 200 })
    expect(await nemotron(fetchImpl).interpret('我要去藥局')).toEqual(UNCERTAIN)
  })

  it('gives up and is uncertain when Token Factory is too slow', async () => {
    // Never answers on its own; only the abort signal ends it.
    const fetchImpl: FetchLike = (_u, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    expect(await nemotron(fetchImpl, 20).interpret('我要去藥局')).toEqual(UNCERTAIN)
  })

  it('does not spend credit on a blank sentence', async () => {
    let called = false
    const fetchImpl: FetchLike = async () => {
      called = true
      return reply('PHARMACY')
    }
    expect(await nemotron(fetchImpl).interpret('   ')).toEqual(UNCERTAIN)
    expect(called).toBe(false)
  })
})
