import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { VirtualBirdAdapter } from '../adapters/virtual'
import { DestinationClient, type DestinationAnswer } from '../destination/client'
import { planFor } from '../destination/plan'
import type { Instruction } from '../engine/types'
import type { Locale } from '../registry/types'
import { label, materialize, render, renderPlace } from '../render/renderer'
import { DEMO_VISIT, MOCK_VENUE } from '../venue/mock'
import { AskCard, acknowledgeFocusReturn, wantFocusReturn } from './AskCard'
import { DevPanel } from './DevPanel'
import {
  IconAsk,
  IconCurrent,
  IconDestination,
  IconDone,
  IconRest,
  IconResume,
  IconRoute,
  LogoMark,
} from './icons'
import type { MotionInput } from './birdMotion'
import { reduceIdleTrigger, type IdleTrigger } from './motionTrigger'
import { NightingaleBird } from './NightingaleBird'
import { useNightingale } from './useNightingale'
import { stopSpeaking } from './speech'
import { visualLines } from './visualText'
import { VolumeControl } from './VolumeControl'

/**
 * Reads the OS reduced-motion preference once per render and re-renders the
 * moment the user flips the switch — so the bird goes quiet immediately,
 * without waiting for the next cue change.
 */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * An arrow is a claim about direction, so it is drawn from the instruction and
 * from nothing else. No live turn, no arrow.
 */
function InstructionArrow({ instruction }: { instruction: Instruction }) {
  if (instruction.intent === 'GO') {
    return (
      <svg className="arrow" viewBox="0 0 40 40" aria-hidden="true">
        <path d="M20 34 V9" />
        <path d="M11 18 L20 8 L29 18" />
      </svg>
    )
  }
  if (instruction.intent === 'TURN' && instruction.turn !== null) {
    return (
      <svg
        className="arrow"
        viewBox="0 0 40 40"
        aria-hidden="true"
        style={instruction.turn === 'LEFT' ? { transform: 'scaleX(-1)' } : undefined}
      >
        <path d="M11 34 V20 C11 15 14 12 19 12 H30" />
        <path d="M24 6 L31 12 L24 18" />
      </svg>
    )
  }
  return null
}

const VOICE_LANG: Record<Locale, string> = { 'zh-TW': 'zh-TW', en: 'en-US' }

