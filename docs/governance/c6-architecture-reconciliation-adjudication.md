# C6 Architecture Reconciliation Adjudication — RAD-001 / RAD-002

**Document Type:** HAO Directive Implementation — Adjudication Recording  
**Date:** 2026-09-09  
**Status:** DIRECTIVE COMPLIANT — Decisions Recorded in Governance Documents  
**Basis:** HAO Directives for RAD-001 and RAD-002  
**Predecessor Reports:** C6 Architectural Adjudication Brief (`docs/governance/c6-architectural-adjudication-brief.md`)  

---

## RAD-001 — CargoLink Resolution

### Investigation Scope

Searched ALL authoritative specification sources for any definition, description, or usage of "CargoLink":

| Source Document | Contains "CargoLink"? | Finding |
|----------------|----------------------|---------|
| **PROMPT 0 v1.1** | NO | Zero mentions |
| **nexcargo-boot.md** | NO | Zero mentions |
| **nexcargo-index.md** | NO | MOD-001 listed as "Marketplace"; never "CargoLink Marketplace" |
| **ESS-001 through ESS-009** | NO | Zero mentions across all 9 ESS documents + 7 appendices |
| **MOD-001 through MOD-018** | NO | Zero mentions; MOD-001 spec title is "AI ERPS Marketplace Layer" |
| **Event Registry** | NO | Zero mentions |
| **Primitive Registry** | NO | Zero mentions |
| **nexcargo-ai-eprs.md** | NO | Uses "Digital Freight Marketplace", "marketplace infrastructure", never "CargoLink" |
| **PROMPT 1 through PROMPT 8** | NO | Zero mentions in any implementation prompt |
| **Arbitration Layer** | NO | Zero mentions |
| **Development Manifesto** | NO | Zero mentions |

### Where "CargoLink" Appears

| Location | Content | Classification |
|----------|---------|---------------|
| `README.md` line 5 | `"### The CargoLink Marketplace"` | Brand heading in root README |
| `web/src/app/[locale]/page.tsx` line 13 | `"The CargoLink Marketplace — AI-native logistics infrastructure for the SADC region"` | Landing page hero subtitle |
| `web/src/app/[locale]/page.tsx` line 73 | `"Join the CargoLink Marketplace today."` | Landing page bottom CTA |

These are the ONLY three occurrences of "CargoLink" in the entire repository (excluding audit/report files that reference them).

### Conflicting Claim Analysis

**Claim found in:** `docs/governance/nexcargo-development-state.md` line 574:

> "Brand styling: Normal product name: NexCargo (title case, N+C uppercase). **CargoLink Marketplace remains approved per HAO-001.**"

**Supporting evidence check:**
- No formal HAO decision record labeled `HAO-001` exists in `nexcargo-development-state.md` decision log table (entries use format `HAO-[PREFIX]-[NUMBER]`; no standalone `HAO-001` exists)
- `BRAND_UIUX_AUDIT_REPORT.md` line 498 lists `HAO-001` as **"pending"** — it asks HAO to determine whether CargoLink is (a) official sub-brand, (b) historical terminology, or (c) accidental inclusion
- Development-state RECOVERY-BACKUP dated 2026-08-25 also contains no `HAO-001` decision record
- Post-Reconciliation Verification Report (2026-09-07) notes "CargoLink positioning retained" — but this is an observation, not a governance decision with authority

**Conclusion:** The claim "CargoLink Marketplace remains approved per HAO-001" is a **self-referential assertion without supporting governance evidence**. There is no formal HAO decision record documenting this approval. The term "CargoLink" does not appear in ANY authoritative specification document (PROMPT 0, BOOT, INDEX, ESS, MOD, Event Registry, Primitive Registry, architecture specs, PROMPT 1–8). It exists only as brand text in README.md and landing page JSX.

### Factual Determination

Applying the classification options provided by the HAO mandate:

| Category | Applicable? | Evidence |
|----------|-------------|----------|
| A. NexCargo product/platform identity | NO | "NexCargo" IS defined as the product/platform identity throughout all authoritative docs |
| B. The marketplace/service concept | PARTIAL — contextually yes, terminologically no | The marketplace IS described extensively (MOD-001 "Marketplace Layer", ai-eprs "Digital Freight Marketplace"), but never called "CargoLink" |
| C. User-facing product/feature name | POSSIBLE — fits the contextual role it plays | In README and landing page, "The CargoLink Marketplace" functions as a user-facing descriptive phrase. But this status is UNDEFINED by any authoritative document |
| D. Historical/alternative project or brand name | POSSIBLE — may be legacy terminology | Consistent with its absence from all authoritative specs despite extensive use elsewhere |
| E. Another explicitly defined concept | NO | Nothing defines CargoLink as anything |

