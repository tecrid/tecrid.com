#!/usr/bin/env node
// Node >=22. No external packages. Private keys are used only on the lab host.
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, createPrivateKey, createPublicKey, sign, verify, pbkdf2Sync, createDecipheriv } from 'node:crypto';
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export async function request(base, path, {token, method='GET', body, retry=false, fetcher=fetch}={}) {
  const origin = new URL(base);
  if (origin.protocol !== 'https:' && !(origin.protocol==='http:' && ['localhost','127.0.0.1'].includes(origin.hostname))) throw new Error('HTTPS is required outside localhost.');
  const target = new URL(path,origin);
  if(target.origin!==origin.origin) throw new Error('Cross-origin API request refused.');
  for(let attempt=0;attempt<4;attempt++) {
    let response;
    try {response=await fetcher(target,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...(token?{authorization:`Bearer ${token}`} : {}),'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});}
    catch(error) {if(!retry||attempt===3) throw new Error(`Request outcome unknown; keep this job and retry it unchanged. ${error.message}`);}
    if(response?.ok) return response.json();
    if(response && (!retry||![429,500,502,503,504].includes(response.status)||attempt===3)) {
      const data=await response.json().catch(()=>({}));throw new Error(`HTTP ${response.status}: ${data.error?.message || data.error || 'Request failed'}`);
    }
    const retryAfter=Number(response?.headers.get('retry-after'));
    await new Promise(r=>setTimeout(r,Math.min(10000,Math.max(500*2**attempt,Number.isFinite(retryAfter)?retryAfter*1000:0))));
  }
}
export function signPayload(canonicalPayload, keystore, passphrase) {
  let jwk;
  if(keystore.format==='tecrid-encrypted-keystore-v1') {
    if(!passphrase || keystore.kdf?.name!=='PBKDF2' || keystore.kdf.hash!=='SHA-256' || keystore.kdf.iterations<200000 || keystore.kdf.iterations>5000000 || keystore.cipher?.name!=='AES-GCM') throw new Error('Valid encrypted keystore and passphrase required.');
    const key=pbkdf2Sync(passphrase,Buffer.from(keystore.kdf.salt,'base64url'),keystore.kdf.iterations,32,'sha256');
    const ciphertext=Buffer.from(keystore.cipher.ciphertext,'base64url');
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(keystore.cipher.iv,'base64url'));
    decipher.setAuthTag(ciphertext.subarray(-16));jwk=JSON.parse(Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]));key.fill(0);
    if(jwk.x!==keystore.publicKeyJwk.x) throw new Error('Keystore public key mismatch.');
  } else throw new Error('Use the encrypted TECRID keystore or supply a separately generated proof from the lab signing service.');
  if(jwk.kty!=='OKP'||jwk.crv!=='Ed25519'||!jwk.d) throw new Error('Ed25519 private key required.');
  return {keyId:keystore.keyId,algorithm:'Ed25519',signature:sign(null,Buffer.from(canonicalPayload,'utf8'),createPrivateKey({key:jwk,format:'jwk'})).toString('base64url')};
}
export function verifyDocument(doc) {
  if(doc.status!=='issued') throw new Error(`Credential is not currently issued (${doc.status}).`);
  if(doc.issuer?.status!=='verified') throw new Error('Issuer is not currently verified.');
  const proof=doc.integrity?.issuerProof;
  if(!proof?.signedPayload) throw new Error('Full signed payload required; obtain authorized recipient access for controlled findings.');
  if(proof.algorithm!=='Ed25519'||sha256(proof.signedPayload)!==proof.signedPayloadHash) throw new Error('Signed payload hash or algorithm invalid.');
  if(!verify(null,Buffer.from(proof.signedPayload),createPublicKey({key:proof.publicKeyJwk,format:'jwk'}),Buffer.from(proof.signature,'base64url'))) throw new Error('Issuer signature invalid.');
  const current=doc.versions?.find(v=>v.version===doc.version);
  if(!current?.canonicalPayload || sha256(current.canonicalPayload)!==doc.integrity.fingerprint || current.signedPayload!==proof.signedPayload) throw new Error('Current version fingerprint mismatch.');
  return {tecrid:doc.tecrid,version:doc.version,status:doc.status,signatureVerified:true,checkedAt:new Date().toISOString(),sourceDocument:doc.sourceDocument,subject:doc.subject};
}
async function save(path,data) {await mkdir(dirname(resolve(path)),{recursive:true});const tmp=`${path}.${process.pid}.tmp`;await writeFile(tmp,JSON.stringify(data,null,2)+'\n',{mode:0o600});await rename(tmp,path);}
async function json(path){return JSON.parse(await readFile(path,'utf8'));}
export async function main(args) {
 const [command,...rest]=args;const base=process.env.TECRID_BASE_URL||'https://tecrid.com';const token=process.env.TECRID_API_KEY;
 const call=(path,options={})=>request(base,path,{token,...options});
 if(command==='sandbox') {
  let currentStage='submitted';for(const action of ['claim','confirm','issue']) {const r=await request(base,'/api/sandbox/v1/scenario',{method:'POST',body:{currentStage,action}});currentStage=r.scenario.stage;}
  console.log(JSON.stringify({sandbox:true,productionAuthority:false,stage:currentStage,note:'Demonstration state transitions only; not cryptographic issuance.'}));return;
 }
 if(command==='reserve') {
  if(!token)throw new Error('Set TECRID_API_KEY in the lab secret manager.');
  const [inputPath,jobPath]=rest;if(!inputPath||!jobPath)throw new Error('reserve reservation.json job.json');
  const input=await json(inputPath);if(!input.idempotencyKey)throw new Error('A stable idempotencyKey is required; reuse the same key after an uncertain response.');
  const r=await call('/api/v1/report-reservations',{method:'POST',body:input,retry:true});await save(jobPath,{base,reservation:r.reservation});console.log(`Reserved ${r.reservation.tecrid}. Render its reportMark on the new PDF before fingerprinting.`);return;
 }
 if(command==='prepare') {
  const [jobPath,inputPath,pdfPath,outputPath]=rest;if(!outputPath)throw new Error('prepare job.json credential.json final-marked.pdf unsigned.json');
  const job=await json(jobPath);if(job.base!==base)throw new Error('Job environment mismatch.');const input=await json(inputPath);const bytes=await readFile(pdfPath);
  if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF required.');
  const credential={...input,publish:true,sourceDocument:{...input.sourceDocument,sha256:sha256(bytes),filename:pdfPath.split(/[\\/]/).pop()}};
  const canonical=await call('/api/v1/credentials/canonicalize',{method:'POST',body:credential});
  await save(outputPath,{base,reservation:job.reservation,credential,canonicalPayload:canonical.canonicalPayload});console.log('Prepared exact canonical payload for lab review. No signature or issuance performed.');return;
 }
 if(command==='sign') {
  const [unsignedPath,outputPath,approval]=rest;if(approval!=='--reviewed')throw new Error('Review the source PDF, canonical payload, scope and disclosure, then use sign unsigned.json signed.json --reviewed.');
  if(!process.env.TECRID_KEYSTORE_PATH)throw new Error('Set TECRID_KEYSTORE_PATH on the laboratory host.');
  const job=await json(unsignedPath);const proof=signPayload(job.canonicalPayload,await json(process.env.TECRID_KEYSTORE_PATH),process.env.TECRID_KEY_PASSPHRASE);
  await save(outputPath,{...job,credential:{...job.credential,proof}});console.log('Signed locally. Private key was not sent.');return;
 }
 if(command==='finalize') {
  const [signedPath,receiptPath,approval]=rest;if(approval!=='--approved')throw new Error('Authorized lab operator must use finalize signed.json receipt.json --approved.');
  const job=await json(signedPath);if(job.base!==base)throw new Error('Job environment mismatch.');
  const r=await call(`/api/v1/report-reservations/${encodeURIComponent(job.reservation.id)}/finalize`,{method:'POST',body:job.credential,retry:true});await save(receiptPath,r);console.log(`Issued ${r.credential.tecrid}. ${r.routingWarning||''}`);return;
 }
 if(command==='verify') {
  const [identifier,outputPath]=rest;if(!outputPath)throw new Error('verify TECRID verification.json');
  const doc=await request(base,`/api/v1/credentials/${encodeURIComponent(identifier)}`);const receipt=verifyDocument(doc);await save(outputPath,receipt);console.log('Current status, signature and version fingerprint verified.');return;
 }
 throw new Error('Commands: sandbox, reserve, prepare, sign, finalize, verify. See README.md.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
