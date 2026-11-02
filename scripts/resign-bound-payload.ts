import { readFileSync } from "node:fs";
import { resignBoundPayloads } from "../lib/resign-bound-payload";

async function signerFromKeys(path: string) {
  const keys = JSON.parse(readFileSync(path, "utf8")) as Record<string, JsonWebKey>;
  const privateKeys = new Map<string, CryptoKey>();
  for (const [keyId, jwk] of Object.entries(keys)) {
    if (!jwk.d) throw new Error(`Signing key ${keyId} is missing private material.`);
    privateKeys.set(keyId, await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]));
  }
  return async (keyId: string, payload: string) => {
    const key = privateKeys.get(keyId);
    if (!key) throw new Error(`No private key was supplied for ${keyId}.`);
    const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(payload));
    return Buffer.from(signature).toString("base64url");
  };
}

const apply = process.argv.includes("--apply");
const keysFlag = process.argv.findIndex((argument) => argument === "--keys");
const keysPath = keysFlag >= 0 ? process.argv[keysFlag + 1] : "";
if (apply && !keysPath) {
  console.error("Refusing to re-sign without --keys <private-jwk-map.json>. Run without --apply for a dry-run count.");
  process.exitCode = 2;
} else {
  const report = await resignBoundPayloads({
    dryRun: !apply,
    sign: apply && keysPath ? await signerFromKeys(keysPath) : undefined,
  });
  console.log(JSON.stringify(report, null, 2));
  if (apply && report.failed) process.exitCode = 1;
}
