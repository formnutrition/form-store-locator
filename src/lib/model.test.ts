import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parseCsv, storeInputFromRecord, storesToCsv } from "./csv";
import { parseGeocodeResponse } from "./geocode";
import { prepareImportRows } from "./import-stores";
import {
  geocodeQuery,
  inferCountry,
  normalizePostcodeForGeocode,
  toPublicList,
  toPublicStore,
} from "./stores-model";
import type { Store } from "./types";
import {
  adminConfigured,
  createSessionToken,
  passwordMatches,
  readSessionToken,
} from "./auth";

test("Stockist CSV parses, including quoted commas, and fills blank UK countries", async () => {
  const text = await readFile(path.join(process.cwd(), "data", "stores-uk-ie.csv"), "utf8");
  const rows = parseCsv(text).map(storeInputFromRecord);
  assert.equal(rows.length, 831);
  const planet = rows.find((row) => row.name === "Planet Organic Ealing");
  assert.ok(planet);
  assert.equal(planet.country, "England");
  assert.equal(planet.postalCode, "W5 5DB");
  const quoted = rows.find((row) => row.address1.includes(","));
  assert.ok(quoted);
  const again = parseCsv(storesToCsv(rows.map((row, index) => ({
    ...row,
    id: String(index),
    latitude: null,
    longitude: null,
    geocodedAt: null,
    updatedAt: null,
  }))));
  assert.equal(again.length, 831);
  assert.equal(again[0]["Name"], rows[0].name);
});

test("postcode typos are only corrected for the geocoder query", () => {
  assert.equal(normalizePostcodeForGeocode("PL19 OHE"), "PL19 0HE");
  assert.equal(normalizePostcodeForGeocode("BN11 3 HE"), "BN11 3HE");
  assert.equal(normalizePostcodeForGeocode("OL1 1AA"), "OL1 1AA");
  assert.equal(inferCountry("", "GY1 1HE"), "Channel Islands");
  assert.match(geocodeQuery({
    stockistId: "",
    name: "Holland and Barrett",
    address1: "Unit 16",
    address2: "",
    city: "Westminster",
    state: "London",
    postalCode: "WC2N 6NN",
    country: "England",
    phone: "",
    website: "",
    email: "",
    logoUrl: "",
    notes: "",
    priority: null,
    visible: true,
  }), /Westminster, London, WC2N 6NN, England/);
});

test("geocode responses", () => {
  assert.deepEqual(
    parseGeocodeResponse({ status: "OK", results: [{ geometry: { location: { lat: 1, lng: 2 } } }] }),
    { lat: 1, lng: 2 }
  );
  assert.equal(parseGeocodeResponse({ status: "ZERO_RESULTS", results: [] }), null);
  assert.throws(() => parseGeocodeResponse({ status: "REQUEST_DENIED", error_message: "nope" }), /nope/);
});

test("import reuses coordinates when the address has not changed", async () => {
  const row = {
    stockistId: "loc_1",
    name: "Holland and Barrett",
    address1: "Unit 4",
    address2: "",
    city: "Tralee",
    state: "County Kerry",
    postalCode: "V92 DW74",
    country: "Ireland",
    phone: "",
    website: "",
    email: "",
    logoUrl: "",
    notes: "",
    priority: null,
    visible: true,
  };
  const existing = new Map([
    ["loc_1", {
      stockistId: "loc_1",
      signature: "unit 4||tralee|county kerry|v92 dw74|ireland",
      latitude: 52.27,
      longitude: -9.7,
      geocodedAt: "2026-01-01T00:00:00.000Z",
    }],
  ]);
  let calls = 0;
  const prepared = await prepareImportRows([row], existing, async () => {
    calls += 1;
    return { lat: 0, lng: 0 };
  });
  assert.equal(calls, 0);
  assert.equal(prepared.reused, 1);
  assert.equal(prepared.records[0].latitude, 52.27);
});

test("public payload hides private fields and hidden stores", () => {
  const store: Store = {
    id: "1",
    stockistId: "loc_1",
    name: "Shop",
    address1: "1 High Street",
    address2: "",
    city: "Cork",
    state: "",
    postalCode: "T12 FY05",
    country: "Ireland",
    phone: "01234",
    website: "https://example.com",
    email: "secret@example.com",
    logoUrl: "",
    notes: "internal",
    priority: null,
    visible: false,
    latitude: 51.8,
    longitude: -8.4,
    geocodedAt: null,
    updatedAt: null,
  };
  const visible = { ...store, id: "2", visible: true };
  const list = toPublicList([store, visible]);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "2");
  assert.equal("email" in list[0], false);
  assert.equal(toPublicStore(visible).lat, 51.8);
});

test("admin cookie is signed and expires", async () => {
  process.env.ADMIN_PASSWORD = "correct horse battery";
  process.env.AUTH_SECRET = "test-secret-test-secret-test-secret";
  assert.equal(adminConfigured(), true);
  assert.equal(await passwordMatches("correct horse battery"), true);
  assert.equal(await passwordMatches("wrong"), false);
  const token = await createSessionToken(1_000);
  assert.equal(await readSessionToken(token, 1_000), true);
  assert.equal(await readSessionToken(token, 1_000 + 8 * 24 * 60 * 60 * 1000), false);
  assert.equal(await readSessionToken(token + "x", 1_000), false);
  delete process.env.ADMIN_PASSWORD;
  delete process.env.AUTH_SECRET;
});

test("migration locks down writes and exposes only visible stores", async () => {
  const sql = await readFile(
    path.join(process.cwd(), "supabase/migrations/20261120120000_stores.sql"),
    "utf8"
  );
  const code = sql.replace(/--.*$/gm, "");
  assert.match(sql, /ALREADY APPLIED/);
  assert.match(sql, /fadwglwxcbufjdivqapt/);
  assert.match(code, /set search_path = ''/);
  assert.doesNotMatch(code, /revoke all on schema private/i);
  assert.match(code, /enable row level security/i);
  assert.match(code, /force row level security/i);
  assert.match(code, /for select/);
  assert.match(code, /using \(visible = true\)/);
  assert.match(code, /revoke all on table public\.stores from public, anon, authenticated/i);
  assert.match(code, /grant select on table public\.stores to anon, authenticated/i);
  assert.doesNotMatch(code, /create policy[\s\S]{0,200}for (insert|update|delete|all)/i);
});

test("the embed loader stays lazy and forces itself visible", async () => {
  const js = await readFile(path.join(process.cwd(), "public/embed.js"), "utf8");
  assert.match(js, /IntersectionObserver/);
  assert.match(js, /geolocation/);
  assert.match(js, /setProperty\("display", "block", "important"\)/);
  assert.match(js, /form-locator-height/);
});

test("no API keys are committed", async () => {
  const files = [
    "README.md",
    ".env.example",
    "src/embed/locator.js",
    "public/embed.js",
    "scripts/geocode-import.ts",
  ];
  for (const file of files) {
    const text = await readFile(path.join(process.cwd(), file), "utf8").catch(() => "");
    assert.doesNotMatch(text, /AIza[0-9A-Za-z_-]{20}/);
    assert.doesNotMatch(text, /sb_secret_[A-Za-z0-9]/);
  }
});
