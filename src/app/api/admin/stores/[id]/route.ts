import { NextResponse, type NextRequest } from "next/server";
import { databaseErrorResponse, requireAdmin } from "@/lib/admin-guard";
import { getStore } from "@/lib/store-repository";
import { normalizeInput } from "@/lib/stores-model";
import { deleteStore, updateStore } from "@/lib/store-writes";
import type { StoreInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const { store: current, source } = await getStore(id);
    if (!current) return NextResponse.json({ error: "That location was not found." }, { status: 404 });
    if (source !== "supabase") {
      return NextResponse.json({ error: "The store database is not connected yet." }, { status: 503 });
    }
    const body = normalizeInput((await request.json()) as Partial<StoreInput>);
    if (!body.name) {
      return NextResponse.json({ error: "A location needs a name." }, { status: 400 });
    }
    const result = await updateStore(id, body, current);
    return NextResponse.json(result);
  } catch (error) {
    return databaseErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const { store, source } = await getStore(id);
    if (!store) return NextResponse.json({ error: "That location was not found." }, { status: 404 });
    if (source !== "supabase") {
      return NextResponse.json({ error: "The store database is not connected yet." }, { status: 503 });
    }
    await deleteStore(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
