import { and, eq, isNull } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { adminFactorSessions, adminRecoveryCodes, adminSecondFactors } from "../db/schema";
import { isIcsAdmin, TecAuthorizationError, TecInputError } from "./tec";

const COOKIE = "tecrid_admin_mfa";
const SESSION_MS = 12 * 60 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

function nowIso() {
  return new Date().toISOString();
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function base32Encode(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const character of secret.toUpperCase().replace(/=+$/g, "")) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function copyBytes(bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function hotp(secret: Uint8Array, counter: number) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(0, Math.floor(counter / 2 ** 32));
  view.setUint32(4, counter >>> 0);
  const key = await crypto.subtle.importKey("raw", copyBytes(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer));
  const offset = mac[mac.length - 1] & 0xf;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, "0");
}

export async function totpCode(secret: string, at = Date.now()) {
  return hotp(base32Decode(secret), Math.floor(at / 30000));
}

async function totpMatches(secret: string, code: string, at = Date.now()) {
  const normalized = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(at / 30000);
  for (const step of [counter - 1, counter, counter + 1]) {
    if (step >= 0 && await hotp(base32Decode(secret), step) === normalized) return true;
  }
  return false;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function readCookie(header: string | null, name = COOKIE) {
  if (!header) return null;
  const part = header.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  if (!part) return null;
  try { return decodeURIComponent(part.slice(name.length + 1)); } catch { return null; }
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function recoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

function requireAdmin(user: ChatGPTUser) {
  if (!isIcsAdmin(user)) throw new TecAuthorizationError("ICS administrator access required.");
  return normalizeEmail(user.email);
}

async function factorRow(email: string) {
  const db = getDb();
  const [row] = await db.select().from(adminSecondFactors).where(eq(adminSecondFactors.email, email)).limit(1);
  return row ?? null;
}

async function assertNotLocked(row: { failedAttempts: number; lockedUntil: string | null }) {
  if (row.lockedUntil && Date.parse(row.lockedUntil) > Date.now()) {
    throw new TecAuthorizationError("Too many second-factor attempts. Try again later.");
  }
}

async function recordFailure(email: string, failedAttempts: number) {
  const next = failedAttempts + 1;
  const db = getDb();
  await db.update(adminSecondFactors).set({
    failedAttempts: next,
    lockedUntil: next >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS).toISOString() : null,
  }).where(eq(adminSecondFactors.email, email));
}

async function clearFailures(email: string) {
  const db = getDb();
  await db.update(adminSecondFactors).set({ failedAttempts: 0, lockedUntil: null }).where(eq(adminSecondFactors.email, email));
}

export async function beginAdminEnrollment(user: ChatGPTUser) {
  const email = requireAdmin(user);
  const existing = await factorRow(email);
  if (existing?.verifiedAt) throw new TecInputError("A second factor is already enrolled. Use a recovery code if you need to replace it.");
  const secret = base32Encode(crypto.getRandomValues(new Uint8Array(20)));
  const createdAt = nowIso();
  const db = getDb();
  if (existing) {
    await db.update(adminSecondFactors).set({ totpSecret: secret, verifiedAt: null, createdAt }).where(eq(adminSecondFactors.email, email));
  } else {
    await db.insert(adminSecondFactors).values({ email, totpSecret: secret, createdAt, failedAttempts: 0 });
  }
  const label = encodeURIComponent(email);
  return {
    secret,
    otpauthUrl: `otpauth://totp/TECRID:${label}?secret=${secret}&issuer=TECRID&algorithm=SHA1&digits=6&period=30`,
  };
}

async function issueSession(email: string) {
  const token = randomToken();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + SESSION_MS).toISOString();
  const db = getDb();
  await db.insert(adminFactorSessions).values({
    id: crypto.randomUUID(),
    email,
    tokenHash: await sha256(token),
    expiresAt,
    createdAt,
  });
  return {
    token,
    expiresAt,
    cookie: `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_MS / 1000}`,
  };
}

