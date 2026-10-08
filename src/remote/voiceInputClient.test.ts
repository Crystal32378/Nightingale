import { describe, expect, it, vi } from 'vitest'
import { transcribeAudio } from './voiceInputClient'

describe('voice transport never sends an observation', () => {
  it('sends binary audio only to the session transcription endpoint', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const blob = new Blob(['audio'], { type: 'audio/mp4;codecs=mp4a.40.2' })
    const result = await transcribeAudio('https://api.example', 'session/one', blob, new AbortController().signal,
      async (url, init) => { requests.push({ url, init }); return new Response('{"text":" 我看見路牌 "}') })
    expect(result).toBe('我看見路牌'); expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('https://api.example/api/sessions/session%2Fone/transcriptions')
    expect(requests[0].init?.body).toBe(blob)
    expect(requests[0].init?.headers).toEqual({ 'Content-Type': 'audio/mp4' })
  })
  it.each(['{}', '{"text":""}', '{"text":42}', '{"text":"bad\\u0000"}', JSON.stringify({ text: 'x'.repeat(501) })])('rejects malformed transcript %s', async body => {
    await expect(transcribeAudio('', 's', new Blob(['x'], { type: 'audio/mp4' }), new AbortController().signal, async () => new Response(body))).rejects.toThrow()
  })
  it('distinguishes rate limit from permission or network problems', async () => {
    await expect(transcribeAudio('', 's', new Blob(['x'], { type: 'audio/mp4' }), new AbortController().signal, async () => new Response('{"error":"audio_session_limit"}', { status: 429 })))
      .rejects.toMatchObject({ code: 'audio_session_limit' })
  })
  it('times out even if a network implementation ignores abort', async () => {
    vi.useFakeTimers()
    try {
      const pending = transcribeAudio('', 's', new Blob(['x'], { type: 'audio/mp4' }), new AbortController().signal, () => new Promise(() => {}))
      const assertion = expect(pending).rejects.toMatchObject({ code: 'transcription_timeout' })
      await vi.advanceTimersByTimeAsync(30001); await assertion
    } finally { vi.useRealTimers() }
  })
})