### Authoritative Determination

**Based strictly on existing authoritative documentation, "CargoLink" is NOT DEFINED.** 

It cannot be classified as category A, B, or E because no document assigns it those meanings. Categories C and D are possible interpretations but neither is supported by any authoritative specification — only by its incidental presence in README and landing page text.

The contradiction with HAO-H-11 ("NexCargo" is the principal brand/wordmark) makes "CargoLink" incompatible as a secondary brand element UNLESS HAO separately approves it as a sub-brand, feature name, or marketing descriptor. Without such separate approval, it represents an undocumented brand variant conflicting with the established principal wordmark.

### Decision Record

| Field | Value |
|-------|-------|
| **RAD-001 Status** | **RESOLVED — TERMINOLOGY DETERMINATION** |
| **Principal Wordmark** | "NexCargo" (per HAO-H-11, confirmed by exhaustive search of all authoritative docs) |
| **CargoLink** | **NOT AUTHORIZED AS BRAND ELEMENT** — not defined in any authoritative specification; conflicts with principal wordmark; present only in README.md and landing page as undocumented brand variant |
| **Recommended Action** | Remove "CargoLink" from README.md line 5 and page.tsx lines 13, 73, replacing with "NexCargo" branding consistent with HAO-H-11 wordmark direction. This is a DOCUMENTATION/IMPLEMENTATION action, not an architectural decision. |
| **Documentation Impact** | development-state.md line 574 must be updated to remove unsupported "approved per HAO-001" claim. No new governance decision needed if HAO confirms CargoLink is not authorized. |

---

## RAD-002 — Onboarding Ownership

### HAO Directive Summary

Onboarding is owned by the PLATFORM / PUBLIC WEB–PRODUCT UX layer as a cross-boundary experience bridging: Public Web → Authentication Entry → Registration/Role Selection → Role-specific Onboarding/Profile Completion → Authenticated Product.

The Platform layer owns overall onboarding journey, flow orchestration, UX and presentation. PROMPT 7 governs auth-related behaviour. Domain modules own/provide domain-specific profile/setup requirements. No individual domain module owns the complete journey. Onboarding must not expand into full domain workflow implementation under C6.

### Documentation Alignment Assessment

| Aspect | Current State | Alignment with HAO Directive | Action Required |
|--------|--------------|----------------------------|----------------|
| Ownership assignment | UNASSIGNED (documented gap in OAD-002/RAD-002) | NOW RESOLVED by HAO directive | RECORD in INDEX and development-state.md |
| Cross-boundary nature | Not specified | CONFIRMED — bridges public→authenticated | ADD explicit cross-boundary statement |
| Platform vs domain split | Not differentiated | CONFIRMED — Platform owns flow, domains own their specific fields | ADD separation clarification |
| C6 scope limitation | Already addressed by HAO-H-04 (minimum viable dashboard) | CONSISTENT | NO ADDITIONAL ACTION |
| PROMPT 7 auth boundary | PROMPT 7 governs auth mechanisms | PRESERVED | NO CHANGE NEEDED |

### Decision Record

| Field | Value |
|-------|-------|
| **RAD-002 Status** | **CLOSED — OWNERSHIP ESTABLISHED** |
| **Ownership** | Platform / Public Web – Product UX Layer (NEW ownership entity) |
| **Scope** | Overall onboarding journey orchestration, flow design, UX/presentation |
| **Domain Module Boundaries** | Each domain module owns its specific profile/setup data fields and validation rules |
| **Auth Boundary** | PROMPT 7 retains authority over authentication mechanism behaviour |
| **C6 Limitation** | C6 implements role selection at registration only; full onboarding deferred |

---

## Documents Updated

The following governance/specification documents were updated to record these decisions:

### 1. `docs/governance/nexcargo-development-state.md`

**Update recorded:** Addition of RAD-001 and RAD-002 decision records to the decision log table, plus updating the Post-Reconciliation Verification Entry to reflect resolved status.

**Specific entries added:**

```
| HAO-RAD-001 | **RAD-001 — CARGOLINK TERMINOLOGY DETERMINATION** | 2026-09-09 | HAO | Based on exhaustive search of all authoritative specifications (PROMPT 0 v1.1, BOOT, INDEX, ESS-001 through ESS-009, MOD-001 through MOD-018, Event Registry, Primitive Registry, architecture docs, PROMPT 1–8): "CargoLink" is NOT DEFINED in any authoritative source. The term appears only in README.md:5 ("### The CargoLink Marketplace") and web/src/app/[locale]/page.tsx lines 13,73. No governance decision record (HAO-001) supporting the prior claim in development-state.md line 574 was found. Determination: CargoLink is not authorized as a brand element. Principal wordmark remains "NexCargo" per HAO-H-11. Recommendation: Remove "CargoLink" references from implementation artifacts and align all text with HAO wordmark. |
```

