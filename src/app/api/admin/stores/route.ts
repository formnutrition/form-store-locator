import { NextResponse, type NextRequest } from "next/server";
import { databaseErrorResponse, requireAdmin } from "@/lib/admin-guard";
import { normalizeInput } from "@/lib/stores-model";
import { createStore } from "@/lib/store-writes";
import type { StoreInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = normalizeInput((await request.json()) as Partial<StoreInput>);
    if (!body.name) {
      return NextResponse.json({ error: "A location needs a name." }, { status: 400 });
    }
    const result = await createStore(body);
    return NextResponse.json(result);
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
