Results table verification, 10 November 2026

Checked the local built sample record in Google Chrome at 1440, 1280 and 375 CSS pixels. The mobile check exposed a global 580px table minimum; results.css now explicitly resets it. Reviewed consistent full-row dividers, normal-case names, inline units, the unclipped Chromium(VI) secondary note, compact status tags and the fictional-specification notice.

The reproducible browser-only fixture imports the application styles, including the global table rules, and both sampleCredentialDocument and the synthetic 40-compound PFAS fixture. It measures every visible result cell for clipping and document overflow. The PFAS data is confined to tests and is never imported by a production route.

Run `node tests/support/results-preview.mjs`, then open:

- http://localhost:3003/tests/fixtures/results-layout.html
- http://localhost:3003/tests/fixtures/results-layout.html?panel=pfas&all=1

Chrome responsive-mode measurements for all 40 compounds:

| Width | Overflow | Row heights |
| --- | --- | --- |
| 1440px | None | 64 to 65px |
| 1280px | None | 64 to 84px |
| 375px | None | 97 to 117px |

Long compound names wrap at natural boundaries and increase the row height. The eight-row sample also passed the 375px overflow check (97 to 98px rows). Desktop sample rows measured 64 to 65px. Mobile rows retain the name and result above the LOQ, specification and status metadata.

Unit coverage includes original values and qualifiers, full accessible status descriptions, methods, above-spec and unknown assessments, inferred families, supplied categories, the 12/13-row collapse boundary, independent group expansion, 20-row single-group truncation, show-all and show-fewer behavior.

`npm test` verifies the production build, rendered routes and unit suite. Targeted ESLint also passes. A separate `tsc --noEmit` check reports existing repository errors in Cloudflare bindings and unrelated modules; no errors remain in the changed results files or fixtures.
