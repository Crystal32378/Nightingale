/**
 * Turns the phone's own position into a route zone, on the phone. Only the
 * zone id ever leaves the device — never coordinates. A fix that is too
 * rough, or outside every zone, is "unknown": the server then treats
 * location as saying nothing, which can delay arrival by one question but
 * never block it.
 */

export interface RouteZone {
  id: string
  lat: number
  lon: number
  radiusM: number
}

export const UNKNOWN_ZONE = 'unknown'
/** Beyond this the fix cannot tell one stretch of the route from the next. */
export const MAX_ACCURACY_M = 50

export function distanceM(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const r = 6_371_000
  const rad = Math.PI / 180
  const dLat = (bLat - aLat) * rad
  const dLon = (bLon - aLon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * r * Math.asin(Math.sqrt(h))
}

/**
 * A zone only when the whole error circle fits inside exactly one zone and
 * touches no other. Anything less — a rough fix, a circle straddling the ER
 * driveway and the lobby, open ground — is unknown. Location can veto a
 * step, so it has to fail closed.
 */
export function zoneFor(zones: RouteZone[], lat: number, lon: number, accuracyM: number): string {
  if (!Number.isFinite(accuracyM) || accuracyM < 0 || accuracyM > MAX_ACCURACY_M) return UNKNOWN_ZONE
  const inside: string[] = []
  let touching = 0
  for (const z of zones) {
    const d = distanceM(lat, lon, z.lat, z.lon)
    if (d + accuracyM <= z.radiusM) inside.push(z.id)
    if (d < z.radiusM + accuracyM) touching++
  }
  return inside.length === 1 && touching === 1 ? inside[0]! : UNKNOWN_ZONE
}
