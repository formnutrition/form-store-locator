import { refreshPublicStores } from "./cache-tags";
import { GeocodeError, geocodeAddress, serverGeocodeKey, type LatLng } from "./geocode";
import { prepareImportRows, type ExistingStore } from "./import-stores";
import { addressSignature, geocodeQuery, newStockistId, toDbWrite } from "./stores-model";
import { getSupabase } from "./supabase";
import type { DbStoreRow, Store, StoreInput } from "./types";
import { fromDb } from "./stores-model";

const IMPORT_BATCH_LIMIT = 40;

export function importBatchLimit(): number {
  return IMPORT_BATCH_LIMIT;
}

async function existingFor(stockistIds: string[]): Promise<Map<string, ExistingStore>> {
  const ids = stockistIds.map((id) => id.trim()).filter(Boolean);
  const map = new Map<string, ExistingStore>();
  if (!ids.length) return map;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("stores")
    .select("stockist_id, address_line_1, address_line_2, city, state, postal_code, country, latitude, longitude, geocoded_at")
    .in("stockist_id", ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const store = {
      address1: row.address_line_1 ?? "",
      address2: row.address_line_2 ?? "",
      city: row.city ?? "",
      state: row.state ?? "",
      postalCode: row.postal_code ?? "",
      country: row.country ?? "",
    };
    map.set(row.stockist_id, {
      stockistId: row.stockist_id,
      signature: addressSignature(store),
      latitude: row.latitude,
      longitude: row.longitude,
      geocodedAt: row.geocoded_at,
    });
  }
  return map;
}

function geocoder(): (query: string) => Promise<LatLng | null> {
  const key = serverGeocodeKey();
  return (query) => {
    if (!key) {
      return Promise.reject(
        new GeocodeError(
          "GOOGLE_MAPS_SERVER_KEY is not set, so this address could not be placed on the map."
        )
      );
    }
    return geocodeAddress(query, key);
  };
}

export async function importRows(rows: StoreInput[]) {
  if (rows.length > IMPORT_BATCH_LIMIT) {
    throw new Error(`Send at most ${IMPORT_BATCH_LIMIT} stores at a time.`);
  }
  const existing = await existingFor(rows.map((row) => row.stockistId));
  const prepared = await prepareImportRows(rows, existing, geocoder());
  if (prepared.records.length) {
    const supabase = getSupabase();
    const { error } = await supabase.from("stores").upsert(prepared.records, { onConflict: "stockist_id" });
    if (error) throw new Error(error.message);
    refreshPublicStores();
  }
  return {
    saved: prepared.records.length,
    geocoded: prepared.geocoded,
    reused: prepared.reused,
    failures: prepared.failures,
    geocodingSkipped: !serverGeocodeKey(),
  };
}

export type SaveResult = { store: Store; warning: string | null };

export async function createStore(input: StoreInput): Promise<SaveResult> {
  const stockistId = input.stockistId.trim() || newStockistId();
  const placed = await placeAddress({ ...input, stockistId }, null);
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("stores")
    .insert(placed.record)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  refreshPublicStores();
  return { store: fromDb(data as DbStoreRow), warning: placed.warning };
}

export async function updateStore(id: string, input: StoreInput, current: Store): Promise<SaveResult> {
  const placed = await placeAddress(
    { ...input, stockistId: input.stockistId.trim() || current.stockistId },
    current
  );
  const supabase = getSupabase();
  const { data, error } = await supabase.from("stores").update(placed.record).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  refreshPublicStores();
  return { store: fromDb(data as DbStoreRow), warning: placed.warning };
}

export async function deleteStore(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refreshPublicStores();
}

async function placeAddress(
  input: StoreInput,
  current: Store | null
): Promise<{ record: ReturnType<typeof toDbWrite>; warning: string | null }> {
  const changed = !current || addressSignature(input) !== addressSignature(current);
  let latitude = current?.latitude ?? null;
  let longitude = current?.longitude ?? null;
  let geocodedAt = current?.geocodedAt ?? null;
  let warning: string | null = null;

  if (changed) {
    const key = serverGeocodeKey();
    if (!key) {
      latitude = null;
      longitude = null;
      geocodedAt = null;
      warning =
        "Saved, but this address is not on the map yet. Add GOOGLE_MAPS_SERVER_KEY and save again.";
    } else {
      try {
        const point = await geocodeAddress(geocodeQuery(input), key);
        if (!point) {
          latitude = null;
          longitude = null;
          geocodedAt = null;
          warning = "Saved, but Google could not find that address.";
        } else {
          latitude = point.lat;
          longitude = point.lng;
          geocodedAt = new Date().toISOString();
        }
      } catch (error) {
        latitude = null;
        longitude = null;
        geocodedAt = null;
        warning = error instanceof Error ? error.message : "Geocoding failed.";
      }
    }
  }

  return {
    record: toDbWrite({ ...input, latitude, longitude, geocodedAt }),
    warning,
  };
}
