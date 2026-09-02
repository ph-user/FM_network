/**
 * Server-side Places API (New) lookups. place_id is server-side only (see
 * CLAUDE.md), so every address entry point sends us a place_id and we
 * resolve the authoritative address and coordinates here -- never trusting
 * client-supplied coordinates. Suburb is deliberately not resolved here --
 * see CLAUDE.md's Data model: the client's own suburb value is the source
 * of truth, not Google's.
 */

import 'server-only';

interface PlaceDetailsResponse {
  formattedAddress: string;
  location: { latitude: number; longitude: number };
}

export interface ResolvedPlace {
  address: string;
  lat: number;
  lng: number;
}

export interface GeocodeCandidate extends ResolvedPlace {
  placeId: string;
}

interface GeocodeResult {
  place_id: string;
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
}

interface GeocodeResponse {
  status: string;
  results: GeocodeResult[];
}

/**
 * CSV import has no dropdown, so each row's address text is resolved here
 * instead of picked from a live list (CLAUDE.md). Geocoding, not
 * Autocomplete: Autocomplete is built to suggest completions and returns
 * several even for a complete, correctly-formatted address (partial
 * matches, nearby businesses at the same street number), which would mark
 * almost every row "ambiguous". Geocoding returns exactly one result for a
 * well-formed address and several only when the address is genuinely
 * ambiguous -- the actual meaning of that review-screen bucket. This is
 * also the one enabled API (see README/.env.example) nothing else in the
 * app uses, which is the tell that it was meant for exactly this.
 *
 * Focus Media's network is Australia-only (Melbourne and Sydney), so
 * results are biased with `region=au` -- a soft preference, not a hard
 * filter, so a legitimately different address can still come back.
 */
export async function geocodeAddress(address: string): Promise<GeocodeCandidate[]> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_SERVER_KEY is not set');

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('region', 'au');
  url.searchParams.set('key', apiKey);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Geocoding API returned ${response.status} for address "${address}"`);
  }

  const data: GeocodeResponse = await response.json();
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Geocoding API status ${data.status} for address "${address}"`);
  }

  return data.results.map((result) => ({
    placeId: result.place_id,
    address: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  }));
}

export async function resolvePlace(placeId: string): Promise<ResolvedPlace> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!apiKey) throw new Error('GOOGLE_MAPS_SERVER_KEY is not set');

  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'formattedAddress,location',
    },
  });

  if (!response.ok) {
    throw new Error(`Places API returned ${response.status} for place_id ${placeId}`);
  }

  const data: PlaceDetailsResponse = await response.json();

  return {
    address: data.formattedAddress,
    lat: data.location.latitude,
    lng: data.location.longitude,
  };
}
