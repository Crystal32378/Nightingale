import type { Cue } from '../engine/types'

/**
 * Last-300m remote engine → bird cue mapping.
 *
 * The outdoor route server (Cloud Run) owns route truth for the segment
 * "transit exit → hospital entrance" and answers every observation with one
 * action. The bird only needs to know which of its states that action is.
 *
 * Deliberately never LEFT / RIGHT: those cues require an installation-derived
 * facing prior (a wall the person had to face), and the outdoor route has
 * none. Same rule as the indoor engine — no orientation prior, no turn cues.
 */

export type RemoteActionType =
  | 'GUIDE'
  | 'ASK'
  | 'RECOVER'
  | 'REANCHOR'
  | 'CONFIRM_ARRIVAL'

export function cueForAction(type: RemoteActionType): Cue {
  switch (type) {
    case 'GUIDE':
      return 'READY'
    case 'RECOVER':
      // Recovery is still a next step to take, not an alarm. There is no
      // red state anywhere in this product; the text carries the turn-around.
      return 'READY'
    case 'ASK':
      return 'ASK'
    case 'REANCHOR':
      // Re-anchoring asks the person what they see. From the bird's point of
      // view that is the same posture as asking a question.
      return 'ASK'
    case 'CONFIRM_ARRIVAL':
      return 'ARRIVED'
  }
}
