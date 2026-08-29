import { and, desc, eq } from "drizzle-orm";
import type { ChatGPTUser } from "../app/chatgpt-auth";
import { getDb } from "../db";
import {
  auditEvents,
  certificationIntakeItems,
  certificationIntakes,
  certificationPrograms,
  organizations,
} from "../db/schema";
import { isSampleTecrid } from "./sample-tecrid";
import {
  getCredential,
  getOrganizationForUser,
  publicCredentialDocument,
  TecAuthorizationError,
  TecInputError,
} from "./tec";

const MAX_ROWS = 100;
const MAX_CSV_BYTES = 1_000_000;

function clean(value: unknown, maximum = 240) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeIdentifier(value: unknown) {
  const raw = clean(value, 120).toUpperCase();
  const normalized = raw.replace(/^TECRID[:-]/, "TECRID·").replace(/^TEC[:-]/, "TECRID·");
  return normalized.startsWith("TECRID·") ? normalized : normalized ? `TECRID·${normalized}` : "";
}

function randomToken(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (quoted) throw new TecInputError("The CSV contains an unclosed quoted field.");
  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  if (rows.length < 2) throw new TecInputError("The CSV needs a header and at least one TECRID row.");
  const headers = rows[0].map((value) => value.replace(/^\uFEFF/, "").trim().toLowerCase());
  const identifierColumn = headers.findIndex((value) => ["tecrid", "identifier"].includes(value));
  if (identifierColumn < 0) throw new TecInputError("The CSV requires a tecrid column.");
  const values = rows.slice(1).map((cells) => clean(cells[identifierColumn], 120)).filter(Boolean);
  if (!values.length) throw new TecInputError("The CSV contains no TECRIDs.");
  return values;
}

function identifiersFromInput(input: { csv?: unknown; tecrids?: unknown }) {
  if (typeof input.csv === "string" && input.csv.trim()) {
    if (new TextEncoder().encode(input.csv).byteLength > MAX_CSV_BYTES) {
      throw new TecInputError("The CSV must be 1 MB or smaller.");
    }
    return { identifiers: parseCsv(input.csv), sourceType: "csv" };
  }
  if (Array.isArray(input.tecrids)) {
    const identifiers = input.tecrids.map((value) => clean(value, 120)).filter(Boolean);
    if (!identifiers.length) throw new TecInputError("Submit at least one TECRID.");
    return { identifiers, sourceType: "api" };
  }
  throw new TecInputError("Submit a CSV or a tecrids array.");
}

async function requireOrganization(user: ChatGPTUser) {
  const membership = await getOrganizationForUser(user.userId);
  if (!membership) throw new TecAuthorizationError("Complete organization setup first.");
  return membership;
}

export async function createCertificationProgram(user: ChatGPTUser, nameValue: unknown) {
  const membership = await requireOrganization(user);
  const name = clean(nameValue, 180);
  if (!name) throw new TecInputError("A certification program name is required.");
  const id = crypto.randomUUID();
  const publicToken = `submit_${randomToken(24)}`;
  const plainTextApiToken = `tec_intake_${randomToken(42)}`;
  const createdAt = new Date().toISOString();
  const db = getDb();
  await db.insert(certificationPrograms).values({
    id,
    organizationId: membership.organization.id,
    name,
    publicToken,
    apiTokenHash: await sha256(plainTextApiToken),
    apiTokenPrefix: plainTextApiToken.slice(0, 16),
    apiTokenLastFour: plainTextApiToken.slice(-4),
    createdByUserId: user.userId,
    createdAt,
  });
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: membership.organization.id,
    actorUserId: user.userId,
    eventType: "certification_program_created",
    entityType: "certification_program",
    entityId: id,
    payload: JSON.stringify({ name, publicToken }),
  });
  return { id, name, publicToken, plainTextApiToken, createdAt };
}

export async function listCertificationConsole(user: ChatGPTUser) {
  const membership = await requireOrganization(user);
  const db = getDb();
  const [programs, intakes] = await Promise.all([
    db
      .select()
      .from(certificationPrograms)
      .where(eq(certificationPrograms.organizationId, membership.organization.id))
      .orderBy(desc(certificationPrograms.createdAt)),
    db
      .select({ intake: certificationIntakes, programName: certificationPrograms.name })
      .from(certificationIntakes)
      .innerJoin(certificationPrograms, eq(certificationIntakes.programId, certificationPrograms.id))
      .where(eq(certificationIntakes.receivingOrganizationId, membership.organization.id))
      .orderBy(desc(certificationIntakes.createdAt))
      .limit(100),
  ]);
  return { membership, programs, intakes };
}

