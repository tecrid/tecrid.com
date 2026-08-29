import { and, desc, eq, isNull } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import { sandboxApiKeys, sandboxSessions } from "../db/schema";

export const sandboxStages = ["submitted", "claimed", "confirmed", "issued"] as const;
export type SandboxStage = (typeof sandboxStages)[number];
export type SandboxAction = "claim" | "confirm" | "issue";

const transitions: Record<SandboxAction, { from: SandboxStage; to: SandboxStage; message: string }> = {
  claim: {
    from: "submitted",
    to: "claimed",
    message: "Northstar claimed the report. The state was saved to your personal sandbox.",
  },
  confirm: {
    from: "claimed",
    to: "confirmed",
    message: "The laboratory confirmed the fictional transcription. Your sandbox state was saved.",
  },
  issue: {
    from: "confirmed",
    to: "issued",
    message: "A sandbox-only TECRID was issued. It has no production authority.",
  },
};

export class SandboxInputError extends Error {
  status = 409;
}

function now() {
  return new Date().toISOString();
}

function normalizeLabel(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 60) : "";
}

function randomCharacters(length: number) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function ensureSandboxSession(user: ChatGPTUser) {
  const db = getDb();
  const createdAt = now();
  await db
    .insert(sandboxSessions)
    .values({ userId: user.userId, stage: "submitted", createdAt, updatedAt: createdAt })
    .onConflictDoNothing({ target: sandboxSessions.userId });
  const [session] = await db
    .select()
    .from(sandboxSessions)
    .where(eq(sandboxSessions.userId, user.userId))
    .limit(1);
  return session;
}

export async function transitionSandboxSession(
  user: ChatGPTUser,
  action: SandboxAction,
  currentStage: unknown,
) {
  const transition = transitions[action];
  const session = await ensureSandboxSession(user);
  if (!transition || currentStage !== transition.from || session.stage !== transition.from) {
    throw new SandboxInputError(
      "That action is not available at the current saved sandbox stage. Refresh the sandbox and try again.",
    );
  }
  const updatedAt = now();
  const db = getDb();
  await db
    .update(sandboxSessions)
    .set({ stage: transition.to, updatedAt })
    .where(
      and(
        eq(sandboxSessions.userId, user.userId),
        eq(sandboxSessions.stage, transition.from),
      ),
    );
  return { stage: transition.to, updatedAt, message: transition.message };
}

export async function resetSandboxSession(user: ChatGPTUser) {
  await ensureSandboxSession(user);
  const updatedAt = now();
  const db = getDb();
  await db
    .update(sandboxSessions)
    .set({ stage: "submitted", updatedAt })
    .where(eq(sandboxSessions.userId, user.userId));
  return { stage: "submitted" as const, updatedAt };
}

export async function listSandboxApiKeys(userId: string) {
  const db = getDb();
  return db
    .select({
      id: sandboxApiKeys.id,
      label: sandboxApiKeys.label,
      keyPrefix: sandboxApiKeys.keyPrefix,
      lastFour: sandboxApiKeys.lastFour,
      createdAt: sandboxApiKeys.createdAt,
      lastUsedAt: sandboxApiKeys.lastUsedAt,
      revokedAt: sandboxApiKeys.revokedAt,
    })
    .from(sandboxApiKeys)
    .where(eq(sandboxApiKeys.userId, userId))
    .orderBy(desc(sandboxApiKeys.createdAt));
}

export async function createSandboxApiKey(user: ChatGPTUser, labelValue: unknown) {
  await ensureSandboxSession(user);
  const db = getDb();
  const activeKeys = await db
    .select({ id: sandboxApiKeys.id })
    .from(sandboxApiKeys)
    .where(
      and(
        eq(sandboxApiKeys.userId, user.userId),
        isNull(sandboxApiKeys.revokedAt),
      ),
    )
    .limit(5);
  if (activeKeys.length >= 5) {
    throw new SandboxInputError("Revoke an existing sandbox key before creating another. The active-key limit is five.");
  }
  const label = normalizeLabel(labelValue) || "Sandbox integration";
  const plainTextKey = `tec_sandbox_${randomCharacters(42)}`;
  const createdAt = now();
  const key = {
    id: `sbx_key_${crypto.randomUUID().replaceAll("-", "")}`,
    userId: user.userId,
    label,
    keyPrefix: plainTextKey.slice(0, 17),
    keyHash: await sha256(plainTextKey),
    lastFour: plainTextKey.slice(-4),
    createdAt,
  };
  await db.insert(sandboxApiKeys).values(key);
  return {
    id: key.id,
    label,
    keyPrefix: key.keyPrefix,
    lastFour: key.lastFour,
    createdAt,
    lastUsedAt: null,
    revokedAt: null,
    plainTextKey,
  };
}

export async function revokeSandboxApiKey(user: ChatGPTUser, keyIdValue: unknown) {
  const keyId = typeof keyIdValue === "string" ? keyIdValue.trim().slice(0, 90) : "";
  if (!keyId) throw new SandboxInputError("Sandbox API key id is required.");
  const db = getDb();
  const [key] = await db
    .select({ id: sandboxApiKeys.id })
    .from(sandboxApiKeys)
    .where(
      and(
        eq(sandboxApiKeys.id, keyId),
        eq(sandboxApiKeys.userId, user.userId),
        isNull(sandboxApiKeys.revokedAt),
      ),
    )
    .limit(1);
  if (!key) throw new SandboxInputError("Active sandbox API key not found.");
  const revokedAt = now();
  await db
    .update(sandboxApiKeys)
    .set({ revokedAt })
    .where(eq(sandboxApiKeys.id, keyId));
  return { id: keyId, revokedAt };
}

export async function authenticateSandboxApiRequest(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(tec_sandbox_[a-z0-9]+)$/i);
  if (!match) return null;
  const keyHash = await sha256(match[1]);
  const db = getDb();
  const [record] = await db
    .select({ key: sandboxApiKeys, session: sandboxSessions })
    .from(sandboxApiKeys)
    .innerJoin(sandboxSessions, eq(sandboxApiKeys.userId, sandboxSessions.userId))
    .where(and(eq(sandboxApiKeys.keyHash, keyHash), isNull(sandboxApiKeys.revokedAt)))
    .limit(1);
  if (!record) throw new SandboxInputError("The sandbox API key is invalid or revoked.");
  await db
    .update(sandboxApiKeys)
    .set({ lastUsedAt: now() })
    .where(eq(sandboxApiKeys.id, record.key.id));
  return record;
}
