import { useMemo } from 'react'
import { VirtualBirdAdapter } from '../adapters/virtual'
import type { Instruction } from '../engine/types'
import { label, renderPlace } from '../render/renderer'
import { DEMO_VISIT, MOCK_VENUE } from '../venue/mock'
import { AskCard } from './AskCard'
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
import { NightingaleBird } from './NightingaleBird'
import { useNightingale } from './useNightingale'
import { visualLines } from './visualText'
import { VolumeControl } from './VolumeControl'

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

export function App() {
  const adapter = useMemo(() => new VirtualBirdAdapter(), [])
  const ng = useNightingale(adapter)
  const { output, actions } = ng

  const leg = DEMO_VISIT[ng.visit ? Math.min(ng.visit.legIndex, DEMO_VISIT.length - 1) : 0]
  const resting = output.state.posture === 'RESTING'
  const arrived = output.state.progress === 'ARRIVED'

  // "下一個：掛號櫃台" shown as a label and a name. Presentation of one verified
  // string, broken where it is already punctuated — not a second string.
  const nextParts = ng.checkpoint ? ng.checkpoint.screen.split('：') : null

  const currentNodeId = ng.visit?.lastObservation?.nodeId ?? null
  const currentPlace = currentNodeId ? renderPlace(MOCK_VENUE.nodes[currentNodeId]?.placeId ?? null, ng.now) : null
  const destinationPlace = ng.started ? renderPlace(leg.destinationId, ng.now) : null

  const guidanceText = ng.guidance.screen
  const instructionClass = [
    'instruction',
    guidanceText.length === 0 ? 'empty' : '',
    ng.guidance.key === 'guidance.uncertain' || ng.guidance.fallbackUsed ? 'uncertain' : '',
  ]
    .filter(Boolean)
    .join(' ')

  // Three scenes, three protagonists. Idle: the bird. Guiding: the sentence.
  // Resting: the silence. The layout knows which scene it is in.
  const scene = !ng.started ? 'idle' : resting ? 'rest' : 'guide'

  return (
    <div className="app" data-scene={scene}>
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
            {arrived ? label('label.arrived') : label('label.underway')}
          </span>
        ) : null}
      </header>

      <NightingaleBird cue={ng.cue} />

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
            {label('label.current')}
          </p>
          <p className="value">{currentPlace ?? '—'}</p>
        </div>
        <div className="rule" />
        <div>
          <p className="label">
            <IconDestination />
            {label('label.destination')}
          </p>
          <p className="value">{destinationPlace ?? '—'}</p>
        </div>
      </div>

      <div className="actions">
        {!ng.started ? (
          <button className="primary wide" onClick={actions.start}>
            <IconResume />
            {label('label.start')}
          </button>
        ) : (
          <>
            <button className="primary" onClick={actions.askForMe}>
              <IconAsk />
              {label('label.ask')}
            </button>
            {resting ? (
              <button onClick={() => actions.setPosture('MOVING')}>
                <IconResume />
                {label('label.resume')}
              </button>
            ) : (
              <button onClick={() => actions.setPosture('RESTING')}>
                <IconRest />
                {label('label.rest')}
              </button>
            )}
          </>
        )}
      </div>

      {/* The bird's voice, one reach above the thumb's resting place. Always
          visible: a volume control you must go find is one you never adjust.
          Icon and bars only — no words to misread. */}
      <VolumeControl context="PRIVATE" />

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
        onReset={actions.reset}
      />

      {ng.askOpen ? <AskCard text={ng.ask.screen} onClose={actions.closeAsk} /> : null}
    </div>
  )
}
