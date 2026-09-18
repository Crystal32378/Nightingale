/**
 * Nightingale — engine types.
 *
 * This module is pure domain code. Nothing under src/engine/ may import React,
 * the DOM, or any adapter. It must run headless in node.
 */

/** Where the person is along the route. Changed only by observation. */
export type Progress = 'AT_CHECKPOINT' | 'IN_TRANSIT' | 'ARRIVED'

/** How much the system trusts its own idea of where the person is. Changed only by time. */
export type Band = 'FRESH' | 'DECAYING' | 'UNKNOWN'

/**
 * What the person is doing. Changed ONLY by an explicit user action.
 * No code path may infer this. There is deliberately no state that describes
 * the person as lost; uncertainty lives on the `band` axis and describes the system.
 */
export type Posture = 'MOVING' | 'RESTING' | 'NEEDS_HELP'

export interface NavState {
  progress: Progress
  /** 0..1, derived from time since the last observation. */
  confidence: number
  band: Band
  posture: Posture
}

/** The only truth injection point in the system. */
export interface Observation {
  nodeId: string
  /** epoch ms */
  at: number
  /**
   * Installation-derived orientation prior, in degrees (0 = north, clockwise).
   * It comes from the code stuck on the wall, not from a sensor.
   * null means we do not know which way the person faces — and then we do not
   * emit LEFT/RIGHT at all.
   */
  facingBearing: number | null
  source: 'QR' | 'BUTTON_CONFIRM'
}

export type Intent = 'GO' | 'TURN' | 'ASK_DIRECTION' | 'WAIT' | 'ARRIVED' | 'NONE'

export type TurnDirection = 'LEFT' | 'RIGHT'

/**
 * Structured instruction. The renderer never decides route truth.
 * One step at a time is a property of this data structure, not a prompt.
 */
export interface Instruction {
  intent: Intent
  turn: TurnDirection | null
  /** epoch ms; after this, LEFT/RIGHT must never be emitted again. */
  turnExpiresAt: number | null
  /** registry key, never a display string */
  destinationId: string | null
  /** always 1 in Phase 1 */
  disclosedSteps: 1
}

export type Cue = 'QUIET' | 'READY' | 'LEFT' | 'RIGHT' | 'ASK' | 'ARRIVED'

export type BirdEvent = 'SHORT_PRESS' | 'LONG_PRESS'

/** An edge of the venue graph. `bearing` null = no meaningful horizontal heading (e.g. a lift). */
export interface VenueEdge {
  to: string
  bearing: number | null
}

export interface VenueNode {
  id: string
  /** registry key for this place's verified name */
  placeId: string
  edges: VenueEdge[]
  /**
   * The bearing a person faces when they are able to scan this node's code.
   * Installation-derived: the code is on a wall, you must face the wall to scan it.
   */
  qrFacingBearing: number | null
}

export interface VenueGraph {
  id: string
  nodes: Record<string, VenueNode>
}

/**
 * A visit is a list of legs. Each leg is one verified destination.
 * Only the current leg is ever disclosed.
 */
export interface VisitLeg {
  destinationId: string
  destinationNodeId: string
}

/** Domain event. Not a persistent state. */
export type NavEvent = { type: 'BACKTRACKED'; nodeId: string; at: number }
