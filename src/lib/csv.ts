import { CSV_HEADERS, inferCountry, parsePriority, parseVisible } from "./stores-model";
import type { Store, StoreInput } from "./types";

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

/** Parse a Stockist export. Handles quotes, commas inside quotes, and a BOM. */
export function parseCsv(text: string): Record<string, string>[] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmpty = rows.filter((cells) => cells.some((value) => value.trim() !== ""));
  if (!nonEmpty.length) throw new CsvError("The file is empty.");

  const headers = nonEmpty[0].map((header) => header.trim());
  if (!headers.includes("Name")) {
    throw new CsvError(
      "This file doesn't look like a Stockist export. It needs a Name column."
    );
  }

  return nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

export function storeInputFromRecord(record: Record<string, string>): StoreInput {
  const postalCode = record["Postal code"] ?? "";
  return {
    stockistId: record["Stockist ID"] ?? "",
    name: record["Name"] ?? "",
    address1: record["Address line 1"] ?? "",
    address2: record["Address line 2"] ?? "",
    city: record["City"] ?? "",
    state: record["State/Province"] ?? "",
    postalCode,
    country: inferCountry(record["Country"] ?? "", postalCode),
    phone: record["Phone"] ?? "",
    website: record["Website"] ?? "",
    email: record["Email"] ?? "",
    logoUrl: record["Logo URL"] ?? "",
    notes: record["Notes"] ?? "",
    priority: parsePriority(record["Priority"] ?? ""),
    visible: parseVisible(record["Visible"] ?? ""),
  };
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function storesToCsv(stores: Store[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const store of stores) {
    const cells = [
      store.stockistId,
      store.name,
      store.address1,
      store.address2,
      store.city,
      store.state,
      store.postalCode,
      store.country,
      store.phone,
      store.website,
      store.email,
      store.logoUrl,
      store.notes,
      store.priority == null ? "" : String(store.priority),
      store.visible ? "Yes" : "No",
    ];
    lines.push(cells.map(csvCell).join(","));
  }
  return lines.join("\n") + "\n";
}
