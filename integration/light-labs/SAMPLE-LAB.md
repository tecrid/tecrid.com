# Runnable sample laboratory

Open https://tecrid.com/sample-lab. All eight source reports already have stable **SBX test identifiers**, public resolver links and a VLE mapping export. The page separates the original source-report issuer (Light Labs) from the integration test signer (TECRID Sample Laboratory). No source result tables or original PDFs are disclosed by these endpoints.

To exercise the signing API now, sign in with your own TECRID account and choose **Run the eight-report API test**. No Light Labs account or approval is required. This generates a temporary Ed25519 key in your browser, fetches each exact canonical payload, signs locally, and saves the verified test proof in your own sandbox. Private keys never leave the browser. Repeated runs return the same saved personal proofs. A public resolver always remains `test_reference`; your personal test does not establish laboratory confirmation.

For an API integration, create a personal `tec_sandbox_` key at `/sandbox`, place it in your environment as `TECRID_SANDBOX_API_KEY`, and run with Node 22+:

```sh
node sample-lab.mjs kasandrinos-vle-test-identifiers.json
```

`TECRID_BASE_URL` defaults to https://tecrid.com. The client uses `connector.mjs` in the same folder. It verifies every returned Ed25519 test signature and payload hash. The sample key is ephemeral; the API persists only public key/signature and report association. The personal proof endpoints require sandbox bearer authentication or your signed-in session. Production API keys are rejected. The sample table is separate from production credentials and cannot grant laboratory issuer authority.

## API contract

- `GET /api/sandbox/lab/reports`: public report/reference manifest.
- `GET /api/sandbox/lab/reports/{testIdentifier}`: public reference; authenticated callers also receive their canonical signing payload and saved personal proof.
- `POST /api/sandbox/lab/reports/{testIdentifier}` with `{publicKeyJwk, signature}`: verify an Ed25519 base64url signature over the exact authenticated GET payload and save one proof per account/report. Returns 201 initially, 200 on replay. Wrong key/signature, tampered payload and cross-account replay fail. Private JWK material is rejected.
- `GET /api/v1/credentials/{testIdentifier}`: public test reference, `sandbox: true`, `productionAuthority: false`, `status: test_reference`, `productionTecrid: null`. It must never pass a production verification gate.
- `GET /records/{testIdentifier}`: human-readable test resolver.

## VLE display and later production linkage

Import the exported `reports` array into VLE's integration/test view. Display `vleDisplayLabel` alongside every test ID and link to `resolverUrl`. Do not award VERIFIED, laboratory-confirmed or VLE QUALIFIED status from these records. No sampling or custody IDs are supplied for these historical documents.

After Light Labs is onboarded and signs the real credential, match its signed report number, original source SHA-256, sample and lot to this source reference. Add its production identifier/resolver and independently verify current signature/status using the production API. Never change an SBX ID into a production ID, overwrite the original hash or treat a report's historical test date as credential issuance time. Use the existing unchanged-PDF legacy workflow or an authorized laboratory reissue; do not modify original reports merely to add test identifiers.
