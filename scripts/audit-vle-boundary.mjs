import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only cross-repository contract characterization. No database or network.
const consumerRoot = process.argv[2];
if (!consumerRoot) throw Error('Usage: node scripts/audit-vle-boundary.mjs <VLE checkout>');
const consumerPath = resolve(consumerRoot, 'server/proof-contract.js');
const { validateEnvelope, verifyDelivery } = await import(pathToFileURL(consumerPath).href);
const producerSource = await readFile(new URL('../lib/recipient-webhook.ts', import.meta.url));
const consumerSource = await readFile(consumerPath);
const blob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
assert.equal(blob(producerSource), '7d17a38712923077234b5c184f7e0c0206e22e9b', 'Re-audit changed producer source');
assert.equal(blob(consumerSource), '099f0bef24405e2eff54eef85665eb8f046994c2', 'Re-audit changed consumer source');
const now = Date.now(), recipient = 'synthetic-marketplace';
const checks = [];
const check = (name, operation) => { operation(); checks.push({ name, passed: true }); };
const rejected = (envelope, status) => assert.throws(() => validateEnvelope(envelope, recipient, now), error => error.status === status);
const candidate = () => ({
 schemaVersion: 'vle-evidence/1', environment: 'production', deliveryId: 'synthetic-delivery', eventId: 'synthetic-event', sequence: 1, event: 'credential.issued', occurredAt: new Date(now).toISOString(),
 recipient: { type: 'marketplace', organizationId: recipient },
 credential: { tecrid: 'TEC-SYNTHETIC', version: 1, status: 'active', program: 'SYNTHETIC ONLY', issuingLab: 'SYNTHETIC lab', issuedAt: new Date(now).toISOString(), retestDue: null, verificationUrl: 'https://tecrid.com/records/TEC-SYNTHETIC', fingerprint: 'a'.repeat(64), verification: { signatureVerified: true, fingerprintVerified: true, currentVersion: true }, identity: { originatingSupplierId: 'synthetic-supplier', ingredientCode: 'SYNTHETIC-INGREDIENT' } },
 grant: { id: 'synthetic-grant', recipientOrganizationId: recipient, status: 'active', accessLevel: 'status_only', publicStatus: false, expiresAt: null, brandOrganizationIds: [] },
});
const metadata = { eventId: 'synthetic-event', event: 'evidence_routing.delivered', sku: 'SYNTHETIC-SKU', url: 'https://tecrid.com/dashboard' };
// This shape is the producer's documented envelope, not a delivered credential.
const producerShape = { ...metadata, schemaVersion: 'tecrid.delivery/1', delivery: { id: 'synthetic-delivery' } };
check('current producer schema is rejected with 422', () => rejected(producerShape, 422));
check('notification-only schema is rejected with 422', () => rejected(metadata, 422));
check('ASCII synthetic consumer control is accepted', () => assert.equal(validateEnvelope(candidate(), recipient, now).sequence, 1));
check('native middle-dot TECRID is rejected with 400', () => { const e = candidate(); e.credential.tecrid = 'TECRID·SYN-26-ABCDEFGH'; e.credential.verificationUrl = 'https://tecrid.com/records/' + encodeURIComponent(e.credential.tecrid); rejected(e, 400); });
check('native lifecycle event ID is rejected with 400', () => { const e = candidate(); e.eventId = 'credential:TECRID·SYN-26-ABCDEFGH:1:synthetic-marketplace'; rejected(e, 400); });
check('missing signed originating supplier is rejected with 400', () => { const e = candidate(); delete e.credential.identity.originatingSupplierId; rejected(e, 400); });
check('missing public-status consent is rejected with 403', () => { const e = candidate(); delete e.grant.publicStatus; rejected(e, 403); });
check('missing program is rejected with 400', () => { const e = candidate(); delete e.credential.program; rejected(e, 400); });
check('missing explicit downstream scope is rejected with 400', () => { const e = candidate(); delete e.grant.brandOrganizationIds; rejected(e, 400); });
// Verify the shared HMAC convention with an ephemeral key; never print it.
const secret = randomBytes(32).toString('base64url'), text = JSON.stringify(producerShape), timestamp = String(Math.floor(now / 1000));
const signature = createHmac('sha256', secret).update(timestamp + '.' + text).digest('hex');
const authenticated = await verifyDelivery(new Request('https://vle.example.test/api/integrations/tecrid/deliveries', { method: 'POST', headers: { 'content-type': 'application/json', 'X-TECRID-Signature': `t=${timestamp},v1=${signature}`, 'X-TECRID-Event-Id': producerShape.eventId }, body: text }), secret, now);
check('HMAC-valid producer body still fails schema with 422', () => rejected(authenticated.data, 422));
console.log(JSON.stringify({ producerBlob: blob(producerSource), consumerBlob: blob(consumerSource), checks, passed: checks.length, failed: 0, networkCalls: 0, databaseCalls: 0, note: 'Passing checks characterize incompatibility; they do not claim end-to-end delivery.' }, null, 2));
