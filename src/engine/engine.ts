import type {
  EngineOutputShape,
} from './engine.types'
import type {
  Instruction,
  NavEvent,
  NavState,
  Observation,
  Posture,
  VenueGraph,
  VisitLeg,
} from './types'
import { bandOf, confidenceAt } from './confidence'
import { deriveTurn, edgeBetween, findPath, nextNodeId } from './graph'

/** A directional instruction is never valid longer than this. */
export const TURN_TTL_MS = 45_000

/** How long after an observation we still consider the person to be at that checkpoint. */
export const AT_CHECKPOINT_WINDOW_MS = 20_000

export interface EngineInput {
  graph: VenueGraph
  leg: VisitLeg
  lastObservation: Observation | null
  posture: Posture
  now: number
  turnTtlMs?: number
  atCheckpointWindowMs?: number
}

export type EngineOutput = EngineOutputShape

const NO_INSTRUCTION: Instruction = {
  intent: 'NONE',
  turn: null,
  turnExpiresAt: null,
  destinationId: null,
  disclosedSteps: 1,
}

function askInstruction(destinationId: string): Instruction {
  return {
    intent: 'ASK_DIRECTION',
    turn: null,
    turnExpiresAt: null,
    destinationId,
    disclosedSteps: 1,
  }
}

/**
 * The whole engine. Pure: same input, same output, no clock of its own, no IO.
 *
 * The returned object deliberately contains the current state, the NEXT
 * checkpoint and the NEXT instruction — and nothing else. The remaining route
 * is not in the response at all, so one-step-at-a-time cannot be undone by a
 * careless presentation layer.
 */
export function step(input: EngineInput): EngineOutput {
  const {
    graph,
    leg,
    lastObservation,
    posture,
    now,
    turnTtlMs = TURN_TTL_MS,
    atCheckpointWindowMs = AT_CHECKPOINT_WINDOW_MS,
  } = input

  const confidence = confidenceAt(lastObservation ? lastObservation.at : null, now)
  const band = bandOf(confidence)

  if (lastObservation === null) {
    const state: NavState = { progress: 'IN_TRANSIT', confidence, band, posture }
    return { state, nextCheckpointNodeId: null, nextCheckpointPlaceId: null, instruction: NO_INSTRUCTION }
  }

  const arrived = lastObservation.nodeId === leg.destinationNodeId
  const atCheckpoint = now - lastObservation.at <= atCheckpointWindowMs
  const state: NavState = {
    progress: arrived ? 'ARRIVED' : atCheckpoint ? 'AT_CHECKPOINT' : 'IN_TRANSIT',
    confidence,
    band,
    posture,
  }

  if (arrived) {
    return {
      state,
      nextCheckpointNodeId: null,
      nextCheckpointPlaceId: null,
      instruction: {
        intent: 'ARRIVED',
        turn: null,
        turnExpiresAt: null,
        destinationId: leg.destinationId,
        disclosedSteps: 1,
      },
    }
  }

  // An explicit rest is absolute. Nothing is proposed, nothing is counted down.
  if (posture === 'RESTING') {
    return {
      state,
      nextCheckpointNodeId: null,
      nextCheckpointPlaceId: null,
      instruction: {
        intent: 'WAIT',
        turn: null,
        turnExpiresAt: null,
        destinationId: null,
        disclosedSteps: 1,
      },
    }
  }

  if (posture === 'NEEDS_HELP') {
    return { state, nextCheckpointNodeId: null, nextCheckpointPlaceId: null, instruction: askInstruction(leg.destinationId) }
  }

  // We do not know where the person is any more. We stop guessing.
  if (band === 'UNKNOWN') {
    return { state, nextCheckpointNodeId: null, nextCheckpointPlaceId: null, instruction: askInstruction(leg.destinationId) }
  }

  const next = nextNodeId(graph, lastObservation.nodeId, leg.destinationNodeId)
  if (next === null) {
    // Guidance unavailable — the graph cannot get us there from here.
    return { state, nextCheckpointNodeId: null, nextCheckpointPlaceId: null, instruction: askInstruction(leg.destinationId) }
  }

  const edge = edgeBetween(graph, lastObservation.nodeId, next)
  const turnCandidate = deriveTurn(lastObservation.facingBearing, edge ? edge.bearing : null)
  const turnExpiresAt = turnCandidate === null ? null : lastObservation.at + turnTtlMs
  const turnStillValid = turnExpiresAt !== null && now < turnExpiresAt
  const turn = turnStillValid ? turnCandidate : null

  return {
    state,
    nextCheckpointNodeId: next,
    nextCheckpointPlaceId: graph.nodes[next].placeId,
    instruction: {
      intent: turn === null ? 'GO' : 'TURN',
      turn,
      turnExpiresAt: turnStillValid ? turnExpiresAt : null,
      destinationId: leg.destinationId,
      disclosedSteps: 1,
    },
  }
}

/**
 * BACKTRACKED is an event, never a state. It fires when a new observation is
 * further from the destination than the previous one was.
 */
export function detectBacktrack(
  graph: VenueGraph,
  previousNodeId: string | null,
  observation: Observation,
  destinationNodeId: string,
): NavEvent | null {
  if (previousNodeId === null || previousNodeId === observation.nodeId) return null
  const before = findPath(graph, previousNodeId, destinationNodeId)
  const after = findPath(graph, observation.nodeId, destinationNodeId)
  if (!before || !after) return null
  if (after.length > before.length) {
    return { type: 'BACKTRACKED', nodeId: observation.nodeId, at: observation.at }
  }
  return null
}
