/**
 * Nightingale — Google track: egress venue graph builder.
 *
 * Turns a Routes API egress (transit exit -> hospital entrance) into a
 * VenueGraph the deterministic engine can already walk. No engine changes:
 * the outdoor last mile becomes just another graph with observations.
 *
 * Truth rules honored:
 *  - Geometry (bearings) comes from Maps, never from a model.
 *  - Intermediate waypoints are unnamed geometry: they carry the DESTINATION
 *    placeId, because the next meaningful checkpoint genuinely is the hospital.
 *    No invented place names, ever.
 *  - Observations are explicit BUTTON_CONFIRM only (the person taps "到了").
 *    facingBearing stays null outdoors until a heading prior is approved —
 *    so the engine says GO, never a guessed LEFT/RIGHT.
 */

import type { VenueEdge, VenueGraph, VenueNode } from '../engine/types'
import type { EgressLeg, LatLng } from './routes'

export interface EgressGraphSpec {
  /** Registry key where the egress starts (e.g. NTUH_EXIT2). Verified. */
  startPlaceId: string
  /** Registry key of the hospital (e.g. NTUH_WEST). Verified. */
  destinationPlaceId: string
  graphId?: string
}

/** Bearing in degrees (0 = north, clockwise). Null when geometry is missing. */
export function bearingBetween(from: LatLng | null, to: LatLng | null): number | null {
  if (from === null || to === null) return null
  const toRad = (d: number) => (d * Math.PI) / 180
  const toDeg = (r: number) => (r * 180) / Math.PI
  const dLng = toRad(to.longitude - from.longitude)
  const lat1 = toRad(from.latitude)
  const lat2 = toRad(to.latitude)
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

export function buildEgressGraph(leg: EgressLeg, spec: EgressGraphSpec): VenueGraph {
  const graphId = spec.graphId ?? 'egress-outdoor-v1'
  const nodes: Record<string, VenueNode> = {}
  // One node per step boundary: EGRESS_0 (at the exit) .. EGRESS_N (at the door).
  const count = leg.steps.length + 1
  for (let i = 0; i < count; i++) {
    const last = i === count - 1
    const edges: VenueEdge[] = []
    if (!last) {
      const step = leg.steps[i]
      edges.push({ to: `EGRESS_${i + 1}`, bearing: bearingBetween(step.start, step.end) })
    }
    nodes[`EGRESS_${i}`] = {
      id: `EGRESS_${i}`,
      placeId: i === 0 ? spec.startPlaceId : spec.destinationPlaceId,
      edges,
      // Outdoor: no wall-mounted code gives us a facing prior. Null on purpose.
      qrFacingBearing: null,
    }
  }
  return { id: graphId, nodes }
}

/** Node id of the hospital door: the leg's destination for the engine. */
export function egressDestinationNodeId(leg: EgressLeg): string {
  return `EGRESS_${leg.steps.length}`
}
