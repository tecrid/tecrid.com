// @vitest-environment node
import {beforeAll,afterAll,expect,it} from 'vitest';
import {eq} from 'drizzle-orm';
import {env} from './support/cloudflare-env';
import {evidenceFixture} from './support/evidence-fixture';
import {getDb} from '../db';
import {auditEvents,sandboxApiKeys,apiKeys} from '../db/schema';
import {createSandboxApiKey,revokeSandboxApiKey} from '../lib/sandbox';
import {createApiKey} from '../lib/tec';
let f:Awaited<ReturnType<typeof evidenceFixture>>;
beforeAll(async()=>{f=await evidenceFixture();},60000);afterAll(async()=>{await f?.mf.dispose();});
it('sandbox key creation and revocation each append one safe actor event',async()=>{const key=await createSandboxApiKey(f.recipient,'Synthetic');await revokeSandboxApiKey(f.recipient,key.id);const events=await getDb().select().from(auditEvents).where(eq(auditEvents.entityId,key.id));expect(events.map(e=>e.eventType)).toEqual(['sandbox_api_key.created','sandbox_api_key.revoked']);expect(events.every(e=>e.actorUserId===f.recipient.userId)).toBe(true);expect(JSON.stringify(events).includes(key.plainTextKey)).toBe(false);});
it('audit failure rolls back a sandbox key rather than creating an unaudited secret',async()=>{const before=(await getDb().select().from(sandboxApiKeys)).length;await env.DB.prepare("CREATE TRIGGER reject_synthetic_sandbox_audit BEFORE INSERT ON audit_events WHEN NEW.event_type='sandbox_api_key.created' BEGIN SELECT RAISE(ABORT,'Synthetic audit outage'); END").run();await createSandboxApiKey(f.recipient,'Synthetic rollback').catch(()=>{});expect((await getDb().select().from(sandboxApiKeys)).length).toBe(before);await env.DB.prepare('DROP TRIGGER reject_synthetic_sandbox_audit').run();});
it('audit failure also rolls back production key creation',async()=>{const before=(await getDb().select().from(apiKeys)).length;await env.DB.prepare("CREATE TRIGGER reject_synthetic_production_audit BEFORE INSERT ON audit_events WHEN NEW.event_type='api_key.created' BEGIN SELECT RAISE(ABORT,'Synthetic audit outage'); END").run();await createApiKey(f.brand,'Synthetic rollback',['read']).catch(()=>{});expect((await getDb().select().from(apiKeys)).length).toBe(before);await env.DB.prepare('DROP TRIGGER reject_synthetic_production_audit').run();});
