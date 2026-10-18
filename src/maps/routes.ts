/**
 * Nightingale — Google track: transit-to-hospital egress via Routes API.
 *
 * The last mile Google Maps drops you at: from a transit alighting stop to the
 * hospital entrance (~200m–1km). We request a TRANSIT route and keep ONLY the
 * final walking egress — transit legs are Google Maps' job, the egress is ours.
 *
 * The egress steps become observations for the deterministic engine; the model
 * never sees raw polylines. Step text from the API is used for debugging only
 * and is never spoken verbatim (it carries unverified names and numbers).
 */

export interface LatLng {
  latitude: number
  longitude: number
}

export interface EgressStep {
  /** Static-travel-mode instruction from the API. Debug only, never spoken. */
  debugInstruction: string
  distanceMeters: number
  /** Geometry truth from Maps. Used to build the egress venue graph. */
  start: LatLng | null
  end: LatLng | null
}

export interface EgressLeg {
  /** Where the person gets off transit. */
  fromStop: string | null
  /** Walking distance of the egress in meters. */
  distanceMeters: number
  steps: EgressStep[]
}

export type FetchLike = typeof fetch

const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes'

interface RoutesResponse {
  routes?: Array<{
    legs?: Array<{
      steps?: Array<{
        navigationInstruction?: { instructions?: string }
        distanceMeters?: string
        travelMode?: string
        startLocation?: { latLng?: { latitude?: number; longitude?: number } }
        endLocation?: { latLng?: { latitude?: number; longitude?: number } }
        transitDetails?: {
          stopDetails?: { departureStop?: { name?: string }; arrivalStop?: { name?: string } }
        }
      }>
    }>
  }>
}

function toLatLng(value: { latitude?: number; longitude?: number } | undefined): LatLng | null {
  if (value?.latitude === undefined || value?.longitude === undefined) return null
  return { latitude: value.latitude, longitude: value.longitude }
}

export interface EgressRequest {
  origin: LatLng
  destinationPlaceId: string
  /** ISO 8601 departure time. Defaults to now. */
  departureTime?: string
}

export async function fetchEgressLeg(
  request: EgressRequest,
  apiKey: string,
  fetchFn: FetchLike = fetch,
): Promise<EgressLeg | null> {
  if (apiKey.trim().length === 0) return null
  const res = await fetchFn(`${ROUTES_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.transitDetails',
    },
    body: JSON.stringify({
      origin: { location: { latLng: request.origin } },
      destination: { placeId: request.destinationPlaceId },
      travelMode: 'TRANSIT',
      computeAlternativeRoutes: false,
      departureTime: request.departureTime ?? new Date().toISOString(),
      languageCode: 'zh-TW',
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as RoutesResponse
  const steps = data.routes?.[0]?.legs?.[0]?.steps ?? []
  if (steps.length === 0) return null

  // Keep the trailing WALK steps: the egress after the last transit leg.
  let lastTransitIndex = -1
  steps.forEach((s, i) => {
    if (s.travelMode === 'TRANSIT') lastTransitIndex = i
  })
  const egress = steps.slice(lastTransitIndex + 1).filter((s) => s.travelMode === 'WALK')
  if (egress.length === 0) return null

  const fromStop =
    lastTransitIndex >= 0
      ? (steps[lastTransitIndex].transitDetails?.stopDetails?.arrivalStop?.name ?? null)
      : null
  const parsed: EgressStep[] = egress.map((s) => ({
    debugInstruction: s.navigationInstruction?.instructions ?? '',
    distanceMeters: Number(s.distanceMeters ?? 0),
    start: toLatLng(s.startLocation?.latLng),
    end: toLatLng(s.endLocation?.latLng),
  }))
  return {
    fromStop,
    distanceMeters: parsed.reduce((sum, s) => sum + s.distanceMeters, 0),
    steps: parsed,
  }
}
