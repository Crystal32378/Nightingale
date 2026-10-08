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
  type TextContinuationAnswer,
} from './last300mClient'
import { PhotoPrepareError, preparePhoto } from './photo'
import { photoDiagnostic } from './photoDiagnostic'
import type { Last300mStringKey } from './strings'
import { outdoorStrings, type OutdoorLocale } from './locale'

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
  noticeKey?: Last300mStringKey | null
  diagnosticCode?: string
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

function noticeText(key: Last300mStringKey, locale: OutdoorLocale, diagnosticCode?: string): string {
  return outdoorStrings(locale)[key] + (diagnosticCode ? ` ${locale === 'en' ? 'Check code: ' : '檢查代碼：'}${diagnosticCode}` : '')
}

export function useLast300m(
  client: Last300mClient,
  bird: BirdCueSink,
  routeId: string,
  location: () => LocationReport | undefined = () => undefined,
  feedback?: OutdoorFeedback,
  photoCheck = false,
  locale: OutdoorLocale = 'zh-TW',
) {
  const localeRef = useRef(locale); localeRef.current = locale
  const message = useCallback((key: Last300mStringKey) => outdoorStrings(localeRef.current)[key], [])
  const [state, setState] = useState<Last300mState>({
    phase: 'IDLE',
    session: null,
    action: null,
    cue: 'QUIET',
    busy: false,
    notice: null, noticeKey: null, diagnosticCode: undefined,
    expects: 'evidence',
  })
  const stillWorking = useRef<ReturnType<typeof setTimeout> | null>(null)
  // State disables visible controls; the ref also catches repeated taps
  // before React has painted that disabled state.
  const inFlight = useRef(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  useEffect(() => {
    setState(current => current.noticeKey ? { ...current, notice: noticeText(current.noticeKey, locale, current.diagnosticCode) } : current)
  }, [locale])

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
        notice: null, noticeKey: null, diagnosticCode: undefined,
        expects,
      })
      feedback?.action(action)
    },
    [bird, feedback],
  )

  const fail = useCallback((key: Last300mStringKey, diagnosticCode?: string) => {
    if (stillWorking.current) clearTimeout(stillWorking.current)
    feedback?.stop()
    setState((s) => ({ ...s, busy: false, notice: noticeText(key, localeRef.current, diagnosticCode), noticeKey: key, diagnosticCode }))
  }, [feedback])

  const start = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    feedback?.stop()
    setState((s) => ({ ...s, busy: true, notice: null, noticeKey: null, diagnosticCode: undefined }))
    try {
      const started = await client.createSession(routeId)
      setSessionId(started.sessionId)
      apply(started.session, started.action, started.expects)
    } catch (err) {
      if (!(err instanceof RemoteProtocolError)) throw err
      fail('l3.notice.offline')
    } finally {
      inFlight.current = false
    }
  }, [apply, client, fail, feedback, routeId])

  const observe = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length === 0 || sessionId === null || inFlight.current) return
      inFlight.current = true
      feedback?.stop()
      setState((s) => ({ ...s, busy: true, notice: null, noticeKey: null, diagnosticCode: undefined,
        action: s.action?.confirmation ? { ...s.action, confirmation: undefined } : s.action }))
      try {
        const result = await client.observe(sessionId, trimmed, location())
        apply(result.session, result.action, result.expects)
      } catch (err) {
        if (!(err instanceof RemoteProtocolError)) throw err
        fail('l3.notice.offline')
      } finally {
        inFlight.current = false
      }
    },
    [apply, client, fail, feedback, location, sessionId],
  )

  const done = useCallback(async () => {
    if (sessionId === null || inFlight.current || state.expects !== 'walker' || state.action?.confirmation) return
    inFlight.current = true
    feedback?.stop()
    setState((s) => ({ ...s, busy: true, notice: null, noticeKey: null, diagnosticCode: undefined }))
    try {
      const result = await client.confirmDone(sessionId)
      apply(result.session, result.action, result.expects)
    } catch (err) {
      if (!(err instanceof RemoteProtocolError)) throw err
      fail('l3.notice.offline')
    } finally {
      inFlight.current = false
    }
  }, [apply, client, fail, feedback, sessionId, state.action, state.expects])

  const confirmContinuation = useCallback(async (answer: TextContinuationAnswer['answer']) => {
    const confirmation = state.action?.confirmation
    if (sessionId === null || inFlight.current || !confirmation || state.expects !== 'evidence') return
    inFlight.current = true
    feedback?.stop()
    setState((s) => ({ ...s, busy: true, notice: null, noticeKey: null, diagnosticCode: undefined }))
    try {
      const result = await client.confirmContinuation(sessionId, { id: confirmation.id, answer }, location())
      apply(result.session, result.action, result.expects)
    } catch (err) {
      if (!(err instanceof RemoteProtocolError)) throw err
      if (err.status === 409) {
        feedback?.stop()
        setState((s) => ({ ...s, busy: false,
          action: s.action ? { ...s.action, confirmation: undefined, question: outdoorStrings('zh-TW')['l3.reanchor.question'] } : null,
          notice: message('l3.confirmation.expired'), noticeKey: 'l3.confirmation.expired',
        }))
      } else {
        fail('l3.notice.offline')
      }
    } finally {
      inFlight.current = false
    }
  }, [apply, client, fail, feedback, location, sessionId, state.action, state.expects])

  const observePhoto = useCallback(
    async (file: Blob) => {
      if (sessionId === null || inFlight.current) return
      inFlight.current = true
      feedback?.photo('photo.wait')
      setState((s) => ({ ...s, busy: true, notice: message('l3.photo.reading'), noticeKey: 'l3.photo.reading',
        action: s.action?.confirmation ? { ...s.action, confirmation: undefined } : s.action }))
      stillWorking.current = setTimeout(
        () => {
          feedback?.photo('photo.wait2')
          setState((s) => (s.busy ? { ...s, notice: message('l3.photo.stillWorking'), noticeKey: 'l3.photo.stillWorking' } : s))
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
            ? 'l3.photo.unreadable'
            : err instanceof RemoteProtocolError && err.status === 429
              ? 'l3.photo.limit'
              : err instanceof RemoteProtocolError
                ? 'l3.notice.offline'
                : null
        if (notice === null) throw err
        const diagnostic = photoCheck && err instanceof PhotoPrepareError ? await photoDiagnostic(err, file) : null
        fail(notice, diagnostic ?? undefined)
      } finally {
        inFlight.current = false
      }
    },
    [apply, client, fail, feedback, location, photoCheck, sessionId],
  )

  return { state, sessionId, start, observe, observePhoto, done, confirmContinuation }
}
