/**
 * Store locator UI. Runs inside the embed iframe, with no framework.
 * Google Maps is used when NEXT_PUBLIC_GOOGLE_MAPS_KEY is set. Without a key
 * (local preview) it falls back to OpenStreetMap so the layout can still be checked.
 */
(function () {
  var cfg = window.FORM_LOCATOR;
  var search = window.FormLocatorSearch;
  var listEl = document.getElementById("list");
  var input = document.getElementById("q");
  var radiusEl = document.getElementById("radius");
  var mapEl = document.getElementById("map");
  var form = document.getElementById("search-form");
  var pickedPlace = false;
  var pickingSuggestion = false;

  var state = {
    stores: [],
    origin: null,
    radius: cfg.defaultRadiusKm,
    selectedId: null,
    mode: "initial",
    status: cfg.messages.initialMessage,
    statusTone: "hint",
    adapter: null,
  };

  function isMobile() {
    return window.matchMedia("(max-width: " + (cfg.desktopBreakpoint - 1) + "px)").matches;
  }

  function reportHeight() {
    var widget = document.getElementById("locator");
    var height = isMobile() ? widget.offsetHeight : cfg.desktopHeight;
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "form-locator-height", height: height }, "*");
    }
  }

  function directionsUrl(store) {
    var destination =
      typeof store.lat === "number"
        ? store.lat + "," + store.lng
        : encodeURIComponent(search.addressLines(store).join(", "));
    return "https://www.google.com/maps/dir/?api=1&destination=" + destination;
  }

  function pinPopupElement(store) {
    var wrap = document.createElement("div");
    wrap.className = "pin-popup";
    var name = document.createElement("div");
    name.textContent = store.name;
    var link = document.createElement("a");
    link.href = directionsUrl(store);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = cfg.messages.directionsLink;
    wrap.appendChild(name);
    wrap.appendChild(link);
    return wrap;
  }

  function pinIcon() {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("class", "pin");
    svg.setAttribute("aria-hidden", "true");
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "d",
      "M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
    );
    path.setAttribute("fill", "#333");
    svg.appendChild(path);
    return svg;
  }

  function renderList(rows, showDistance) {
    listEl.replaceChildren();
    if (state.status) {
      var status = document.createElement("p");
      status.className = "status" + (state.statusTone === "error" ? " is-error" : "");
      status.setAttribute("role", "status");
      status.textContent = state.status;
      listEl.appendChild(status);
    }
    if (!rows.length) {
      reportHeight();
      return;
    }
    var ul = document.createElement("ul");
    ul.className = "results";
    rows.forEach(function (row) {
      var store = row.store;
      var li = document.createElement("li");
      li.className = "result" + (store.id === state.selectedId ? " is-active" : "");
      li.tabIndex = 0;

      var bullet = document.createElement("span");
      bullet.className = "bullet";
      bullet.setAttribute("aria-hidden", "true");

      var pinCol = document.createElement("div");
      pinCol.className = "pincol";
      pinCol.appendChild(pinIcon());
      if (showDistance && typeof row.distance === "number") {
        var distance = document.createElement("span");
        distance.className = "distance";
        distance.textContent = search.formatDistance(row.distance);
        pinCol.appendChild(distance);
      }

      var body = document.createElement("div");
      body.className = "body";
      var name = document.createElement("div");
      name.className = "name";
      name.textContent = store.name;

      var address = document.createElement("div");
      address.className = "address";
      search.addressLines(store).forEach(function (line) {
        var lineEl = document.createElement("div");
        lineEl.textContent = line;
        address.appendChild(lineEl);
      });

      body.appendChild(name);
      body.appendChild(address);
      li.appendChild(bullet);
      li.appendChild(pinCol);
      li.appendChild(body);

      function choose() {
        state.selectedId = store.id;
        renderList(rows, showDistance);
        if (typeof store.lat === "number" && state.adapter) {
          state.adapter.panTo(store.lat, store.lng);
        }
        var active = listEl.querySelector(".is-active");
        if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
      }
      li.addEventListener("click", choose);
      li.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose(event);
        }
      });
      ul.appendChild(li);
    });
    listEl.appendChild(ul);
    reportHeight();
  }

  function resultRows() {
    if (!state.origin) return [];
    return search.resultsForOrigin(state.stores, state.origin, state.radius, cfg.maxResults);
  }

  function showNotFound() {
    state.mode = "results";
    state.origin = null;
    state.status = cfg.messages.addressNotFound;
    state.statusTone = "error";
    renderList([], false);
  }

  function applyOrigin(origin, fit) {
    state.mode = "results";
    state.origin = origin;
    state.status = "";
    state.statusTone = "hint";
    var rows = resultRows();
    if (!rows.length) {
      state.status = cfg.messages.noResults;
      state.statusTone = "error";
    }
    if (fit && state.adapter) {
      if (rows.length) state.adapter.fitStores(rows.map(function (row) { return row.store; }));
      else state.adapter.panTo(origin.lat, origin.lng);
    }
    renderList(rows, true);
  }

  function resetInitial() {
    state.mode = "initial";
    state.origin = null;
    state.selectedId = null;
    state.status = cfg.messages.initialMessage;
    state.statusTone = "hint";
    renderList([], false);
  }

  function commitTyped() {
    var value = input.value.trim();
    if (!value) {
      resetInitial();
      return;
    }
    if (window.google && google.maps && google.maps.Geocoder) {
      new google.maps.Geocoder().geocode({ address: value, region: "uk" }, function (results, status) {
        if (status === "OK" && results && results[0]) {
          var loc = results[0].geometry.location;
          applyOrigin({ lat: loc.lat(), lng: loc.lng() }, true);
          return;
        }
        var fallback = search.originFromQuery(state.stores, value);
        if (fallback) applyOrigin(fallback, true);
        else showNotFound();
      });
      return;
    }
    var fallback = search.originFromQuery(state.stores, value);
    if (fallback) applyOrigin(fallback, true);
    else showNotFound();
  }

  function onMapIdle() {
    if (state.adapter) state.adapter.sync(visibleStores(), onMarkerPick);
    if (state.mode !== "results") renderList([], false);
  }

  function onMarkerPick(store) {
    state.selectedId = store.id;
    if (state.mode === "results" && state.origin) renderList(resultRows(), true);
    else {
      state.status = "";
      renderList([{ store: store, distance: null }], false);
    }
    var active = listEl.querySelector(".is-active");
    if (active && active.scrollIntoView) active.scrollIntoView({ block: "nearest" });
  }

  function visibleStores() {
    return state.stores.filter(function (store) {
      return typeof store.lat === "number" && typeof store.lng === "number";
    });
  }

  function startPlace() {
    var place = cfg.initialPlace;
    if (place && typeof place.lat === "number" && typeof place.lng === "number") {
      return { lat: place.lat, lng: place.lng };
    }
    var fallback = search.openingView();
    return { lat: fallback.lat, lng: fallback.lng };
  }

  function showNearby(origin) {
    state.mode = "results";
    state.origin = origin;
    state.status = "";
    state.statusTone = "hint";
    var rows = resultRows();
    if (!rows.length) {
      state.status = cfg.messages.noResults;
      state.statusTone = "error";
    }
    if (state.adapter) state.adapter.setView(origin.lat, origin.lng, search.openingView().zoom);
    renderList(rows, true);
  }

  /** Browser location only. Called from the Use my location button, never on load. */
  function tryGeolocation() {
    if (!navigator.geolocation || !window.isSecureContext) {
      state.status = cfg.messages.geolocationError;
      state.statusTone = "error";
      renderList(resultRows(), true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (position) {
        showNearby({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      function () {
        state.status = cfg.messages.geolocationError;
        state.statusTone = "error";
        renderList(resultRows(), true);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }

  function clusterIconUrl(count) {
    var size = count > 99 ? 46 : count > 9 ? 40 : 34;
    var canvas = document.createElement("canvas");
    canvas.width = size * 2;
    canvas.height = size * 2;
    var ctx = canvas.getContext("2d");
    ctx.scale(2, 2);
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fillStyle = "#333333";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 13px Avenir Next, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), size / 2, size / 2 + 0.5);
    return { url: canvas.toDataURL(), size: size };
  }

  function groupByPixel(stores, project) {
    var groups = new Map();
    var width = mapEl.clientWidth || 300;
    var height = mapEl.clientHeight || 240;
    stores.forEach(function (store) {
      var point = project(store.lat, store.lng);
      if (!point) return;
      if (point.x < -64 || point.y < -64 || point.x > width + 64 || point.y > height + 64) return;
      var key = Math.floor(point.x / 56) + ":" + Math.floor(point.y / 56);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(store);
    });
    return groups;
  }

  function spread(stores, project) {
    var points = stores.map(function (store) { return project(store.lat, store.lng); }).filter(Boolean);
    if (points.length < 2) return 0;
    var minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
    points.forEach(function (point) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
    return Math.max(maxX - minX, maxY - minY);
  }

  function createGoogleAdapter() {
    var place = startPlace();
    var view = search.openingView();
    var map = new google.maps.Map(mapEl, {
      center: { lat: place.lat, lng: place.lng },
      zoom: view.zoom,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      gestureHandling: "greedy",
      clickableIcons: false,
    });
    var overlay = new google.maps.OverlayView();
    overlay.onAdd = function () {};
    overlay.draw = function () {};
    overlay.setMap(map);
    var markers = [];
    var info = new google.maps.InfoWindow();
    var idleFn = function () {};
    map.addListener("idle", function () { idleFn(); });

    function project(lat, lng) {
      var projection = overlay.getProjection();
      if (!projection) return null;
      var point = projection.fromLatLngToContainerPixel(new google.maps.LatLng(lat, lng));
      if (!point) return null;
      return { x: point.x, y: point.y };
    }

    function clear() {
      markers.forEach(function (marker) { marker.setMap(null); });
      markers = [];
    }

    return {
      onIdle: function (fn) { idleFn = fn; },
      getBounds: function () {
        var box = map.getBounds();
        if (!box) return null;
        var ne = box.getNorthEast();
        var sw = box.getSouthWest();
        return { north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() };
      },
      getCenter: function () {
        var center = map.getCenter();
        if (!center) return null;
        return { lat: center.lat(), lng: center.lng() };
      },
      panTo: function (lat, lng) {
        map.panTo({ lat: lat, lng: lng });
        if ((map.getZoom() || 0) < 14) map.setZoom(14);
      },
      setView: function (lat, lng, zoom) {
        map.setCenter({ lat: lat, lng: lng });
        map.setZoom(zoom);
      },
      fitStores: function (stores) {
        if (!stores.length) return;
        if (stores.length === 1) {
          map.setCenter({ lat: stores[0].lat, lng: stores[0].lng });
          map.setZoom(14);
          return;
        }
        var box = new google.maps.LatLngBounds();
        stores.forEach(function (store) { box.extend({ lat: store.lat, lng: store.lng }); });
        map.fitBounds(box, 48);
      },
      zoomIn: function () { map.setZoom((map.getZoom() || 6) + 2); },
      sync: function (stores, onPick) {
        clear();
        var icon = {
          url: cfg.markerUrl,
          scaledSize: new google.maps.Size(40, 40),
          anchor: new google.maps.Point(20, 40),
        };
        groupByPixel(stores, project).forEach(function (group) {
          if (group.length === 1) {
            var marker = new google.maps.Marker({
              position: { lat: group[0].lat, lng: group[0].lng },
              map: map,
              icon: icon,
              title: group[0].name,
            });
            marker.addListener("click", function () {
              info.setContent(pinPopupElement(group[0]));
              info.open({ map: map, anchor: marker });
              onPick(group[0]);
            });
            markers.push(marker);
            return;
          }
          var point = search.centroid(group);
          var drawn = clusterIconUrl(group.length);
          var cluster = new google.maps.Marker({
            position: point,
            map: map,
            icon: {
              url: drawn.url,
              scaledSize: new google.maps.Size(drawn.size, drawn.size),
              anchor: new google.maps.Point(drawn.size / 2, drawn.size / 2),
            },
            title: group.length + " stores",
            zIndex: 1000 + group.length,
          });
          cluster.addListener("click", function () {
            if (spread(group, project) < 48) map.setZoom((map.getZoom() || 6) + 2);
            else {
              var box = new google.maps.LatLngBounds();
              group.forEach(function (store) { box.extend({ lat: store.lat, lng: store.lng }); });
              map.fitBounds(box, 48);
            }
          });
          markers.push(cluster);
        });
      },
    };
  }

  function createLeafletAdapter(L) {
    var place = startPlace();
    var view = search.openingView();
    var map = L.map(mapEl, {
      zoomControl: false,
      attributionControl: true,
      center: [place.lat, place.lng],
      zoom: view.zoom,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    var layer = L.layerGroup().addTo(map);
    var idleFn = function () {};
    map.on("moveend", function () { idleFn(); });
    var icon = L.icon({
      iconUrl: cfg.markerUrl,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    function project(lat, lng) {
      var point = map.latLngToContainerPoint([lat, lng]);
      return { x: point.x, y: point.y };
    }

    return {
      onIdle: function (fn) { idleFn = fn; },
      getBounds: function () {
        var box = map.getBounds();
        return { north: box.getNorth(), south: box.getSouth(), east: box.getEast(), west: box.getWest() };
      },
      getCenter: function () {
        var center = map.getCenter();
        return { lat: center.lat, lng: center.lng };
      },
      panTo: function (lat, lng) {
        var zoom = Math.max(map.getZoom(), 14);
        map.setView([lat, lng], zoom);
      },
      setView: function (lat, lng, zoom) {
        map.setView([lat, lng], zoom);
      },
      fitStores: function (stores) {
        if (!stores.length) return;
        if (stores.length === 1) {
          map.setView([stores[0].lat, stores[0].lng], 14);
          return;
        }
        map.fitBounds(stores.map(function (store) { return [store.lat, store.lng]; }), { padding: [40, 40] });
      },
      sync: function (stores, onPick) {
        layer.clearLayers();
        groupByPixel(stores, project).forEach(function (group) {
          if (group.length === 1) {
            var marker = L.marker([group[0].lat, group[0].lng], { icon: icon, title: group[0].name });
            marker.on("click", function () {
              marker.unbindPopup();
              marker.bindPopup(pinPopupElement(group[0])).openPopup();
              onPick(group[0]);
            });
            marker.addTo(layer);
            return;
          }
          var point = search.centroid(group);
          var size = group.length > 99 ? 46 : group.length > 9 ? 40 : 34;
          var clusterIcon = L.divIcon({
            className: "cluster-wrap",
            html: '<div class="cluster" style="width:' + size + "px;height:" + size + 'px">' + group.length + "</div>",
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          });
          var cluster = L.marker([point.lat, point.lng], { icon: clusterIcon });
          cluster.on("click", function () {
            if (spread(group, project) < 48) map.setZoom(map.getZoom() + 2);
            else map.fitBounds(group.map(function (store) { return [store.lat, store.lng]; }), { padding: [40, 40] });
          });
          cluster.addTo(layer);
        });
      },
    };
  }

  /**
   * Address suggestions use Places API (New): AutocompleteSuggestion and Place.fetchFields.
   * The old google.maps.places.Autocomplete widget calls the legacy Places API, which this
   * key cannot use, and Google then draws an error inside the dropdown.
   */
  function attachAutocomplete() {
    var loadPlaces = google.maps.importLibrary
      ? google.maps.importLibrary("places")
      : Promise.resolve(google.maps.places || {});
    loadPlaces.then(wireSuggestions).catch(function () {});
  }

  function predictionText(value) {
    if (!value) return "";
    if (typeof value === "string") return value;
    if (typeof value.text === "string") return value.text;
    if (typeof value.toString === "function") {
      var text = value.toString();
      if (text && text !== "[object Object]") return text;
    }
    return "";
  }

  function wireSuggestions(places) {
    if (!places.AutocompleteSuggestion || !places.AutocompleteSessionToken) return;
    var box = document.createElement("div");
    box.className = "suggestions";
    box.hidden = true;
    box.setAttribute("role", "listbox");
    form.appendChild(box);

    var sessionToken = null;
    var rows = [];
    var activeIndex = -1;
    var suggestTimer = 0;
    var requestId = 0;

    function token() {
      if (!sessionToken) sessionToken = new places.AutocompleteSessionToken();
      return sessionToken;
    }

    function hideSuggestions() {
      box.hidden = true;
      box.replaceChildren();
      rows = [];
      activeIndex = -1;
      input.setAttribute("aria-expanded", "false");
    }

    function renderSuggestions() {
      box.style.top = input.offsetTop + input.offsetHeight + 4 + "px";
      box.replaceChildren();
      if (!rows.length) {
        hideSuggestions();
        return;
      }
      rows.forEach(function (row, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "suggestion" + (index === activeIndex ? " is-active" : "");
        button.setAttribute("role", "option");
        button.textContent = row.label;
        button.addEventListener("mousedown", function (event) {
          event.preventDefault();
        });
        button.addEventListener("click", function () {
          chooseSuggestion(row.prediction);
        });
        box.appendChild(button);
      });
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function chooseSuggestion(prediction) {
      var place = prediction.toPlace();
      hideSuggestions();
      window.clearTimeout(suggestTimer);
      window.clearTimeout(typingTimer);
      pickedPlace = true;
      var label = predictionText(prediction.text);
      if (label) {
        pickingSuggestion = true;
        input.value = label;
        pickingSuggestion = false;
      }
      place
        .fetchFields({ fields: ["location"] })
        .then(function () {
          sessionToken = null;
          var loc = place.location;
          var lat = loc && typeof loc.lat === "function" ? loc.lat() : loc && loc.lat;
          var lng = loc && typeof loc.lng === "function" ? loc.lng() : loc && loc.lng;
          if (typeof lat !== "number" || typeof lng !== "number") {
            pickedPlace = false;
            commitTyped();
            return;
          }
          applyOrigin({ lat: lat, lng: lng }, true);
        })
        .catch(function () {
          sessionToken = null;
          pickedPlace = false;
          commitTyped();
        });
    }

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    input.addEventListener("input", function () {
      if (pickingSuggestion) return;
      window.clearTimeout(suggestTimer);
      var value = input.value.trim();
      if (value.length < 2) {
        hideSuggestions();
        sessionToken = null;
        return;
      }
      suggestTimer = window.setTimeout(function () {
        var current = ++requestId;
        places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: value,
          sessionToken: token(),
          includedRegionCodes: search.placeRegionCodes,
          language: "en-GB",
          region: "gb",
        })
          .then(function (result) {
            if (current !== requestId || input.value.trim() !== value) return;
            rows = (result.suggestions || [])
              .map(function (suggestion) { return suggestion.placePrediction; })
              .filter(Boolean)
              .slice(0, 6)
              .map(function (prediction) {
                return { prediction: prediction, label: predictionText(prediction.text) };
              })
              .filter(function (row) { return row.label; });
            activeIndex = -1;
            renderSuggestions();
          })
          .catch(function () {
            if (current === requestId) hideSuggestions();
          });
      }, 200);
    });

    input.addEventListener("keydown", function (event) {
      if (box.hidden) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        activeIndex = Math.min(rows.length - 1, activeIndex + 1);
        renderSuggestions();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeIndex = Math.max(-1, activeIndex - 1);
        renderSuggestions();
      } else if (event.key === "Escape") {
        hideSuggestions();
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        chooseSuggestion(rows[activeIndex].prediction);
      }
    });

    document.addEventListener("click", function (event) {
      if (!form.contains(event.target)) hideSuggestions();
    });
  }

  function loadLeaflet() {
    return new Promise(function (resolve, reject) {
      var css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      var script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = function () { resolve(window.L); };
      script.onerror = function () { reject(new Error("map")); };
      document.head.appendChild(script);
    });
  }

  function loadGoogle() {
    return new Promise(function (resolve, reject) {
      if (!cfg.mapsKey) {
        reject(new Error("no key"));
        return;
      }
      window.__formLocatorMaps = function () { resolve(); };
      var script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(cfg.mapsKey) +
        "&libraries=places&v=weekly&loading=async&callback=__formLocatorMaps";
      script.async = true;
      script.onerror = function () { reject(new Error("maps")); };
      document.head.appendChild(script);
    });
  }

  function showMapMessage(text) {
    var message = document.createElement("div");
    message.className = "map-message";
    message.textContent = text;
    mapEl.appendChild(message);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    window.setTimeout(function () {
      if (pickedPlace) {
        pickedPlace = false;
        return;
      }
      commitTyped();
    }, 200);
  });

  var typingTimer = 0;
  input.addEventListener("input", function () {
    if (pickingSuggestion) return;
    pickedPlace = false;
    window.clearTimeout(typingTimer);
    var value = input.value;
    typingTimer = window.setTimeout(function () {
      if (!value.trim()) {
        resetInitial();
        return;
      }
      var origin = search.originFromQuery(state.stores, value);
      if (!origin) return;
      state.mode = "results";
      state.origin = origin;
      state.status = "";
      state.statusTone = "hint";
      renderList(resultRows(), true);
    }, 300);
  });

  radiusEl.addEventListener("change", function () {
    state.radius = Number(radiusEl.value);
    if (state.mode === "results" && state.origin) applyOrigin(state.origin, true);
  });

  window.addEventListener("resize", reportHeight);
  if ("ResizeObserver" in window) {
    new ResizeObserver(reportHeight).observe(document.getElementById("locator"));
  }

  var locateButton = document.getElementById("locate");
  if (locateButton) locateButton.addEventListener("click", tryGeolocation);

  state.origin = startPlace();
  state.mode = "results";

  function bootMap() {
    return loadGoogle().then(
      function () {
        state.adapter = createGoogleAdapter();
        attachAutocomplete();
      },
      function () {
        if (cfg.mapsKey) {
          showMapMessage("The map couldn't be loaded. Search still works.");
          return null;
        }
        return loadLeaflet().then(function (L) {
          state.adapter = createLeafletAdapter(L);
        });
      }
    ).then(function () {
      if (state.adapter) {
        state.adapter.onIdle(onMapIdle);
        window.setTimeout(onMapIdle, 350);
      }
      if (state.stores.length) showNearby(state.origin);
      reportHeight();
    });
  }

  // Map first, with London or the IP place already known. Stores fill the list when they arrive.
  bootMap().catch(function () {
    state.status = cfg.messages.genericError;
    state.statusTone = "error";
    renderList([], false);
  });

  fetch(cfg.storesUrl, { headers: { accept: "application/json" } })
    .then(function (response) {
      if (!response.ok) throw new Error("stores");
      return response.json();
    })
    .then(function (data) {
      state.stores = data.stores || [];
      if (!input.value.trim()) showNearby(startPlace());
      else renderList(resultRows(), state.mode === "results");
      if (state.adapter) state.adapter.sync(visibleStores(), onMarkerPick);
    })
    .catch(function () {
      state.status = cfg.messages.genericError;
      state.statusTone = "error";
      renderList([], false);
    });
})();
