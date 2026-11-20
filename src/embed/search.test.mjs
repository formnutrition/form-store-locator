import assert from "node:assert/strict";
import test from "node:test";
import search from "./search.js";

const london = { id: "1", name: "Holland and Barrett", address1: "Unit 16, Embankment Shopping Centre", address2: "Villiers Street", city: "Westminster", state: "London", postalCode: "WC2N 6NN", country: "England", lat: 51.5074, lng: -0.1278 };
const dublin = { id: "2", name: "Holland and Barrett", address1: "Unit 4", address2: "Central Plaza", city: "Tralee", state: "County Kerry", postalCode: "V92 DW74", country: "Ireland", lat: 53.3498, lng: -6.2603 };

test("distance from London to Dublin is about 460 km", () => {
  const km = search.haversineKm({ lat: london.lat, lng: london.lng }, { lat: dublin.lat, lng: dublin.lng });
  assert.ok(km > 430 && km < 500, String(km));
  assert.equal(search.formatDistance(0.34), "0.3 km");
  assert.equal(search.formatDistance(12.2), "12.2 km");
});

test("address lines match the stockist layout", () => {
  assert.deepEqual(search.addressLines(london), [
    "Unit 16, Embankment Shopping Centre",
    "Villiers Street",
    "Westminster, London WC2N 6NN",
    "England",
  ]);
});

test("a postcode or city becomes a search point and results sort nearest first", () => {
  const stores = [london, dublin, { ...london, id: "3", postalCode: "WC2N 5DU", lat: 51.51, lng: -0.12 }];
  const origin = search.originFromQuery(stores, "wc2n");
  assert.ok(origin);
  const rows = search.resultsForOrigin(stores, origin, 25, 100);
  assert.equal(rows.length, 2);
  assert.ok(rows[0].distance <= rows[1].distance);
  assert.equal(search.originFromQuery(stores, "Tralee").lat, dublin.lat);
  assert.equal(search.originFromQuery(stores, "zzzz"), null);
});
