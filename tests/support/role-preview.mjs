// Local review harness only. Uses disposable D1 fixtures, never production bindings.
// Run: node --import ./tests/support/register-worker-env.mjs tests/support/role-preview.mjs
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { Miniflare } from "miniflare";
const root = resolve(process.env.TECRID_REVIEW_ROOT || ".");
const port = Number(process.env.TECRID_REVIEW_PORT || 3110);
const mf = new Miniflare({ modules: true, script: 'export default { fetch(){return new Response("test")} }', compatibilityDate: "2026-05-22", d1Databases: ["DB"] });
const DB = await mf.getD1Database("DB");
for (const file of (await readdir(resolve(root,"drizzle"))).filter(f=>f.endsWith(".sql")).sort()) for (const sql of (await readFile(resolve(root,"drizzle",file),"utf8")).split("--> statement-breakpoint")) if(sql.trim()) await DB.prepare(sql).run();
const roles = ["brand","supplier","laboratory","certification_body","retailer","public"];
for (const role of roles) {
  await DB.prepare("INSERT INTO organizations (id,name,slug,organization_type,owner_user_id,owner_email,issuer_code,issuer_status) VALUES (?,?,?,?,?,?,?,?)").bind(`fixture-${role}`,`DEMO ${role.replaceAll("_"," ")} workspace`,`fixture-${role}`,role==="public"?"other":role,`fixture:${role}`,`${role}@example.test`,`DEMO-${role}`,role==="laboratory"?"pending":"not_applicable").run();
  await DB.prepare("INSERT INTO organization_members (organization_id,user_id,email,role) VALUES (?,?,?,?)").bind(`fixture-${role}`,`fixture:${role}`,`${role}@example.test`,"owner").run();
}
globalThis.__TECRID_WORKER_TEST_BINDINGS__ = { DB };
const {default:worker} = await import(pathToFileURL(resolve(root,"dist/server/index.js")));
const assetRoots = [resolve(root,"dist/client"),resolve(root,"public")];
const types = {".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".woff2":"font/woff2",".json":"application/json",".webmanifest":"application/manifest+json"};
const server = createServer(async (req,res)=>{
  try {
    const url=new URL(req.url,`http://localhost:${port}`);
    if(url.pathname.startsWith("/_next/") || /\.(svg|png|ico|woff2|webmanifest)$/.test(url.pathname)) {
      for(const directory of assetRoots){const path=resolve(directory,"."+decodeURIComponent(url.pathname));if(!path.startsWith(directory+"/"))continue;try{const body=await readFile(path);res.writeHead(200,{"content-type":types[extname(path)]||"application/octet-stream"});res.end(body);return;}catch{}}
    }
    const chosen=url.searchParams.get("fixture");
    let fixture=chosen || (req.headers.cookie||"").match(/(?:^|;\s*)review_fixture=([^;]+)/)?.[1];
    const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value)headers.set(key,Array.isArray(value)?value.join(","):value);
    if(roles.includes(fixture)||fixture==="new") { headers.set("oai-authenticated-user-id",`fixture:${fixture}`);headers.set("oai-authenticated-user-email",`${fixture}@example.test`); }
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const request=new Request(url,{method:req.method,headers,...(["GET","HEAD"].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
    const response=await worker.fetch(request, {DB, ASSETS:{fetch:async()=>new Response("Not found",{status:404})}}, {waitUntil(){},passThroughOnException(){}});
    const out=Object.fromEntries(response.headers);
    if(chosen)out["set-cookie"]=`review_fixture=${roles.includes(chosen)||chosen==="new"?chosen:"anonymous"}; Path=/; SameSite=Lax`;
    let body=Buffer.from(await response.arrayBuffer());
    if((out["content-type"]||"").includes("text/html"))body=Buffer.from(body.toString().replace("<body",'<body data-review="local-disposable-fixtures"').replace(/(<body[^>]*>)/,'$1<div style="padding:8px;text-align:center;background:#fff2bc;font:12px system-ui">LOCAL REVIEW ONLY. Disposable demo accounts. No production data.</div>'));
    res.writeHead(response.status,out);res.end(body);
  }catch(error){res.writeHead(500,{"content-type":"text/plain"});res.end(String(error));console.error(error);}
});
server.listen(port,"127.0.0.1",()=>console.log(`Disposable role preview: http://localhost:${port}/?fixture=anonymous`));
process.on("SIGINT",async()=>{server.close();await mf.dispose();process.exit(0);});
