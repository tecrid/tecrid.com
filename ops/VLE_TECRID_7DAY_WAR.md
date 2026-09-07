# 7-DAY WAR PLAN — Prove TECRID + VLE or Pivot
**Clock:** 2026-09-07 → 2026-09-14 (Asia/Nicosia)  
**Mission Lead:** Elon (INTJ) · **CEO:** Karen · **Eng:** Codex · **Deals:** Marcus · **Pilot board:** Elena  
**Rule:** If it does not create a real path lot → sample → TECRID → QUALIFIED on a live domain with a real human on the other end, kill it.

---

## 0. First principles (what “works” means in 7 days)

We are **not** proving a marketplace with inventory. We are proving:

1. **A stranger can understand and trust the system** on `vle.exchange` + `tecrid.com` in <5 minutes.
2. **A lab can say yes and get everything they need** the same day (docs, sandbox/API path, VLE handoff, commercial terms packet).
3. **A supplier can nominate a real stocked lot** and see the next steps without confusion.
4. **Ops can run one closed-loop dry run** with real accounts (Clerk bootstrap), even if QUALIFIED is still sandbox/TECRID-stub.

**PROVE (by Sep 14):** All four true, plus ≥1 lab in active onboarding conversation AND ≥1 supplier lot-facts conversation that is not ghosted.

**PIVOT (Sep 14):** If (2) or (3) fails after honest outreach + live surfaces — the bottleneck is not “more UI.” Options: narrow to TECRID-only lab SaaS, Rescue-only concierge, or pause VLE public until lab issuer exists.

---

## 1. Brutal current state (do not lie to yourself)

| Fact | Status |
|------|--------|
| VLE product (PR-H) | Live on `vle-navy.vercel.app` — finished-feeling pilot chrome |
| `vle.exchange` | **Parking lander** (`/lander` redirect) — **NOT the product** |
| `tecrid.com` | Live Next app (verifiable reports story); open PR #1 dashboard |
| TECRID↔VLE | Adapter stub; live credentials blocked on partner GO |
| Nominations | **0** NOMINATED; Marcus HOLD/WATCH ~17–18; bank parked ~Sep 15 |
| Labs in flight | 4 SENT (Anresco, Eurofins WEJ, Certified, Light Labs/Nick) |
| Clerk bootstrap | **Not done** — real people cannot fully test |
| Cocoa Profile | Still EXAMPLE honesty banners — freeze is CEO |

---

## 2. Parallel tracks (run all four every day)

```
TRACK A — SURFACES (Codex + Karen DNS)
TRACK B — TECRID LAB PACK (Codex + Karen commercial)
TRACK C — HUMAN PHYSICS (Marcus + Elena + Karen)
TRACK D — PROOF INSTRUMENTS (Elon kill gates)
```

No fifth track. No WikiBiome/HMTc/HMI in this 7-day window unless a lab deal requires a cite.

---

## 3. Hour-zero pack (TODAY — Sep 7, before sleep)

### A0 — Put the real product on the real domain (blocker #1)
1. Point `vle.exchange` + `www` to the Vercel project that serves PR-H (not the lander).
2. Verify: home, `/for-suppliers`, `/for-buyers`, `/for-laboratories`, `/access` load on the apex domain.
3. Codex ORDER **PR-I**: domain hardening checklist in-repo + any host redirects; kill lander stub once DNS live.
4. Karen: DNS/Vercel domain attach (only she can finish registrar/Vercel ownership steps).

### B0 — TECRID pen-pal bus LIVE
1. Create `ops/bridge/ELON_CODEX.md` on `tecrid/tecrid.com` (same protocol as VLE).
2. Codex ORDER **T-PR-1**: **Lab Go-Time Pack** on tecrid.com:
   - `/for-laboratories` (or equivalent): what TECRID is, mint flow, evidence lifecycle, revoke
   - **Sandbox / API keys path** documented end-to-end (request → issue → test call → VLE link)
   - “When a lab says GO tomorrow” checklist: keys, config, sample payload, support contact, VLE dual-ask
   - Explicit: PDF/COA upload alone ≠ TECRID; VLE will not QUALIFY without TECRID-linked evidence
3. Do not invent live issuer credentials. Sandbox + request path is enough for day-1 conversations.

### C0 — Unblock humans
1. **Karen (30 min):** Clerk `access:bootstrap` → map self + Marcus + Elena on `/ops/memberships`.
2. **Karen (decision):** Cocoa Profile v1.0 freeze **or** explicit “EXAMPLE-for-demo through Sep 14” memo (no silent fake limits).
3. **Marcus:** Lift Sep-15 park for this war week only — follow-up the 4 labs + top supplier threads with deep links to live `vle.exchange` + `tecrid.com` lab pack. No cold spray dump. No Knowde.
4. **Elena:** Board ready for first NOMINATED within 2h of lot facts.

