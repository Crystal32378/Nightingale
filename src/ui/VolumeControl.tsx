import { useSyncExternalStore } from 'react'
import type { ListeningContext } from '../voice/level'
import { getLevels, lowerContext, raiseContext, subscribe } from './volumeStore'

/**
 * The volume control. No label, no settings screen: an icon anyone who has
 * held a phone already knows, four bars, and two big buttons that read
 * "softer" and "louder" in the oldest symbols there are.
 *
 * Four steps, not a slider — a step is one decision, a slider is a hundred
 * (see src/voice/level.ts). The same two buttons serve both listening
 * contexts: PRIVATE on the main screen, PUBLIC while the ask card is open,
 * because that is the sound playing in that moment.
 */
function SpeakerIcon() {
  return (
    <svg className="volume-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 12.5 v7 h5 l6.5 5.5 V7 L11 12.5 Z" fill="currentColor" stroke="none" />
      <path d="M21 11.5 C23 13.2 23 18.8 21 20.5" />
      <path d="M24.5 8.5 C28.2 11.6 28.2 20.4 24.5 23.5" />
    </svg>
  )
}

function LevelBars({ level }: { level: number }) {
  return (
    <span className="volume-bars" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`volume-bar${i <= level ? ' on' : ''}`} style={{ height: `${9 + i * 5}px` }} />
      ))}
    </span>
  )
}

export function VolumeControl({ context }: { context: ListeningContext }) {
  const levels = useSyncExternalStore(subscribe, getLevels)
  const level = levels[context]
  const ariaLabel = `volume ${level + 1} of 4`

  return (
    <div className={`volume volume-${context.toLowerCase()}`} role="group" aria-label={ariaLabel}>
      <SpeakerIcon />
      <button
        type="button"
        className="volume-btn"
        aria-label="volume down"
        disabled={level === 0}
        onClick={() => lowerContext(context)}
      >
        −
      </button>
      <LevelBars level={level} />
      <button
        type="button"
        className="volume-btn"
        aria-label="volume up"
        disabled={level === 3}
        onClick={() => raiseContext(context)}
      >
        +
      </button>
    </div>
  )
}
