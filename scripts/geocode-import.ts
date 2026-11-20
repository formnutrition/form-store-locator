/**
 * One-off import: read a Stockist CSV, place each address with the Google
 * Geocoding API, and upsert into Supabase.
 *
 *   npm run import:stores
 *   npm run import:stores -- --csv data/stores-uk-ie.csv
 *   npm run import:stores -- --dry-run
 *
 * Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and GOOGLE_MAPS_SERVER_KEY.
 * A local cache in data/.geocode-cache.json means a re-run does not pay for
 * addresses that were already looked up.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseCsv, storeInputFromRecord } from "../src/lib/csv.ts";
import { geocodeAddress, type LatLng } from "../src/lib/geocode.ts";
import { prepareImportRows, type ExistingStore } from "../src/lib/import-stores.ts";
import { addressSignature } from "../src/lib/stores-model.ts";
import { getSupabase } from "../src/lib/supabase.ts";
import type { StoreInput } from "../src/lib/types.ts";

type Cache = Record<string, LatLng | null>;

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function readCache(file: string): Promise<Cache> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as Cache;
  } catch {
    return {};
  }
}

export async function loadCsvStores(csvPath: string): Promise<StoreInput[]> {
  const text = await readFile(csvPath, "utf8");
  return parseCsv(text).map(storeInputFromRecord);
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const csvPath = path.resolve(arg("--csv") || "data/stores-uk-ie.csv");
  const cachePath = path.resolve("data/.geocode-cache.json");
  const stores = await loadCsvStores(csvPath);
  console.log(`${stores.length} rows in ${path.basename(csvPath)}.`);

  const key = process.env.GOOGLE_MAPS_SERVER_KEY?.trim() ?? "";
  if (!key) {
    console.log(
      "GOOGLE_MAPS_SERVER_KEY is not set, so nothing was placed on the map. The CSV itself is readable. Set the key and run this again to import."
    );
    process.exit(dryRun ? 0 : 2);
  }

  const cache = await readCache(cachePath);
  let lookups = 0;
  const geocode = async (query: string): Promise<LatLng | null> => {
    if (Object.prototype.hasOwnProperty.call(cache, query)) return cache[query];
    const point = await geocodeAddress(query, key);
    cache[query] = point;
    lookups += 1;
    if (lookups % 25 === 0) {
      await writeFile(cachePath, JSON.stringify(cache));
      console.log(`geocoded ${lookups} new addresses…`);
    }
    return point;
  };

  let existing = new Map<string, ExistingStore>();
  if (!dryRun) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("stores")
      .select("stockist_id, address_line_1, address_line_2, city, state, postal_code, country, latitude, longitude, geocoded_at")
      .limit(5000);
    if (error) throw new Error(error.message);
    existing = new Map(
      (data ?? []).map((row) => {
        const signature = addressSignature({
          address1: row.address_line_1 ?? "",
          address2: row.address_line_2 ?? "",
          city: row.city ?? "",
          state: row.state ?? "",
          postalCode: row.postal_code ?? "",
          country: row.country ?? "",
        });
        return [
          row.stockist_id as string,
          {
            stockistId: row.stockist_id as string,
            signature,
            latitude: row.latitude as number | null,
            longitude: row.longitude as number | null,
            geocodedAt: row.geocoded_at as string | null,
          },
        ] as const;
      })
    );
  }

  const prepared = await prepareImportRows(stores, existing, geocode);
  await writeFile(cachePath, JSON.stringify(cache));
  console.log(
    `${prepared.records.length} ready, ${prepared.geocoded} newly placed, ${prepared.reused} already placed, ${prepared.failures.length} warnings.`
  );
  for (const failure of prepared.failures.slice(0, 20)) {
    console.log(`- ${failure.name || "(no name)"}: ${failure.error}`);
  }

  if (dryRun) {
    console.log("Dry run: nothing was written to the database.");
    return;
  }

  const supabase = getSupabase();
  for (let i = 0; i < prepared.records.length; i += 100) {
    const chunk = prepared.records.slice(i, i + 100);
    const { error } = await supabase.from("stores").upsert(chunk, { onConflict: "stockist_id" });
    if (error) throw new Error(error.message);
    console.log(`saved ${Math.min(i + 100, prepared.records.length)} / ${prepared.records.length}`);
  }
  console.log("Import finished.");
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
