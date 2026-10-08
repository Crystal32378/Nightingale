import { describe, expect, it } from 'vitest'
import { Last300mClient, RemoteProtocolError, type FetchLike } from './last300mClient'
import { fitWithin, hasJpegMetadata, PHOTO_MAX_EDGE, PhotoPrepareError, stripCanvasJpegMetadata } from './photo'
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
  const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0x12, 0xff, 0xd9]

  it('finds an Exif segment (where GPS lives)', () => {
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0]
    expect(hasJpegMetadata(new Uint8Array([...soi, ...seg(0xe1, exif), ...sos]))).toBe(true)
  })

  it('passes a JPEG with only JFIF and tables, as a canvas writes it', () => {
    const jfif = [0x4a, 0x46, 0x49, 0x46, 0]
    expect(hasJpegMetadata(new Uint8Array([...soi, ...seg(0xe0, jfif), ...seg(0xdb, [0, 1, 2]), ...sos]))).toBe(false)
  })
})

describe('canvas JPEG metadata removal', () => {
  // These fixtures exercise marker framing, not a JPEG decoder. Browser checks
  // separately verify complete, decodable JPEGs produced by the actual canvas.
  const soi = [0xff, 0xd8]
  const eoi = [0xff, 0xd9]
  const sos = [0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0]
  const scan = [0x12, 0xff, 0, 0x34, 0xff, 0xd0, 0x56]
  const seg = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload]
  const jpeg = (...headers: number[][]) => new Uint8Array([...soi, ...headers.flat(), ...sos, ...scan, ...eoi])
  // Exact APP1 payload recorded in docs/field-photo-webkit-repro-2026-10-08.json.
  const webkitExif = Array.from(Buffer.from('4578696600004d4d002a00000008000187690004000000010000001a000000000003a00100030000000100010000a00200040000000100000140a003000400000001000000f000000000', 'hex'))

  it.each([
    ['actual WebKit EXIF', 0xe1, webkitExif],
    ['XMP', 0xe1, Array.from(new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0synthetic-location'))],
    ['IPTC', 0xed, Array.from(new TextEncoder().encode('Photoshop 3.0\0synthetic-location'))],
    ['comment', 0xfe, Array.from(new TextEncoder().encode('synthetic-location'))],
  ] as const)('removes %s while retaining all image bytes', (_name, marker, payload) => {
    const input = jpeg(seg(marker, [...payload]))
    expect(hasJpegMetadata(input)).toBe(true)
    expect(stripCanvasJpegMetadata(input)).toEqual(jpeg())
    expect(hasJpegMetadata(stripCanvasJpegMetadata(input))).toBe(false)
  })

  it('preserves JFIF, ICC color profiles, tables, stuffed bytes and restart markers', () => {
    const jfif = seg(0xe0, [0x4a, 0x46, 0x49, 0x46, 0])
    const icc = seg(0xe2, [...new TextEncoder().encode('ICC_PROFILE\0'), 1, 1, 0x12, 0xff, 0xe1, 0x34])
    const tables = seg(0xdb, [0, 1, 2])
    const input = jpeg(jfif, seg(0xe1, webkitExif), icc, tables, seg(0xed, [1, 2]))
    const before = input.slice()
    expect(stripCanvasJpegMetadata(input)).toEqual(jpeg(jfif, icc, tables))
    expect(input).toEqual(before)
  })

  it('removes metadata between scans and preserves each compressed scan', () => {
    const input = new Uint8Array([...soi, ...sos, ...scan, ...seg(0xfe, [1, 2]), ...sos, ...scan, ...eoi])
    expect(hasJpegMetadata(input)).toBe(true)
    expect(stripCanvasJpegMetadata(input)).toEqual(new Uint8Array([...soi, ...sos, ...scan, ...sos, ...scan, ...eoi]))
  })

  it('handles marker fill bytes and standalone TEM without treating them as lengths', () => {
    const input = new Uint8Array([...soi, 0xff, 0x01, 0xff, ...seg(0xe1, webkitExif), ...sos, ...scan, 0xff, 0xff, 0xd9])
    expect(stripCanvasJpegMetadata(input)).toEqual(new Uint8Array([...soi, 0xff, 0x01, ...sos, ...scan, 0xff, 0xff, 0xd9]))
  })

  it('preserves a DNL marker and TEM inside a scan', () => {
    const input = new Uint8Array([...soi, ...sos, 0x12, ...seg(0xdc, [0, 240]), 0x34, 0xff, 0x01, 0x56, ...eoi])
    expect(stripCanvasJpegMetadata(input)).toEqual(input)
    expect(hasJpegMetadata(input)).toBe(false)
  })

  it.each([
    ['not JPEG', [1, 2, 3]],
    ['truncated marker', [...soi, 0xff]],
    ['zero segment length', [...soi, 0xff, 0xe1, 0, 0, ...sos, ...scan, ...eoi]],
    ['one-byte segment length', [...soi, 0xff, 0xe1, 0, 1, ...sos, ...scan, ...eoi]],
    ['segment exceeds input', [...soi, 0xff, 0xe1, 0xff, 0xff, ...sos, ...scan, ...eoi]],
    ['unframed header bytes', [...soi, 0x12, 0x34, ...sos, ...scan, ...eoi]],
    ['stuffed byte outside a scan', [...soi, 0xff, 0, ...sos, ...scan, ...eoi]],
    ['restart outside a scan', [...soi, 0xff, 0xd0, ...sos, ...scan, ...eoi]],
    ['repeated SOI', [...soi, ...soi, ...sos, ...scan, ...eoi]],
    ['missing scan', [...soi, ...eoi]],
    ['missing EOI', [...soi, ...sos, ...scan]],
    ['truncated scan escape', [...soi, ...sos, 0x12, 0xff]],
    ['trailing bytes after EOI', [...soi, ...sos, ...scan, ...eoi, 0x12]],
  ])('fails closed for %s', (_name, bytes) => {
    const input = new Uint8Array(bytes as number[])
    expect(() => stripCanvasJpegMetadata(input)).toThrow(PhotoPrepareError)
    expect(hasJpegMetadata(input)).toBe(true)
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
    for (const key of ['l3.photo.small', 'l3.photo.remind'] as const) {
      expect(LAST300M_ZH[key]).toContain('人臉')
      expect(LAST300M_ZH[key]).toContain('車牌')
      expect(LAST300M_ZH[key]).toContain('病患資料')
    }
    expect(Object.values(LAST300M_ZH).join('')).not.toMatch(/絕不|永不|不會被任何/)
  })
})
