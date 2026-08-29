import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import {
  auditEvents,
  organizationNotifications,
  organizations,
  reportReservations,
} from "../db/schema";
import {
  createCredential,
  generateTecridIdentifier,
  getCredential,
  TecAuthorizationError,
  TecInputError,
} from "./tec";
import {
  authorizeRoutingAuthorizationId,
  authorizeRoutingToken,
  deliverCredentialWithAuthorization,
} from "./evidence-routing";

const SOURCE_SYSTEMS = new Set(["generic", "labware", "labvantage", "starlims"]);

function clean(value: unknown, maximum = 240) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeSku(value: unknown) {
  return clean(value, 100).toUpperCase().replace(/\s+/g, "-");
}

function reservationDocument(reservation: typeof reportReservations.$inferSelect) {
  const resolverUrl = `https://tecrid.com/records/${encodeURIComponent(reservation.identifier)}`;
  return {
    id: reservation.id,
    tecrid: reservation.identifier,
    status: reservation.status,
    productName: reservation.productName,
    productSku: reservation.productSku,
    laboratoryReportNumber: reservation.laboratoryReportNumber,
    sourceSystem: reservation.sourceSystem,
    createdAt: reservation.createdAt,
    expiresAt: reservation.expiresAt,
    finalizedAt: reservation.finalizedAt,
    finalizedCredentialIdentifier: reservation.finalizedCredentialIdentifier,
    reportMark: {
      humanReadable: reservation.identifier,
      resolverUrl,
      qrData: resolverUrl,
      templateFields: {
        tecrid_identifier: reservation.identifier,
        tecrid_resolver_url: resolverUrl,
      },
    },
    links: {
      resolver: resolverUrl,
      finalize: `/api/v1/report-reservations/${encodeURIComponent(reservation.id)}/finalize`,
    },
  };
}

export async function reserveReportTecrid(
  organization: typeof organizations.$inferSelect,
  input: Record<string, unknown>,
) {
  if (organization.organizationType !== "laboratory" || organization.issuerStatus !== "verified") {
    throw new TecAuthorizationError("Only an ICS-verified laboratory can reserve a production TECRID for a report.");
  }
  const productName = clean(input.productName, 180);
  const productSku = normalizeSku(input.productSku);
  const laboratoryReportNumber = clean(input.laboratoryReportNumber, 120) || null;
  const sourceSystem = clean(input.sourceSystem, 40).toLowerCase() || "generic";
  if (!productName || !productSku) throw new TecInputError("productName and productSku are required.");
  if (!SOURCE_SYSTEMS.has(sourceSystem)) {
    throw new TecInputError("sourceSystem must be generic, labware, labvantage, or starlims.");
  }

  const routingToken = clean(input.routingToken, 120);
  const routing = routingToken ? await authorizeRoutingToken(routingToken, organization.id) : null;
  if (routing) {
    if (routing.authorization.productSku !== productSku) {
      throw new TecInputError("productSku must match the SKU bound to the brand-controlled routing token.");
    }
    if (routing.authorization.productName.toLowerCase() !== productName.toLowerCase()) {
      throw new TecInputError("productName must match the product bound to the routing token.");
    }
  }

  const requestedHours = Number(input.expiresInHours);
  const expiresInHours = Number.isFinite(requestedHours)
    ? Math.max(1, Math.min(168, Math.round(requestedHours)))
    : 48;
  const id = `reservation_${crypto.randomUUID().replaceAll("-", "")}`;
  const identifier = generateTecridIdentifier(organization.issuerCode);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000).toISOString();
  const db = getDb();
  const reservation = {
    id,
    identifier,
    laboratoryOrganizationId: organization.id,
    controllerOrganizationId: routing?.authorization.controllerOrganizationId ?? null,
    routingAuthorizationId: routing?.authorization.id ?? null,
    productName,
    productSku,
    laboratoryReportNumber,
    sourceSystem,
    status: "reserved",
    expiresAt,
    createdAt,
  };
  await db.batch([
    db.insert(reportReservations).values(reservation),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organizationId: organization.id,
      actorUserId: null,
      eventType: "report_tecrid.reserved",
      entityType: "report_reservation",
      entityId: id,
      payload: JSON.stringify({ identifier, productSku, sourceSystem, controllerOrganizationId: reservation.controllerOrganizationId }),
      createdAt,
    }),
  ]);
  if (reservation.controllerOrganizationId) {
    await db.insert(organizationNotifications).values({
      id: crypto.randomUUID(),
      organizationId: reservation.controllerOrganizationId,
      eventType: "laboratory_report.reserved",
      title: `Laboratory report in preparation for ${productSku}`,
      body: `${organization.name} reserved ${identifier}. It is not issued until the final report is fingerprinted and signed.`,
      actionPath: "/dashboard/evidence-routing#laboratory-reports",
      entityType: "report_reservation",
      entityId: id,
      createdAt,
    });
  }
  return reservationDocument({
    ...reservation,
    finalizedCredentialIdentifier: null,
    finalizedAt: null,
  });
}

export async function listReportReservations(laboratoryOrganizationId: string) {
  const rows = await getDb()
    .select()
    .from(reportReservations)
    .where(eq(reportReservations.laboratoryOrganizationId, laboratoryOrganizationId))
    .orderBy(desc(reportReservations.createdAt))
    .limit(100);
  return rows.map(reservationDocument);
}

