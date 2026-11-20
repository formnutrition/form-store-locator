/**
 * Distance and address helpers shared by the embed and the unit tests.
 * No DOM. Attaches FormLocatorSearch in the browser and module.exports in Node.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FormLocatorSearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function haversineKm(a, b) {
    var radius = 6371;
    var dLat = ((b.lat - a.lat) * Math.PI) / 180;
    var dLng = ((b.lng - a.lng) * Math.PI) / 180;
    var lat1 = (a.lat * Math.PI) / 180;
    var lat2 = (b.lat * Math.PI) / 180;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function formatDistance(km) {
    if (!Number.isFinite(km)) return "";
    if (km < 100) return km.toFixed(1) + " km";
    return Math.round(km) + " km";
  }

  function addressLines(store) {
    var lines = [];
    if (store.address1) lines.push(store.address1);
    if (store.address2) lines.push(store.address2);
    var cityLine = [store.city, store.postalCode].filter(Boolean).join(", ");
    if (cityLine) lines.push(cityLine);
    if (store.country) lines.push(store.country);
    return lines;
  }

  function located(stores) {
    return stores.filter(function (store) {
      return typeof store.lat === "number" && typeof store.lng === "number";
    });
  }

  function centroid(stores) {
    var rows = located(stores);
    if (!rows.length) return null;
    var lat = 0;
    var lng = 0;
    rows.forEach(function (store) {
      lat += store.lat;
      lng += store.lng;
    });
    return { lat: lat / rows.length, lng: lng / rows.length };
  }

  function compactPostcode(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function looksLikePostcode(value) {
    return /^[a-z]{1,2}\d/.test(value) || /^[a-z]\d{2}[a-z0-9]{0,4}$/.test(value);
  }

  /** Outward code, so "W12 8AA" is W12 and "W1 2AB" is W1, not W12. An Eircode's routing key is its first three characters. */
  function outwardCode(postal) {
    var compact = compactPostcode(postal);
    if (/^[a-z]\d{2}[a-z0-9]{4}$/.test(compact)) return compact.slice(0, 3);
    if (compact.length >= 5) return compact.slice(0, -3);
    return compact;
  }

  function isEircode(postal) {
    return /^[a-z]\d{2}[a-z0-9]{4}$/.test(compactPostcode(postal));
  }

  /**
   * Guess a map point from the stores we already have, so a postcode or city
   * still works before Google Places is available.
   */
  function originFromQuery(stores, query) {
    var q = String(query || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
    if (q.length < 2) return null;
    var compact = compactPostcode(q);
    var rows = located(stores);

    var exact = rows.filter(function (store) {
      return compactPostcode(store.postalCode) === compact;
    });
    if (exact.length) return centroid(exact);

    if (looksLikePostcode(compact)) {
      var ukMatches = [];
      var eircodeMatches = [];
      rows.forEach(function (store) {
        var outward = outwardCode(store.postalCode);
        if (!(outward === compact || outward.indexOf(compact) === 0)) return;
        if (isEircode(store.postalCode)) eircodeMatches.push(store);
        else ukMatches.push(store);
      });
      // "W12" is both a London district and an Irish routing key. Prefer the UK postcode.
      var prefixed = ukMatches.length ? ukMatches : eircodeMatches;
      if (prefixed.length) return centroid(prefixed);
    }

    var city = rows.filter(function (store) {
      return String(store.city || "").toLowerCase() === q;
    });
    if (city.length) return centroid(city);

    if (q.length >= 4) {
      var cityPrefix = rows.filter(function (store) {
        return String(store.city || "").toLowerCase().indexOf(q) === 0;
      });
      if (cityPrefix.length) return centroid(cityPrefix);
    }

    return null;
  }

  function resultsForOrigin(stores, origin, radiusKm, limit) {
    return located(stores)
      .map(function (store) {
        return { store: store, distance: haversineKm(origin, { lat: store.lat, lng: store.lng }) };
      })
      .filter(function (row) {
        return row.distance <= radiusKm;
      })
      .sort(function (a, b) {
        return a.distance - b.distance;
      })
      .slice(0, limit);
  }

  function inBounds(stores, bounds, center, limit) {
    return located(stores)
      .filter(function (store) {
        return (
          store.lat <= bounds.north &&
          store.lat >= bounds.south &&
          store.lng <= bounds.east &&
          store.lng >= bounds.west
        );
      })
      .map(function (store) {
        return {
          store: store,
          distance: center ? haversineKm(center, { lat: store.lat, lng: store.lng }) : null,
        };
      })
      .sort(function (a, b) {
        return (a.distance || 0) - (b.distance || 0);
      })
      .slice(0, limit);
  }

  /** Central London. Used when the visitor is not in the UK, Ireland, or the Crown Dependencies. */
  function openingView() {
    return {
      lat: 51.5074,
      lng: -0.1278,
      zoom: 12,
    };
  }

  var placeRegionCodes = ["gb", "ie", "je", "gg", "im"];

  return {
    haversineKm: haversineKm,
    formatDistance: formatDistance,
    addressLines: addressLines,
    originFromQuery: originFromQuery,
    resultsForOrigin: resultsForOrigin,
    inBounds: inBounds,
    centroid: centroid,
    openingView: openingView,
    placeRegionCodes: placeRegionCodes,
  };
});
