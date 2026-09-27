import { describe, expect, it } from 'vitest'
import { Last300mClient, RemoteProtocolError, type FetchLike } from './last300mClient'
import { fitWithin, hasJpegMetadata, PHOTO_MAX_EDGE } from './photo'
import { LAST300M_ZH } from './strings'

describe('photo sizing', () => {
  it('fits the long edge inside the box and keeps the aspect ratio', () => {
    expect(fitWithin(3024, 4032, PHOTO_MAX_EDGE)).toEqual({ width: 960, height: 1280 })
    expect(fitWithin(4032, 3024, PHOTO_MAX_EDGE)).toEqual({ width: 1280, height: 960 })
  })

  it('never scales a small photo up', () => {
    expect(fitWithin(800, 600, PHOTO_MAX_EDGE)).toEqual({ width: 800, height: 600 })
  })
})

describe('metadata check', () => {
  const seg = (marker: number, payload: number[]) => [0xff, marker, 0, payload.length + 2, ...payload]
  const soi = [0xff, 0xd8]
  const sos = [0xff, 0xda, 0, 2]

  it('finds an Exif segment (where GPS lives)', () => {
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0]
    expect(hasJpegMetadata(new Uint8Array([...soi, ...seg(0xe1, exif), ...sos]))).toBe(true)
  })

  it('passes a JPEG with only JFIF and tables, as a canvas writes it', () => {
    const jfif = [0x4a, 0x46, 0x49, 0x46, 0]
    expect(hasJpegMetadata(new Uint8Array([...soi, ...seg(0xe0, jfif), ...seg(0xdb, [0, 1, 2]), ...sos]))).toBe(false)
  })
})

describe('photo upload', () => {
  const okSession = { routeId: 'r1', state: 'AT_CHECKPOINT', checkpointId: 'cp2', questionCount: 0 }
  const okAction = { type: 'GUIDE', checkpointId: 'cp1', instruction: 'walk on' }

  it('posts only the prepared photo', async () => {
    let sent: unknown
    const fetchImpl: FetchLike = async (_url, init) => {
      sent = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ session: okSession, action: okAction }), { status: 200 })
    }
    const client = new Last300mClient('https://api.example', fetchImpl)
    const r = await client.observePhoto('s1', { mimeType: 'image/jpeg', data: 'AAAA' })
    expect(sent).toEqual({ photo: { mimeType: 'image/jpeg', data: 'AAAA' } })
    expect(r.action.type).toBe('GUIDE')
  })

  it('surfaces a photo limit as status 429, not as a broken connection', async () => {
    const client = new Last300mClient('https://api.example', async () => new Response('{}', { status: 429 }))
    const err = await client.observePhoto('s1', { mimeType: 'image/jpeg', data: 'AAAA' }).catch((e) => e)
    expect(err).toBeInstanceOf(RemoteProtocolError)
    expect(err.status).toBe(429)
  })

  it('discloses exactly what the privacy ruling allows, and nothing stronger', () => {
    expect(LAST300M_ZH['l3.photo.privacy']).toBe(
      'Nightingale 不保存原始照片；照片會傳送給 Google Vertex AI 辨識，系統只保留結構化的路線判斷。',
    )
    expect(LAST300M_ZH['l3.photo.hint']).toContain('人臉')
    expect(LAST300M_ZH['l3.photo.hint']).toContain('車牌')
    expect(LAST300M_ZH['l3.photo.hint']).toContain('病患資料')
    expect(Object.values(LAST300M_ZH).join('')).not.toMatch(/絕不|永不|不會被任何/)
  })
})
