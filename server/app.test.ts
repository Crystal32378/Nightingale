import { describe, expect, it } from 'vitest'
import type { Destination, DestinationInterpreter } from '../src/destination/destination'
import { createApp } from './app'

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
