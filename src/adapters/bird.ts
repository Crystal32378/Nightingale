import type { BirdEvent, Cue } from '../engine/types'

export type { BirdEvent, Cue }

/**
 * The hardware contract, shared by the virtual bird (Phase 1) and the physical
 * one over BLE (Phase 3). The engine never knows which is connected.
 *
 * Note that the bird holds no state of its own. Every cue is perishable: a real
 * bird re-arms to QUIET on its own if no new cue arrives, and goes QUIET the
 * moment the link drops. A bird that keeps pointing left after the phone dies
 * would walk someone into the wrong corridor and never stop.
 */
export interface BirdAdapter {
  send(cue: Cue): void
  on(handler: (event: BirdEvent) => void): () => void
  readonly connected: boolean
}
