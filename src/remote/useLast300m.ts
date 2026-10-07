import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cue } from '../engine/types'
import { cueForAction } from './cueMap'
import {
  Last300mClient,
  RemoteProtocolError,
  type Expects,
  type LocationReport,
  type RemoteAction,
  type RemoteSession,
} from './last300mClient'
import { PhotoPrepareError, preparePhoto } from './photo'
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
  /** 'walker': the step waits for the walker's own word (exit reached, road crossed) — one button, bird quiet. */
  expects: Expects
}

/** After this long a photo reading gets one more line, so the wait never feels like a hang. */
export const PHOTO_STILL_WORKING_MS = 10_000

export interface OutdoorFeedback {
  action(action: RemoteAction): void
  photo(key: 'photo.wait' | 'photo.wait2'): void
  stop(): void
}

export function useLast300m(
  client: Last300mClient,
  bird: BirdCueSink,
  routeId: string,
  location: () => LocationReport | undefined = () => undefined,
  feedback?: OutdoorFeedback,
) {
  const [state, setState] = useState<Last300mState>({
    phase: 'IDLE',
    session: null,
    action: null,
    cue: 'QUIET',
    busy: false,
    notice: null,
    expects: 'evidence',
  })
  const stillWorking = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  useEffect(() => () => {
    if (stillWorking.current) clearTimeout(stillWorking.current)
    feedback?.stop()
  }, [feedback])

  const apply = useCallback(
    (session: RemoteSession, action: RemoteAction, expects: Expects) => {
      if (stillWorking.current) clearTimeout(stillWorking.current)
      // Mid-crossing the bird holds still: nothing competes with the road.
      const cue = expects === 'walker' ? 'QUIET' : cueForAction(action.type)
      bird.send(cue)
      setState({
        phase: session.state === 'ARRIVED' ? 'ARRIVED' : 'ACTIVE',
        session,
        action,
        cue,
        busy: false,
        notice: null,
        expects,
      })
      feedback?.action(action)
    },
    [bird, feedback],
  )

  const fail = useCallback((notice: string) => {
    if (stillWorking.current) clearTimeout(stillWorking.current)
    feedback?.stop()
    setState((s) => ({ ...s, busy: false, notice }))
  }, [feedback])

  const start = useCallback(async () => {
    feedback?.stop()
    setState((s) => ({ ...s, busy: true, notice: null }))
    try {
      const started = await client.createSession(routeId)
      setSessionId(started.sessionId)
      apply(started.session, started.action, started.expects)
    } catch (err) {
      if (!(err instanceof RemoteProtocolError)) throw err
      fail(LAST300M_ZH['l3.notice.offline'])
    }
  }, [apply, client, fail, feedback, routeId])

  const observe = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length === 0 || sessionId === null) return
      feedback?.stop()
      setState((s) => ({ ...s, busy: true, notice: null }))
      try {
        const result = await client.observe(sessionId, trimmed, location())
        apply(result.session, result.action, result.expects)
      } catch (err) {
        if (!(err instanceof RemoteProtocolError)) throw err
        fail(LAST300M_ZH['l3.notice.offline'])
      }
    },
    [apply, client, fail, feedback, location, sessionId],
  )

  const done = useCallback(async () => {
    if (sessionId === null) return
    feedback?.stop()
    setState((s) => ({ ...s, busy: true, notice: null }))
    try {
      const result = await client.confirmDone(sessionId)
      apply(result.session, result.action, result.expects)
    } catch (err) {
      if (!(err instanceof RemoteProtocolError)) throw err
      fail(LAST300M_ZH['l3.notice.offline'])
    }
  }, [apply, client, fail, feedback, sessionId])

  const observePhoto = useCallback(
    async (file: Blob) => {
      if (sessionId === null) return
      feedback?.photo('photo.wait')
      setState((s) => ({ ...s, busy: true, notice: LAST300M_ZH['l3.photo.reading'] }))
      stillWorking.current = setTimeout(
        () => {
          feedback?.photo('photo.wait2')
          setState((s) => (s.busy ? { ...s, notice: LAST300M_ZH['l3.photo.stillWorking'] } : s))
        },
        PHOTO_STILL_WORKING_MS,
      )
      try {
        const photo = await preparePhoto(file)
        const result = await client.observePhoto(sessionId, photo, location())
        apply(result.session, result.action, result.expects)
      } catch (err) {
        const notice =
          err instanceof PhotoPrepareError
            ? LAST300M_ZH['l3.photo.unreadable']
            : err instanceof RemoteProtocolError && err.status === 429
              ? LAST300M_ZH['l3.photo.limit']
              : err instanceof RemoteProtocolError
                ? LAST300M_ZH['l3.notice.offline']
                : null
        if (notice === null) throw err
        fail(notice)
      }
    },
    [apply, client, fail, feedback, location, sessionId],
  )

  return { state, start, observe, observePhoto, done }
}
