import type { VenueGraph, VenueEdge, TurnDirection } from './types'
import { TURN_AMBIGUOUS_DEG, TURN_DEADZONE_DEG } from './tuning'

export { TURN_AMBIGUOUS_DEG, TURN_DEADZONE_DEG }

export function normalizeBearing(deg: number): number {
  const n = deg % 360
  return n < 0 ? n + 360 : n
}

/** Signed relative angle in (-180, 180]. Positive = to the right. */
export function relativeAngle(fromBearing: number, toBearing: number): number {
  let d = normalizeBearing(toBearing) - normalizeBearing(fromBearing)
  if (d > 180) d -= 360
  if (d <= -180) d += 360
  return d
}

/** Breadth-first shortest path, inclusive of both ends. null when unreachable. */
export function findPath(graph: VenueGraph, fromId: string, toId: string): string[] | null {
  if (!graph.nodes[fromId] || !graph.nodes[toId]) return null
  if (fromId === toId) return [fromId]

  const queue: string[] = [fromId]
  const cameFrom = new Map<string, string>()
  const seen = new Set<string>([fromId])

  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const edge of graph.nodes[current].edges) {
      if (seen.has(edge.to) || !graph.nodes[edge.to]) continue
      seen.add(edge.to)
      cameFrom.set(edge.to, current)
      if (edge.to === toId) {
        const path = [toId]
        let cursor = toId
        while (cameFrom.has(cursor)) {
          cursor = cameFrom.get(cursor) as string
          path.unshift(cursor)
        }
        return path
      }
      queue.push(edge.to)
    }
  }
  return null
}

/** The single next node on the way to `toId`. null when already there or unreachable. */
export function nextNodeId(graph: VenueGraph, fromId: string, toId: string): string | null {
  const path = findPath(graph, fromId, toId)
  if (!path || path.length < 2) return null
  return path[1]
}

export function edgeBetween(graph: VenueGraph, fromId: string, toId: string): VenueEdge | null {
  const node = graph.nodes[fromId]
  if (!node) return null
  return node.edges.find((e) => e.to === toId) ?? null
}

/**
 * Deterministic turn derivation. Returns null when we must not claim a direction:
 * no facing prior, no edge bearing, straight ahead, or a near-reversal we cannot
 * distinguish.
 */
export function deriveTurn(facingBearing: number | null, edgeBearing: number | null): TurnDirection | null {
  if (facingBearing === null || edgeBearing === null) return null
  const rel = relativeAngle(facingBearing, edgeBearing)
  const magnitude = Math.abs(rel)
  if (magnitude < TURN_DEADZONE_DEG) return null
  if (magnitude >= TURN_AMBIGUOUS_DEG) return null
  return rel > 0 ? 'RIGHT' : 'LEFT'
}

export interface AuthoringWarning {
  nodeId: string
  toNodeId: string
  kind: 'NEAR_REVERSAL' | 'NO_FACING_PRIOR' | 'DANGLING_EDGE'
  relativeAngle: number | null
}

/**
 * Build-time authoring check for the venue graph. Near-180° turns produce a
 * warning so the code can be re-sited — never a hard error.
 */
export function validateVenueAuthoring(graph: VenueGraph): AuthoringWarning[] {
  const warnings: AuthoringWarning[] = []
  for (const node of Object.values(graph.nodes)) {
    for (const edge of node.edges) {
      if (!graph.nodes[edge.to]) {
        warnings.push({ nodeId: node.id, toNodeId: edge.to, kind: 'DANGLING_EDGE', relativeAngle: null })
        continue
      }
      if (edge.bearing === null) continue
      if (node.qrFacingBearing === null) {
        warnings.push({ nodeId: node.id, toNodeId: edge.to, kind: 'NO_FACING_PRIOR', relativeAngle: null })
        continue
      }
      const rel = relativeAngle(node.qrFacingBearing, edge.bearing)
      if (Math.abs(rel) >= TURN_AMBIGUOUS_DEG) {
        warnings.push({ nodeId: node.id, toNodeId: edge.to, kind: 'NEAR_REVERSAL', relativeAngle: rel })
      }
    }
  }
  return warnings
}
