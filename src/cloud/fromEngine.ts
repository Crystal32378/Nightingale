/**
 * Nightingale — engine-to-cloud bridge.
 *
 * Builds a PresentationInput from what the engine already decided plus the
 * deterministic string the renderer already produced. This is the ONLY path
 * cloud presenters may take: they never see the venue graph, never see the
 * remaining route, never see anything but one disclosed step.
 */

import { deriveCue } from '../engine/cues'
import type { EngineOutputShape } from '../engine/engine.types'
import type { CloudTrack, PresentationInput } from './types'

export interface BridgeOptions {
  track: CloudTrack
  /** Verified display name for input.placeName, or null. Looked up by the caller. */
  placeName: string | null
  now: number
}

export function inputFromEngine(
  output: EngineOutputShape,
  baseText: string,
  options: BridgeOptions,
): PresentationInput {
  const turn = output.instruction.turn
  const turnLive =
    turn !== null &&
    output.instruction.turnExpiresAt !== null &&
    options.now < output.instruction.turnExpiresAt
  return {
    baseText,
    placeId: output.instruction.destinationId ?? output.nextCheckpointPlaceId,
    placeName: options.placeName,
    intent: output.instruction.intent,
    cue: deriveCueForInput(output),
    turnLive,
    track: options.track,
  }
}

function deriveCueForInput(output: EngineOutputShape) {
  return deriveCue(output.state, output.instruction)
}
