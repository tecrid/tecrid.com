# Define TECRID clearly

The before image is the unmodified `/what-is-a-tecrid` page on main at `daf3ce3ff344f9e8ed1a7b519b88ce0a02b415b6`. The after images show this branch. All captures use local Vinext development servers and fictional demo data, with no production writes or publication.

- [Before, desktop](before-what-is-a-tecrid.png): 1440 by 1100 viewport, full page.
- [After, desktop](after-what-is-a-tecrid.png): same viewport, full page.
- [After, mobile](after-what-is-a-tecrid-mobile.png): 390 by 844 viewport, full page.

The first content on the explainer is its definition H1 and a plain-language sentence. The example draws its identifier, laboratory, report, lot, result, and fingerprint from the existing demo data. It does not claim a verified signature for the fictional example.

`npm test` builds the production worker, tests rendered HTML and redirects, and runs the unit/integration suite. Added rendered coverage checks the definition H1, definition metadata, example labels, section order and content, each requested first-screen introduction, and internal destinations from public renders and literal navigation throughout the app. The link crawl follows redirects, checks downloadable files on disk because the test worker stubs ASSETS, and never submits forms. The retired `/pricing` route stays a 404 and is not linked.

The two broken destinations found by the crawl were the default badge preview's placeholder profile and the pending test laboratory's nonexistent issuer detail page. An empty badge preview now leads to the participant directory. Laboratories without public issuer status link to the live issuer directory; verified, suspended, and revoked laboratories retain their specific issuer page.

Browser capture uses Playwright Chromium with `--single-process`, `--no-zygote`, and `--in-process-gpu` for compatibility with the local process restrictions. The mobile check confirms the definition fits in the first viewport, no horizontal overflow, and the privacy FAQ expands.
