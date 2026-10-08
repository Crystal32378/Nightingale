import { describe, expect, it } from 'vitest'
import { Last300mClient, RemoteProtocolError, type FetchLike } from './last300mClient'
import { outdoorKeysFor } from './outdoorVoice'

const id = '0fdcbcf1-1897-4f8c-a836-44ab68abec60'
const session = { routeId: 'renai-001', state: 'RECOVERING', checkpointId: 'cp2', questionCount: 2 }
const question = '你已經過復興南路，現在安全站在仁愛路口的人行道上，而且還沒有過仁愛路，對嗎？'
const action = {
  type: 'ASK', checkpointId: 'cp2', question,
  confirmation: { id, kind: 'renai-before-second-crossing' },
}
const pending = { session, action, expects: 'evidence' }
const afterCrossing = {
  session: { ...session, state: 'AT_CHECKPOINT', checkpointId: 'cp3x', questionCount: 0 },
  action: { type: 'GUIDE', checkpointId: 'cp3', instruction: '等綠燈，走斑馬線。' },
  expects: 'walker',
}

function clientReturning(body: unknown, status = 200): Last300mClient {
  return new Last300mClient('https://api.example', async () =>
    new Response(JSON.stringify(body), { status }))
}

describe('text continuation protocol', () => {
  it('keeps a validated typed question silent and does not match its prose', async () => {
    const client = clientReturning({ ...pending, action: { ...action, question: '安全位置都符合嗎？' } })
    const result = await client.observe('session', '仁愛復興路口')
    expect(result.action.confirmation).toEqual({ id, kind: 'renai-before-second-crossing' })
    expect(result.expects).toBe('evidence')
    expect(outdoorKeysFor('renai-001', result.action)).toEqual([])
  })

  const malformedActions = [
    { ...action, confirmation: null },
    { ...action, confirmation: [] },
    { ...action, confirmation: 'yes' },
    { ...action, confirmation: { id, kind: 'another-crossing' } },
    { ...action, confirmation: { kind: 'renai-before-second-crossing' } },
    { ...action, confirmation: { ...action.confirmation, id: 4 } },
    { ...action, confirmation: { ...action.confirmation, id: '' } },
    { ...action, confirmation: { ...action.confirmation, id: '   ' } },
    { ...action, confirmation: { ...action.confirmation, id: 'x'.repeat(81) } },
    { ...action, confirmation: { ...action.confirmation, id: 'bad\u0000id' } },
    { ...action, type: 'GUIDE' },
    { ...action, checkpointId: 'cp3' },
    { ...action, question: undefined },
    { ...action, question: '' },
    { ...action, question: 'x'.repeat(141) },
  ]
  it.each(malformedActions)('rejects unsafe confirmation action %# before controls can render', async (badAction) => {
    const client = clientReturning({ ...pending, action: badAction })
    await expect(client.observe('session', '仁愛路')).rejects.toThrow(RemoteProtocolError)
  })

  it.each([
    { ...pending, session: { ...session, checkpointId: 'cp3' } },
    { ...pending, session: { ...session, routeId: 'unverified-route' } },
    { ...pending, expects: 'walker' },
    { ...pending, expects: undefined },
  ])('rejects a question outside its evidence checkpoint %#', async (body) => {
    const client = clientReturning(body)
    await expect(client.observe('session', '仁愛路')).rejects.toThrow(RemoteProtocolError)
  })

  it('also rejects malformed confirmation on session creation', async () => {
    const client = clientReturning({ ...pending, sessionId: 'session', action: { ...action, confirmation: null } })
    await expect(client.createSession('renai-001')).rejects.toThrow(RemoteProtocolError)
  })

  it.each(['confirm', 'cancel'] as const)('sends %s with the question id and current location, never ordinary done', async (answer) => {
    const requests: Array<{ url: string; body: unknown }> = []
    const fetchImpl: FetchLike = async (url, init) => {
      requests.push({ url, body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify(afterCrossing), { status: 200 })
    }
    const client = new Last300mClient('https://api.example', fetchImpl)
    const result = await client.confirmContinuation('session/one', { id, answer }, { zone: 'renai-junction' })
    expect(requests).toEqual([{
      url: 'https://api.example/api/sessions/session%2Fone/observations',
      body: { confirmation: { id, answer }, location: { zone: 'renai-junction' } },
    }])
    expect(result.session.checkpointId).toBe('cp3x')
    expect(result.expects).toBe('walker')
  })

  it('omits location when it is unavailable', async () => {
    let body: unknown
    const client = new Last300mClient('https://api.example', async (_url, init) => {
      body = JSON.parse(String(init?.body))
      return new Response(JSON.stringify(afterCrossing), { status: 200 })
    })
    await client.confirmContinuation('session', { id, answer: 'confirm' })
    expect(body).toEqual({ confirmation: { id, answer: 'confirm' } })
  })

  it('preserves HTTP 409 so the view can withdraw expired controls', async () => {
    const client = clientReturning({ error: 'expired' }, 409)
    await expect(client.confirmContinuation('session', { id, answer: 'confirm' }))
      .rejects.toMatchObject({ status: 409 })
  })
})