export async function getPublicReportReservation(identifierValue: string) {
  const identifier = clean(decodeURIComponent(identifierValue), 120).toUpperCase();
  if (!identifier) return null;
  const [record] = await getDb()
    .select({ reservation: reportReservations, laboratory: organizations })
    .from(reportReservations)
    .innerJoin(organizations, eq(reportReservations.laboratoryOrganizationId, organizations.id))
    .where(eq(reportReservations.identifier, identifier))
    .limit(1);
  if (!record) return null;
  return {
    tecrid: record.reservation.identifier,
    status: record.reservation.status,
    reservedAt: record.reservation.createdAt,
    expiresAt: record.reservation.expiresAt,
    expired: record.reservation.status === "expired" || new Date(record.reservation.expiresAt).getTime() <= Date.now(),
    laboratory: {
      name: record.laboratory.name,
      code: record.laboratory.issuerCode,
      status: record.laboratory.issuerStatus,
    },
    productionAuthority: false,
    note: "This identifier was reserved for report rendering. No analytical credential has been issued yet.",
  };
}

export async function finalizeReportTecrid(
  organization: typeof organizations.$inferSelect,
  reservationIdValue: unknown,
  input: Record<string, unknown>,
) {
  const reservationId = clean(reservationIdValue, 120);
  const db = getDb();
  const [reservation] = await db
    .select()
    .from(reportReservations)
    .where(and(
      eq(reportReservations.id, reservationId),
      eq(reportReservations.laboratoryOrganizationId, organization.id),
    ))
    .limit(1);
  if (!reservation) throw new TecAuthorizationError("Report reservation not found for this laboratory.");
  if (reservation.status === "finalized" && reservation.finalizedCredentialIdentifier) {
    const existing = await getCredential(reservation.finalizedCredentialIdentifier);
    return {
      reservation: reservationDocument(reservation),
      credential: existing ? { tecrid: existing.credential.identifier, status: existing.credential.status, fingerprint: existing.credential.fingerprint } : null,
      idempotent: true,
    };
  }
  if (reservation.status !== "reserved") throw new TecInputError("This report reservation is already being finalized.");
  if (new Date(reservation.expiresAt).getTime() <= Date.now()) {
    await db.update(reportReservations).set({ status: "expired" }).where(eq(reportReservations.id, reservation.id));
    throw new TecInputError("This report reservation expired before finalization. Reserve a new TECRID and render the report again.");
  }

  const productSku = normalizeSku(input.productSku);
  if (productSku !== reservation.productSku) {
    throw new TecInputError("productSku must match the reserved report.");
  }
  const sourceDocument = input.sourceDocument as Record<string, unknown> | undefined;
  const sourceHash = clean(sourceDocument?.sha256, 64).toLowerCase();
  const sourceFilename = clean(sourceDocument?.filename, 240);
  if (!/^[a-f0-9]{64}$/.test(sourceHash) || !sourceFilename.toLowerCase().endsWith(".pdf")) {
    throw new TecInputError("Finalization requires the SHA-256 fingerprint and filename of the final TECRID-marked PDF.");
  }
  if (reservation.laboratoryReportNumber) {
    const reportNumber = clean(sourceDocument?.reportNumber, 120);
    if (reportNumber !== reservation.laboratoryReportNumber) {
      throw new TecInputError("sourceDocument.reportNumber must match the reserved laboratory report number.");
    }
  }
  if (input.publish !== true) throw new TecInputError("A report reservation can only be finalized as an issued credential.");

  const routing = reservation.routingAuthorizationId
    ? await authorizeRoutingAuthorizationId(reservation.routingAuthorizationId, organization.id)
    : null;
  if (input.visibility === "controlled" && !routing) {
    throw new TecAuthorizationError("Controlled findings require a current brand-controlled routing authorization.");
  }
  const [claimed] = await db
    .update(reportReservations)
    .set({ status: "finalizing" })
    .where(and(eq(reportReservations.id, reservation.id), eq(reportReservations.status, "reserved")))
    .returning({ id: reportReservations.id });
  if (!claimed) throw new TecInputError("This report reservation is already being finalized.");

  let credential;
  try {
    credential = await createCredential(organization, null, input, {
      reservedIdentifier: reservation.identifier,
      controlledRoutingAuthorized: Boolean(routing),
      issuanceBasis: "report_reservation",
    });
  } catch (error) {
    await db.update(reportReservations).set({ status: "reserved" }).where(and(
      eq(reportReservations.id, reservation.id),
      eq(reportReservations.status, "finalizing"),
    ));
    throw error;
  }

  const finalizedAt = new Date().toISOString();
  await db.batch([
    db.update(reportReservations).set({
      status: "finalized",
      finalizedCredentialIdentifier: credential.identifier,
      finalizedAt,
    }).where(eq(reportReservations.id, reservation.id)),
    db.insert(auditEvents).values({
      id: crypto.randomUUID(),
      organizationId: organization.id,
      actorUserId: null,
      eventType: "report_tecrid.finalized",
      entityType: "report_reservation",
      entityId: reservation.id,
      payload: JSON.stringify({ identifier: credential.identifier, sourceHash, productSku }),
      createdAt: finalizedAt,
    }),
  ]);

  let routingResult = null;
  let routingWarning = null;
  if (routing) {
    try {
      routingResult = await deliverCredentialWithAuthorization(routing, credential.identifier);
    } catch (error) {
      routingWarning = error instanceof Error ? error.message : "The TECRID was issued, but automatic delivery needs retry.";
    }
  }
  const finalizedReservation = {
    ...reservation,
    status: "finalized",
    finalizedCredentialIdentifier: credential.identifier,
    finalizedAt,
  };
  return {
    reservation: reservationDocument(finalizedReservation),
    credential,
    routing: routingResult,
    routingWarning,
    idempotent: false,
  };
}
