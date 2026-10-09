import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { VirtualBirdAdapter } from '../adapters/virtual'
import { acknowledgeFocusReturn, AskCard, wantFocusReturn } from '../ui/AskCard'
import { IconAsk, IconCamera, IconCrossing, IconCurrent, IconDestination, IconExit, IconHospital, IconWalk } from '../ui/icons'
import { NightingaleBird } from '../ui/NightingaleBird'
import { Last300mClient, RemoteProtocolError, type LocationReport, type RemoteAction, type RouteInfo } from './last300mClient'
import { RemoteGuidanceText } from './RemoteGuidanceText'
import { doneLabelFor, stepCardFor, type StepIcon } from './stepCard'
import { outdoorStrings, type OutdoorLocale } from './locale'
import { useLast300m } from './useLast300m'
import { createOutdoorPlayer, outdoorKeysFor, type OutdoorVoice } from './outdoorVoice'
import { createHelpPlayer } from './helpVoice'
import { UNKNOWN_ZONE, zoneFor, type RouteZone } from './zone'
import { VoiceInput } from './VoiceInput'
import type { VoiceCapture } from './voiceCapture'
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
 * The photo button stays off until 福 passes the three photo gates on the
 * live page; ?photo=1 turns it on for review.
 */
const PHOTO_ENABLED = new URLSearchParams(window.location.search).get('photo') === '1'
const PHOTO_CHECK = new URLSearchParams(window.location.search).get('photoCheck') === '1'

/**
 * Photo input. The first press only reminds (the bird's one spoken line, shown
 * as its words and played from the fixed recording); the camera opens on the
 * person's next press, never by itself. A small line stays under the button,
 * and the full privacy sentence is one tap away. The chosen file goes
 * straight to the hook and the input is cleared, so nothing lingers.
 */
function PhotoInput({ disabled, onPhoto, onRemind, locale }: { disabled: boolean; onPhoto: (file: File) => void; onRemind: () => void; locale: OutdoorLocale }) {
  const copy = outdoorStrings(locale)
  const [reminded, setReminded] = useState(false)
  const [open, setOpen] = useState(false)
  const camera = (label: string) => (
    <label className={`l3-secondary l3-photo-button${disabled ? ' is-disabled' : ''}`}>
      <IconCamera className="l3-btn-icon" />
      {label}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled}
        className="l3-photo-file"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0]
          e.currentTarget.value = ''
          setOpen(false)
          if (file) onPhoto(file)
        }}
      />
    </label>
  )
  return (
    <section className="l3-photo">
      {open ? (
        <div className="l3-photo-remind" role="status">
          <p>{copy['l3.photo.remind']}</p>
          {camera(copy['l3.photo.go'])}
        </div>
      ) : reminded ? (
        camera(copy['l3.photo.button'])
      ) : (
        <button
          className="l3-secondary l3-icon-button"
          disabled={disabled}
          onClick={() => {
            setReminded(true)
            setOpen(true)
            onRemind()
          }}
        >
          <IconCamera className="l3-btn-icon" />
          {copy['l3.photo.button']}
        </button>
      )}
      <p className="l3-photo-small">{copy['l3.photo.small']}</p>
      <details className="l3-photo-details">
        <summary>ⓘ {copy['l3.photo.more']}</summary>
        <p>{copy['l3.photo.privacy']}</p>
      </details>
    </section>
  )
}

const ICONS: Record<StepIcon, () => JSX.Element> = {
  exit: () => <IconExit className="l3-step-icon" />,
  crossing: () => <IconCrossing className="l3-step-icon" />,
  walk: () => <IconWalk className="l3-step-icon" />,
  hospital: () => <IconHospital className="l3-step-icon" />,
}

/**
 * One step on screen: the verified short label and its icon when the step has
 * one; otherwise the server's bounded text. Questions and recoveries always
 * keep their words — they are what the person has to answer or do.
 */
