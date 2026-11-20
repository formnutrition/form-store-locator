import { NextResponse, type NextRequest } from "next/server";
import { databaseErrorResponse, requireAdmin } from "@/lib/admin-guard";
import { importBatchLimit, importRows } from "@/lib/store-writes";
import type { StoreInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = (await request.json()) as { rows?: StoreInput[] };
    const rows = body.rows ?? [];
    if (!Array.isArray(rows) || !rows.length) {
      return NextResponse.json({ error: "No rows to import." }, { status: 400 });
    }
    if (rows.length > importBatchLimit()) {
      return NextResponse.json(
        { error: `Send at most ${importBatchLimit()} rows at a time.` },
        { status: 400 }
      );
    }
    const result = await importRows(rows);
    return NextResponse.json(result);
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
