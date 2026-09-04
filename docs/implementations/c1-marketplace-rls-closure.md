# C1 — Marketplace RLS & Authentication Hardening — CLOSURE RECORD

## Session Metadata

| Field | Value |
|-------|-------|
| Closure Date | 2026-09-04 |
| Closure Status | **CLOSED** |
| Module | MOD-001 (Marketplace Layer) |
| Workstream | Authentication hardening + RLS policy implementation |

---

## Scope

C1 covers two workstreams under MOD-001:

1. **Authentication Hardening** — Elimination of `x-user-role` fallback patterns and default role assignments in API route handlers. All identity enforcement now derives from Supabase Auth tokens exclusively.
2. **RLS Policy Implementation** — Row Level Security policies on all four marketplace tables (`listings`, `offers`, `matches`, `quotes`) per ESS-006 §4.4 Golden Rule.

---

## Deliverables

### A. Database Migration

| File | Path | Status |
|------|------|--------|
| `002_rls_policies.sql` | `web/src/infrastructure/migrations/002_rls_policies.sql` | Committed (untracked → staged for C1 checkpoint) |

Defines ALTER TABLE ENABLE ROW LEVEL SECURITY on 4 tables, with 14 CREATE POLICY statements total.

### B. Repository Error Handling

| File | Path | Status |
|------|------|--------|
| `listings-repository.ts` | `web/src/infrastructure/repositories/listings-repository.ts` | Staged |
| `offers-repository.ts` | `web/src/infrastructure/repositories/offers-repository.ts` | Staged |
| `repository-error-handling.test.ts` | `web/src/modules/mod-001-marketplace/__tests__/repository-error-handling.test.ts` | Staged |

Repository layer now propagates DB failures; no fake-success fallbacks.

### C. API Route Authentication Hardening

| File | Path | Change |
|------|------|--------|
| `listings/route.ts` | `web/src/app/api/marketplace/listings/route.ts` | Removed x-user-role fallback |
| `listings/[id]/route.ts` | `web/src/app/api/marketplace/listings/[id]/route.ts` | Removed x-user-role fallback |
| `offers/route.ts` | `web/src/app/api/marketplace/offers/route.ts` | Removed x-user-role fallback |
| `offers/[id]/route.ts` | `web/src/app/api/marketplace/offers/[id]/route.ts` | Removed x-user-role fallback |

All routes now enforce Supabase Auth token presence. No x-user-role header or default role fallback.

### D. Support Utilities

| File | Path | Purpose |
|------|------|---------|
| `api-auth.ts` | `web/src/lib/supabase/api-auth.ts` | Centralized Supabase auth client factory |
| `get-user.ts` | `web/src/lib/supabase/get-user.ts` | Server-side user identity extraction from JWT |

---

## Live Verification Evidence (Supabase)

### RLS Enablement

| Table | RLS Enabled | Policies Deployed |
|-------|-------------|-------------------|
| `marketplace_schema.listings` | YES | 5 |
| `marketplace_schema.offers` | YES | 5 |
| `marketplace_schema.matches` | YES | 2 |
| `marketplace_schema.quotes` | YES | 2 |
| **Total** | **4/4** | **14** |

### Policy Inventory (Authoritative — from `002_rls_policies.sql`)

| # | Table | Policy Name | Operation |
|---|-------|-------------|-----------|
| 1 | listings | Shipper reads own listings | SELECT |
| 2 | listings | Shipper creates own listings | INSERT |
| 3 | listings | Shipper updates own listings | UPDATE |
| 4 | listings | All auth users read published listings | SELECT |
| 5 | listings | Admin full access to listings | ALL |
| 6 | offers | Transporter reads own offers | SELECT |
| 7 | offers | Transporter creates own offers | INSERT |
| 8 | offers | Transporter updates own offers | UPDATE |
| 9 | offers | Shipper reads offers for their listings | SELECT |
| 10 | offers | Admin full access to offers | ALL |
| 11 | matches | Match participants read matches | SELECT |
| 12 | matches | Admin full access to matches | ALL |
| 13 | quotes | Shipper reads quotes for their listings | SELECT |
| 14 | quotes | Admin full access to quotes | ALL |

### Discrepancy Resolution

The previous C1 Closure Report stated "15 policies" — this was a counting error. Both the authoritative migration file (`002_rls_policies.sql`) and the live Supabase database contain exactly **14 policies**. No policy is missing. The "15 policies" figure does not require correction because the correct count is 14.

### Semantic Validation Against ESS-006

All 14 policies align with expected ownership semantics and ESS-006 requirements:

- **listings**: Shipper CRUD + public SELECT for transporter discovery + admin bypass. Valid.
- **offers**: Transporter CRUD + shipper SELECT (via listing join subquery) + admin bypass. Valid.
- **matches**: System-created only; read-access for both parties + admin bypass. Deliberately no user INSERT/UPDATE/DELETE policy. Valid.
- **quotes**: System-generated advisory data; read-only for shippers + admin bypass. Deliberately no user write policy. Valid.

---

## Verification Gate Results

| Gate | Criterion | Result |
|------|-----------|--------|
| V-001 | RLS enabled on all 4 marketplace tables | PASS |
| V-002 | 14 policies deployed to production | PASS |
| V-003 | No `x-user-role` fallback in API routes | PASS |
| V-004 | No default role assignments | PASS |
| V-005 | Repository errors propagate (no fake success) | PASS |
| V-006 | TypeScript: 0 compilation errors | PASS |
| V-007 | Test suite: 52/52 files, 1,208 passing | PASS |
| V-008 | Track B frozen — zero module.config.ts changes | PASS |
| V-009 | PROMPT 0 v1.1 unchanged | PASS |
| V-010 | Governance documents unmodified | PASS |

---

## Exclusions Honored

- No governance document modified
- No PROMPT 0 v1.1 modification
- No Track B (module.config.ts) changes
- No C2 scope entry
- No policy added to reach arbitrary count of 15
- No new migrations beyond 002_rls_policies.sql

---

## Closure Decision

**C1 is CLOSED.** All verification gates passed. All deliverables are committed or staged. The 14 RLS policies deployed match the authoritative migration file. Authentication hardening eliminates all `x-user-role` fallbacks and default role assignments. Repository failures propagate correctly. The development state will be updated to reflect C1 closed status.

## Remaining Prerequisites for C2

- Explicit HAO authorization before C2 implementation begins
- C2 entry criteria checklist must be defined and verified
- No implicit authorization by C1 closure
