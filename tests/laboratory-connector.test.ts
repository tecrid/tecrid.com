// @vitest-environment node
import { describe,it,expect } from 'vitest';
import { generateKeyPairSync, randomBytes, pbkdf2Sync, createCipheriv, verify, createPublicKey } from 'node:crypto';
import { request, signPayload, verifyDocument } from '../integration/light-labs/connector.mjs';
describe('laboratory connector boundary',()=>{
 it('signs encrypted keystores locally and never includes private material in proof',()=>{
  const {privateKey,publicKey}=generateKeyPairSync('ed25519'); const salt=randomBytes(16),iv=randomBytes(12); const key=pbkdf2Sync('test password',salt,200000,32,'sha256');
  const cipher=createCipheriv('aes-256-gcm',key,iv);const encrypted=Buffer.concat([cipher.update(JSON.stringify(privateKey.export({format:'jwk'}))),cipher.final(),cipher.getAuthTag()]);
  const store={format:'tecrid-encrypted-keystore-v1',keyId:'test',publicKeyJwk:publicKey.export({format:'jwk'}),kdf:{name:'PBKDF2',hash:'SHA-256',iterations:200000,salt:salt.toString('base64url')},cipher:{name:'AES-GCM',iv:iv.toString('base64url'),ciphertext:encrypted.toString('base64url')}};
  const proof=signPayload('exact bytes',store,'test password');expect(Object.keys(proof)).toEqual(['keyId','algorithm','signature']);expect(verify(null,Buffer.from('exact bytes'),createPublicKey({key:store.publicKeyJwk,format:'jwk'}),Buffer.from(proof.signature,'base64url'))).toBe(true);
  expect(()=>signPayload('exact bytes',store,'wrong password')).toThrow();
 });
 it('refuses insecure and cross-origin requests and redacted/revoked verification',async()=>{
  await expect(request('http://example.test','/api')).rejects.toThrow(/HTTPS/);
  await expect(request('https://example.test','https://other.test/api',{token:'never-send'})).rejects.toThrow(/Cross-origin/);
  expect(()=>verifyDocument({status:'revoked'})).toThrow(/not currently issued/);
  expect(()=>verifyDocument({status:'issued',issuer:{status:'verified'},integrity:{issuerProof:{signedPayload:null}}})).toThrow(/Full signed payload/);
 });
 it('does not retry a denied write',async()=>{
  let count=0;await expect(request('https://example.test','/api',{method:'POST',body:{},retry:true,fetcher:async()=>{count++;return Response.json({error:{message:'denied'}},{status:403})}})).rejects.toThrow(/403/);expect(count).toBe(1);
 });
});
