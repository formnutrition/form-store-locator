import { addressSignature, geocodeQuery, newStockistId, toDbWrite } from "./stores-model";
import type { StoreInput } from "./types";
import type { LatLng } from "./geocode";

export type ExistingStore = {
  stockistId: string;
  signature: string;
  latitude: number | null;
  longitude: number | null;
  geocodedAt: string | null;
};

export type PreparedStore = ReturnType<typeof toDbWrite> & { stockist_id: string };

export type PrepareResult = {
  records: PreparedStore[];
  failures: { name: string; stockistId: string; error: string }[];
  geocoded: number;
  reused: number;
};

export async function prepareImportRows(
  rows: StoreInput[],
  existingByStockistId: Map<string, ExistingStore>,
  geocode: (query: string) => Promise<LatLng | null>,
  now = new Date()
): Promise<PrepareResult> {
  const records: PreparedStore[] = [];
  const failures: PrepareResult["failures"] = [];
  let geocoded = 0;
  let reused = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const name = row.name.trim();
    if (!name) {
      failures.push({ name: "", stockistId: row.stockistId, error: "Missing name." });
      continue;
    }
    let stockistId = row.stockistId.trim();
    if (!stockistId || seen.has(stockistId)) stockistId = newStockistId();
    seen.add(stockistId);

    const input: StoreInput = { ...row, name, stockistId, country: row.country };
    const signature = addressSignature(input);
    const previous = existingByStockistId.get(row.stockistId.trim());
    let latitude: number | null = null;
    let longitude: number | null = null;
    let geocodedAt: string | null = null;

    const canReuse =
      previous &&
      previous.signature === signature &&
      previous.latitude != null &&
      previous.longitude != null;

    if (canReuse && previous) {
      latitude = previous.latitude;
      longitude = previous.longitude;
      geocodedAt = previous.geocodedAt;
      reused += 1;
    } else {
      try {
        const point = await geocode(geocodeQuery(input));
        if (point) {
          latitude = point.lat;
          longitude = point.lng;
          geocodedAt = now.toISOString();
          geocoded += 1;
        } else {
          failures.push({
            name,
            stockistId,
            error: "Saved, but Google could not find this address on the map.",
          });
        }
      } catch (error) {
        failures.push({
          name,
          stockistId,
          error: error instanceof Error ? error.message : "Geocoding failed.",
        });
      }
    }

    records.push(
      toDbWrite({
        ...input,
        stockistId,
        latitude,
        longitude,
        geocodedAt,
      })
    );
  }

  return { records, failures, geocoded, reused };
}
