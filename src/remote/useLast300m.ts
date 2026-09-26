import { useCallback, useState } from 'react'
import type { Cue } from '../engine/types'
import { cueForAction } from './cueMap'
import {
  Last300mClient,
  RemoteProtocolError,
  type RemoteAction,
  type RemoteSession,
} from './last300mClient'
import { LAST300M_ZH } from './strings'

/**
 * Session state for the outdoor last-300m flow. All route truth lives on the
 * server; this hook only carries the latest validated (session, action) pair
 * to the screen and the bird. On any protocol failure the previous state is
 * kept and a transient notice is shown — the screen never invents a step.
 */

export type Last300mPhase = 'IDLE' | 'ACTIVE' | 'ARRIVED'

interface BirdCueSink {
  send(cue: Cue): void
}

export interface Last300mState {
  phase: Last300mPhase
  session: RemoteSession | null
  action: RemoteAction | null
  cue: Cue
  busy: boolean
  notice: string | null
}

export function useLast300m(client: Last300mClient, bird: BirdCueSink, routeId: string) {
  const [state, setState] = useState<Last300mState>({
    phase: 'IDLE',
    session: null,
    action: null,
    cue: 'QUIET',
    busy: false,
    notice: null,
  })
  const [sessionId, setSessionId] = useState<string | null>(null)

  const apply = useCallback(
    (session: RemoteSession, action: RemoteAction) => {
      const cue = cueForAction(action.type)
      bird.send(cue)
      setState({
        phase: session.state === 'ARRIVED' ? 'ARRIVED' : 'ACTIVE',
        session,
        action,
        cue,
        busy: false,
        notice: null,
      })
    },
    [bird],
  )

  const start = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, notice: null }))
    try {
      const started = await client.createSession(routeId)
      setSessionId(started.sessionId)
      apply(started.session, started.action)
    } catch (err) {
      if (!(err instanceof RemoteProtocolError)) throw err
      setState((s) => ({ ...s, busy: false, notice: LAST300M_ZH['l3.notice.offline'] }))
    }
  }, [apply, client, routeId])

  const observe = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length === 0 || sessionId === null) return
      setState((s) => ({ ...s, busy: true, notice: null }))
      try {
        const result = await client.observe(sessionId, trimmed)
        apply(result.session, result.action)
      } catch (err) {
        if (!(err instanceof RemoteProtocolError)) throw err
        setState((s) => ({ ...s, busy: false, notice: LAST300M_ZH['l3.notice.offline'] }))
      }
    },
    [apply, client, sessionId],
  )

  return { state, start, observe }
}
