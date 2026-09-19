/**
 * How loud, decided at playback.
 *
 * The audio files are generated at a clean level and never touched again. All
 * loudness lives here, because loudness is a property of the room and the ear,
 * not of the sentence. Baking it into the file means every listener gets the
 * level that suited whoever happened to be in the room when it was made.
 *
 * Two things this module refuses to be:
 *
 * 1. A slider. A slider asks someone standing in a corridor, already lost, to
 *    solve a calibration problem. A step is one decision; a slider is a hundred.
 *
 * 2. One number for the whole product. Guidance is heard by the person holding
 *    the phone. The ask utterance is heard by a stranger across a counter, over
 *    a queue. Those are different distances and they were never the same job —
 *    see the note at the bottom of profiles.ts, where this was first written
 *    down and deliberately not solved at synthesis time.
 */

/** Who the sound has to reach. */
export type ListeningContext =
  /** the person holding the phone */
  | 'PRIVATE'
  /** someone on the other side of a counter */
  | 'PUBLIC'

export type Level = 0 | 1 | 2 | 3

export const LEVELS: Level[] = [0, 1, 2, 3]

/**
 * Linear gain per step, roughly 4 dB apart. Four steps span about 12 dB, which
 * is the range between "quiet office" and "outpatient hall at ten in the
 * morning" — wide enough to matter, short enough to walk up by pressing a
 * button twice.
 */
export const LEVEL_GAIN: Record<Level, number> = {
  0: 1.0,
  1: 1.6,
  2: 2.5,
  3: 4.0,
}

/**
 * Where each context starts.
 *
 * PUBLIC starts one step up because it always has a counter to cross. That is
 * not a preference, it is the geometry of the situation.
 */
export const DEFAULT_LEVEL: Record<ListeningContext, Level> = {
  PRIVATE: 0,
  PUBLIC: 1,
}

export type ListeningLevels = Record<ListeningContext, Level>

export const DEFAULT_LEVELS: ListeningLevels = { ...DEFAULT_LEVEL }

/** One step up, capped. Already at the top is not an error — it is just the top. */
export function louder(level: Level): Level {
  return Math.min(level + 1, 3) as Level
}

/** One step down, floored. There must always be a way back. */
export function softer(level: Level): Level {
  return Math.max(level - 1, 0) as Level
}

export function atCeiling(level: Level): boolean {
  return level === 3
}

export function atFloor(level: Level): boolean {
  return level === 0
}

/**
 * What pressing 再說一遍 does to the level.
 *
 * Asking to hear something again is evidence, not just a request: the most
 * likely reason is that it was not heard. So a repeat raises the level by one
 * and keeps it there. The person never has to find a setting, and the phone
 * stops being quiet at them.
 *
 * The risk is the opposite case — someone repeats because they were distracted,
 * and the phone gets needlessly loud. That is why `softer` exists and why the
 * ceiling is four steps rather than open ended.
 */
export function levelAfterRepeat(level: Level): Level {
  return louder(level)
}

export function gainFor(levels: ListeningLevels, context: ListeningContext): number {
  return LEVEL_GAIN[levels[context]]
}

export function setLevel(levels: ListeningLevels, context: ListeningContext, level: Level): ListeningLevels {
  return { ...levels, [context]: level }
}

export function raise(levels: ListeningLevels, context: ListeningContext): ListeningLevels {
  return setLevel(levels, context, louder(levels[context]))
}

export function lower(levels: ListeningLevels, context: ListeningContext): ListeningLevels {
  return setLevel(levels, context, softer(levels[context]))
}

/**
 * Whether the playback graph has to compress before it amplifies.
 *
 * Gain above 1 on a file that already peaks near full scale clips, and a
 * clipped consonant is the exact failure this product cannot afford: 左 and 右
 * are told apart by their consonants, not their vowels. So anything above unity
 * goes through a compressor first. Louder, not broken.
 */
export function needsCompression(gain: number): boolean {
  return gain > 1
}

/** Which context a spoken string belongs to. Derived from the key, never passed in by a caller. */
export function contextForKey(key: string): ListeningContext {
  return key === 'ask.utterance' ? 'PUBLIC' : 'PRIVATE'
}

/** For storage. Anything unrecognised falls back to the default rather than throwing. */
export function parseLevels(value: unknown): ListeningLevels {
  if (typeof value !== 'object' || value === null) return { ...DEFAULT_LEVELS }
  const record = value as Record<string, unknown>
  const read = (context: ListeningContext): Level => {
    const raw = record[context]
    return LEVELS.includes(raw as Level) ? (raw as Level) : DEFAULT_LEVEL[context]
  }
  return { PRIVATE: read('PRIVATE'), PUBLIC: read('PUBLIC') }
}
