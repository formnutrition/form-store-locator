"use client";

import { useMemo, useState } from "react";
import { parseCsv, storeInputFromRecord } from "@/lib/csv";
import { oneLineAddress } from "@/lib/stores-model";
import type { Store } from "@/lib/types";

const PAGE = 25;

export default function AdminList({
  stores,
  source,
  saved,
}: {
  stores: Store[];
  source: "supabase" | "seed";
  saved: boolean;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState("");
  const [importError, setImportError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = stores.slice().sort((a, b) => a.name.localeCompare(b.name) || a.city.localeCompare(b.city));
    if (!q) return rows;
    return rows.filter((store) =>
      [store.name, store.address1, store.address2, store.city, store.state, store.postalCode, store.country, store.stockistId]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [stores, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages);
  const start = (current - 1) * PAGE;
  const slice = filtered.slice(start, start + PAGE);
  const unplaced = stores.filter((store) => store.latitude == null || store.longitude == null).length;

  async function onImport(file: File) {
    setImportError("");
    setImporting("Reading the file…");
    try {
      const rows = parseCsv(await file.text()).map(storeInputFromRecord);
      let savedCount = 0;
      let warnings = 0;
      for (let i = 0; i < rows.length; i += 20) {
        const batch = rows.slice(i, i + 20);
        setImporting(`Placing addresses on the map… ${Math.min(i + batch.length, rows.length)} of ${rows.length}`);
        const response = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rows: batch }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Import failed.");
        savedCount += body.saved || 0;
        warnings += (body.failures || []).length;
      }
      setImporting(`Imported ${savedCount} locations${warnings ? ` (${warnings} need a look)` : ""}.`);
      window.location.href = "/admin?saved=1";
    } catch (error) {
      setImporting("");
      setImportError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">All locations</h1>
          <p className="mt-1 text-sm text-form-muted">
            {unplaced
              ? `${unplaced} ${unplaced === 1 ? "address is" : "addresses are"} not on the map yet.`
              : "Every address is placed on the map."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer border border-form-black px-4 py-2 text-sm">
            Bulk import
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onImport(file);
              }}
            />
          </label>
          <a href="/api/admin/export" className="border border-form-black px-4 py-2 text-sm">
            Bulk export
          </a>
          <a href="/admin/locations/new" className="bg-form-gold px-4 py-2 text-sm font-semibold">
            Add location
          </a>
        </div>
      </div>

      {source === "seed" ? (
        <p className="mt-4 bg-white px-4 py-3 text-sm">
          This is a preview of the Stockist file. Connect Supabase before saving changes. The live locator will keep using this preview until then.
        </p>
      ) : null}
      {saved ? <p className="mt-4 bg-white px-4 py-3 text-sm">Saved. The store locator will catch up within a minute.</p> : null}
      {importing ? <p className="mt-4 text-sm">{importing}</p> : null}
      {importError ? <p className="mt-4 text-sm text-red-800">{importError}</p> : null}

      <div className="mt-6 bg-white shadow-sm">
        <div className="border-b border-form-stone p-4">
          <label className="sr-only" htmlFor="location-search">
            Search locations
          </label>
          <input
            id="location-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search locations…"
            className="w-full border border-form-stone px-3 py-2"
          />
          <p className="mt-3 text-sm">
            Showing {filtered.length ? start + 1 : 0}–{Math.min(start + PAGE, filtered.length)} of {filtered.length} locations
          </p>
        </div>
        <ul>
          {slice.map((store) => (
            <li key={store.id} className="border-b border-form-stone last:border-b-0">
              <a href={`/admin/locations/${store.id}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-form-cream">
                <span>
                  <span className="block font-semibold">{store.name}</span>
                  <span className="mt-1 block text-sm text-form-muted">{oneLineAddress(store)}</span>
                </span>
                <span className="flex items-center gap-3">
                  {store.latitude == null ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-900">Not on map</span>
                  ) : null}
                  <span
                    className={
                      store.visible
                        ? "rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                        : "rounded-full bg-stone-100 px-2 py-1 text-xs text-stone-600"
                    }
                  >
                    {store.visible ? "Active" : "Hidden"}
                  </span>
                  <span aria-hidden className="text-form-muted">
                    ›
                  </span>
                </span>
              </a>
            </li>
          ))}
          {!slice.length ? <li className="px-4 py-8 text-sm text-form-muted">No locations match that search.</li> : null}
        </ul>
        {pages > 1 ? (
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <button
              type="button"
              className="underline disabled:no-underline disabled:opacity-40"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
            >
              Previous
            </button>
            <span>
              Page {current} of {pages}
            </span>
            <button
              type="button"
              className="underline disabled:no-underline disabled:opacity-40"
              disabled={current >= pages}
              onClick={() => setPage(current + 1)}
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
