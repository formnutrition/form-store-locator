import { NextResponse } from "next/server";
import { getPublicStores } from "@/lib/store-repository";
import { messages } from "@/lib/messages";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stores = await getPublicStores();
    return NextResponse.json(
      { stores },
      {
        headers: {
          // A minute on the CDN, then another minute of stale-while-revalidate.
          // Admin saves also call revalidatePath so this usually updates sooner.
          "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("[stores]", error);
    return NextResponse.json({ error: messages.genericError }, { status: 500 });
  }
}
