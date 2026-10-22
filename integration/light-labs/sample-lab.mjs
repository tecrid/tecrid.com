#!/usr/bin/env node
import {generateKeyPairSync,sign,verify,createPublicKey} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {request,sha256} from './connector.mjs';
const base=process.env.TECRID_BASE_URL||'https://tecrid.com';
const token=process.env.TECRID_SANDBOX_API_KEY;
if(!token?.startsWith('tec_sandbox_'))throw new Error('Set TECRID_SANDBOX_API_KEY to a personal key from /sandbox. No production key or laboratory approval is needed.');
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const publicKeyJwk=publicKey.export({format:'jwk'});
const manifest=await request(base,'/api/sandbox/lab/reports');
const results=[];
for(const reference of manifest.reports){
 const path=`/api/sandbox/lab/reports/${encodeURIComponent(reference.testIdentifier)}`;
 const prepared=await request(base,path,{token});
 if(!prepared.canonicalPayload||!JSON.parse(prepared.canonicalPayload).sandbox)throw new Error('Expected a sandbox canonical payload.');
 const signature=sign(null,Buffer.from(prepared.canonicalPayload),privateKey).toString('base64url');
 const issued=await request(base,path,{token,method:'POST',body:{publicKeyJwk,signature},retry:true});
 const proof=issued.proof;
 if(!issued.sandbox||issued.productionAuthority!==false||sha256(proof.signedPayload)!==issued.payloadHash||!verify(null,Buffer.from(proof.signedPayload),createPublicKey({key:proof.publicKeyJwk,format:'jwk'}),Buffer.from(proof.signature,'base64url')))throw new Error('Sandbox proof verification failed.');
 results.push({...reference,personalTestProof:issued});
 console.log(`${reference.reportNumber}: ${reference.testIdentifier} — sample signature verified`);
}
const out=process.argv[2]||'kasandrinos-vle-test-identifiers.json';
await writeFile(out,JSON.stringify({contractVersion:'tecrid-vle-sample-lab/1',sandbox:true,productionAuthority:false,displayRequirement:'Always show TEST identifier · Light Labs confirmation pending',reports:results},null,2)+'\n',{mode:0o600});
console.log(`Saved ${out}. These are test proofs, not Light Labs production credentials.`);
