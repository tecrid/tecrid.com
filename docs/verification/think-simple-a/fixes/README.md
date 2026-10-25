# PR 25 review fixes

The owner saves the real organization name once. That save atomically replaces the deferred slug and issuer code with a slug and code derived from the real name. Deferred codes have an internal SETUP_ marker. Previously created deferred workspaces are recognized by their setup-- slug and receive the same repair on save. Completed identity remains stable and subsequent identity changes still require ICS.

The server rejects deferred identity before application submission, approval, report reservation or credential creation. Even an incorrectly verified deferred organization cannot reserve or issue an identifier. The regression completes a disposable lab, passes its existing review and signing-key gates, and verifies that both a reservation and a signed issued credential use the real SIL issuer prefix. The former code never appears on either identifier. No production issuance occurred.

The built Worker returns HTTP 301 from /pricing, /pricing/ and /pricing with a query string to /. The page fallback also points home. The rendered regression checks the exact status and Location, empty body and the followed homepage's absence of the removed purchase card and checkout.

Validation: production build passed; 29 rendered/Worker/redirect checks passed; 73 unit/backend tests in 20 files passed. Focused ESLint passed with zero errors or warnings. Whitespace checks passed. The isolated D1 tests require host-local loopback sockets, so the final run used the approved local test environment. No production bindings or live transports were used.

Local curl proof against that built Worker:

```text
$ curl --silent --show-error --dump-header pricing-headers.txt --output pricing-body http://127.0.0.1:3111/pricing
HTTP/1.1 301 Moved Permanently
location: http://127.0.0.1:3111/
redirect body: 0 bytes
$ curl --silent --show-error --location --output home.html --write-out 'Final HTTP %{http_code}; URL %{url_effective}' http://127.0.0.1:3111/pricing
Final HTTP 200; URL http://127.0.0.1:3111/
```

The raw local response headers and passing test output are alongside this note. This is local built-source proof, not a production claim. No merge, deploy, real email or notification was performed.
