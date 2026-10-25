import {expect,it} from "vitest";
import {canonicalizeCredential} from "../lib/tec";
const legacy={sampleName:"Synthetic sample",productSku:"TEST",results:[{analyte:"Synthetic",resultText:"ND",unit:"test"}]};
it("preserves legacy payload bytes and adds supplier identity only in a new signature domain",()=>{
 const old=canonicalizeCredential(legacy).normalizedCredential;
 expect(old).not.toHaveProperty("signatureVersion");
 const v2=canonicalizeCredential({...legacy,ingredientCode:"ING"}).normalizedCredential;
 expect(v2).toMatchObject({signatureVersion:"tec-credential/2"});
 const v3=canonicalizeCredential({...legacy,ingredientCode:"ING",originatingSupplier:"supplier-id"}).normalizedCredential;
 expect(v3).toMatchObject({signatureVersion:"tec-credential/3",originatingSupplier:"supplier-id",ingredientCode:"ing"});
 expect(canonicalizeCredential({...legacy,originatingSupplier:"supplier-id"}).canonicalPayload).not.toBe(canonicalizeCredential(legacy).canonicalPayload);
});
it("rejects display names, domains and truncated supplier identities",()=>{
 for(const originatingSupplier of ["Supplier Name","owner@example.test","x".repeat(121),null,12])expect(()=>canonicalizeCredential({...legacy,originatingSupplier})).toThrow(/organization ID/);
});
