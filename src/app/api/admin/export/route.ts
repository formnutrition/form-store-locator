import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { storesToCsv } from "@/lib/csv";
import { listStores } from "@/lib/store-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { stores } = await listStores();
    const csv = storesToCsv(stores);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"stores.csv\"",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export]", error);
    return NextResponse.json({ error: "The export failed." }, { status: 500 });
  }
}
