export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Confirms the server has a Supabase URL and a real service key.
 * Accepts the legacy service_role JWT and the newer sb_secret_ key.
 * Rejects the anon and publishable keys so a copy-paste mix-up fails loudly.
 */
export function assertSupabaseServiceRoleConfigured(): { url: string; serviceRoleKey: string } {
  const url = process.env.SUPABASE_URL?.trim() ?? "";
  if (!url) {
    throw new SupabaseConfigError(
      "Missing SUPABASE_URL. Add it in Vercel for Production and Preview."
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SupabaseConfigError("SUPABASE_URL is not a valid URL.");
  }
  if (parsed.protocol !== "https:") {
    throw new SupabaseConfigError("SUPABASE_URL must start with https://.");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
  if (!serviceRoleKey) {
    throw new SupabaseConfigError(
      "Missing SUPABASE_SERVICE_ROLE_KEY. The server will not fall back to the anon key."
    );
  }
  if (serviceRoleKey.startsWith("sb_publishable_") || serviceRoleKey.startsWith("sb_anon_")) {
    throw new SupabaseConfigError(
      "SUPABASE_SERVICE_ROLE_KEY is a publishable key. Paste the service_role secret or the sb_secret_ key."
    );
  }

  if (serviceRoleKey.startsWith("eyJ")) {
    const payload = decodeJwtPayload(serviceRoleKey);
    const role = typeof payload?.role === "string" ? payload.role : "";
    if (role === "anon" || role === "authenticated") {
      throw new SupabaseConfigError(
        `SUPABASE_SERVICE_ROLE_KEY is an ${role} key. Paste the service_role secret instead.`
      );
    }
    if (role !== "service_role") {
      throw new SupabaseConfigError(
        "SUPABASE_SERVICE_ROLE_KEY is not a service_role JWT. Paste the service_role secret from Supabase → Project Settings → API."
      );
    }
  } else if (!serviceRoleKey.startsWith("sb_secret_")) {
    throw new SupabaseConfigError(
      "SUPABASE_SERVICE_ROLE_KEY should be the service_role JWT (starts with eyJ) or a secret key (starts with sb_secret_)."
    );
  }

  return { url, serviceRoleKey };
}

export function supabaseConfigured(): boolean {
  try {
    assertSupabaseServiceRoleConfigured();
    return true;
  } catch {
    return false;
  }
}
