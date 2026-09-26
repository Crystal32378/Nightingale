import { describe, expect, it } from 'vitest'
import type { Cue } from '../engine/types'
import { cueForAction, type RemoteActionType } from './cueMap'
import { Last300mClient, RemoteProtocolError, type FetchLike } from './last300mClient'

describe('cue mapping', () => {
  it('maps every remote action to a bird cue, and never to LEFT/RIGHT', () => {
    const expected: Record<RemoteActionType, Cue> = {
      GUIDE: 'READY',
      RECOVER: 'READY',
      ASK: 'ASK',
      REANCHOR: 'ASK',
      CONFIRM_ARRIVAL: 'ARRIVED',
    }
    for (const [action, cue] of Object.entries(expected)) {
      const mapped = cueForAction(action as RemoteActionType)
      expect(mapped).toBe(cue)
      expect(mapped).not.toBe('LEFT')
      expect(mapped).not.toBe('RIGHT')
    }
  })
})

const okSession = {
  routeId: 'r1',
  state: 'AT_CHECKPOINT',
  checkpointId: 'cp2',
  questionCount: 0,
}
const okAction = { type: 'GUIDE', checkpointId: 'cp1', instruction: 'walk on' }

function fetchReturning(status: number, body: unknown): FetchLike {
  return async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
}

describe('Last300mClient', () => {
  it('parses a session start', async () => {
    const client = new Last300mClient(
      'https://api.example',
      fetchReturning(201, { sessionId: 's1', session: okSession, action: okAction }),
    )
    const start = await client.createSession('r1')
    expect(start.sessionId).toBe('s1')
    expect(start.action.type).toBe('GUIDE')
  })

  it('parses a step and posts the free text to the session', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ session: okSession, action: okAction }), { status: 200 })
    }
    const client = new Last300mClient('https://api.example', fetchImpl)
    const result = await client.observe('s1', '我看到天橋')
    expect(result.session.checkpointId).toBe('cp2')
    expect(calls[0]!.url).toBe('https://api.example/api/sessions/s1/observations')
    expect(calls[0]!.body).toEqual({ text: '我看到天橋' })
  })

  it('throws on HTTP errors, non-JSON, malformed shapes, and network failure', async () => {
    const cases: FetchLike[] = [
      fetchReturning(500, { error: 'boom' }),
      fetchReturning(200, 'not json {'),
      fetchReturning(200, { session: { bad: true }, action: okAction }),
      fetchReturning(200, { session: okSession, action: { type: 'TELEPORT', checkpointId: 'x' } }),
      async () => {
        throw new Error('offline')
      },
    ]
    for (const fetchImpl of cases) {
      const client = new Last300mClient('https://api.example', fetchImpl)
      await expect(client.observe('s1', 'hi')).rejects.toThrow(RemoteProtocolError)
    }
  })

  it('rejects a session-start payload missing its sessionId', async () => {
    const client = new Last300mClient(
      'https://api.example',
      fetchReturning(201, { session: okSession, action: okAction }),
    )
    await expect(client.createSession('r1')).rejects.toThrow(RemoteProtocolError)
  })

  it('reads the route frame for the requested route only', async () => {
    const routes = [
      { routeId: 'other', origin: { name: 'x' }, destination: { name: 'y' } },
      {
        routeId: 'renai-001',
        origin: { type: 'transit_exit', name: '捷運忠孝復興站 出口2（無障礙電梯）' },
        destination: { type: 'hospital_entrance', name: '臺北市立聯合醫院仁愛院區 大廳入口（無台階）' },
      },
    ]
    const client = new Last300mClient('https://api.example', fetchReturning(200, routes))
    const info = await client.routeInfo('renai-001')
    expect(info.originName).toContain('出口2')
    expect(info.destinationName).toContain('大廳入口')
  })

  it('fails closed when the route frame is missing or malformed', async () => {
    const cases: FetchLike[] = [
      fetchReturning(200, []),
      fetchReturning(200, [{ routeId: 'renai-001', origin: {}, destination: { name: 'y' } }]),
      fetchReturning(200, { not: 'an array' }),
      fetchReturning(500, []),
    ]
    for (const fetchImpl of cases) {
      const client = new Last300mClient('https://api.example', fetchImpl)
      await expect(client.routeInfo('renai-001')).rejects.toThrow(RemoteProtocolError)
    }
  })
})
