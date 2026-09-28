import { describe, expect, it } from 'vitest'
import { lintStringTable } from '../lint/register'
import { Last300mClient, type FetchLike } from './last300mClient'
import { STEP_CARDS, stepCardFor } from './stepCard'
import { distanceM, UNKNOWN_ZONE, zoneFor, type RouteZone } from './zone'

const zones: RouteZone[] = [
  { id: 'er', lat: 25.0377, lon: 121.5446, radiusM: 35 },
  { id: 'lobby', lat: 25.0377, lon: 121.5455, radiusM: 28 },
]

describe('zone on the phone', () => {
  it('measures the ER driveway and lobby about 90 m apart', () => {
    expect(Math.round(distanceM(25.0377, 121.5446, 25.0377, 121.5455))).toBeGreaterThan(85)
  })

  it('places a good fix in its zone, and says unknown for a rough fix or open ground', () => {
    expect(zoneFor(zones, 25.0377, 121.5455, 8)).toBe('lobby')
    expect(zoneFor(zones, 25.0377, 121.5455, 128)).toBe(UNKNOWN_ZONE)
    expect(zoneFor(zones, 25.0377, 121.545, 10)).toBe(UNKNOWN_ZONE)
  })
})

describe('step labels', () => {
  it('stay short, carry no seconds, and pass the register lint', () => {
    for (const cards of Object.values(STEP_CARDS)) {
      const table = Object.fromEntries(Object.entries(cards).map(([k, c]) => [k, c.label]))
      expect(lintStringTable(table)).toEqual([])
      for (const c of Object.values(cards)) {
        expect([...c.label].length).toBeLessThanOrEqual(5)
        expect(c.label).not.toMatch(/\d|秒/)
      }
    }
  })

  it('match the route by checkpoint and action, and fall back when unknown', () => {
    expect(stepCardFor('renai-001', { type: 'GUIDE', checkpointId: 'cp2' })?.label).toBe('過復興路')
    expect(stepCardFor('renai-001', { type: 'RECOVER', checkpointId: 'cp5' })).toBeNull()
    expect(stepCardFor('other', { type: 'GUIDE', checkpointId: 'cp2' })).toBeNull()
  })
})

describe('crossings and location over the wire', () => {
  const okSession = { routeId: 'r1', state: 'AT_CHECKPOINT', checkpointId: 'cp2x', questionCount: 0 }
  const okAction = { type: 'GUIDE', checkpointId: 'cp2', instruction: '等綠燈，過復興南路。' }
  const recording = () => {
    const sent: unknown[] = []
    const fetchImpl: FetchLike = async (_u, init) => {
      sent.push(JSON.parse(String(init?.body)))
      return new Response(JSON.stringify({ session: okSession, action: okAction, expects: 'walker' }), { status: 200 })
    }
    return { sent, client: new Last300mClient('https://api.example', fetchImpl) }
  }

  it('sends the walker\'s "crossed" and reads what the next step expects', async () => {
    const { sent, client } = recording()
    const r = await client.confirmCrossed('s1')
    expect(sent[0]).toEqual({ confirm: 'crossed' })
    expect(r.expects).toBe('walker')
  })

  it('sends only a zone id with an observation, never coordinates', async () => {
    const { sent, client } = recording()
    await client.observe('s1', '出口2', { zone: 'exit2' })
    await client.observe('s1', '出口2')
    expect(sent[0]).toEqual({ text: '出口2', location: { zone: 'exit2' } })
    expect(sent[1]).toEqual({ text: '出口2' })
  })

  it('treats a server that says nothing about expects as evidence', async () => {
    const client = new Last300mClient('https://api.example', async () =>
      new Response(JSON.stringify({ session: okSession, action: okAction }), { status: 200 }),
    )
    expect((await client.observe('s1', 'x')).expects).toBe('evidence')
  })
})
