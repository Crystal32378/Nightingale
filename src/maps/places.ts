/**
 * Nightingale — Google track: hospital lookup via Places API (New).
 *
 * Finds the ONE real hospital the demo runs against and returns its verified
 * identity: Maps place ID, display name, address, and location. The caller
 * matches the display name against the place registry (added by a human with a
 * web source) — an unmatched name is never spoken, it leaves a quiet gap.
 *
 * No React, no DOM. Fetch is injected so this runs in node and in tests.
 */

export interface HospitalPlace {
  placeId: string
  displayName: string
  languageCode: string
  formattedAddress: string | null
  latitude: number | null
  longitude: number | null
  /** Citable web source for the registry: openable URL + read date. */
  mapsUrl: string
}

export type FetchLike = typeof fetch

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText'

interface PlacesSearchResponse {
  places?: Array<{
    id?: string
    displayName?: { text?: string; languageCode?: string }
    formattedAddress?: string
    location?: { latitude?: number; longitude?: number }
  }>
}

export async function findHospital(
  textQuery: string,
  apiKey: string,
  fetchFn: FetchLike = fetch,
): Promise<HospitalPlace | null> {
  if (apiKey.trim().length === 0 || textQuery.trim().length === 0) return null
  const res = await fetchFn(`${PLACES_SEARCH_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery, languageCode: 'zh-TW', maxResultCount: 1 }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as PlacesSearchResponse
  const place = data.places?.[0]
  if (place?.id === undefined || place.displayName?.text === undefined) return null
  return {
    placeId: place.id,
    displayName: place.displayName.text,
    languageCode: place.displayName.languageCode ?? 'zh-TW',
    formattedAddress: place.formattedAddress ?? null,
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.displayName.text)}&query_place_id=${encodeURIComponent(place.id)}`,
  }
}
