import { Miniflare } from 'miniflare';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { serializeSignedCookie } from 'better-call';
export async function workspaceFixture() {
  const mf = new Miniflare({ modules:true,script:"export default {fetch(){return new Response('test')}}",compatibilityDate:'2026-05-22',d1Databases:['DB'] });
  const DB = await mf.getD1Database('DB');
  const migrations = new URL('../../drizzle/',import.meta.url);
  for (const file of (await readdir(migrations)).filter(f=>f.endsWith('.sql')).sort()) for (const sql of (await readFile(new URL(file,migrations),'utf8')).split('--> statement-breakpoint')) if(sql.trim()) await DB.prepare(sql).run();
  await DB.prepare(`INSERT INTO organizations (id,name,slug,organization_type,website,owner_user_id,owner_email,issuer_code,issuer_status)
    VALUES ('fixture','Atlas Laboratory','atlas-laboratory','laboratory','https://atlas.example','email:fixture-owner','alex@atlas.example','ATL','pending')`).run();
  await DB.prepare(`INSERT INTO organization_members (organization_id,user_id,email,role,display_name,created_at) VALUES ('fixture','email:fixture-owner','alex@atlas.example','owner','Alex Morgan','2026-11-01T12:00:00Z'),('fixture','fixture-member','sam@atlas.example','member','Sam Taylor','2026-11-02T12:00:00Z')`).run();
  await DB.prepare(`INSERT INTO workspace_invites VALUES ('fixture-invite','fixture','jordan@atlas.example','member','email:fixture-owner','2026-11-09T12:00:00Z')`).run();
  await DB.prepare("INSERT INTO admin_second_factors (email,totp_secret,verified_at,created_at) VALUES ('alex@atlas.example','TESTONLY','2026-11-01','2026-11-01')").run();
  const token='test-only-local-factor';
  await DB.prepare("INSERT INTO admin_factor_sessions VALUES ('fixture-factor','alex@atlas.example',?,'2099-01-01T00:00:00Z','2026-11-01')").bind(createHash('sha256').update(token).digest('hex')).run();
  const secret='test-only-local-auth-secret-that-is-never-deployed';
  await DB.prepare("INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES ('fixture-owner','Alex Morgan','alex@atlas.example',1,0,0)").run();
  await DB.prepare("INSERT INTO auth_session (id,expires_at,token,created_at,updated_at,user_id) VALUES ('fixture-session',?,'fixture-session-token',0,0,'fixture-owner')").bind(new Date('2099-01-01').getTime()).run();
  const sessionCookie=(await serializeSignedCookie('tecrid.session_token','fixture-session-token',secret,{path:'/'})).split(';')[0];
  const bindings={DB,TECRID_AUTH_SECRET:secret,TECRID_AUTH_URL:'http://localhost',RESEND_API_KEY:'test-only-unused',TECRID_EMAIL_FROM:'TECRID <signin@atlas.example>', ICS_ADMIN_EMAILS:'alex@atlas.example',TECRID_PLATFORM_IDENTITY_SECRET:'fixture-local-only-identity-secret'};
  const headers={accept:'text/html',host:'localhost','oai-authenticated-user-id':'email:fixture-owner','oai-authenticated-user-email':'alex@atlas.example','oai-authenticated-user-full-name':'Alex Morgan','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8','x-tecrid-platform-identity':bindings.TECRID_PLATFORM_IDENTITY_SECRET,cookie:`${sessionCookie}; tecrid_admin_mfa=${token}`};
  return {mf,bindings,headers};
}