export async function confirmAdminEnrollment(user: ChatGPTUser, code: string) {
  const email = requireAdmin(user);
  const row = await factorRow(email);
  if (!row || row.verifiedAt) throw new TecInputError("Start enrollment before confirming a code.");
  await assertNotLocked(row);
  if (!await totpMatches(row.totpSecret, code)) {
    await recordFailure(email, row.failedAttempts);
    throw new TecAuthorizationError("That authentication code is not valid.");
  }
  const codes = Array.from({ length: 8 }, recoveryCode);
  const verifiedAt = nowIso();
  const db = getDb();
  await db.batch([
    db.update(adminSecondFactors).set({ verifiedAt, failedAttempts: 0, lockedUntil: null }).where(eq(adminSecondFactors.email, email)),
    db.delete(adminRecoveryCodes).where(eq(adminRecoveryCodes.email, email)),
    db.insert(adminRecoveryCodes).values(await Promise.all(codes.map(async (codeValue) => ({
      id: crypto.randomUUID(),
      email,
      codeHash: await sha256(codeValue),
      usedAt: null,
    })))),
  ]);
  const session = await issueSession(email);
  return { recoveryCodes: codes, ...session };
}

export async function verifyAdminSecondFactor(user: ChatGPTUser, code: string) {
  const email = requireAdmin(user);
  const row = await factorRow(email);
  if (!row?.verifiedAt) throw new TecInputError("Enroll a second factor before signing in to admin tools.");
  await assertNotLocked(row);
  const normalized = code.trim().toUpperCase();
  if (await totpMatches(row.totpSecret, code)) {
    await clearFailures(email);
    return issueSession(email);
  }
  const recovery = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)
    ? (await getDb().select().from(adminRecoveryCodes).where(and(
      eq(adminRecoveryCodes.email, email),
      eq(adminRecoveryCodes.codeHash, await sha256(normalized)),
      isNull(adminRecoveryCodes.usedAt),
    )).limit(1))[0]
    : null;
  if (!recovery) {
    await recordFailure(email, row.failedAttempts);
    throw new TecAuthorizationError("That authentication code is not valid.");
  }
  await getDb().update(adminRecoveryCodes).set({ usedAt: nowIso() }).where(eq(adminRecoveryCodes.id, recovery.id));
  await clearFailures(email);
  return issueSession(email);
}

export async function adminFactorSatisfied(user: ChatGPTUser, cookieHeader: string | null) {
  if (!isIcsAdmin(user)) return false;
  const token = readCookie(cookieHeader);
  if (!token) return false;
  const email = normalizeEmail(user.email);
  const db = getDb();
  const [session] = await db.select().from(adminFactorSessions).where(and(
    eq(adminFactorSessions.email, email),
    eq(adminFactorSessions.tokenHash, await sha256(token)),
  )).limit(1);
  return Boolean(session && Date.parse(session.expiresAt) > Date.now());
}

export async function adminGate(user: ChatGPTUser, cookieHeader: string | null) {
  if (!isIcsAdmin(user)) return "denied" as const;
  const row = await factorRow(normalizeEmail(user.email));
  if (!row?.verifiedAt) return "enroll" as const;
  return await adminFactorSatisfied(user, cookieHeader) ? "ok" as const : "challenge" as const;
}

export async function requireAdminFactor(user: ChatGPTUser, request: Request) {
  const gate = await adminGate(user, request.headers.get("cookie"));
  if (gate === "denied") throw new TecAuthorizationError("ICS administrator access required.");
  if (gate !== "ok") throw new TecAuthorizationError("Admin second factor required. Open /admin/security.");
}

export function mfaCookie(cookie: string, requestUrl: string) {
  return requestUrl.startsWith("https:") ? cookie.replace("HttpOnly", "Secure; HttpOnly") : cookie;
}
