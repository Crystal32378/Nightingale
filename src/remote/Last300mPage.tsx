import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { VirtualBirdAdapter } from '../adapters/virtual'
import { acknowledgeFocusReturn, AskCard, wantFocusReturn } from '../ui/AskCard'
import { IconCurrent, IconDestination } from '../ui/icons'
import { NightingaleBird } from '../ui/NightingaleBird'
import { Last300mClient, RemoteProtocolError, type RouteInfo } from './last300mClient'
import { RemoteGuidanceText } from './RemoteGuidanceText'
import { LAST300M_ZH } from './strings'
import { useLast300m } from './useLast300m'
import './last300m.css'

/**
 * Outdoor flow: transit exit → verified hospital entrance. A separate page,
 * mounted via ?flow=last300m — the indoor experience and its boot flow are
 * untouched (福's ruling #2). Layout follows 大G's product mock: bird, next
 * place, one instruction card, current/destination row, one input.
 *
 * On arrival the page hands over explicitly: the entrance is confirmed by
 * evidence, and indoor wayfinding is the next chapter, not this page's job.
 */

const API_BASE =
  (import.meta.env.VITE_LAST300M_API as string | undefined) ??
  'https://nightingale-160543130573.asia-east1.run.app'
const ROUTE_ID = (import.meta.env.VITE_LAST300M_ROUTE as string | undefined) ?? 'renai-001'

/**
 * The route frame: origin → destination, straight from route truth. These are
 * display metadata, not a live position claim — that is why the first row says
 * 起點 and never 目前位置. Fetched once; on failure no rows render, because a
 * failed fetch must never invent place names.
 */
function RouteFrame({ info }: { info: RouteInfo | null }) {
  if (!info) return null
  return (
    <dl className="l3-route">
      <div className="l3-route-row">
        <dt>
          <IconCurrent />
          {LAST300M_ZH['l3.label.origin']}
        </dt>
        <dd>{info.originName}</dd>
      </div>
      <div className="l3-route-row">
        <dt>
          <IconDestination />
          {LAST300M_ZH['l3.label.destination']}
        </dt>
        <dd>{info.destinationName}</dd>
      </div>
    </dl>
  )
}

export function Last300mPage() {
  const bird = useMemo(() => new VirtualBirdAdapter(), [])
  const client = useMemo(() => new Last300mClient(API_BASE), [])
  const { state, start, observe } = useLast300m(client, bird, ROUTE_ID)
  const [draft, setDraft] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)

  // Route frame is display metadata; a failure just means no rows.
  useEffect(() => {
    let cancelled = false
    client.routeInfo(ROUTE_ID).then(
      (info) => {
        if (!cancelled) setRouteInfo(info)
      },
      (err) => {
        if (!(err instanceof RemoteProtocolError)) throw err
      },
    )
    return () => {
      cancelled = true
    }
  }, [client])
  const contentRef = useRef<HTMLDivElement>(null)
  const helpRef = useRef<HTMLButtonElement>(null)

  // Same pair as the indoor App: while the ask card is open the page behind
  // it is inert, and focus comes home to 幫我問 only after inert lifts.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    if (askOpen) el.setAttribute('inert', '')
    else el.removeAttribute('inert')
  }, [askOpen])

  useEffect(() => {
    if (!askOpen && wantFocusReturn) {
      acknowledgeFocusReturn()
      helpRef.current?.focus()
    }
  }, [askOpen])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (state.busy) return
    void observe(draft)
    setDraft('')
  }

  if (state.phase === 'IDLE') {
    return (
      <div className="l3-page l3-cover">
        <h1 className="l3-title">Nightingale</h1>
        <p className="l3-promise">{LAST300M_ZH['l3.start.promise']}</p>
        <NightingaleBird cue="QUIET" />
        <RouteFrame info={routeInfo} />
        <button className="l3-primary" onClick={() => void start()} disabled={state.busy}>
          {LAST300M_ZH['l3.start.button']}
        </button>
        {state.notice ? <p className="l3-notice">{state.notice}</p> : null}
      </div>
    )
  }

  return (
    <>
    <div className="l3-page" ref={contentRef}>
      <header className="l3-header">
        <h1 className="l3-title">Nightingale</h1>
      </header>

      <NightingaleBird cue={state.cue} />

      {state.action ? <RemoteGuidanceText action={state.action} /> : null}

      {state.phase === 'ARRIVED' ? (
        <p className="l3-handoff">{LAST300M_ZH['l3.arrived.handoff']}</p>
      ) : (
        <>
          <form className="l3-observe" onSubmit={submit}>
            <input
              className="l3-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={LAST300M_ZH['l3.input.placeholder']}
              disabled={state.busy}
              autoComplete="off"
            />
            <button className="l3-primary" type="submit" disabled={state.busy || draft.trim().length === 0}>
              {LAST300M_ZH['l3.input.send']}
            </button>
          </form>
          {/* 幫我問 is Nightingale's ask-a-person move: it opens the question
              card a passerby can read (and the phone can say). It never calls
              the backend, records nothing, and parses no reply. */}
          <button ref={helpRef} className="l3-secondary" onClick={() => setAskOpen(true)}>
            {LAST300M_ZH['l3.button.help']}
          </button>
        </>
      )}

      <RouteFrame info={routeInfo} />

      {state.notice ? <p className="l3-notice">{state.notice}</p> : null}
    </div>
    {askOpen ? (
      <AskCard text={LAST300M_ZH['l3.ask.utterance']} onClose={() => setAskOpen(false)} />
    ) : null}
    </>
  )
}
