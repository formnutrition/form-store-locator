export const ADMIN_COOKIE = "form_locator_admin";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, payload: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return new Uint8Array(signature);
}

function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

async function sha256(text: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}

export function adminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD?.trim() && process.env.AUTH_SECRET?.trim());
}

export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected) return false;
  const [left, right] = await Promise.all([sha256(input), sha256(expected)]);
  return safeEqual(left, right);
}

export async function createSessionToken(now = Date.now()): Promise<string | null> {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) return null;
  const payload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify({ exp: now + SESSION_MS }))
  );
  const signature = bytesToBase64Url(await hmac(secret, payload));
  return `${payload}.${signature}`;
}

export async function readSessionToken(token: string | undefined | null, now = Date.now()): Promise<boolean> {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const expected = bytesToBase64Url(await hmac(secret, parts[0]));
  const actualBytes = base64UrlToBytes(parts[1]);
  const expectedBytes = base64UrlToBytes(expected);
  if (!safeEqual(actualBytes, expectedBytes)) return false;
  try {
    const json = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[0]))) as { exp?: number };
    return typeof json.exp === "number" && json.exp > now;
  } catch {
    return false;
  }
}

/** Secure only on https. A production build on http://localhost must still be able to sign in. */
export function sessionCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_MS / 1000,
  };
}

const attempts = new Map<string, { count: number; resetAt: number }>();

export function loginRateLimited(ip: string, now = Date.now()): boolean {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= 8;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string): void {
  attempts.delete(ip);
}
