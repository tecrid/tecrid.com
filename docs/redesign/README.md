# TECRID Blue Atlas review

The self-contained `TECRID-Blue-Atlas.html` is the revised version of the supplied v3 design reference. Open it locally to review the public pages, sample record, and preview-only sign-in graphic. Preview form submission sends no email.

The production implementation is in `app/blue-atlas`, with existing application data imported from `lib/sample-tecrid.ts` and `lib/roles.ts`. The homepage, explanation, sample-record presentation, verifier surround, and shared public navigation use this design. Existing dashboard navigation and all production sign-in handlers remain in place.

Branding is TECRID, with the Institute of Contaminant Standards subline. The homepage title is `TECRID | Verify a lab report`; its robots metadata permits indexing and following. The required safety statements, demonstration labels, and fictional sample identifiers are retained. Canonical sample bytes, protocol names, fingerprints, routes, API responses, auth/mail handlers, and approval decisions are unchanged. Remaining workflow-file edits are presentation text literals only.

## Validation

- Production build passed.
- Page rendering and redirects: 29 passed.
- Relevant existing UI tests: 25 passed.
- Standalone preview semantic, interaction, and focused TypeScript checks passed.
- Broad unit run matches the untouched `2932c8a` baseline exactly: 62 passed, 36 skipped, 3 failed, with 9 failing files caused by the existing Miniflare constructor API mismatch in the available local dependencies.
- Full TypeScript checking reports existing backend/environment diagnostics; the production build completes.
- Copy-only workflow edits were checked structurally with the TypeScript parser. API, mail, canonical data, and authorization implementations are unchanged.

No merge or deployment is included.

## Integration with PR 53

Rebased onto main after the role-aware dashboard change, commit `2932c8a`. The role homes, approvals list, settings sections, and ICS laboratory invite route keep their main-branch structure and logic. Blue Atlas overrides target the existing selectors in CSS. Dashboard source changes are copy literals only. Auth, mail, invite, and approval implementations are preserved. The health response service label is `TECRID API` in both operational and degraded responses.

Rechecked production build, page rendering, full unit suite, lint, and TypeScript. Build and all 29 rendered/redirect checks pass. Unit and TypeScript failures match main. Lint retains existing main errors; the Blue Atlas unescaped apostrophes, unused compact prop, and obsolete test stylesheet binding are corrected.
