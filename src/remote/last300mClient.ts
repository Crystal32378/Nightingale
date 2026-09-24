import type { RemoteActionType } from './cueMap'

/**
 * Typed client for the last-300m route server (Cloud Run).
 *
 * The server is the deterministic authority for the outdoor segment; this
 * client only transports and type-checks. Every response is validated
 * structurally before anything above this layer sees it — a malformed or
 * failed response throws, and the caller keeps its previous state. A broken
 * network must never invent a next step.
 */

export interface RemoteSession {
  routeId: string
  state: 'AT_CHECKPOINT' | 'AMBIGUOUS' | 'RECOVERING' | 'ARRIVED'
  checkpointId: string
  questionCount: number
}

export interface RemoteAction {
  type: RemoteActionType
  checkpointId: string
  instruction?: string
  question?: string
  lookFor?: string[]
}

export interface SessionStart {
  sessionId: string
  session: RemoteSession
  action: RemoteAction
}

export interface StepResult {
  session: RemoteSession
  action: RemoteAction
}

export class RemoteProtocolError extends Error {}

const SESSION_STATES = new Set(['AT_CHECKPOINT', 'AMBIGUOUS', 'RECOVERING', 'ARRIVED'])
const ACTION_TYPES = new Set(['GUIDE', 'ASK', 'RECOVER', 'REANCHOR', 'CONFIRM_ARRIVAL'])

function isSession(v: unknown): v is RemoteSession {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.routeId === 'string' &&
    typeof s.state === 'string' &&
    SESSION_STATES.has(s.state) &&
    typeof s.checkpointId === 'string' &&
    typeof s.questionCount === 'number'
  )
}

function isAction(v: unknown): v is RemoteAction {
  if (typeof v !== 'object' || v === null) return false
  const a = v as Record<string, unknown>
  if (typeof a.type !== 'string' || !ACTION_TYPES.has(a.type)) return false
  if (typeof a.checkpointId !== 'string') return false
  if (a.instruction !== undefined && typeof a.instruction !== 'string') return false
  if (a.question !== undefined && typeof a.question !== 'string') return false
  if (a.lookFor !== undefined && (!Array.isArray(a.lookFor) || a.lookFor.some((x) => typeof x !== 'string')))
    return false
  return true
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

async function post(fetchImpl: FetchLike, url: string, body: unknown): Promise<unknown> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    throw new RemoteProtocolError(`network failure: ${String(err)}`)
  }
  if (!res.ok) throw new RemoteProtocolError(`server answered ${res.status}`)
  try {
    return await res.json()
  } catch {
    throw new RemoteProtocolError('server answered non-JSON')
  }
}

export class Last300mClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: FetchLike = (input, init) => fetch(input, init),
  ) {}

  async createSession(routeId: string): Promise<SessionStart> {
    const body = await post(this.fetchImpl, `${this.baseUrl}/api/sessions`, { routeId })
    const b = body as Record<string, unknown>
    if (typeof b?.sessionId !== 'string' || !isSession(b.session) || !isAction(b.action)) {
      throw new RemoteProtocolError('malformed session response')
    }
    return { sessionId: b.sessionId, session: b.session, action: b.action }
  }

  async observe(sessionId: string, text: string): Promise<StepResult> {
    const body = await post(
      this.fetchImpl,
      `${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/observations`,
      { text },
    )
    const b = body as Record<string, unknown>
    if (!isSession(b?.session) || !isAction(b?.action)) {
      throw new RemoteProtocolError('malformed step response')
    }
    return { session: b.session, action: b.action }
  }
}
