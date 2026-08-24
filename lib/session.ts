import { cookies } from "next/headers";

const COOKIE = "leaddesk_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // a phone you unlock daily, not a bank

/**
 * One passcode, one user, no user table. The cookie carries an issue timestamp and
 * an HMAC over it, so a forged or expired cookie is rejected without a database
 * lookup. Web Crypto is used rather than node:crypto so the same code runs in
 * middleware and in server actions.
 */
function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is not set. Copy .env.example to .env.");
  return value;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sign(payload: string): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(payload)));
}

/** Length-independent comparison, so a wrong signature leaks nothing through timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueToken(now: number = Date.now()): Promise<string> {
  const payload = String(now);
  return `${payload}.${await sign(payload)}`;
}

export async function verifyToken(token: string | undefined, now: number = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (!safeEqual(signature, await sign(payload))) return false;
  const issued = Number(payload);
  if (!Number.isFinite(issued)) return false;
  return now - issued < MAX_AGE_SECONDS * 1000;
}

export function checkPasscode(input: string): boolean {
  const expected = process.env.APP_PASSCODE;
  if (!expected) throw new Error("APP_PASSCODE is not set. Copy .env.example to .env.");
  return safeEqual(input.trim(), expected);
}

export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, await issueToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isSignedIn(): Promise<boolean> {
  return verifyToken((await cookies()).get(COOKIE)?.value);
}

export const SESSION_COOKIE = COOKIE;
