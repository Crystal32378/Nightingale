import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Destination, DestinationInterpreter } from '../src/destination/destination'
import { createApp, readLimits } from './app'
import type { Extract } from './tavily'

/**
 * The proxy is the only thing between the public internet and the API key's
 * credit. It must answer the screen in one shape whichever interpreter runs,
 * and refuse anything that is not a short sentence before it costs a call.
 */

/** Records what it was asked, so a test can tell whether a call was spent. */
function fakeInterpreter(mode: 'mock' | 'nemotron', answer: Destination) {
  const asked: string[] = []
  const interpreter: DestinationInterpreter = {
    mode,
    async interpret(text) {
      asked.push(text)
      return answer
    },
  }
  return { interpreter, asked }
}

const post = (app: ReturnType<typeof createApp>, body: string, contentType = 'application/json') =>
  app.request('/indoor-api/destination', { method: 'POST', headers: { 'content-type': contentType }, body })

describe('indoor proxy', () => {
  it('answers with the destination and which interpreter decided it', async () => {
    const { interpreter, asked } = fakeInterpreter('nemotron', { kind: 'place', placeId: 'PHARMACY' })
    const res = await post(createApp(interpreter), JSON.stringify({ text: '我要去領藥' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ mode: 'nemotron', destination: { kind: 'place', placeId: 'PHARMACY' } })
    expect(asked).toEqual(['我要去領藥'])
  })

  it('tells the screen it is the mock, so it can label 模擬', async () => {
    const { interpreter } = fakeInterpreter('mock', { kind: 'uncertain' })
    const res = await post(createApp(interpreter), JSON.stringify({ text: '今天天氣如何' }))
    expect(await res.json()).toEqual({ mode: 'mock', destination: { kind: 'uncertain' } })
  })

  it.each([
    ['not JSON', 'hello'],
    ['no text', JSON.stringify({})],
    ['text is not a string', JSON.stringify({ text: 42 })],
    ['blank text', JSON.stringify({ text: '   ' })],
    ['over 200 characters', JSON.stringify({ text: '藥'.repeat(201) })],
  ])('refuses %s without spending a call', async (_why, body) => {
    const { interpreter, asked } = fakeInterpreter('nemotron', { kind: 'place', placeId: 'PHARMACY' })
    const res = await post(createApp(interpreter), body)
    expect(res.status).toBe(400)
    // The mode tells the screen this is a refused sentence from a working
    // proxy, not a broken one — so it says uncertain instead of asking the mock.
    expect((await res.json()).mode).toBe('nemotron')
    expect(asked).toEqual([])
  })

  it('refuses a body too large to be one sentence before reading it', async () => {
    const { interpreter, asked } = fakeInterpreter('nemotron', { kind: 'place', placeId: 'PHARMACY' })
    const res = await post(createApp(interpreter), JSON.stringify({ text: 'x', pad: 'x'.repeat(5000) }))
    expect(res.status).toBe(413)
    expect((await res.json()).mode).toBe('nemotron')
    expect(asked).toEqual([])
  })

  it('accepts exactly 200 characters', async () => {
    const { interpreter } = fakeInterpreter('nemotron', { kind: 'uncertain' })
    const res = await post(createApp(interpreter), JSON.stringify({ text: '藥'.repeat(200) }))
    expect(res.status).toBe(200)
  })

  it('stays off /api, which belongs to the outdoor Cloud Run service', async () => {
    const { interpreter } = fakeInterpreter('nemotron', { kind: 'uncertain' })
    const res = await createApp(interpreter).request('/api/destination', { method: 'POST', body: '{"text":"x"}' })
    expect(res.status).toBe(404)
  })
})

/**
 * Token Factory has no spending cap: past the credit it charges the card. Once
 * the URL is public, these limits are what keep a day's model calls — and so
 * the bill — bounded, and keep one person from using up everyone's day.
 */
describe('spending limits', () => {
  // 2026-10-27 15:59:00 in Taipei (UTC+8).
  const start = Date.UTC(2026, 9, 27, 7, 59)
  const from = (app: ReturnType<typeof createApp>, ip: string, text = '我要去領藥') =>
    app.request('/indoor-api/destination', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ text }),
    })

  it('stops one person after the per-minute limit, without spending a call, and not anyone else', async () => {
    const { interpreter, asked } = fakeInterpreter('nemotron', { kind: 'uncertain' })
    let now = start
    const app = createApp(interpreter, undefined, { perMinute: 2, perDay: 100, now: () => now })

    expect((await from(app, '1.1.1.1')).status).toBe(200)
    expect((await from(app, '1.1.1.1')).status).toBe(200)
    const limited = await from(app, '1.1.1.1')
    expect(limited.status).toBe(429)
    // The mode says a working proxy refused, so the screen says uncertain, not the mock.
    expect((await limited.json()).mode).toBe('nemotron')
    expect(asked).toHaveLength(2)

    expect((await from(app, '2.2.2.2')).status).toBe(200)
    now += 60_000
    expect((await from(app, '1.1.1.1')).status).toBe(200)
  })

  it('counts only the first address a forwarded request came from', async () => {
    const { interpreter } = fakeInterpreter('nemotron', { kind: 'uncertain' })
    const app = createApp(interpreter, undefined, { perMinute: 1, perDay: 100, now: () => start })
    expect((await from(app, '1.1.1.1, 35.0.0.1')).status).toBe(200)
    expect((await from(app, '1.1.1.1, 35.0.0.2')).status).toBe(429)
  })

  it('stops model calls for everyone after the daily limit, until the next Taipei day', async () => {
    const { interpreter, asked } = fakeInterpreter('nemotron', { kind: 'uncertain' })
    let now = start
    const app = createApp(interpreter, undefined, { perMinute: 100, perDay: 2, now: () => now })

    expect((await from(app, '1.1.1.1')).status).toBe(200)
    expect((await from(app, '2.2.2.2')).status).toBe(200)
    const capped = await from(app, '3.3.3.3')
    expect(capped.status).toBe(429)
    expect((await capped.json()).mode).toBe('nemotron')
    expect(asked).toHaveLength(2)

    now += 60_000 // 16:00 Taipei is still 10/27
    expect((await from(app, '3.3.3.3')).status).toBe(429)
    now = Date.UTC(2026, 9, 27, 16, 0) // 00:00 on 10/28 in Taipei
    expect((await from(app, '3.3.3.3')).status).toBe(200)
  })

  it('does not count a refused sentence against the day', async () => {
    const { interpreter } = fakeInterpreter('nemotron', { kind: 'uncertain' })
    const app = createApp(interpreter, undefined, { perMinute: 100, perDay: 2, now: () => start })
    expect((await from(app, '1.1.1.1')).status).toBe(200)
    expect((await from(app, '1.1.1.1', '   ')).status).toBe(400)
    expect((await from(app, '1.1.1.1')).status).toBe(200)
  })

  it('is a kill switch at a daily limit of 0: no call is ever spent', async () => {
    const { interpreter, asked } = fakeInterpreter('nemotron', { kind: 'place', placeId: 'PHARMACY' })
    const app = createApp(interpreter, undefined, { perMinute: 100, perDay: 0, now: () => start })
    expect((await from(app, '1.1.1.1')).status).toBe(429)
    expect(asked).toEqual([])
  })

  it('limits the clinic lookup per person too, before it spends a Tavily credit', async () => {
    const fetched: string[] = []
    const extract: Extract = async (url) => {
      fetched.push(url)
      throw new Error('not needed')
    }
    const app = createApp(fakeInterpreter('mock', { kind: 'uncertain' }).interpreter, extract, { perMinute: 1, perDay: 100, now: () => start })
    const get = () => app.request('/indoor-api/campuses', { headers: { 'x-forwarded-for': '1.1.1.1' } })
    await get()
    expect((await get()).status).toBe(429)
    expect(fetched).toHaveLength(1)
  })
})