### D0 — Instruments
1. Resume VLE + TECRID Codex polls only while ORDERS are LIVE.
2. Nightly Elon scorecard (below). Sep 14 = prove/pivot kill gate (aligns Friday network gate).

---

## 4. Day plan

### Day 1 (Sep 8) — “They can see it and request keys”
| Owner | Done when |
|-------|-----------|
| Karen | `vle.exchange` serves product; Clerk bootstrap done |
| Codex VLE | PR-I domain/host truth; lander dead |
| Codex TECRID | T-PR-1 Lab Go-Time Pack merged or at kill-gate |
| Marcus | All 4 labs + priority suppliers pinged with live URLs + one clear ask |
| Elon | Kill-gate PRs; scorecard |

**Marketing that is real (not ads):**
- One Lab email (Specter): TECRID mint + VLE independent sample dual-ask + link to lab pack
- One Supplier email: nominate stocked lot → sample → TECRID → qualify; link `/for-suppliers`
- Optional: 1-page PDF “How VLE + TECRID work” generated from live pages (no new brand system)

### Day 2–3 (Sep 9–10) — “Someone is talking”
- Convert ≥1 lab to: call booked **or** sandbox key requested **or** explicit NO
- Convert ≥1 supplier to: lot code + qty + location + authorizer **or** explicit NO
- If Light Labs/Nick replies: Karen commercial terms packet same day; Elon orders live-adapter prep only after GO
- Codex: only fixes that unblock demos (auth empty states, key request UX, broken links) — no Phase C

### Day 4–5 (Sep 11–12) — “Dry-run physics”
- One NOMINATED lot on board (Elena)
- Sample/custody plan scheduled or blocked with named reason
- TECRID sandbox evidence linked to that lot (or documented blocker with owner)
- VLE shows the lot’s next gate without looking broken
- Buyer path: at least one serious buyer conversation OR Rescue request form used by a real human

### Day 6 (Sep 13) — “Close gaps only”
- Fix only what failed demos
- No new features
- Prep Sep 14 kill packet: links, screenshots, conversation log, blockers

### Day 7 (Sep 14) — PROVE or PIVOT
Elon kill gate scores 0–2 each:

| Criterion | 2 | 1 | 0 |
|-----------|---|---|---|
| Live domains | Both product-true | One true | Landing theater |
| Lab go-time | Lab requested/issued keys or signed path | Warm yes, no keys | Silence / confusion |
| Supplier physics | Lot facts in system | Verbal only | None |
| Closed-loop demo | Nominate→TECRID-link→gate visible | Partial | Can’t demo |

**PROVE:** ≥6/8 and no fatal trust lie.  
**PIVOT:** ≤4/8 or lab path impossible → Elon proposes narrow TECRID-lab wedge or concierge-only Rescue within 24h.

---

## 5. Hard NO list (7-day)

- Phase C Orders/payments, Knowde catalog, avocado expansion
- Fake QUALIFIED lots / invented Profile numbers
- Donation/WikiBiome/HMTc digressions
- Mass cold email to new lab shortlists (use the 4 in flight + Karen-named adds only)
- Building TECRID issuer production before Karen commercial GO
- Waiting for “perfect” before DNS cutover

---

## 6. Pen-pal operating model

| Repo | Bridge | Poll |
|------|--------|------|
| `paleofoundation/VLE` | `ops/bridge/ELON_CODEX.md` | 5-min while LIVE; STOP on HOLD |
| `tecrid/tecrid.com` | `ops/bridge/ELON_CODEX.md` (new) | 5-min while LIVE; STOP on HOLD |

Elon writes ORDER/KILL-GATE/STOP/LIVE. Codex appends STATUS/PR. Newest on top.

---

## 7. Who moves what (no ambiguity)

| Role | Owns in 7 days |
|------|----------------|
| **Karen** | DNS/domain, Clerk bootstrap, Cocoa freeze-or-EXAMPLE memo, TECRID commercial GO, money |
| **Elon** | This plan integrity, daily scorecard, Codex ORDERS, Marcus/Elena orders, Sep 14 kill |
| **Codex** | PR-I (VLE domain), T-PR-1 (TECRID lab pack), demo blockers only |
| **Marcus** | Lab+supplier conversations; deep links; lot facts; no spray |
| **Elena** | Board the moment NOMINATED exists; sample→evidence checklist |

---

## 8. Daily scorecard (Elon posts each night)

1. `vle.exchange` product? Y/N  
2. TECRID lab pack live? Y/N  
3. Lab conversation state (none / warm / keys / NO)  
4. Supplier lot-facts state (none / verbal / in-system / NO)  
5. Clerk bootstrap? Y/N  
6. Blockers with owners  

---

*End. Execute. Do not expand.*