export async function getCertificationProgramByPublicToken(tokenValue: unknown) {
  const token = clean(tokenValue, 100);
  if (!token) return null;
  const db = getDb();
  const [program] = await db
    .select({ program: certificationPrograms, organization: organizations })
    .from(certificationPrograms)
    .innerJoin(organizations, eq(certificationPrograms.organizationId, organizations.id))
    .where(and(eq(certificationPrograms.publicToken, token), eq(certificationPrograms.active, true)))
    .limit(1);
  return program ?? null;
}

export async function authenticateCertificationIntakeRequest(request: Request) {
  const direct = request.headers.get("x-tecrid-intake-token") ?? "";
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(tec_intake_[A-Za-z0-9]+)$/)?.[1] ?? "";
  const token = direct || bearer;
  if (!token.startsWith("tec_intake_")) {
    throw new TecAuthorizationError("A valid certification intake token is required.");
  }
  const db = getDb();
  const [program] = await db
    .select({ program: certificationPrograms, organization: organizations })
    .from(certificationPrograms)
    .innerJoin(organizations, eq(certificationPrograms.organizationId, organizations.id))
    .where(
      and(
        eq(certificationPrograms.apiTokenHash, await sha256(token)),
        eq(certificationPrograms.active, true),
      ),
    )
    .limit(1);
  if (!program) throw new TecAuthorizationError("The certification intake token is invalid or inactive.");
  return program;
}

type ProgramRecord = NonNullable<Awaited<ReturnType<typeof getCertificationProgramByPublicToken>>>;

