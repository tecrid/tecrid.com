import {Miniflare} from 'miniflare';
import {readFileSync,readdirSync} from 'node:fs';
import {env} from './cloudflare-env';
// Isolated D1 + R2 with every migration applied. Never connected to production.
export async function isolatedStorage(){
 const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("test")}}',compatibilityDate:'2026-05-22',d1Databases:['DB'],r2Buckets:['DOCUMENTS']});
 env.DB=await mf.getD1Database('DB');env.DOCUMENTS=await mf.getR2Bucket('DOCUMENTS');
 for(const f of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync(`drizzle/${f}`,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await env.DB.prepare(sql).run();
 return mf;
}
