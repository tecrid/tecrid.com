# Onboarding the first issuer laboratory

This is the path for one known laboratory, Light Labs, and for the ICS reviewer, Karen Pendergrass. It does not grant access by itself. Nothing in this document is a password, API key, or signing key.

TECRiD accepts only laboratories accredited to ISO/IEC 17025. A person still checks the accreditation. The check has to be written down: certificate, accreditation body, scope, and expiry. Karen can see those fields on the issuer review page.

Two different ICS administrators must agree before the laboratory can mint. Neither person may be an owner, member, contact, or the person who submitted the application. Karen is the named reviewer for this first laboratory. A second ICS administrator, who is also independent of Light Labs, gives the final approval. The product does not use a phone passkey for that approval.

## Before anyone starts

Confirm that tecrid.com is serving the release Karen reviewed. The public issuer list should still show zero active laboratories until this review finishes. Do not send Light Labs a production API key before the laboratory status is verified.

Karen enrolls the admin second factor at `/admin/security` before opening review tools. The email sign-in link alone does not open them.

## What the laboratory technician does

1. Open `https://tecrid.com/sign-in`. Enter a work email on the laboratory's own domain. The laboratory website must use that same domain. Free webmail is refused. Open the single-use link in the message within 10 minutes. There is no password.

2. Create the laboratory workspace if this email does not already have one. The workspace starts pending. Pending laboratories can prepare a private draft. They cannot publish a TECRiD or a public laboratory profile.

3. Open `https://tecrid.com/dashboard/laboratory` and submit one application. Include:
   - legal name, address, website, and the technician's role
   - the ISO/IEC 17025 scope as a PDF
   - accreditation body, certificate number, certificate expiry, and the public register URL
   - the scope TECRiD should allow, including matrices, analytes, methods, and exclusions
   - the responsible contact, which must be the same confirmed work email

4. Generate the signing key on the laboratory's own computer. The application form can create an encrypted key file in the browser, or the laboratory can use its own key process. TECRiD receives only the public Ed25519 key and a key id. Do not paste a private key into the form, a chat, or a ticket. Store the private key and the key-file passphrase in the laboratory's own custody, separate from each other.

5. Submit the application. Then open the key challenge on the same page. TECRiD shows a short-lived payload. Sign that exact text locally with the private key and submit only the signature. The challenge expires after 15 minutes. If it expires, start a new one. Do not reuse an old signature.

6. Wait. The page shows four steps: confirmed work email, identity and accreditation and scope, key challenge, and two independent ICS reviews. Issuing stays locked until both reviews pass. Do not create a production API key yet. A production write key is refused until the laboratory is verified.

7. After Karen's page shows the laboratory as verified, mint one onboarding TECRiD for a sample the laboratory is willing to leave on the public resolver. Say in the sample name that it is the onboarding check. Reserve the identifier, sign the canonical payload TECRiD returns, and include the TECRID, the PDF SHA-256, and the lot in that signature. Submit the signature. Open the public page for that identifier and confirm the laboratory name, the verified status, and a verified signature. A revoked TECRiD stays revoked. Do not plan to "undo" this record by signing it back to issued.

Production API keys are created only after verification, by an owner or admin, and only with the scopes the integration needs. The private signing key still stays at the laboratory. The API key is not a substitute for it.

## What Karen checks

Open `https://tecrid.com/admin/issuers` after the second factor. For the Light Labs application, record each item in the review form. The note is the evidence. Do not approve from memory.

- Identity. The legal name, address, and website belong to Light Labs. The confirmed email domain matches the website. The contact is a real laboratory role, not a personal mailbox.
- Certificate. The accreditation body, certificate number, and expiry on the application match the scope PDF.
- Register. Open the accreditation body's public register. Record the register URL, what it showed, and the date checked. The scope TECRiD is asked to carry must fit the accredited scope, including sites and methods, and must list exclusions. If the certificate is expired or the scope does not fit, fail the accreditation or scope check and send the application back. Do not approve it.
- Independence. Karen does not approve an application she owns, belongs to, submitted, or is the contact for. If she records the identity, accreditation, and scope checks, a different ICS administrator records the final approval. If the other administrator recorded those checks, Karen records the final approval. The same person cannot do both.
- Key. The key-control and signing-conformance rows must already say passed. Those come from the laboratory's challenge signature. Do not mark them passed by hand.
- Decision. The second administrator writes a review note and approves, asks for information, or rejects. Approval turns the laboratory into a verified issuer and publishes the reviewed public key. The public issuer list then shows Light Labs.

After the onboarding TECRiD exists, open its public page. The issuer line should say verified, and the signature check should pass.

## If the laboratory must stop issuing

On the same review page, an independent ICS administrator can suspend or revoke the laboratory. A reason is required. The reason is stored in the audit log, and the laboratory sees a notice.

- Suspend means the laboratory cannot mint. Existing TECRiDs stay on their public pages and show the laboratory as suspended. ICS can reinstate a suspended laboratory later, with another audited reason.
- Revoke means the same minting block, and it is permanent. Existing TECRiDs stay public and show the laboratory as revoked. Reinstatement is refused.

Suspending or revoking a laboratory does not delete its old TECRiDs and does not by itself revoke an individual record. To revoke one TECRiD, the laboratory signs a revocation while it is still verified. Do that before a permanent laboratory revocation if a particular onboarding record should stop being relied on.
