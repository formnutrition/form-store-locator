/**
 * Builds data/seed-stores.json so the locator can be previewed before the
 * Google geocoding import has been run. UK postcodes come from postcodes.io.
 * Ireland and anything postcodes.io misses go through Nominatim.
 * This is not the production import. Run scripts/geocode-import.ts for that.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCsv, storeInputFromRecord } from "../src/lib/csv.ts";
import { geocodeQuery, newStockistId } from "../src/lib/stores-model.ts";

const root = process.cwd();
const csvPath = path.join(root, "data", "stores-uk-ie.csv");
const outPath = path.join(root, "data", "seed-stores.json");

function ukCompact(postal) {
  return postal.toUpperCase().replace(/\s+/g, "");
}

function geocodePostcode(postal) {
  const raw = ukCompact(postal);
  if (raw.length < 5) return postal.trim();
  const outward = raw.slice(0, -3);
  let inward = raw.slice(-3);
  if (inward[0] === "O") inward = "0" + inward.slice(1);
  return outward + " " + inward;
}

async function postcodesIo(postcodes) {
  const found = new Map();
  for (let i = 0; i < postcodes.length; i += 100) {
    const batch = postcodes.slice(i, i + 100);
    const response = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ postcodes: batch }),
    });
    if (!response.ok) throw new Error("postcodes.io " + response.status);
    const body = await response.json();
    for (const row of body.result || []) {
      if (row.result && row.query) {
        found.set(row.query.toUpperCase(), {
          lat: row.result.latitude,
          lng: row.result.longitude,
        });
      }
    }
    process.stdout.write(`postcodes.io ${Math.min(i + 100, postcodes.length)}/${postcodes.length}\n`);
  }
  return found;
}

async function nominatim(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: { "user-agent": "form-store-locator/1.0 (preview seed; not production)" },
  });
  if (!response.ok) return null;
  const body = await response.json();
  if (!body[0]) return null;
  return { lat: Number(body[0].lat), lng: Number(body[0].lon) };
}

const csv = await readFile(csvPath, "utf8");
const inputs = parseCsv(csv).map(storeInputFromRecord);
const lookups = [...new Set(inputs.map((row) => geocodePostcode(row.postalCode)))];
const ukLike = lookups.filter((code) => {
  const compact = code.replace(/\s/g, "");
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact);
});
const points = await postcodesIo(ukLike);

const stores = [];
let nominatimCount = 0;
for (const input of inputs) {
  const key = geocodePostcode(input.postalCode).toUpperCase();
  let point = points.get(key) || null;
  if (!point) {
    nominatimCount += 1;
    const city = input.city.replace(/^Dublin\s+\d+.*/i, "Dublin");
    const state = input.state.replace(/^Country\s+/i, "").replace(/^Co\.?\s+/i, "").replace(/^County\s+/i, "");
    const country = input.country === "Channel Islands" ? input.state || "Channel Islands" : input.country || "United Kingdom";
    point = await nominatim([city, state, country].filter(Boolean).join(", "));
    await new Promise((resolve) => setTimeout(resolve, 1100));
    process.stdout.write(`nominatim ${nominatimCount} ${input.postalCode} ${point ? "ok" : "miss"}\n`);
  }
  stores.push({
    id: input.stockistId || newStockistId(),
    stockistId: input.stockistId,
    name: input.name,
    address1: input.address1,
    address2: input.address2,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    country: input.country,
    phone: input.phone,
    website: input.website,
    email: input.email,
    logoUrl: input.logoUrl,
    notes: input.notes,
    priority: input.priority,
    visible: input.visible,
    latitude: point ? point.lat : null,
    longitude: point ? point.lng : null,
    geocodedAt: null,
    updatedAt: null,
  });
}

await writeFile(outPath, JSON.stringify(stores));
const placed = stores.filter((store) => store.latitude != null).length;
console.log(`wrote ${stores.length} stores, ${placed} with coordinates, ${stores.length - placed} missing`);
