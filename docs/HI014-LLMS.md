# HI-014: public TECRID guide

The live read-only baseline returned404 for llms.txt. Home and join already contain valid Organization, WebSite, Person and Service structured data; those existing graphs are preserved.

This change adds only a public documentation guide at llms.txt. It points to existing public overview, standard, verifier, developer, FAQ and disclosure pages. It keeps TEST examples separate, distinguishes laboratory records from product certification and grants no private access. No private API, workspace or report URL is listed. No credential, schema, UI or operational change.

Validation: build PASS;29 rendered tests PASS;73 unit tests across20 files PASS. Built dist/client/llms.txt is byte-identical to public/llms.txt. Every linked path exists in current main. Whitespace PASS. The source is plain Markdown using the [llms.txt proposal](https://llmstxt.org/). Draft only, no merge or publication; receiver activation remains separately gated.
