import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { fromDb, toPublicList } from "./stores-model";
import { getSupabase } from "./supabase";
import { supabaseConfigured } from "./supabase-env";
import type { DbStoreRow, PublicStore, Store } from "./types";

const SEED_PATH = path.join(process.cwd(), "data", "seed-stores.json");

let seedCache: Store[] | null = null;

async function readSeed(): Promise<Store[]> {
  if (seedCache) return seedCache;
  const text = await readFile(SEED_PATH, "utf8");
  seedCache = JSON.parse(text) as Store[];
  return seedCache;
}

export type StoreSource = "supabase" | "seed";

export async function listStores(): Promise<{ stores: Store[]; source: StoreSource }> {
  if (!supabaseConfigured()) {
    return { stores: await readSeed(), source: "seed" };
  }
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  return { stores: (data as DbStoreRow[]).map(fromDb), source: "supabase" };
}

async function loadPublicStores(): Promise<PublicStore[]> {
  const { stores } = await listStores();
  return toPublicList(stores);
}

/**
 * Public map data. Cached for a minute so the WordPress page stays fast,
 * and dropped as soon as someone saves in the admin (see revalidateTag).
 */
export const getPublicStores = unstable_cache(loadPublicStores, ["public-stores-v1"], {
  revalidate: 60,
  tags: ["stores"],
});

export async function getStore(id: string): Promise<{ store: Store | null; source: StoreSource }> {
  if (!supabaseConfigured()) {
    const stores = await readSeed();
    return { store: stores.find((store) => store.id === id) ?? null, source: "seed" };
  }
  const supabase = getSupabase();
  const { data, error } = await supabase.from("stores").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return { store: data ? fromDb(data as DbStoreRow) : null, source: "supabase" };
}
