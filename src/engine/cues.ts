import type { Cue, Instruction, NavState } from './types'

/**
 * (state, instruction) -> Cue. A pure function, deliberately living in the
 * engine and not in a React effect: the bird must be drivable without any
 * screen being open.
 *
 * There is no alarm cue. RESTING looks exactly like idle from the outside —
 * that is the entire point of the feature.
 */
export function deriveCue(state: NavState, instruction: Instruction): Cue {
  if (state.posture === 'RESTING') return 'QUIET'
  // Nothing has started, or an explicit wait: there is nothing to be unsure about.
  if (instruction.intent === 'NONE' || instruction.intent === 'WAIT') return 'QUIET'
  if (instruction.intent === 'ARRIVED') return 'ARRIVED'
  if (state.posture === 'NEEDS_HELP') return 'ASK'
  if (state.band === 'UNKNOWN' || instruction.intent === 'ASK_DIRECTION') return 'ASK'
  if (instruction.turn === 'LEFT') return 'LEFT'
  if (instruction.turn === 'RIGHT') return 'RIGHT'
  if (state.progress === 'AT_CHECKPOINT') return 'READY'
  return 'QUIET'
}
