/**
 * Nightingale — presentation server (Cloud Run + Nebius Serverless).
 *
 * GET  /health       -> { ok, tracks }
 * POST /api/present  -> { text, source, fallbackUsed, reason }
 *
 * Body: { track, baseText, placeId, placeName, intent, cue, turnLive }
 * Env: GEMINI_API_KEY (google track), NEBIUS_API_KEY (nebius track), PORT.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { presentWithGemini } from '../src/cloud/googleGemini'
import { presentWithNemotron } from '../src/cloud/nebiusNemotron'
import { VertexGeminiPresenter, defaultTokenProvider } from '../src/cloud/vertexGemini'
import type { PresentationInput } from '../src/cloud/types'
import { deterministicResult } from '../src/cloud/types'

const PORT = Number(process.env.PORT ?? 8080)
// Vertex AI (GCP billing) is preferred for the google track; the API-key
// transport stays as fallback for local dev without GCP credentials.
const VERTEX_PROJECT = process.env.VERTEX_PROJECT ?? ''

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Access-Control-Allow-Origin': '*',
  })
  res.end(text)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function isTrack(value: unknown): value is 'google' | 'nebius' {
  return value === 'google' || value === 'nebius'
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }
  if (req.url === '/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, tracks: ['google', 'nebius'] })
    return
  }
  if (req.url === '/api/present' && req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = JSON.parse(await readBody(req)) as Record<string, unknown>
    } catch {
      sendJson(res, 400, { error: 'invalid JSON' })
      return
    }
    if (!isTrack(body.track) || typeof body.baseText !== 'string' || body.baseText.trim() === '') {
      sendJson(res, 400, { error: 'need { track: google|nebius, baseText }' })
      return
    }
    const input: PresentationInput = {
      baseText: body.baseText,
      placeId: typeof body.placeId === 'string' ? body.placeId : null,
      placeName: typeof body.placeName === 'string' ? body.placeName : null,
      intent: typeof body.intent === 'string' ? (body.intent as PresentationInput['intent']) : 'NONE',
      cue: typeof body.cue === 'string' ? (body.cue as PresentationInput['cue']) : 'QUIET',
      turnLive: body.turnLive === true,
      track: body.track,
    }
    try {
      const result =
        body.track === 'google'
          ? VERTEX_PROJECT !== ''
            ? await new VertexGeminiPresenter(VERTEX_PROJECT, defaultTokenProvider()).present(input)
            : await presentWithGemini(input, process.env.GEMINI_API_KEY ?? '')
          : await presentWithNemotron(input, process.env.NEBIUS_API_KEY ?? '')
      sendJson(res, 200, result)
    } catch (err) {
      sendJson(res, 200, {
        ...deterministicResult(input.baseText),
        fallbackUsed: true,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
    return
  }
  sendJson(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(`nightingale-present listening on :${PORT}`)
})
