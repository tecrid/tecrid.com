# Elon ↔ Codex bridge (TECRID pen pals)

Repo: `tecrid/tecrid.com` · Live: https://tecrid.com
Shared drop-box. Append only in your section. Newest on top. Never delete the other party's entries.

Plan: see paleofoundation/VLE `ops/VLE_TECRID_7DAY_WAR.md` (7-day war).

## Protocol
1. Codex → `## CODEX → ELON` (STATUS / ASK / PR / BLOCKER)
2. Elon → `## ELON → CODEX` (ORDER / KILL-GATE / PROMPT / NO / STOP / LIVE)
3. Newest on top; tag line required.
4. Scope locks: no inventing live issuer credentials; no weakening evidence authenticity; PDF/COA alone ≠ TECRID; VLE QUALIFY requires TECRID-linked evidence; commercial partner GO is Karen.
5. Elon STOP if poll offline >15m; LIVE on resume.

## ELON → CODEX

### 2026-09-07 12:10 Asia/Nicosia — LIVE
Tag: STATUS

**LIVE.** 7-day war. Lab go-time pack is critical path.

### 2026-09-07 12:10 Asia/Nicosia — ORDER
Tag: ORDER

**T-PR-1 — Lab Go-Time Pack (sandbox + docs, not fake production issuer).**

Ship one PR to tecrid.com that a lab can use the same day they say GO:
1. Public `/for-laboratories` (or clear nav equivalent): what TECRID is, mint/authenticate flow, evidence lifecycle, revoke/supersede, explicit PDF/COA ≠ TECRID.
2. End-to-end **sandbox / API key request path** documented (and UI if already partially there): request → issue/sandbox → example test call → how evidence links to VLE lot. Do not invent production secrets.
3. **"Lab says GO tomorrow" checklist** page or section: keys, config snippet, sample payload, support contact, dual-ask with VLE independent sampling, link to https://vle.exchange/for-laboratories (once domain points at product; until then also list https://vle-navy.vercel.app/for-laboratories).
4. Do not: fake lab certifications, weaken authenticity claims, build unrelated marketing fluff, or claim VLE QUALIFIED without TECRID.

Stop at kill-gate with PR URL. NO FINISH.

### 2026-09-07 12:10 Asia/Nicosia — PROMPT
Tag: PROMPT

Acknowledge LIVE + T-PR-1. Open PR. STATUS with URL. Stop for kill-gate. NO FINISH.

## CODEX → ELON

*(Codex: newest on top.)*

### 2026-09-07 12:52 Asia/Nicosia — STATUS
Tag: STATUS

LIVE acknowledged. ORDER T-PR-1 — Lab Go-Time Pack is open for kill-gate review:

- PR: https://github.com/tecrid/tecrid.com/pull/2
- Public surface added: `/laboratory-go-time`, linked from `/for-laboratories`, primary navigation, footer, and sitemap.
- Mint flow, evidence lifecycle, correction/revocation, `PDF/COA ≠ TECRID`, keys/config/sample payload/support, and the VLE dual-ask are explicit.
- Laboratory sandbox links now land on the requested role and portal section.
- Candidate `/api/sandbox/v1/vle-evidence` test contract fails closed on authentication, issuance state, TECRID mismatch, and VLE Sample-code mismatch.
- Production authority remains false; the VLE contract is labeled sandbox-only and `CANDIDATE_NOT_PRODUCTION`; no certification or VLE QUALIFIED claim is created.
- Verification: build passed; 20/20 rendered-route tests; 15/15 unit tests; browser desktop/mobile clean; 390px horizontal overflow = 0; unauthenticated contract call = `401` + `no-store`.

Kill-gate: STOPPED. Awaiting PASS/NO. No production deployment. NO FINISH.
