import {
  DEFAULT_LEVELS,
  LEVEL_GAIN,
  contextForKey,
  lower,
  parseLevels,
  raise,
  type Level,
  type ListeningContext,
  type ListeningLevels,
} from '../voice/level'

/**
 * The volume control's state, living outside React so that speech playback can
 * read it without a prop chain.
 *
 * All rules about what a level MEANS stay in src/voice/level.ts — this module
 * only remembers the two current levels (PRIVATE: the bird talking to the
 * person holding the phone; PUBLIC: the ask utterance across a counter) and
 * persists them. It adds no new words to the product: the control is an icon
 * and four bars, because a volume that needs instructions has already failed.
 */

const STORAGE_KEY = 'nightingale.levels.v1'

function load(): ListeningLevels {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_LEVELS }
    return parseLevels(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return { ...DEFAULT_LEVELS }
  }
}

let levels: ListeningLevels = load()
const listeners = new Set<() => void>()

function persist(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(levels))
  } catch {
    // A phone that cannot remember the level just starts at the default. Not an error.
  }
}

function emit(): void {
  listeners.forEach((fn) => fn())
}

export function getLevels(): ListeningLevels {
  return levels
}

export function levelFor(context: ListeningContext): Level {
  return levels[context]
}

export function raiseContext(context: ListeningContext): void {
  levels = raise(levels, context)
  persist()
  emit()
}

export function lowerContext(context: ListeningContext): void {
  levels = lower(levels, context)
  persist()
  emit()
}

/** useSyncExternalStore wiring. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/**
 * What a level means for the Web Speech fallback used in this prototype.
 * SpeechSynthesisUtterance.volume is capped at 1, so the four steps are mapped
 * onto the available headroom, preserving the ~4 dB spacing between steps.
 * The recorded files go through GainNode + compressor instead (see level.ts).
 */
export function speechVolumeFor(key: string): number {
  const gain = LEVEL_GAIN[levels[contextForKey(key)]]
  return Math.min(1, gain * 0.25)
}
