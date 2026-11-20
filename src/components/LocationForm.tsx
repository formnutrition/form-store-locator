"use client";

import { useState } from "react";
import type { Store, StoreInput } from "@/lib/types";

const empty: StoreInput = {
  stockistId: "",
  name: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  phone: "",
  website: "",
  email: "",
  logoUrl: "",
  notes: "",
  priority: null,
  visible: true,
};

export default function LocationForm({ store }: { store: Store | null }) {
  const [fields, setFields] = useState<StoreInput>(store ?? empty);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof StoreInput>(key: K, value: StoreInput[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setWarning("");
    const response = await fetch(store ? `/api/admin/stores/${store.id}` : "/api/admin/stores", {
      method: store ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(fields),
    });
    const body = await response.json();
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "Could not save.");
      return;
    }
    if (body.warning) setWarning(body.warning);
    const id = body.store?.id || store?.id;
    window.location.href = id ? `/admin/locations/${id}?saved=1` : "/admin?saved=1";
  }

  async function onDelete() {
    if (!store) return;
    if (!window.confirm("Remove this location? It will disappear from the store locator.")) return;
    setSaving(true);
    const response = await fetch(`/api/admin/stores/${store.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setError(body.error || "Could not remove it.");
      return;
    }
    window.location.href = "/admin?saved=1";
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <p className="text-sm">
        <a href="/admin" className="underline">
          All locations
        </a>
      </p>
      <h1 className="text-3xl font-semibold">{store ? "Edit location" : "Add location"}</h1>
      {store ? (
        <p className="text-sm text-form-muted">
          {store.latitude != null
            ? "This address is placed on the map."
            : "This address is not on the map yet. Saving it will try again."}
        </p>
      ) : (
        <p className="text-sm text-form-muted">Saving looks up the address and drops a pin on the map.</p>
      )}

      <Field label="Name" value={fields.name} onChange={(value) => set("name", value)} required />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={fields.visible}
          onChange={(event) => set("visible", event.target.checked)}
        />
        Active (shown on the store locator)
      </label>
      <Field label="Address line 1" value={fields.address1} onChange={(value) => set("address1", value)} />
      <Field label="Address line 2" value={fields.address2} onChange={(value) => set("address2", value)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" value={fields.city} onChange={(value) => set("city", value)} />
        <Field label="State / county" value={fields.state} onChange={(value) => set("state", value)} />
        <Field label="Postcode" value={fields.postalCode} onChange={(value) => set("postalCode", value)} />
        <Field label="Country" value={fields.country} onChange={(value) => set("country", value)} />
        <Field label="Phone" value={fields.phone} onChange={(value) => set("phone", value)} />
        <Field label="Website" value={fields.website} onChange={(value) => set("website", value)} />
        <Field label="Email" value={fields.email} onChange={(value) => set("email", value)} />
        <Field
          label="Priority"
          value={fields.priority == null ? "" : String(fields.priority)}
          onChange={(value) => set("priority", value.trim() ? Number(value) : null)}
        />
      </div>
      <Field label="Logo URL" value={fields.logoUrl} onChange={(value) => set("logoUrl", value)} />
      <label className="block text-sm">
        Notes
        <textarea
          value={fields.notes}
          onChange={(event) => set("notes", event.target.value)}
          rows={3}
          className="mt-1 w-full border border-form-stone bg-white px-3 py-2"
        />
      </label>
      <Field label="Stockist ID" value={fields.stockistId} onChange={(value) => set("stockistId", value)} />
      <p className="text-xs text-form-muted">Leave the Stockist ID blank and one will be created. Imports match on this id.</p>

      {error ? <p className="text-sm text-red-800">{error}</p> : null}
      {warning ? <p className="text-sm text-amber-900">{warning}</p> : null}

      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button type="submit" disabled={saving} className="bg-form-gold px-5 py-3 font-semibold disabled:opacity-60">
          {saving ? "Saving…" : "Save location"}
        </button>
        {store ? (
          <button type="button" onClick={() => void onDelete()} disabled={saving} className="text-sm underline">
            Remove location
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-form-stone bg-white px-3 py-2"
      />
    </label>
  );
}
