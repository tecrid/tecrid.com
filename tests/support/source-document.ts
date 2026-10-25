import { createHash } from "node:crypto";
let sequence = 0;
// Each synthetic PDF represents a distinct source document, unless a test
// deliberately reuses its returned hash to exercise retry behavior.
export function syntheticSourceDocument() {
 return {sha256:createHash("sha256").update(`SYNTHETIC fixture PDF ${++sequence}`).digest("hex"),filename:`synthetic-${sequence}.pdf`};
}
