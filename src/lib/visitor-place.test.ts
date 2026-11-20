import assert from "node:assert/strict";
import test from "node:test";
import { LONDON, placeFromIpHeaders } from "./visitor-place";

test("IP location is used only for the UK, Ireland and the Crown Dependencies", () => {
  assert.deepEqual(
    placeFromIpHeaders({ country: "GB", latitude: "53.48", longitude: "-2.24" }),
    { lat: 53.48, lng: -2.24 }
  );
  assert.deepEqual(
    placeFromIpHeaders({ country: "ie", latitude: "53.35", longitude: "-6.26" }),
    { lat: 53.35, lng: -6.26 }
  );
  for (const country of ["JE", "GG", "IM"]) {
    const place = placeFromIpHeaders({ country, latitude: "49.2", longitude: "-2.1" });
    assert.equal(place.lat, 49.2, country);
  }
  assert.deepEqual(placeFromIpHeaders({ country: "US", latitude: "40.7", longitude: "-74" }), LONDON);
  assert.deepEqual(placeFromIpHeaders({ country: "GB", latitude: "", longitude: "-0.1" }), LONDON);
  assert.deepEqual(placeFromIpHeaders({ country: "", latitude: "51.5", longitude: "-0.1" }), LONDON);
  assert.deepEqual(placeFromIpHeaders({ country: "GB", latitude: "nope", longitude: "0" }), LONDON);
});
