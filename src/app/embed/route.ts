import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { locatorSettings, messages } from "@/lib/messages";
import { placeFromIpHeaders } from "@/lib/visitor-place";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function jsString(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function GET() {
  const requestHeaders = await headers();
  // Already on this request. No second lookup, and nothing is logged or stored.
  const initialPlace = placeFromIpHeaders({
    country: requestHeaders.get("x-vercel-ip-country"),
    latitude: requestHeaders.get("x-vercel-ip-latitude"),
    longitude: requestHeaders.get("x-vercel-ip-longitude"),
  });
  const dir = path.join(process.cwd(), "src", "embed");
  const [css, searchJs, locatorJs] = await Promise.all([
    readFile(path.join(dir, "locator.css"), "utf8"),
    readFile(path.join(dir, "search.js"), "utf8"),
    readFile(path.join(dir, "locator.js"), "utf8"),
  ]);

  const config = {
    mapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY?.trim() ?? "",
    storesUrl: "/api/stores",
    markerUrl: "/marker.png",
    messages: {
      addressNotFound: messages.addressNotFound,
      directionsLink: messages.directionsLink,
      genericError: messages.genericError,
      geolocationError: messages.geolocationError,
      initialMessage: messages.initialMessage,
      noResults: messages.noResults,
      searchPlaceholder: messages.searchPlaceholder,
    },
    defaultRadiusKm: locatorSettings.defaultRadiusKm,
    maxResults: locatorSettings.maxResults,
    desktopBreakpoint: locatorSettings.desktopBreakpoint,
    desktopHeight: locatorSettings.desktopHeight,
    initialPlace,
  };

  const radiusOptions = locatorSettings.radiusOptions
    .map(
      (km) =>
        `<option value="${km}"${km === locatorSettings.defaultRadiusKm ? " selected" : ""}>${km} km</option>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="/marker.png">
<title>Store locator</title>
<style>${css}</style>
</head>
<body>
<div id="locator" class="widget">
  <section class="panel" aria-label="Stores">
    <form id="search-form" class="search" role="search" autocomplete="off">
      <label class="sr-only" for="q">Search by postcode or address</label>
      <input id="q" name="q" type="search" enterkeyhint="search" placeholder="${messages.searchPlaceholder}" autocomplete="off">
      <div class="tools">
        <label class="radius">Within
          <select id="radius" aria-label="Search radius">${radiusOptions}</select>
        </label>
        <button type="button" id="locate" class="locate">Use my location</button>
      </div>
    </form>
    <div id="list" class="list"></div>
  </section>
  <div id="map" class="map" role="region" aria-label="Map of stores"></div>
</div>
<script>window.FORM_LOCATOR = ${jsString(config)};</script>
<script>${searchJs}</script>
<script>${locatorJs}</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Private: the page includes this visitor's approximate place. Do not cache it on a shared CDN.
      "Cache-Control": "private, no-store",
    },
  });
}
