/** Central London. Used when IP geolocation is missing or outside the store countries. */
export const LONDON = { lat: 51.5074, lng: -0.1278 };

const ALLOWED_COUNTRIES = new Set(["GB", "IE", "JE", "GG", "IM"]);

export type VisitorPlace = { lat: number; lng: number };

/**
 * Approximate place from Vercel's IP headers. The headers are already on the
 * page request, so this does not wait on another lookup. Nothing is logged
 * or saved. Outside GB, IE, JE, GG and IM, or if the numbers are unusable,
 * the result is central London.
 */
export function placeFromIpHeaders(headers: {
  country?: string | null;
  latitude?: string | null;
  longitude?: string | null;
}): VisitorPlace {
  const country = (headers.country ?? "").trim().toUpperCase();
  if (!ALLOWED_COUNTRIES.has(country)) return LONDON;
  const latText = (headers.latitude ?? "").trim();
  const lngText = (headers.longitude ?? "").trim();
  if (!latText || !lngText) return LONDON;
  const lat = Number(latText);
  const lng = Number(lngText);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return LONDON;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return LONDON;
  return { lat, lng };
}
