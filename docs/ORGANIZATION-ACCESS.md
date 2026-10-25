# Organization recipient gate

Order TECRID-MINT-TO-PHONE-1, step 3. Stacked on the standing authorization PR. No deployment or automatic delivery activation.

An onward recipient is UNGATED when its organization identity has been verified and it holds an active grant from the relevant controlling brand or supplier. A grant from another controller does not unlock this controller's delivery. Each grant must also remain active. Revocation is checked again before an external notification is sent.

Migration 0022 creates the singleton delivery policy with an empty terms URL, empty terms version, and `terms_required = 0`. There is no terms document in this change. An ICS operator can configure an existing HTTPS terms URL and version in `/dashboard/organization-access`, then enable the requirement. No code change is needed. When enabled, the organization's `terms_accepted_at` must exist and its `terms_version` must match the configured version. Missing configuration fails closed. Only an organization owner or administrator can record acceptance; they must explicitly accept the current linked version. Identity decisions and policy changes require existing ICS operator privileges and are audited.

Existing operator-reviewed issuer or registry verification counts until an explicit identity decision is recorded. An explicit identity revocation takes precedence. Organization profiles, the recipient access page, and grant screens show GATED or UNGATED with reasons. Public reasons disclose neither grant identities nor private evidence.

The gate is enforced before creating recipient snapshots, by a database insertion guard, and before outbound delivery. A blocked external notification consumes no transport attempt and is retried after 15 seconds. Controller receipts and laboratory lifecycle events remain the controlling organization's own records. An explicit synthetic channel test does not require a recipient grant.

One-time grants authorize one snapshot. The existing delivery row consumes that one use, with an atomic database check preventing a second snapshot. The grant remains active as disclosure authority for that first record and its alert until explicitly revoked. Historical grants already marked fulfilled are not reactivated. Future-SKU grants continue allowing new matching records.

Verification uses isolated D1 databases, synthetic Ed25519 keys and intercepted transports. It covers default-off terms, controller isolation, denied self-verification, GATED snapshot and network denial, direct database guard enforcement, verified identity, enabling terms, changed versions, explicit acceptance, nonadministrator rejection, identity revocation, and one-time first-alert delivery without a second record delivery.