export async function submitCertificationIntake(
  programRecord: ProgramRecord,
  input: {
    applicantOrganization?: unknown;
    applicantName?: unknown;
    applicantEmail?: unknown;
    submissionReference?: unknown;
    csv?: unknown;
    tecrids?: unknown;
  },
  submittedByUserId: string | null,
) {
  const applicantOrganization = clean(input.applicantOrganization, 180);
  const applicantName = clean(input.applicantName, 140);
  const applicantEmail = clean(input.applicantEmail, 180).toLowerCase();
  const submissionReference = clean(input.submissionReference, 180);
  if (!applicantOrganization || !applicantName || !/^\S+@\S+\.\S+$/.test(applicantEmail)) {
    throw new TecInputError("Applicant organization, contact name, and a valid email are required.");
  }
  const { identifiers, sourceType } = identifiersFromInput(input);
  if (identifiers.length > MAX_ROWS) throw new TecInputError(`One submission may contain at most ${MAX_ROWS} TECRIDs.`);
  const seen = new Set<string>();
  const items: Array<{
    rowNumber: number;
    submittedIdentifier: string;
    normalizedIdentifier: string;
    validationStatus: string;
    credentialIdentifier: string | null;
    issuerOrganizationId: string | null;
    recordVersion: number | null;
    recordStatus: string | null;
    issuerSignatureVerified: boolean;
    snapshotFingerprint: string | null;
    snapshotJson: string | null;
    errors: string[];
  }> = [];

  for (const [index, submittedIdentifier] of identifiers.entries()) {
    const normalizedIdentifier = normalizeIdentifier(submittedIdentifier);
    const errors: string[] = [];
    let record: Awaited<ReturnType<typeof getCredential>> = null;
    if (!normalizedIdentifier) errors.push("invalid TECRID format");
    else if (seen.has(normalizedIdentifier)) errors.push("duplicate TECRID in this submission");
    else if (isSampleTecrid(normalizedIdentifier)) errors.push("sample TECRIDs have no production authority");
    else record = await getCredential(normalizedIdentifier);
    seen.add(normalizedIdentifier);
    if (!errors.length && !record) errors.push("no public registry record found");
    if (record) {
      if (record.credential.visibility === "controlled") errors.push("controlled findings require an evidence delivery grant");
      if (record.credential.status !== "issued") errors.push(`record status is ${record.credential.status}`);
      if (record.issuer.issuerStatus !== "verified") errors.push("issuing laboratory is not verified");
      if (!record.integrity.issuerSignatureVerified) errors.push("issuer signature is not verified");
      if (!record.integrity.fingerprintValid) errors.push("current fingerprint could not be recomputed");
      if (!record.integrity.currentVersionConsistent) errors.push("current row and version history are inconsistent");
    }
    const snapshot = record ? publicCredentialDocument(record) : null;
    const snapshotJson = snapshot ? JSON.stringify(snapshot) : null;
    items.push({
      rowNumber: index + 1,
      submittedIdentifier,
      normalizedIdentifier,
      validationStatus: errors.length ? "blocked" : "valid",
      credentialIdentifier: record?.credential.identifier ?? null,
      issuerOrganizationId: record?.issuer.id ?? null,
      recordVersion: record?.credential.version ?? null,
      recordStatus: record?.credential.status ?? null,
      issuerSignatureVerified: Boolean(record?.integrity.issuerSignatureVerified),
      snapshotFingerprint: snapshotJson ? await sha256(snapshotJson) : null,
      snapshotJson,
      errors,
    });
  }

  const validRows = items.filter((item) => item.validationStatus === "valid").length;
  const blockedRows = items.length - validRows;
  const status = blockedRows ? (validRows ? "needs_attention" : "blocked") : "validated";
  const createdAt = new Date().toISOString();
  const manifestJson = JSON.stringify({
    schema: "tecrid-certification-intake/v1",
    program: { id: programRecord.program.id, name: programRecord.program.name },
    receivingOrganization: { id: programRecord.organization.id, name: programRecord.organization.name },
    applicant: { organization: applicantOrganization, name: applicantName, email: applicantEmail },
    submissionReference: submissionReference || null,
    sourceType,
    createdAt,
    items: items.map((item) => ({
      rowNumber: item.rowNumber,
      submittedIdentifier: item.submittedIdentifier,
      normalizedIdentifier: item.normalizedIdentifier,
      validationStatus: item.validationStatus,
      snapshotFingerprint: item.snapshotFingerprint,
      errors: item.errors,
      recordSnapshot: item.snapshotJson ? JSON.parse(item.snapshotJson) : null,
    })),
  });
  const manifestFingerprint = await sha256(manifestJson);
  const intakeId = crypto.randomUUID();
  const db = getDb();
  await db.insert(certificationIntakes).values({
    id: intakeId,
    programId: programRecord.program.id,
    receivingOrganizationId: programRecord.organization.id,
    applicantOrganization,
    applicantName,
    applicantEmail,
    submissionReference: submissionReference || null,
    sourceType,
    status,
    rowCount: items.length,
    validRows,
    blockedRows,
    manifestJson,
    manifestFingerprint,
    submittedByUserId,
    createdAt,
  });
  await db.insert(certificationIntakeItems).values(items.map((item) => ({
    id: crypto.randomUUID(),
    intakeId,
    rowNumber: item.rowNumber,
    submittedIdentifier: item.submittedIdentifier,
    normalizedIdentifier: item.normalizedIdentifier,
    validationStatus: item.validationStatus,
    credentialIdentifier: item.credentialIdentifier,
    issuerOrganizationId: item.issuerOrganizationId,
    recordVersion: item.recordVersion,
    recordStatus: item.recordStatus,
    issuerSignatureVerified: item.issuerSignatureVerified,
    snapshotFingerprint: item.snapshotFingerprint,
    snapshotJson: item.snapshotJson,
    errors: item.errors.length ? JSON.stringify(item.errors) : null,
  })));
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(),
    organizationId: programRecord.organization.id,
    actorUserId: submittedByUserId,
    eventType: "certification_intake_submitted",
    entityType: "certification_intake",
    entityId: intakeId,
    payload: JSON.stringify({ programId: programRecord.program.id, sourceType, validRows, blockedRows, manifestFingerprint }),
  });
  return {
    intakeId,
    status,
    rowCount: items.length,
    validRows,
    blockedRows,
    manifestFingerprint,
    items: items.map((item) => ({
      rowNumber: item.rowNumber,
      submittedIdentifier: item.submittedIdentifier,
      normalizedIdentifier: item.normalizedIdentifier,
      validationStatus: item.validationStatus,
      credentialIdentifier: item.credentialIdentifier,
      issuerOrganizationId: item.issuerOrganizationId,
      recordVersion: item.recordVersion,
      recordStatus: item.recordStatus,
      issuerSignatureVerified: item.issuerSignatureVerified,
      snapshotFingerprint: item.snapshotFingerprint,
      errors: item.errors,
    })),
  };
}

export async function getCertificationIntakeForUser(user: ChatGPTUser, intakeIdValue: unknown) {
  const membership = await requireOrganization(user);
  const intakeId = clean(intakeIdValue, 100);
  const db = getDb();
  const [record] = await db
    .select({ intake: certificationIntakes, program: certificationPrograms })
    .from(certificationIntakes)
    .innerJoin(certificationPrograms, eq(certificationIntakes.programId, certificationPrograms.id))
    .where(
      and(
        eq(certificationIntakes.id, intakeId),
        eq(certificationIntakes.receivingOrganizationId, membership.organization.id),
      ),
    )
    .limit(1);
  if (!record) return null;
  const items = await db
    .select()
    .from(certificationIntakeItems)
    .where(eq(certificationIntakeItems.intakeId, intakeId))
    .orderBy(certificationIntakeItems.rowNumber);
  return { ...record, items, organization: membership.organization };
}
