const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ecosystem-builder/1.0';

/**
 * Geocode a city using the Nominatim API.
 * Returns a Region object on success, { notFound: true } when no results,
 * or { error: true, message } on failure.
 *
 * @param {{ city: string, state?: string, country?: string }} params
 * @returns {Promise<object>}
 */
export async function geocodeCity({ city, state, country }) {
  const params = new URLSearchParams({
    q: city,
    addressdetails: '1',
    format: 'jsonv2',
    limit: '5',
  });

  if (country) {
    // Use countrycodes for better accuracy when country is provided
    params.set('countrycodes', country);
  }

  if (state) {
    // Append state to the query for better accuracy
    params.set('q', `${city}, ${state}`);
  }

  const url = `${NOMINATIM_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      return { error: true, message: `Nominatim returned ${response.status}` };
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { notFound: true };
    }

    // Pick the result with the highest importance score
    const best = data.reduce((prev, curr) =>
      (curr.importance ?? 0) > (prev.importance ?? 0) ? curr : prev
    );

    return normalizePlace(best);
  } catch (err) {
    return { error: true, message: err.message };
  }
}

/**
 * Normalize a Nominatim result into a Region object.
 *
 * @param {object} result - A single Nominatim result object
 * @returns {{ city: string|null, state: string|null, county: string|null, country: string|null, lat: number, lng: number }}
 */
export function normalizePlace(result) {
  const address = result.address ?? {};

  const city =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    null;

  const state = address.state || null;
  const country = address.country || null;
  const county = address.county || address.state_district || null;

  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);

  return { city, state, county, country, lat, lng };
}