export function App() {
  const adapter = useMemo(() => new VirtualBirdAdapter(), [])
  const appRef = useRef<HTMLDivElement>(null)
  // Same switch as the outdoor flow: ?lang=en. Changing it changes words only;
  // the visit, the typed text and any pending or answered query stay as they are.
  const [locale, setLocale] = useState<Locale>(() =>
    new URLSearchParams(window.location.search).get('lang') === 'en' ? 'en' : 'zh-TW',
  )
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  const switchLocale = (next: Locale) => {
    // A sentence already being spoken belongs to the old screen.
    stopSpeaking()
    setLocale(next)
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState(null, '', url)
  }
  const t = (key: Parameters<typeof label>[0]) => label(key, { locale })
  const ng = useNightingale(adapter, locale)
  const { output, actions } = ng

  // Dev-only IDLE motion triggers (L1 glance / L2 gaze). Sealed inside App:
  // never derived from engine state, never forwarded to the engine. Each
  // trigger is single-shot — armed on press, consumed by the sequence.
  const [idleTrigger, setIdleTrigger] = useState<IdleTrigger | null>(null)
  const armIdleTrigger = (kind: IdleTrigger['kind']) => {
    const now = Date.now()
    setIdleTrigger((current) => reduceIdleTrigger(current, { kind, pressedAtMs: now }, now))
  }
  const motionInput: MotionInput = {
    cue: ng.cue,
    listenActive: false,
    l1Triggered: idleTrigger?.kind === 'L1',
    l2Triggered: idleTrigger?.kind === 'L2',
    sequenceStartedAtMs: idleTrigger?.startedAtMs ?? 0,
    now: Date.now(),
    reducedMotion: useReducedMotion(),
  }

  // Where the person says they want to go, before the visit starts. Only ever
  // a destination: where they are still comes from a QR scan or a button.
  const destinationClient = useMemo(() => new DestinationClient(), [])
  const [whereText, setWhereText] = useState('')
  const [finding, setFinding] = useState(false)
  const [answer, setAnswer] = useState<(DestinationAnswer & { requestId: number }) | null>(null)
  const whereInputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  // Editing, rejecting or leaving this question invalidates every older
  // request, even if the person later types exactly the same words again.
  const clearDestination = useCallback(() => {
    requestId.current += 1
    setAnswer(null)
    setFinding(false)
  }, [])
  useEffect(() => () => { requestId.current += 1 }, [])
  // Also covers a resumed visit and an ask card opened by the bird's button.
  useEffect(() => {
    if (ng.started || ng.askOpen) clearDestination()
  }, [ng.started, ng.askOpen, clearDestination])

  const findWay = async (event: React.FormEvent) => {
    event.preventDefault()
    if (finding || ng.started || ng.askOpen || !whereText.trim()) return
    clearDestination()
    const submittedId = requestId.current
    setFinding(true)
    const result = await destinationClient.interpret(whereText)
    // An obsolete reply must not update the answer OR stop a newer spinner.
    if (submittedId !== requestId.current) return
    setAnswer({ ...result, requestId: submittedId })
    setFinding(false)
  }
  // A recognised place is asked about once; nothing starts until 對. The
  // line goes through the validator, so an unverified place comes back as
  // 我不確定。我陪你問。 with no 對 to press.
  const confirmLine =
    answer?.destination.kind === 'place'
      ? render({ key: 'label.confirm', params: { placeId: answer.destination.placeId } }, { instruction: null, now: ng.now }, { locale })
      : null
  const confirmable = !finding && answer?.requestId === requestId.current && confirmLine !== null && !confirmLine.fallbackUsed
  const answerText = confirmLine ? confirmLine.screen : materialize({ key: 'guidance.uncertain' }, { locale })
  const confirmDestination = () => {
    if (!answer || !confirmable || answer.requestId !== requestId.current) return
    const plan = planFor(answer.destination)
    clearDestination()
    setWhereText('')
    if (plan.kind === 'walk') actions.startAt(plan.legIndex)
    else if (plan.kind === 'ask') actions.askAbout(plan.placeId)
  }
  const rejectDestination = () => {
    clearDestination()
    whereInputRef.current?.focus()
  }
  // The demo is an explicit alternative on the empty screen, never the next
  // step of a pending, uncertain or rejected destination query.
  const canStartDemo = !ng.started && !finding && !answer && !whereText.trim()
  const startVisit = () => {
    if (!canStartDemo) return
    clearDestination()
    setWhereText('')
    actions.start()
  }
  const resetVisit = () => {
    clearDestination()
    setWhereText('')
    actions.reset()
  }

  const leg = DEMO_VISIT[ng.visit ? Math.min(ng.visit.legIndex, DEMO_VISIT.length - 1) : 0]
  const resting = output.state.posture === 'RESTING'
  const arrived = output.state.progress === 'ARRIVED'

  // "下一個：掛號櫃台" / "Next: Registration Counter" shown as a label and a
  // name. Presentation of one verified string, broken where it is already
  // punctuated — not a second string.
  const nextParts = ng.checkpoint ? ng.checkpoint.screen.split(/：|: /) : null

  const currentNodeId = ng.visit?.lastObservation?.nodeId ?? null
  const currentPlace = currentNodeId ? renderPlace(MOCK_VENUE.nodes[currentNodeId]?.placeId ?? null, ng.now, { locale }) : null
  const destinationPlace = ng.started ? renderPlace(leg.destinationId, ng.now, { locale }) : null

  const guidanceText = ng.guidance.screen
  const instructionClass = [
    'instruction',
    guidanceText.length === 0 ? 'empty' : '',
    ng.guidance.key === 'guidance.uncertain' || ng.guidance.fallbackUsed ? 'uncertain' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // While the ask card is open, the background goes inert: nothing behind the
  // card can take focus, be clicked, or be announced. When it closes, the
  // background wakes exactly as it was.
  useEffect(() => {
    const el = appRef.current
    if (!el) return
    if (ng.askOpen) {
      el.setAttribute('inert', '')
    } else {
      el.removeAttribute('inert')
    }
  }, [ng.askOpen])

  // The card and the inert background are a pair. Focus must come home only
  // AFTER the inert flag lifts, or the focus attempt lands on an inert button
  // and silently falls to <body>. The card asks; this effect answers.
  useEffect(() => {
    if (!ng.askOpen && wantFocusReturn) {
      acknowledgeFocusReturn()
      document.querySelector<HTMLElement>('[data-ask-trigger]')?.focus()
    }
  }, [ng.askOpen])

  // Three scenes, three protagonists. Idle: the bird. Guiding: the sentence.
  // Resting: the silence. The layout knows which scene it is in.
  const scene = !ng.started ? 'idle' : resting ? 'rest' : 'guide'
  const volumeLabels = { level: t('label.volume.level'), down: t('label.volume.down'), up: t('label.volume.up') }

  return (
    <>
      <div className="app" data-scene={scene} ref={appRef}>
      <header className="masthead">
        <div className="brand">
          <LogoMark />
          <div>
            <h1 className="wordmark">Nightingale</h1>
            <p className="tagline">Walk with you</p>
          </div>
        </div>
        {/* Nothing is shown while resting. Silence includes the status line. */}
        {ng.started && !resting ? (
          <span className="status">
            {arrived ? <IconDone /> : <IconRoute />}
            {arrived ? t('label.arrived') : t('label.underway')}
          </span>
        ) : null}
      </header>

      <NightingaleBird cue={ng.cue} motionInput={motionInput} />

      <div className="next">
        {nextParts && nextParts.length === 2 ? (
          <>
            <p className="label">{nextParts[0]}</p>
            <p className="place">{nextParts[1]}</p>
          </>
        ) : null}
      </div>

      <div className={instructionClass}>
        <InstructionArrow instruction={output.instruction} />
        {guidanceText.length > 0 ? <p className="text">{visualLines(guidanceText).join('\n')}</p> : null}
      </div>

      <div className="meta">
        <div>
          <p className="label">
            <IconCurrent />
            {t('label.current')}
          </p>
          <p className="value">{currentPlace ?? '—'}</p>
        </div>
        <div className="rule" />
        <div>
          <p className="label">
            <IconDestination />
            {t('label.destination')}
          </p>
          <p className="value">{destinationPlace ?? '—'}</p>
        </div>
      </div>

      {!ng.started ? (
        <form className="where" onSubmit={findWay}>
          <label className="label" htmlFor="where-text">
            {t('label.where')}
          </label>
          <div className="where-row">
            <input
              id="where-text"
              ref={whereInputRef}
              // Where focus comes home after an ask card opened from here.
              data-ask-trigger
              value={whereText}
              onChange={(event) => {
                clearDestination()
                setWhereText(event.target.value)
              }}
              maxLength={200}
              enterKeyHint="go"
              autoComplete="off"
              aria-describedby="where-privacy"
            />
            <button type="submit" disabled={finding || !whereText.trim()}>
              {t('label.find')}
            </button>
          </div>
          <p className="privacy" id="where-privacy">
            {t('label.privacy')}
          </p>
          <div className="answer" aria-live="polite">
            {answer ? (
              <>
                <p>
                  <span className="mode">{t(answer.mode === 'nemotron' ? 'label.mode.nemotron' : 'label.mode.mock')}</span>
                  {answerText}
                </p>
                {confirmable ? (
                  <div className="confirm">
                    <button type="button" className="primary" onClick={confirmDestination}>
                      {t('label.yes')}
                    </button>
                    <button type="button" onClick={rejectDestination}>
                      {t('label.no')}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="actions">
        {!ng.started ? (
          // A confirmed destination has its own 對／不是 choice. Everywhere
          // else the person can ask for help without choosing a destination.
          confirmable ? null : (
            <>
              <button className="primary wide" data-ask-trigger onClick={actions.askForMe}>
                <IconAsk />
                {t('label.ask')}
              </button>
              {canStartDemo ? (
                <button className="wide" onClick={startVisit}>
                  <IconResume />
                  {t('label.start')}
                </button>
              ) : null}
            </>
          )
        ) : (
          <>
            <button className="primary" data-ask-trigger onClick={actions.askForMe}>
              <IconAsk />
              {t('label.ask')}
            </button>
            {resting ? (
              <button onClick={() => actions.setPosture('MOVING')}>
                <IconResume />
                {t('label.resume')}
              </button>
            ) : (
              <button onClick={() => actions.setPosture('RESTING')}>
                <IconRest />
                {t('label.rest')}
              </button>
            )}
          </>
        )}
      </div>

      {/* The bird's voice, one reach above the thumb's resting place. Always
          visible: a volume control you must go find is one you never adjust.
          Icon and bars only — no words to misread. */}
      <VolumeControl context="PRIVATE" labels={volumeLabels} />

      {/* Below the fold on purpose: a setting, not part of the walk. */}
      <select
        className="language"
        aria-label="Language / 語言"
        value={locale}
        onChange={(event) => switchLocale(event.target.value === 'en' ? 'en' : 'zh-TW')}
      >
        <option value="zh-TW">繁體中文</option>
        <option value="en">English</option>
      </select>

      <DevPanel
        output={output}
        cue={ng.cue}
        lastEvent={ng.lastEvent}
        timeShiftMs={ng.timeShiftMs}
        guidanceKey={ng.guidance.key}
        fallbackUsed={ng.guidance.fallbackUsed}
        onSimulateCheckpoint={() => {
          if (output.nextCheckpointNodeId) actions.observe(output.nextCheckpointNodeId, 'QR')
          else actions.advanceLeg()
        }}
        onSimulateArrival={() => actions.observe(leg.destinationNodeId, 'QR')}
        onShortPress={actions.simulateShortPress}
        onLongPress={actions.simulateLongPress}
        onDecay={actions.decay}
        onTriggerIdleGlance={() => armIdleTrigger('L1')}
        onTriggerIdleGaze={() => armIdleTrigger('L2')}
        onReset={resetVisit}
      />
      </div>

      {ng.askOpen ? (
        <AskCard
          text={ng.ask.screen}
          onClose={actions.closeAsk}
          lang={VOICE_LANG[locale]}
          labels={{ again: t('label.again'), done: t('label.done'), volume: volumeLabels }}
        />
      ) : null}
    </>
  )
}