describe('readLimits', () => {
  it('defaults to 10 a minute per person and 400 a day', () => {
    expect(readLimits({})).toEqual({ perMinute: 10, perDay: 400 })
  })

  it('takes the deploy settings, including 0 as the kill switch', () => {
    expect(readLimits({ RATE_LIMIT_PER_MINUTE: '5', DAILY_LIMIT: '0' })).toEqual({ perMinute: 5, perDay: 0 })
  })

  // A typo must not quietly mean "no limit" on a public URL.
  it.each([['DAILY_LIMIT', 'abc'], ['DAILY_LIMIT', '-1'], ['DAILY_LIMIT', '1.5'], ['RATE_LIMIT_PER_MINUTE', '0']])('refuses to start with %s=%s', (name, value) => {
    expect(() => readLimits({ [name]: value })).toThrow(name)
  })
})

describe('clinic lookup', () => {
  const pages: Record<string, string> = {
    'https://webreg.tpech.gov.tw/': readFileSync('server/fixtures/tpech-home.md', 'utf8'),
    'https://webreg.tpech.gov.tw/RegOnline1_1.aspx?ZCode=F': readFileSync('server/fixtures/tpech-campus-F.md', 'utf8'),
  }
  /** Records which pages were fetched, so a test can tell whether a credit was spent. */
  function fakeExtract(fail = false) {
    const fetched: string[] = []
    const extract: Extract = async (url) => {
      fetched.push(url)
      if (fail) throw new Error('Tavily 432')
      return pages[url] ?? 'nothing here'
    }
    return { extract, fetched }
  }
  const { interpreter } = fakeInterpreter('mock', { kind: 'uncertain' })

  it('lists the campuses from the hospital home page, and says where they came from', async () => {
    const { extract } = fakeExtract()
    const res = await createApp(interpreter, extract).request('/indoor-api/campuses')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.source).toBe('https://webreg.tpech.gov.tw/')
    expect(body.campuses).toContainEqual({ code: 'F', name: '仁愛院區' })
  })

  it('lists a campus departments with the page they came from', async () => {
    const { extract, fetched } = fakeExtract()
    const res = await createApp(interpreter, extract).request('/indoor-api/departments?campus=F')
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.source).toBe('https://webreg.tpech.gov.tw/RegOnline1_1.aspx?ZCode=F')
    expect(body.departments.map((d: { name: string }) => d.name)).toContain('神經外科')
    expect(fetched).toEqual([body.source])
  })

  it.each(['', '../x', 'F&ZCode=G', 'TOOLONG'])('refuses campus %j without fetching anything', async (campus) => {
    const { extract, fetched } = fakeExtract()
    const res = await createApp(interpreter, extract).request(`/indoor-api/departments?campus=${encodeURIComponent(campus)}`)
    expect(res.status).toBe(400)
    expect(fetched).toEqual([])
  })

  it('says unavailable rather than an empty list when Tavily fails', async () => {
    const { extract } = fakeExtract(true)
    expect((await createApp(interpreter, extract).request('/indoor-api/departments?campus=F')).status).toBe(502)
    expect((await createApp(interpreter, extract).request('/indoor-api/campuses')).status).toBe(502)
  })

  it('says unavailable when the page no longer has the list, instead of claiming the campus has no clinics', async () => {
    const { extract } = fakeExtract()
    expect((await createApp(interpreter, extract).request('/indoor-api/departments?campus=G')).status).toBe(502)
  })

  it('says the lookup is off when there is no Tavily key', async () => {
    expect((await createApp(interpreter).request('/indoor-api/campuses')).status).toBe(503)
    expect((await createApp(interpreter).request('/indoor-api/departments?campus=F')).status).toBe(503)
  })
})
