import type { EngineOutput } from '../engine/engine'
import type { Cue } from '../engine/types'

export interface DevPanelProps {
  output: EngineOutput
  cue: Cue
  lastEvent: string | null
  timeShiftMs: number
  guidanceKey: string
  fallbackUsed: boolean
  onSimulateCheckpoint: () => void
  onShortPress: () => void
  onLongPress: () => void
  onDecay: () => void
  onSimulateArrival: () => void
  onReset: () => void
  onTriggerIdleGlance: () => void
  onTriggerIdleGaze: () => void
}

export function DevPanel(props: DevPanelProps) {
  const { output, cue, lastEvent, timeShiftMs, guidanceKey, fallbackUsed } = props
  return (
    <details className="dev">
      <summary>dev panel</summary>
      <div className="dev-grid">
        <button onClick={props.onSimulateCheckpoint}>simulate checkpoint</button>
        <button onClick={props.onSimulateArrival}>simulate arrival</button>
        <button onClick={props.onShortPress}>simulate short press</button>
        <button onClick={props.onLongPress}>simulate long press</button>
        <button onClick={props.onDecay}>simulate confidence decay</button>
        <button onClick={props.onTriggerIdleGlance}>trigger idle glance (L1)</button>
        <button onClick={props.onTriggerIdleGaze}>trigger idle gaze (L2)</button>
        <button onClick={props.onReset}>reset visit</button>
      </div>
      <div className="dev-readout">
        <span>
          last cue <b>{cue}</b>
        </span>
        <span>
          last bird event <b>{lastEvent ?? '—'}</b>
        </span>
        <span>
          progress <b>{output.state.progress}</b> · band <b>{output.state.band}</b> · posture{' '}
          <b>{output.state.posture}</b>
        </span>
        <span>
          confidence <b>{output.state.confidence.toFixed(3)}</b> · clock offset <b>+{Math.round(timeShiftMs / 1000)}s</b>
        </span>
        <span>
          string key <b>{guidanceKey}</b>
          {fallbackUsed ? ' (validator fallback)' : ''}
        </span>
        <span>
          engine response <b>{JSON.stringify({ ...output, state: undefined })}</b>
        </span>
      </div>
    </details>
  )
}
