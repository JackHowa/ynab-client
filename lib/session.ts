/**
 * Encrypted session stored in an httpOnly cookie.
 *
 * Holds the YNAB OAuth tokens. Encrypted with AES-256-GCM using a key derived
 * from SESSION_SECRET, so the cookie value is opaque and tamper-evident.
 */
import "server-only";
import { cookies } from "next/headers";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const SESSION_COOKIE = "ynab_session";

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the access token expires. */
  expiresAt: number;
}

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Missing SESSION_SECRET.");
  // Derive a fixed 32-byte key regardless of the secret's length/encoding.
  return createHash("sha256").update(secret).digest();
}

/** Encrypt a session to a compact base64url string: iv.tag.ciphertext */
export function seal(session: Session): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(session), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext]
    .map((b) => b.toString("base64url"))
    .join(".");
}

/** Decrypt a sealed session, or return null if missing/invalid/tampered. */
export function unseal(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const [ivB64, tagB64, dataB64] = value.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8")) as Session;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return unseal(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, seal(session), {
    ...cookieOptions,
    // Tied to the refresh token's usefulness; the access token itself is short.
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
