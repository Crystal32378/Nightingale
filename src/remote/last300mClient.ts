import type { RemoteActionType } from './cueMap'
import type { RouteZone } from './zone'

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
  confirmation?: TextContinuation
}

/** A server-issued question, separate from the walker's ordinary crossing-done button. */
export interface TextContinuation {
  id: string
  kind: 'renai-before-second-crossing'
}

export interface TextContinuationAnswer {
  id: string
  answer: 'confirm' | 'cancel'
}

/** What the next confirmation has to be: evidence, or the walker saying a crossing is done. */
export type Expects = 'evidence' | 'walker'

export interface SessionStart {
  sessionId: string
  session: RemoteSession
  action: RemoteAction
  expects: Expects
}

export interface StepResult {
  session: RemoteSession
  action: RemoteAction
  expects: Expects
}

/** The phone's zone, computed on the phone. Omitted when the page has no location at all. */
export interface LocationReport {
  zone: string
}

export interface RouteInfo {
  routeId: string
  originName: string
  destinationName: string
  zones: RouteZone[]
}

export class RemoteProtocolError extends Error {
  constructor(
    message: string,
    /** HTTP status when the server answered; 429 means a photo limit, not a broken link. */
    readonly status?: number,
  ) {
    super(message)
  }
}

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
  if (a.confirmation !== undefined) {
    if (a.type !== 'ASK' || a.checkpointId !== 'cp2') return false
    // The complete question must fit the guidance view; never show a yes
    // button under a missing or truncated condition.
    if (typeof a.question !== 'string' || !a.question.trim() || a.question.length > 140) return false
    const c = a.confirmation
    if (typeof c !== 'object' || c === null || Array.isArray(c)) return false
    const confirmation = c as Record<string, unknown>
    if (confirmation.kind !== 'renai-before-second-crossing'
      || typeof confirmation.id !== 'string' || confirmation.id.length === 0
      || confirmation.id.length > 80 || /[\s\u0000-\u001f\u007f]/.test(confirmation.id)) return false
  }
  return true
}

function hasValidConfirmationContext(session: RemoteSession, action: RemoteAction, expects: unknown): boolean {
  return !action.confirmation || (session.routeId === 'renai-001' && session.checkpointId === 'cp2' && expects === 'evidence')
}

function isZone(v: unknown): v is RouteZone {
  if (typeof v !== 'object' || v === null) return false
  const z = v as Record<string, unknown>
  return (
    typeof z.id === 'string' &&
    [z.lat, z.lon, z.radiusM].every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    (z.radiusM as number) > 0
  )
}

/** An older server says nothing: treat every step as evidence-confirmed, as before. */
function readExpects(v: unknown): Expects {
  return v === 'walker' ? 'walker' : 'evidence'
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
  if (!res.ok) throw new RemoteProtocolError(`server answered ${res.status}`, res.status)
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
    if (typeof b?.sessionId !== 'string' || !isSession(b.session) || !isAction(b.action)
      || !hasValidConfirmationContext(b.session, b.action, b.expects)) {
      throw new RemoteProtocolError('malformed session response')
    }
    return { sessionId: b.sessionId, session: b.session, action: b.action, expects: readExpects(b.expects) }
  }

  /**
   * Route frame for the header rows (origin → destination). Display metadata
   * from route truth — validated like everything else; on failure the caller
   * shows no rows rather than invented ones.
   */
  async routeInfo(routeId: string): Promise<RouteInfo> {
    let res: Response
    try {
      res = await this.fetchImpl(`${this.baseUrl}/api/routes`)
    } catch (err) {
      throw new RemoteProtocolError(`network failure: ${String(err)}`)
    }
    if (!res.ok) throw new RemoteProtocolError(`server answered ${res.status}`)
    let body: unknown
    try {
      body = await res.json()
    } catch {
      throw new RemoteProtocolError('server answered non-JSON')
    }
    if (!Array.isArray(body)) throw new RemoteProtocolError('malformed routes response')
    const row = body.find(
      (r): r is Record<string, unknown> =>
        typeof r === 'object' && r !== null && (r as Record<string, unknown>).routeId === routeId,
    )
    if (!row) throw new RemoteProtocolError(`route ${routeId} not listed`)
    const origin = row.origin as Record<string, unknown> | undefined
    const destination = row.destination as Record<string, unknown> | undefined
    if (typeof origin?.name !== 'string' || typeof destination?.name !== 'string') {
      throw new RemoteProtocolError('malformed routes response')
    }
    // Zones are optional: a route without them simply never sends a location.
    const zones = Array.isArray(row.zones) ? row.zones.filter(isZone) : []
    return { routeId, originName: origin.name, destinationName: destination.name, zones }
  }

  async observe(sessionId: string, text: string, location?: LocationReport): Promise<StepResult> {
    return this.step(sessionId, { text }, location)
  }

  /** Photo is already downsized and stripped by preparePhoto; the server reads it and keeps none of it. */
  async observePhoto(
    sessionId: string,
    photo: { mimeType: 'image/jpeg'; data: string },
    location?: LocationReport,
  ): Promise<StepResult> {
    return this.step(sessionId, { photo }, location)
  }

  /** The walker says this step is done (at exit 2, across the road). Nothing else moves such a step on. */
  async confirmDone(sessionId: string): Promise<StepResult> {
    return this.step(sessionId, { confirm: 'done' })
  }

  async confirmContinuation(
    sessionId: string,
    confirmation: TextContinuationAnswer,
    location?: LocationReport,
  ): Promise<StepResult> {
    return this.step(sessionId, { confirmation }, location)
  }

  private async step(sessionId: string, payload: Record<string, unknown>, location?: LocationReport): Promise<StepResult> {
    const body = await post(
      this.fetchImpl,
      `${this.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/observations`,
      location ? { ...payload, location } : payload,
    )
    const b = body as Record<string, unknown>
    if (!isSession(b?.session) || !isAction(b?.action)
      || !hasValidConfirmationContext(b.session, b.action, b.expects)) {
      throw new RemoteProtocolError('malformed step response')
    }
    return { session: b.session, action: b.action, expects: readExpects(b.expects) }
  }
}