function StepView({ action, locale }: { action: RemoteAction; locale: OutdoorLocale }) {
  const copy = outdoorStrings(locale)
  const card = stepCardFor(ROUTE_ID, action, locale)
  if (!card) return <RemoteGuidanceText action={action} locale={locale} routeId={ROUTE_ID} />
  const full = card.speech.join(locale === 'en' ? ' ' : '')
  return (
    <div className="l3-guidance l3-step" role="group" aria-label={full}>
      {ICONS[card.icon]()}
      <p className="l3-step-label" aria-hidden="true">
        {card.label}
      </p>
      <details className="l3-step-full">
        <summary>{copy['l3.step.full']}</summary>
        {card.speech.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </details>
      {card.signs?.map(sign => <p className="l3-sign-hint" key={sign}><span lang="zh-TW">{sign.split(' — ')[0]}</span>{' — '}{sign.split(' — ')[1]}</p>)}
    </div>
  )
}

/**
 * Keeps the latest route zone while a walk is on. Asked only after 開始, so the
 * permission prompt follows the person's own press. Coordinates are turned
 * into a zone id here and dropped; a denied permission just means no location
 * is ever sent.
 */
function useRouteZone(zones: RouteZone[], active: boolean): () => LocationReport | undefined {
  const zone = useRef<string | null>(null)
  useEffect(() => {
    if (!active || zones.length === 0 || !('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (p) => {
        zone.current = zoneFor(zones, p.coords.latitude, p.coords.longitude, p.coords.accuracy)
      },
      () => {
        zone.current = zone.current === null ? null : UNKNOWN_ZONE
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [active, zones])
  return useMemo(() => () => (zone.current === null ? undefined : { zone: zone.current }), [])
}

/**
 * The route frame: origin → destination, straight from route truth. These are
 * display metadata, not a live position claim — that is why the first row says
 * 起點 and never 目前位置. Fetched once; on failure no rows render, because a
 * failed fetch must never invent place names.
 */
function RouteFrame({ info, locale }: { info: RouteInfo | null; locale: OutdoorLocale }) {
  const copy = outdoorStrings(locale)
  if (!info) return null
  const english = locale === 'en' && info.routeId === 'renai-001'
  return (
    <dl className="l3-route">
      <div className="l3-route-row">
        <dt>
          <IconCurrent />
          {copy['l3.label.origin']}
        </dt>
        <dd>{english ? 'Zhongxiao Fuxing · Exit 2, street level (step-free)' : info.originName}{english ? <small lang="zh-TW">{info.originName}</small> : null}</dd>
      </div>
      <div className="l3-route-row">
        <dt>
          <IconDestination />
          {copy['l3.label.destination']}
        </dt>
        <dd>{english ? 'Taipei City Hospital · Renai Branch, lobby (step-free)' : info.destinationName}{english ? <small lang="zh-TW">{info.destinationName}</small> : null}</dd>
      </div>
    </dl>
  )
}

export function Last300mPage() {
  const [locale, setLocale] = useState<OutdoorLocale>(() => new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'zh-TW')
  const localeRef = useRef(locale); localeRef.current = locale
  const copy = outdoorStrings(locale)
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  useEffect(() => () => { document.documentElement.lang = 'zh-TW' }, [])
  const bird = useMemo(() => new VirtualBirdAdapter(), [])
  const client = useMemo(() => new Last300mClient(API_BASE), [])
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null)
  const [walking, setWalking] = useState(false)
  const zones = useMemo(() => routeInfo?.zones ?? [], [routeInfo])
  const location = useRouteZone(zones, walking)
  const player = useMemo(() => createOutdoorPlayer(), [])
  const helpPlayer = useMemo(() => createHelpPlayer(), [])
  const [voice, setVoice] = useState<OutdoorVoice>('Leda')
  const voiceRef = useRef<OutdoorVoice>('Leda')
  const helpActive = useRef(false)
  const inputActive = useRef(false)
  const voiceInput = useRef<VoiceCapture | null>(null)
  const [inputBusy, setInputBusy] = useState(false)
  const feedback = useMemo(() => ({
    action: (action: RemoteAction) => {
      if (!helpActive.current && !inputActive.current) void player.play(outdoorKeysFor(ROUTE_ID, action, localeRef.current), voiceRef.current, localeRef.current)
    },
    photo: (key: 'photo.wait' | 'photo.wait2') => {
      if (ROUTE_ID === 'renai-001' && !helpActive.current && !inputActive.current) void player.play([key], voiceRef.current, localeRef.current)
    },
    stop: () => player.stop(),
  }), [player])
  const { state, sessionId, start, observe, observePhoto, done, confirmContinuation } = useLast300m(client, bird, ROUTE_ID, location, feedback, PHOTO_CHECK, locale)
  const [draft, setDraft] = useState('')
  const [askOpen, setAskOpen] = useState(false)
  const helpPlayback = useMemo(() => ({
    play: () => {
      if (ROUTE_ID === 'renai-001') void helpPlayer.play(voiceRef.current, localeRef.current, outdoorStrings(localeRef.current)['l3.ask.utterance'])
    },
    stop: helpPlayer.stop,
    muted: voice === 'quiet',
  }), [helpPlayer, voice])
  useEffect(() => () => player.dispose(), [player])
  useEffect(() => () => helpPlayer.dispose(), [helpPlayer])
  const unlock = () => { if (voiceRef.current !== 'quiet') player.unlock() }
  const playLocal = (keys: string[]) => {
    if (ROUTE_ID !== 'renai-001' || inputActive.current) return
    unlock()
    void player.play(keys, voiceRef.current, localeRef.current)
  }
  const languageControl = (
    <label className="l3-language">
      <span>Language / 語言</span>
      <select aria-label="Language / 語言" value={locale} onChange={event => {
        voiceInput.current?.cancel(); player.stop(); window.speechSynthesis?.cancel()
        const next = event.target.value === 'en' ? 'en' : 'zh-TW'
        localeRef.current = next; setLocale(next)
        const url = new URL(window.location.href); url.searchParams.set('lang', next)
        window.history.replaceState(null, '', url)
      }}><option value="zh-TW">繁體中文</option><option value="en">English</option></select>
    </label>
  )
  const voiceControl = (
    <label className="l3-voice">
      {copy['l3.voice.label']}
      <select value={voice} disabled={inputBusy} onChange={(event) => {
        const next = event.target.value as OutdoorVoice
        player.stop()
        voiceRef.current = next
        setVoice(next)
        if (next !== 'quiet') player.unlock()
      }}>
        <option value="Leda">{copy['l3.voice.female']}</option>
        <option value="Puck">{copy['l3.voice.male']}</option>
        <option value="quiet">{copy['l3.voice.quiet']}</option>
      </select>
    </label>
  )

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
    if (state.busy || inputActive.current || !draft.trim()) return
    voiceInput.current?.cancel()
    unlock()
    void observe(draft)
    setDraft('')
  }

  if (state.phase === 'IDLE') {
    return (
      <div className="l3-page l3-cover">
        <h1 className="l3-title">Nightingale</h1>
        <p className="l3-promise">{copy['l3.start.promise']}</p>
        {languageControl}
        <NightingaleBird cue="QUIET" />
        <RouteFrame info={routeInfo} locale={locale} />
        {voiceControl}
        <button
          className="l3-primary"
          onClick={() => {
            setWalking(true)
            unlock()
            void start()
          }}
          disabled={state.busy}
        >
          {copy['l3.start.button']}
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
        {languageControl}
      </header>

      <NightingaleBird cue={state.cue} />

      {state.action ? <StepView action={state.action} locale={locale} /> : null}

      {state.phase === 'ARRIVED' ? (
        <p className="l3-handoff">{copy['l3.arrived.handoff']}</p>
      ) : state.expects === 'walker' ? (
        // Waiting for the walker (at exit 2, mid-crossing): one button, nothing else until it is pressed.
        <button className="l3-primary l3-crossed" onClick={() => { unlock(); void done() }} disabled={state.busy}>
          {doneLabelFor(ROUTE_ID, state.session?.checkpointId, copy['l3.crossed.button'], locale)}
        </button>
      ) : (
        <>
          {state.action?.confirmation ? (
            <div className="l3-confirmation" role="group" aria-label={locale === 'en' ? 'Confirm your position' : '確認目前位置'}>
              <button className="l3-primary" disabled={state.busy}
                onClick={() => { unlock(); void confirmContinuation('confirm') }}>
                {copy['l3.confirmation.yes']}
              </button>
              <button className="l3-secondary" disabled={state.busy}
                onClick={() => { unlock(); void confirmContinuation('cancel') }}>
                {copy['l3.confirmation.cancel']}
              </button>
            </div>
          ) : (
            <>
              <form className="l3-observe" onSubmit={submit}>
                <input
                  className="l3-input"
                  aria-label={locale === 'en' ? 'What can you see?' : '你看到什麼'}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={copy['l3.input.placeholder']}
                  disabled={state.busy || inputBusy}
                  autoComplete="off"
                />
                <button className="l3-primary" type="submit" disabled={state.busy || inputBusy || draft.trim().length === 0}>
                  {copy['l3.input.send']}
                </button>
              </form>
              {sessionId ? <VoiceInput key={`${state.session?.checkpointId}:${JSON.stringify(state.action)}`}
                locale={locale} baseUrl={API_BASE} sessionId={sessionId} control={voiceInput} disabled={state.busy || askOpen}
                beforeStart={() => { player.stop(); window.speechSynthesis?.cancel() }}
                onActive={active => { inputActive.current = active; setInputBusy(active) }}
                onTranscript={setDraft} /> : null}
              {PHOTO_ENABLED ? (
                <PhotoInput locale={locale} disabled={state.busy || inputBusy} onRemind={() => playLocal(['photo.remind'])} onPhoto={(file) => { voiceInput.current?.cancel(); unlock(); void observePhoto(file) }} />
              ) : null}
            </>
          )}
          {/* 幫我問 is Nightingale's ask-a-person move: it opens the question
              card a passerby can read (and the phone can say). It never calls
              the backend, records nothing, and parses no reply. */}
          <button ref={helpRef} className="l3-secondary l3-icon-button" onClick={() => { voiceInput.current?.cancel(); helpActive.current = true; player.stop(); if (voiceRef.current !== 'quiet') helpPlayer.unlock(); setAskOpen(true) }}>
            <IconAsk className="l3-btn-icon" />
            {copy['l3.button.help']}
          </button>
        </>
      )}

      {state.expects !== 'walker' ? (
        <>
          {voiceControl}
          {state.action && outdoorKeysFor(ROUTE_ID, state.action, locale).length > 0 ? (
            <button className="l3-secondary l3-icon-button" disabled={state.busy || inputBusy || voice === 'quiet'}
              onClick={() => { if (state.action) playLocal(outdoorKeysFor(ROUTE_ID, state.action, locale)) }}>
              <IconCurrent className="l3-btn-icon" />{copy['l3.voice.repeat']}
            </button>
          ) : null}
          {ROUTE_ID === 'renai-001' && state.action?.type === 'GUIDE' && state.action.checkpointId === 'cp2x' ? (
            <div className="l3-voice-extras">
              <button className="l3-secondary" disabled={state.busy || inputBusy || voice === 'quiet'} onClick={() => playLocal(['cp2.bike'])}>{copy['l3.voice.bike']}</button>
              <button className="l3-secondary" disabled={state.busy || inputBusy || voice === 'quiet'} onClick={() => playLocal(['cp2.water'])}>{copy['l3.voice.water']}</button>
            </div>
          ) : null}
        </>
      ) : null}

      {state.expects === 'walker' ? null : <RouteFrame info={routeInfo} locale={locale} />}

      {state.notice ? <p className="l3-notice" role="status">{state.notice}</p> : null}
    </div>
    {askOpen ? (
      <AskCard lang={locale === 'en' ? 'en-US' : 'zh-TW'} labels={locale === 'en' ? { again: 'Say it again', done: 'Done', volume: { level: 'Volume {n} of 4', down: 'Quieter', up: 'Louder' } } : undefined} text={copy['l3.ask.utterance']} playback={helpPlayback} volumeLabel={locale === 'en' ? 'Volume' : '音量'} onClose={() => { helpPlayer.stop(); helpActive.current = false; setAskOpen(false) }} />
    ) : null}
    </>
  )
}