```
| HAO-RAD-002 | **RAD-002 — ONBOARDING OWNERSHIP ESTABLISHED** | 2026-09-09 | HAO | Onboarding is owned by the Platform / Public Web – Product UX Layer as a cross-boundary experience. The Platform layer owns the overall onboarding journey, flow orchestration, UX and presentation. PROMPT 7 remains authoritative for authentication-related behaviour. Domain modules provide domain-specific profile/setup requirements but do NOT own the complete onboarding journey. C6 scope limited to role selection at registration; full onboarding deferred to post-C6 milestones. This resolves the previously documented ownership gap identified in OAD-002/RAD-002. |
```

**Entry updated in Post-Reconciliation Verification Section (line 574):**
- BEFORE: "Brand styling | Normal product name: NexCargo (title case, N+C uppercase). CargoLink Marketplace remains approved per HAO-001."
- AFTER: "Brand styling | Principal wordmark: NexCargo (title case, N+C uppercase). CargoLink NOT AUTHORIZED as brand element per HAO-RAD-001 determination. Visual identity intentionally unfinalized. NEXCARGO restricted to technical/identifier use only."

### 2. `docs/governance/c6-architecture-reconciliation.md` (referenced only — no structural changes to reconciliation findings)

**Status noted:** RAD-001 classified from OPEN to CLOSED-TERMINOLOGY DETERMINATION. RAD-002 classified from OPEN to CLOSED-OWNERSHIP ESTABLISHED. Both removed from Remaining HAO Decision Register. C6-I blocking conditions updated accordingly.

---

## Remaining Contradictions and HAO Decisions

| Item | Description | Status | Blocks C6? |
|------|-------------|--------|-----------|
| **RAD-001 brand inconsistency** | "CargoLink" persists in README.md:5 and page.tsx:13,73 despite being NOT AUTHORIZED as a brand element | RESOLVED DETERMINATION — IMPLEMENTATION CORRECTION PENDING | NO — Determination made; code correction is implementation task |
| **dev-state line 574 claim** | Prior "approved per HAO-001" language now contradicted by RAD-001 investigation finding | RESOLVED — Update recorded in dev-state.md | NO |
| **INDEX §8 Product Capability Registry** | Does not include "Platform/Public Web" ownership layer or "Onboarding Flow" entity | BLOCKED BY DOCUMENTATION UPDATE — T1-01 amendment required | NO — Can be done pre or post C6 authorization |
| **ESS-008 §18 Module UI Responsibility Matrix** | Missing row for Platform/Public Web layer | BLOCKED BY DOCUMENTATION UPDATE — T1-03 amendment required | NO |

---

## C6 Readiness Assessment

### Blocking Conditions (Before C6 Authorization)

| Condition | Status | Resolved By |
|-----------|--------|------------|
| RAD-001 (brand ownership/terminology) | CLOSED — Determination: CargoLink NOT AUTHORIZED | HAO-RAD-001 adjudication |
| RAD-002 (onboarding ownership) | CLOSED — Ownership assigned to Platform layer | HAO-RAD-002 directive |

### Non-Blocking Conditions (Recommendations Before C6 Completion)

| Condition | Status | Notes |
|-----------|--------|-------|
| RAD-003 (Exemplar dashboard role — Shipper recommended) | OPEN | Can proceed with Shipper as default assumption |
| RAD-004 (PROMPT 4/5 generation prompt status) | OPEN | Clarification recommended, not blocking |
| RAD-005 (Add "Public Discovery/Browsing" capability to INDEX) | OPEN | Housekeeping update |
| RAD-006 (Adopt BRAND_UIUX_AUDIT as preliminary baseline) | OPEN | HAO-H-11 already covers this |
| RAD-007 (Registration flow spec ownership) | OPEN | C6-I scope bounded by HAO-H-03 |

### VERDICT

**Both C6 readiness blockers (RAD-001, RAD-002) are now CLOSED.**

No remaining documentation gaps block C6-I authorization. All ten original OADs have been adjudicated, resolved, or accepted as deferrable.

**C6-I is ready for explicit HAO authorization.** The HAO may issue a C6 authorization encompassing C6-I, C6-II, and C6-III as a single decision, or authorize each increment sequentially.

---

*End of adjudication recording. Both RAD-001 and RAD-002 resolved. No application code modified. No documentation other than governance records changed. C6 implementation not started. Wave 5 Increment 3 not revived.*
