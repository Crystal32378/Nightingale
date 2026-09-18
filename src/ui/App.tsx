import { useMemo } from 'react'
import { VirtualBirdAdapter } from '../adapters/virtual'
import { DEMO_VISIT } from '../venue/mock'
import { AskCard } from './AskCard'
import { DevPanel } from './DevPanel'
import { NightingaleBird } from './NightingaleBird'
import { useNightingale } from './useNightingale'

export function App() {
  const adapter = useMemo(() => new VirtualBirdAdapter(), [])
  const ng = useNightingale(adapter)
  const { output, actions } = ng
  const leg = DEMO_VISIT[ng.visit ? Math.min(ng.visit.legIndex, DEMO_VISIT.length - 1) : 0]
  const resting = output.state.posture === 'RESTING'

  return (
    <div className="app">
      <div className="topline">
        <span>Nightingale</span>
        <span>{ng.started ? `${output.state.band.toLowerCase()}` : 'phase 1'}</span>
      </div>

      <div className="stage">
        <NightingaleBird cue={ng.cue} />
        <p className="checkpoint">{ng.checkpoint ? ng.checkpoint.screen : ''}</p>
        <p className="guidance">{ng.guidance.screen}</p>
      </div>

      <div className="controls">
        {!ng.started ? (
          <button className="primary wide" onClick={actions.start}>
            開始
          </button>
        ) : (
          <>
            <button className="primary" onClick={actions.askForMe}>
              幫我問
            </button>
            {resting ? (
              <button onClick={() => actions.setPosture('MOVING')}>繼續</button>
            ) : (
              <button onClick={() => actions.setPosture('RESTING')}>休息</button>
            )}
          </>
        )}
      </div>

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
