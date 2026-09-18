import type { Instruction, NavState } from './types'

/**
 * What the engine is allowed to hand to anything above it.
 *
 * Note what is absent: the route. A presentation layer physically cannot show
 * the remaining path, because it was never given one.
 */
export interface EngineOutputShape {
  state: NavState
  /** The single next checkpoint. Never a list. */
  nextCheckpointNodeId: string | null
  /** Registry key for the next checkpoint's verified name. Never a display string. */
  nextCheckpointPlaceId: string | null
  instruction: Instruction
}
