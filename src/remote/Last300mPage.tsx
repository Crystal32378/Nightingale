import { useMemo, useState, type FormEvent } from 'react'
import { VirtualBirdAdapter } from '../adapters/virtual'
import { NightingaleBird } from '../ui/NightingaleBird'
import { Last300mClient } from './last300mClient'
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

const API_BASE = (import.meta.env.VITE_LAST300M_API as string | undefined) ?? 'http://localhost:8080'
const ROUTE_ID = (import.meta.env.VITE_LAST300M_ROUTE as string | undefined) ?? 'fixture-hospital-001'

export function Last300mPage() {
  const bird = useMemo(() => new VirtualBirdAdapter(), [])
  const client = useMemo(() => new Last300mClient(API_BASE), [])
  const { state, start, observe } = useLast300m(client, bird, ROUTE_ID)
  const [draft, setDraft] = useState('')

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
        <button className="l3-primary" onClick={() => void start()} disabled={state.busy}>
          {LAST300M_ZH['l3.start.button']}
        </button>
        {state.notice ? <p className="l3-notice">{state.notice}</p> : null}
      </div>
    )
  }

  return (
    <div className="l3-page">
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
          <button
            className="l3-secondary"
            onClick={() => void observe(LAST300M_ZH['l3.help.utterance'])}
            disabled={state.busy}
          >
            {LAST300M_ZH['l3.button.help']}
          </button>
        </>
      )}

      {state.notice ? <p className="l3-notice">{state.notice}</p> : null}
    </div>
  )
}
