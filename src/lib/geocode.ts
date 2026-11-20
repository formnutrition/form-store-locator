export type LatLng = { lat: number; lng: number };

export class GeocodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocodeError";
  }
}

type GeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: { geometry?: { location?: { lat?: number; lng?: number } } }[];
};

export function parseGeocodeResponse(body: GeocodeResponse): LatLng | null {
  if (body.status === "OK") {
    const location = body.results?.[0]?.geometry?.location;
    if (
      location &&
      typeof location.lat === "number" &&
      typeof location.lng === "number"
    ) {
      return { lat: location.lat, lng: location.lng };
    }
    throw new GeocodeError("Google returned a result with no coordinates.");
  }
  if (body.status === "ZERO_RESULTS") return null;
  if (body.status === "REQUEST_DENIED") {
    throw new GeocodeError(
      body.error_message ||
        "Google refused the geocoding key. Enable the Geocoding API on GOOGLE_MAPS_SERVER_KEY and check it is allowed to be used from this server."
    );
  }
  throw new GeocodeError(
    body.error_message || `Google geocoding failed (${body.status || "unknown"}).`
  );
}

const RETRYABLE = new Set(["OVER_QUERY_LIMIT", "UNKNOWN_ERROR", "RESOURCE_EXHAUSTED"]);

export async function geocodeAddress(
  query: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<LatLng | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  if (!apiKey.trim()) {
    throw new GeocodeError(
      "GOOGLE_MAPS_SERVER_KEY is not set, so this address could not be placed on the map."
    );
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", trimmed);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("region", "uk");

    const response = await fetchImpl(url);
    if (!response.ok) {
      lastError = new GeocodeError(`Geocoding request failed (${response.status}).`);
      if (response.status === 429 || response.status >= 500) continue;
      throw lastError;
    }
    const body = (await response.json()) as GeocodeResponse;
    if (body.status && RETRYABLE.has(body.status)) {
      lastError = new GeocodeError(body.error_message || body.status);
      continue;
    }
    return parseGeocodeResponse(body);
  }
  throw lastError ?? new GeocodeError("Geocoding failed after several tries.");
}

export function serverGeocodeKey(): string {
  return process.env.GOOGLE_MAPS_SERVER_KEY?.trim() ?? "";
}
