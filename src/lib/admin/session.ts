import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { allow, clientIp } from "@/lib/rate-limit";

/**
 * 93+ · Shop editor sign-in
 *
 * One password for the shop (ADMIN_PASSWORD), no accounts. Signing in sets
 * an httpOnly cookie that says "signed in until <time>", signed with a key
 * made from the password — so changing the password signs everyone out.
 * ADMIN_SECRET, if set, is mixed into that key too.
 */

const COOKIE = "93plus_admin";
const DAYS = 30;

function key() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return createHash("sha256")
    .update(`93plus-editor\0${process.env.ADMIN_SECRET ?? ""}\0${password}`)
    .digest();
}

const sign = (k: Buffer, until: string) =>
  createHmac("sha256", k).update(`editor:${until}`).digest("base64url");

function same(a: string, b: string) {
  const x = createHash("sha256").update(a).digest();
  const y = createHash("sha256").update(b).digest();
  return timingSafeEqual(x, y);
}

export const passwordIsSet = () => Boolean(process.env.ADMIN_PASSWORD);

export async function isAdmin(): Promise<boolean> {
  const k = key();
  const value = (await cookies()).get(COOKIE)?.value;
  if (!k || !value) return false;
  const [until, sig] = value.split(".");
  if (!until || !sig || Number(until) < Date.now()) return false;
  return same(sig, sign(k, until));
}

async function isHttps() {
  const proto = (await headers()).get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https";
}

export type SignInResult = { ok: true } | { ok: false; error: string };

export async function signIn(password: string): Promise<SignInResult> {
  const k = key();
  if (!k) return { ok: false, error: "No password is set for the editor yet (ADMIN_PASSWORD)." };
  // Ten tries in fifteen minutes from one connection: plenty for a typo,
  // useless for guessing.
  if (!allow(`signin:${await clientIp()}`, 10, 15 * 60_000))
    return { ok: false, error: "Too many tries. Wait a few minutes." };
  if (!same(String(password ?? ""), process.env.ADMIN_PASSWORD!))
    return { ok: false, error: "That's not the password." };
  const until = String(Date.now() + DAYS * 86_400_000);
  (await cookies()).set(COOKIE, `${until}.${sign(k, until)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: await isHttps(),
    maxAge: DAYS * 86_400,
    path: "/",
  });
  return { ok: true };
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
}
