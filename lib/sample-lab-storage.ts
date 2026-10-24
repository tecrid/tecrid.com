import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { sampleLabProofs } from "../db/schema";
import { sampleLabCanonical, sampleLabReference, sampleHash, verifySampleLabProof } from "./sample-lab";

export async function getSampleLabProof(userId:string, identifier:string) {
 const reference=sampleLabReference(identifier);if(!reference) return null;
 const [row]=await getDb().select().from(sampleLabProofs).where(and(eq(sampleLabProofs.userId,userId),eq(sampleLabProofs.testIdentifier,reference.testIdentifier))).limit(1);
 if(!row)return null;
 return {testIdentifier:row.testIdentifier,sandbox:true,productionAuthority:false,status:"test_signed",testSignedAt:row.createdAt,payloadHash:row.payloadHash,proof:{algorithm:"Ed25519",publicKeyJwk:JSON.parse(row.publicKeyJwk),signature:row.signature,signedPayload:row.canonicalPayload},signatureMeaning:"Self-signed integration test. Not a reviewed laboratory signing key or confirmation of source findings."};
}
export async function issueSampleLabProof(userId:string, identifier:string, input:{publicKeyJwk:JsonWebKey;signature:string}) {
 const canonicalPayload=await sampleLabCanonical(userId,identifier);
 const jwk=await verifySampleLabProof(canonicalPayload,input.publicKeyJwk,input.signature);
 const reference=sampleLabReference(identifier)!;
 const prior=await getSampleLabProof(userId,identifier);
 if(prior)return {...prior,idempotent:true};
 await getDb().insert(sampleLabProofs).values({id:crypto.randomUUID(),userId,testIdentifier:reference.testIdentifier,canonicalPayload,payloadHash:await sampleHash(canonicalPayload),publicKeyJwk:JSON.stringify(jwk),signature:input.signature,createdAt:new Date().toISOString()}).onConflictDoNothing({target:[sampleLabProofs.userId,sampleLabProofs.testIdentifier]});
 return {...(await getSampleLabProof(userId,identifier))!,idempotent:false};
}
