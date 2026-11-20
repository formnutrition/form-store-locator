import type { DbStoreRow, PublicStore, Store, StoreInput } from "./types";

/** Hidden stores stay out of the public map even though the service key can see them. */
export function toPublicList(stores: Store[]): PublicStore[] {
  return stores.filter((store) => store.visible).map(toPublicStore);
}

export const CSV_HEADERS = [
  "Stockist ID",
  "Name",
  "Address line 1",
  "Address line 2",
  "City",
  "State/Province",
  "Postal code",
  "Country",
  "Phone",
  "Website",
  "Email",
  "Logo URL",
  "Notes",
  "Priority",
  "Visible",
] as const;

/**
 * Nine Stockist rows have a blank country but a UK postcode (all Planet Organic
 * in London). Treat those as England so they match the rest of the export.
 * Channel Islands postcodes (GY, JE) are labelled when the country cell is empty.
 */
export function inferCountry(country: string, postalCode: string): string {
  const given = country.trim();
  if (given) return given;
  const compact = postalCode.toUpperCase().replace(/\s+/g, "");
  if (/^(GY|JE)\d/.test(compact)) return "Channel Islands";
  if (/^[A-Z]{1,2}\d/.test(compact)) return "England";
  return "";
}

/**
 * The inward code of a UK postcode is a digit plus two letters. A few export
 * rows use the letter O where a zero belongs (PL19 OHE) or split the inward
 * code with a space (BN11 3 HE). This is only for the geocoder query. The
 * stored postcode stays as it was typed.
 */
export function normalizePostcodeForGeocode(postalCode: string): string {
  const raw = postalCode.toUpperCase().replace(/\s+/g, "");
  if (raw.length < 5 || raw.length > 8) return postalCode.trim();
  const outward = raw.slice(0, -3);
  let inward = raw.slice(-3);
  if (inward[0] === "O") inward = "0" + inward.slice(1);
  return `${outward} ${inward}`;
}

export function addressSignature(store: Pick<
  StoreInput,
  "address1" | "address2" | "city" | "state" | "postalCode" | "country"
>): string {
  return [
    store.address1,
    store.address2,
    store.city,
    store.state,
    store.postalCode,
    store.country,
  ]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

export function geocodeQuery(store: StoreInput): string {
  const country = inferCountry(store.country, store.postalCode);
  const postal = normalizePostcodeForGeocode(store.postalCode);
  return [store.address1, store.address2, store.city, store.state, postal, country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function newStockistId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return (
    "loc_" +
    Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}

export function fromDb(row: DbStoreRow): Store {
  return {
    id: row.id,
    stockistId: row.stockist_id,
    name: row.name,
    address1: row.address_line_1 ?? "",
    address2: row.address_line_2 ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    postalCode: row.postal_code ?? "",
    country: row.country ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    email: row.email ?? "",
    logoUrl: row.logo_url ?? "",
    notes: row.notes ?? "",
    priority: row.priority,
    visible: row.visible,
    latitude: row.latitude,
    longitude: row.longitude,
    geocodedAt: row.geocoded_at,
    updatedAt: row.updated_at,
  };
}

export function toDbWrite(
  store: StoreInput & {
    latitude: number | null;
    longitude: number | null;
    geocodedAt: string | null;
  }
) {
  return {
    stockist_id: store.stockistId,
    name: store.name,
    address_line_1: store.address1,
    address_line_2: store.address2,
    city: store.city,
    state: store.state,
    postal_code: store.postalCode,
    country: inferCountry(store.country, store.postalCode),
    phone: store.phone,
    website: store.website,
    email: store.email,
    logo_url: store.logoUrl,
    notes: store.notes,
    priority: store.priority,
    visible: store.visible,
    latitude: store.latitude,
    longitude: store.longitude,
    geocoded_at: store.geocodedAt,
  };
}

export function toPublicStore(store: Store): PublicStore {
  return {
    id: store.id,
    name: store.name,
    address1: store.address1,
    address2: store.address2,
    city: store.city,
    state: store.state,
    postalCode: store.postalCode,
    country: store.country,
    lat: store.latitude,
    lng: store.longitude,
  };
}

export function oneLineAddress(store: StoreInput): string {
  return [store.address1, store.address2, store.city, store.state, store.postalCode, store.country]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function parseVisible(value: string): boolean {
  const text = value.trim().toLowerCase();
  if (!text) return true;
  if (["no", "false", "0", "n", "hidden"].includes(text)) return false;
  return true;
}

export function normalizeInput(input: Partial<StoreInput>): StoreInput {
  const postalCode = input.postalCode ?? "";
  return {
    stockistId: input.stockistId ?? "",
    name: (input.name ?? "").trim(),
    address1: input.address1 ?? "",
    address2: input.address2 ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
    postalCode,
    country: inferCountry(input.country ?? "", postalCode),
    phone: input.phone ?? "",
    website: input.website ?? "",
    email: input.email ?? "",
    logoUrl: input.logoUrl ?? "",
    notes: input.notes ?? "",
    priority: input.priority ?? null,
    visible: input.visible !== false,
  };
}

export function parsePriority(value: string): number | null {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return Math.round(number);
}
