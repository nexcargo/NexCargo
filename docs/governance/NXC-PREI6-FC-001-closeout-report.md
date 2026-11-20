# NXC-PREI6-FC-001 — PRE-I-6 Defect Closure Completion Report

**Date:** 2026-11-19  
**Prepared for:** Lead Architect (LA) consolidated acceptance  
**Scope:** PRE-I-6 remediation closeout for `NXC-PREI6-DEF-01` and `API-ID-CONTRACT-01`  
**Baseline HEAD:** `a956d650e896c55a2f2543bb998c8edcc24dc69a` (`main`)  
**Ledger row:** `docs/governance/nexcargo-development-state.md:210`  
**Status:** **COMPLETE within authorised scope — 35 executed PASS / 0 FAIL / 3 unexecuted BLOCKED placeholders (38 legs declared, 35 run) (#189)**  
**I-6:** **NOT BEGUN**

---

## 1. Executive Summary

The two authorised PRE-I-6 defects are closed and verified.

1. **DEF-01 — Driver operational writes rejected under RLS.**  
   Driver GPS updates, Driver Identity Verification (DIV), and Proof of Delivery (POD) writes use `INSERT … RETURNING`. Migration 070 added the required Driver `INSERT` policies but no corresponding Driver `SELECT` policy. PostgreSQL re-checked `SELECT` on the returned row and rejected every write with `42501 new row violates row-level security policy`. Migrations **071**, **072**, and **073** correct this without granting Driver access to commercial booking data.

2. **API-ID-CONTRACT-01 — Fleet assignment API confused the Driver business key with the Driver primary key.**  
   `POST /api/fleet` returns `driverId` as the `drivers.driver_id` business key, while `PATCH /api/fleet/assignments` expected `drivers.id`. The route now resolves both forms, returns a uniform `404 ERR_1004` for unknown or foreign Drivers, and maps assignment FK/check violations to `400 ERR_4001`.

The final live verifier result is **35 executed PASS / 0 FAIL**, plus **3 BLOCKED placeholders** that were declared but never executed: **C8, H4, and I1**. The verifier declares 38 legs, but only 35 produced evidence; it is therefore inaccurate to describe the run as "38 executed" or "38 PASS". The three placeholders were blocked by **task #189** because they require positive MODERATOR/ADMIN/SUPER_ADMIN rows in `app.platform_roles`; the task did not create those rows without explicit LA consent. They were subsequently executed on 2026-11-20 under the LA's final reconciliation authorization (section 6).

No Git commit, push, or deployment was performed. No I-6 work was started.

---

## 2. Outcome Summary

| Area | Result | Evidence |
|---|---|---|
| DEF-01 Driver GPS/DIV/POD `INSERT … RETURNING` | **CLOSED** | Migrations 071–073; live GPS/DIV/POD writes persisted |
| API-ID-CONTRACT-01 Driver key resolution | **CLOSED** | Business-key and UUID resolution; live F4-pre/F4 passed |
| Live operational verification | **35 executed PASS / 0 FAIL; 3 unexecuted placeholders** | `fc-resume3-results.json`; 38 legs declared, 35 executed |
| Pre-fix failure regression | **7 previously failing legs now PASS** | `fc-resume2.stdout.log` baseline 27/7/3 |
| Full test suite | **2802/2802 PASS, 133 files** | Vitest |
| TypeScript | **0 errors** | `npx tsc --noEmit` |
| Production build | **PASS**, 72 static pages | `npm run build` |
| Lint | **Zero new errors**; 586 pre-existing repo-wide | `npm run lint`; 16 pre-existing `no-explicit-any` errors in two touched test files |
| Task-owned fixture cleanup | **All counts 0** | Post-cleanup SQL verification |
| Protected I-5 fixture | **Untouched, DELIVERED** | `ce28e62d-ded6-4dcf-8e3c-ba9febb0e4e7` |
| Verification server | **STOPPED** | PID 27804; port 3211 closed |
| Git / deployment | **NONE** | No commit, push, or deploy |
| I-6 | **NOT BEGUN** | No I-6 implementation performed |

---

## 3. DEF-01 — Root Cause and Corrections

### 3.1 Root cause

The affected repositories use:

```ts
.insert(...)
.select()
.single()
```

This compiles to `INSERT … RETURNING`. PostgreSQL requires the caller to satisfy both the `INSERT` policy and the `SELECT` policy for the returned row. Migration 070 added Driver `INSERT` branches but no Driver `SELECT` branches for the new write paths, so the returned row could not be read back.

### 3.2 Migration 071 — Driver SELECT policies

**File:** `web/src/infrastructure/migrations/071_prei6_driver_select_returning.sql`  
**Applied journal version:** `20261119124400`

Adds permissive `FOR SELECT TO authenticated` policies:

- `Driver reads own GPS updates`
- `Driver reads own verifications`
- `Driver reads own POD`

Result: the Driver can read back the row it wrote, satisfying `RETURNING`. The live policies are **assignment-scoped, not row-scoped**: a role-less Driver linked to the Driver row may read every GPS update / DIV / POD belonging to a shipment with a PLANNED or ACTIVE assignment, not only the row just inserted. This is the policy as applied and is confirmed by `pg_get_expr` read-back; it does not grant access to any other shipment or to commercial booking data.

### 3.3 Migration 072 — DIV driver FK alignment

**File:** `web/src/infrastructure/migrations/072_prei6_div_driver_fk_alignment.sql`  
**Applied journal version:** `20261119124802`

Moves `driver_identity_verifications.driver_id` from `auth.users(id)` to `logistics_schema.drivers(id)`. The DIV table contained **0 rows** at the time of the change.

### 3.4 Migration 073 — POD booking guard

**File:** `web/src/infrastructure/migrations/073_prei6_pod_booking_guard.sql`  
**Applied journal version:** `20261119125200`

Adds boolean-only helper:

```sql
public.booking_is_not_deleted(UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
```

The helper is owned by `postgres`; `PUBLIC`/`anon` `EXECUTE` is revoked and `authenticated` is granted. The migration recreates:

- `Transporter submits POD for own booking` (INSERT)
- `Driver reads own POD` (SELECT)

Result: POD submission can evaluate the booking state without granting the Driver `SELECT` on `logistics_schema.bookings`.

### 3.5 Deliberate security boundary

The Driver was **not** granted `SELECT` on `logistics_schema.bookings`, because that table contains `offer_price` and other commercial data.

Verified outcomes:

| Check | Result |
|---|---|
| Driver sees booking rows directly | **0** |
| POD policy count after migration | **4** |
| Helper executable by `PUBLIC` / `anon` | **No** |
| Helper returns only boolean booking-deletion state | **Yes** |

---

## 4. API-ID-CONTRACT-01 — Root Cause and Correction

### 4.1 Root cause

`POST /api/fleet` returns the Driver business key as `driverId`:

- `drivers.id` — UUID primary key
- `drivers.driver_id` — business key returned to the client

`PATCH /api/fleet/assignments` previously treated `driverId` as `drivers.id`, producing `500 ERR_9001` when the client supplied the business key.

### 4.2 Correction

- Added `FleetRepository.getDriverByBusinessKey(driverId)`.
- The assignments route:
  - resolves UUID-looking input through `getDriverById`;
  - resolves business keys through `getDriverByBusinessKey`;
  - forwards the resolved primary key to `requireOwnedDriver`;
  - returns `404 ERR_1004` for unknown or foreign Drivers.
- `handleFleetError` maps assignment foreign-key violations and `chk_assignment_has_asset` to `400 ERR_4001`.

`getAssignmentById` remains PK-scoped (`.eq('id', id)`), so `PATCH action:'update'` requires the assignment **primary key**, not the business `assignmentId`.

---

## 5. Live Verification

### 5.1 Method

Live HTTP verification ran against a production build on `127.0.0.1:3211` using real authenticated sessions:

- Shipper
- Transporter
- Unrelated Shipper
- Role-less Driver
- Role-less `fc.moderator`

The final verifier was `fc-resume3.mjs`, corrected after the first run to match actual route semantics.

### 5.2 Verifier corrections

| Leg | Correction |
|---|---|
| F4-pre cleanup | Cancel now uses `data(bizAsg).id` (assignment PK), not the business `assignmentId` |
| F5 | Counts only assignments with `status in (PLANNED, ACTIVE)`; a CANCELLED row must not remain visible to the Driver |
| G4 | Accepts pickup-ack `200` or `409`, then requires IN_TRANSIT `200`; successful pickup proof already advances status to `PICKUP_ACKNOWLEDGED` |

### 5.3 Final result

| Result | Count |
|---|---|
| PASS (executed) | **35** |
| FAIL | **0** |
| BLOCKED (declared, not executed) | **3** |
| Total legs declared | **38** |
| Total legs executed | **35** |

Machine-readable evidence:

- `C:\Users\geral\Documents\Qoder\2026-10-28\5f775026\fc-resume3-results.json`
- `C:\Users\geral\AppData\Local\Temp\opencode\fc-resume3b.stdout.log`

### 5.4 Coverage by leg group

| Group | Legs | Result | What it proves |
|---|---|---:|---|
| Session/fixture setup and Driver key tests (A, E-pre, F4-pre, E6–E10) | 9 | PASS | Sessions, Driver PK/business-key distinction, assignment creation/cancellation, association linkage |
| Fleet assignment and Driver RLS (F2–F6) | 5 | PASS | Unassigned Driver denied, unrelated Shipper denied, own assignment readable, foreign records invisible |
| Driver operations and security negatives (G1–G18) | 18 | PASS | Pickup proof, status transitions, GPS, POD, ownership, role-holder denial, anonymous denial, foreign tracking denial |
| Document access (H1–H3) | 3 | PASS | Role-less denial, anonymous denial, legitimate Shipper read |
| Governance positive legs (C8, H4, I1) | 3 | **NOT EXECUTED (placeholders)** | Declared but never run; require MODERATOR/ADMIN/SUPER_ADMIN `app.platform_roles` rows — task #189 |

### 5.5 Pre-fix baseline

The prior run was:

- **27 PASS / 7 FAIL / 3 BLOCKED**

The seven previously failing legs are now PASS:

- `F4-pre`
- `G2`
- `G3`
- `G5`
- `G6`
- `G9`
- `G10`

### 5.6 Independently observed persisted proof

Before cleanup, the live database contained:

| Record | Identifier | State |
|---|---|---|
| DIV | `6c20cace-beda-49af-b4ff-ac716588e7d3` | `SUCCESS` |
| GPS update | `e25bf8e6-0b57-4ca2-8f2d-9d23f9586600` | persisted |
| POD | `46208803-ef24-4c9e-b6bd-676ea92746e8` | `PENDING` |
| Assignment (cancelled) | `14ac0b96-3918-43b7-8215-8986336b59c4` | `CANCELLED` |
| Assignment (planned) | `a5f01ff9-350a-4a90-82c6-ec1250fa1548` | `PLANNED` |
| Tracking | `db96f583-0c5e-4100-95c3-ad2a375fd950` | `DELIVERED` |

The cancelled assignment's business key was `ad03e840-6384-48a4-8a15-88cd3ee91df7`; the planned assignment's business key was `9a444d23-8407-4912-a0b2-36e9646e76b4`.

This confirms the writes were not merely accepted by HTTP; they persisted under session RLS with the expected ownership pins.

### 5.7 Blocked legs — task #189

| Leg | Reason |
|---|---|
| C8 | Positive MODERATOR/ADMIN/SUPER_ADMIN match-access legs require governance-role inserts into `app.platform_roles`; soft-blocked pending explicit LA consent |
| H4 | Positive MODERATOR metadata/preview/download legs require a MODERATOR `app.platform_roles` row; same #189 decision |
| I1 | POD verification plus COMPLETED leg is governance-only; no governance account exists without the #189 grant |

These are **not product failures**. They are verification gaps caused by the absence of a governance-role fixture. The negative paths around them passed, including role-less denial and anonymous denial. They were executed on 2026-11-20 under the LA's final reconciliation authorization; results are in section 12.

---

## 6. Quality Gates

| Gate | Command | Result |
|---|---|---|
| Focused tests | 4 files | **177/177 PASS** |
| Full suite | `npx vitest run` | **2802/2802 PASS**, 133 files |
| TypeScript | `npx tsc --noEmit` | **0 errors** |
| Production build | `npm run build` | **PASS**, 72 static pages |
| Lint | `npm run lint` | **586 pre-existing problems**; zero new errors |
| Changed-file lint | `npx eslint` on 5 changed files | 16 pre-existing `@typescript-eslint/no-explicit-any` errors in two touched test files; zero new |

The lint position is recorded honestly: the repository carries pre-existing lint debt, and this increment introduced no new lint errors.

---

## 7. Fixture Cleanup and Preservation

### 7.1 Cleanup performed

All task-owned rows were deleted in FK-safe order:

- POD
- GPS
- DIV
- `tracking_events` (12 rows)
- `asset_assignments`
- incidents
- exceptions
- refunds
- backhaul
- disputes
- tracking record
- contract
- booking
- vehicles
- driver
- fleet
- marketplace matches / offers / quotes / listings

Every task-owned table count was re-verified as **0**.

### 7.2 Deleted task fixture identifiers

| Object | Identifier |
|---|---|
| Fleet | `8e2060d3-5092-4ff5-befd-ed2051e42dfb` |
| Driver | `4b986941-a6bc-42ca-8d61-68cf81bccd32` |
| Tracking | `db96f583-0c5e-4100-95c3-ad2a375fd950` |
| Booking | `973e60e2-77fa-4c55-ab61-a3bf91b8573f` |
| Contract | `19b446b7-7faf-4f2c-a9bd-a9570c5ea5ac` |
| Listing | `b92cc5a8-3ad4-452a-b483-3e330f9c3c1c` |
| Offer | `ffc16e42-6128-427a-8e6d-e3dcd61525a9` |
| Match | `1da08a7e-3b79-4883-b0d3-ad689019e3cb` |

### 7.3 Preservation

Protected I-5 tracking record:

```text
ce28e62d-ded6-4dcf-8e3c-ba9febb0e4e7
```

Remains `DELIVERED` and was not modified.

`fc-fixtures.json` is now stale by design because it describes rows deleted during cleanup. It should not be treated as current live state.

---

## 8. Scope and Governance Boundaries

The following boundaries were observed:

- No general Driver grants beyond the minimum needed for `RETURNING`.
- No Driver `SELECT` on `logistics_schema.bookings`.
- No expansion of financial authority.
- No role-definition change.
- No change to migrations 067–070 retrospectively.
- No I-5 fixture or seed mutation.
- No Git commit, push, or deployment.
- No I-6 work started.
- Verification server started only for this task and stopped afterward.

The only database changes were:

1. Migrations 071–073, applied live with journal rows.
2. Deletion of task-owned verification fixtures.

---

## 9. Residual Limitations and LA Decisions

### 9.1 Task #189 — RESOLVED 2026-11-20

Positive governance-role verification was blocked in this report's original run. It was executed on 2026-11-20 under the LA's final reconciliation authorization using three temporary `app.platform_roles` rows, which were deleted after the run. Results and two product defects found during that execution are recorded in section 12. No governance role row remains from this task.

### 9.2 Evidence timing

The live verifier ran before cleanup. Fixture rows referenced in the evidence no longer exist. The machine-readable results and stdout log are preserved unchanged.

### 9.3 Lint debt

The repository retains 586 pre-existing lint problems. This report does not claim a clean repository lint state; it claims zero new lint errors from this increment.

### 9.4 Next governance step

The Pre-I-6 programme can now return to LA for consolidated acceptance. I-6 remains unauthorised until LA acceptance.

---

## 10. Evidence Index

| Evidence | Path |
|---|---|
| Final verifier output | `C:\Users\geral\AppData\Local\Temp\opencode\fc-resume3b.stdout.log` |
| Final machine-readable results | `C:\Users\geral\Documents\Qoder\2026-10-28\5f775026\fc-resume3-results.json` |
| Pre-fix verifier output | `C:\Users\geral\AppData\Local\Temp\opencode\fc-resume2.stdout.log` |
| Migration 071 | `web/src/infrastructure/migrations/071_prei6_driver_select_returning.sql` |
| Migration 072 | `web/src/infrastructure/migrations/072_prei6_div_driver_fk_alignment.sql` |
| Migration 073 | `web/src/infrastructure/migrations/073_prei6_pod_booking_guard.sql` |
| Ledger row | `docs/governance/nexcargo-development-state.md:210` |
| Verification server logs | `C:\Users\geral\AppData\Local\Temp\opencode\fc-server3.out.log` and `fc-server3.err.log` |
| Build log | `C:\Users\geral\AppData\Local\Temp\opencode\fc-build.log` |

---

## 11. LA Acceptance Statement

The authorised PRE-I-6 defects `NXC-PREI6-DEF-01` and `API-ID-CONTRACT-01` are remediated, live-verified, regression-tested, cleaned up, and recorded.

**Recommended LA disposition:** accept `NXC-PREI6-FC-001` as complete. The three #189 placeholders were executed on 2026-11-20 (section 12): C8 passed as an expected denial, H4 authorization passed with a pre-existing metadata-payload defect, and I1 passed with a pre-existing MODERATOR RLS defect. Withhold I-6 authorisation until this report and the two defects in section 12.5 are dispositioned.

---

## 12. Post-closeout reconciliation — 2026-11-20

This section records the final reconciliation authorized by the LA. It supersedes only the stale status statements above; all historical identifiers and evidence remain as recorded.

### 12.1 Method

- Production build of the current working tree: `npm run build`, exit 0, 72 static pages.
- Production server on `127.0.0.1:3211`, real cookie sessions via `POST /api/auth/login`, real Supabase password grants for PostgREST/RLS checks.
- Three temporary `app.platform_roles` rows, `assigned_by = 11111111-1111-1111-1111-111111111111`:
  - `MODERATOR` → `84a253d4-8fe7-44ea-9834-25c852ad86ae`
  - `ADMIN` → `67ecbba9-ec07-4eeb-a29d-25342275dd8e`
  - `SUPER_ADMIN` → `c8f47236-573c-4a90-8c50-a6efe4869acd`
- All three rows were deleted after the run; `app.platform_roles` is back to its two permanent rows (`DISPATCHER`, `SUPER_ADMIN`).
- Task-owned fixtures only. All identifiers below were deleted; the four `fc.*` auth users were not deleted.

### 12.2 C8 — governance match denial (expected 404)

Fixture: listing `e4621998-31b9-45f2-9852-7b5822ab1a99`, offer `31b2174a-4ddc-4e73-ae2f-b6d5679b839b`, match `384f8335-7cf8-4061-88ae-9b8365740654`, all task-owned and later deleted.

| Leg | Result |
|---|---|
| C8.1 MODERATOR/ADMIN/SUPER_ADMIN collection and item reads | **404 / 404 / 404** (both) |
| C8.2 Denial bodies | only `data.error`; no match, offer, price or transporter fields |
| C8.3 Direct PostgREST SELECT under each governance session | **0 rows** each (HTTP 200) |
| C8.4 Participants retained | Shipper route 200 with 1 match; Shipper RLS 1; Transporter RLS 1; unrelated Shipper 404 |

**Disposition: PASS.** There is no governance match-read path at the application or RLS layer. A role grant alone cannot produce a positive read. The 404 is the expected denial, not a defect.

### 12.3 H4 — Moderator document read authority

A task-owned document (`PREI6-FINAL-4f8288ad`, row `4f8288ad-36a9-4209-8863-ea29c7af5bd7`, linked to booking `8d56c207-a82b-4c7e-b092-ed5973e5908b`) was created and deleted. The `nexcargow-documents` bucket was absent in this project, so it was created temporarily for the evidence and deleted afterwards.

| Leg | Result |
|---|---|
| H4.1 MODERATOR/ADMIN/SUPER_ADMIN detail read of a non-owned document | **200 / 200 / 200**, correct row |
| H4.2 MODERATOR entity list | **200**, 1 document |
| H4.3 MODERATOR preview and download | **307 / 307** to a signed storage URL |
| H4.4 Non-party Shipper detail/download/list | **403 / 403 / 0 documents** (list 200) |
| H4.5 Role-less Driver / anonymous | **403 / 401** |

**Disposition: authorization PASS; metadata payload defect.** The MODERATOR authority chain was traced via the PRE-I-6 FINAL COMPLETION DIRECTIVE (Items 2 & 3, committed in `a956d65`), the repository RBAC matrix, and the application document access gate (`document-access.ts:38`), though the absence of standalone archived directive text in the repository is noted as a governance traceability limitation. MODERATOR read authority is enforced at the gate and was exercised. However, `GET /api/documents/[id]` returns only `id`, `created_at`, `updated_at`, `version`: `Document.toJSON()` (`document-repository.ts:268`) discards `documentId`, `documentType`, `linkedEntityType`, `linkedEntityId`, `status`, `fileReference` and `createdBy`. The list endpoint does return them. This is pre-existing (PREI6-REC-02) and affects every caller, not only governance.

### 12.4 I1 — assignment scope, denials, GPS/DIV/POD, completion invariant

Fixture chain: booking `8d56c207-a82b-4c7e-b092-ed5973e5908b`, contract `78bfd745-2f19-4695-92d3-bbf5f5d57b2b`, tracking `2acbacb9-efc5-418d-a544-65900a75ce78`, fleet `48527892-ae1a-4a5f-a6a7-85e2b56f5cf3`, driver `23d06346-02a9-428b-ba9c-8b7fba99d0cb`, assignment `c01f126c-9195-4bc8-a40d-6720c201b97c`, POD `e3600ea7-e1c3-4e8c-b72a-1f6ff1a8cb36`, DIV `db62302a-9d29-45e9-8e5b-af40b1a3167a` — all deleted.

| Leg | Result |
|---|---|
| Acceptance chain | booking confirm 200, contract accept 200/200, tracking created |
| Unassigned linked Driver transition | **403** |
| Transporter creates own Driver + PLANNED assignment | **201**, `PLANNED` |
| Driver session scope | own tracking 1, own assignment 1, foreign tracking 0; unrelated party 0 |
| Driver pickup proof | **201**, DIV pinned to tracking/booking/driver PK, `SUCCESS` |
| Driver status + GPS | pickup acknowledged 200, in-transit 200, GPS 200 |
| Driver DELIVERED | **200** |
| Driver COMPLETE / CANCEL | **403 / 403** |
| POD mismatched booking / valid submission | **403** / **201**, `PENDING`, pinned to tracking and booking |
| POD verify by Driver / Transporter / unrelated | **403 / 403 / 403** |
| Completion while POD PENDING | **409**, status unchanged, `completed_at` null |
| POD verify by MODERATOR | **409 — defect (section 12.5)** |
| POD verify by ADMIN | **200**, persisted `VERIFIED` |
| Completion by SUPER_ADMIN after VERIFIED POD | **200**, `COMPLETED`, `completed_at` set |
| Driver against protected I-5 shipment (GPS/status/POD/POP) | **403 / 403 / 403 / 403**, no mutation |
| Protected I-5 tracking after all legs | `DELIVERED`, version 6, `completed_at` null |

**Disposition: PASS on the assignment boundary, separation of duties and completion invariant.** The only failed expectation was the MODERATOR verification tier, which is an RLS defect external to the I1 logic; the same leg passed under ADMIN. The I1.5 DIV assertion in the first run expected the driver business key, while the response correctly pinned the `drivers.id` primary key; re-read against the PK, the leg passes.

### 12.5 Defects found (pre-existing; not fixed here)

| ID | Severity | Finding |
|---|---|---|
| PREI6-REC-01 | **HIGH** | `app.platform_roles` is readable only by ADMIN/SUPER_ADMIN (`010:90-94`, policy `platform_roles_admin FOR ALL`). Every RLS policy that tests `EXISTS (... app.platform_roles ... role IN ('MODERATOR', ...))` therefore evaluates **false for MODERATOR**. Confirmed live: MODERATOR reads 0 POD rows and its POD verification returns 409; ADMIN reads 1 row and verifies 200. Affects the POD read/verify policies and, at the database level, the `I2 delegated reads documents` leg. The application document read path is unaffected because it uses the service-role client plus `document-access.ts`. Root cause is the 051 mitigation's premise: it assumed "non-governance sessions select zero rows", but MODERATOR is governance and also selects zero. |
| PREI6-REC-02 | **MEDIUM** | `GET /api/documents/[id]` returns a four-field envelope because `Document.toJSON()` drops the document metadata. Authorization is correct; the payload is not. |
| PREI6-REC-03 | **MEDIUM** | No storage bucket exists in the project (`GET /storage/v1/bucket` returned `[]`). Document preview/download cannot work in production until `nexcargow-documents` (or the configured bucket) is provisioned. A temporary private bucket was created for this evidence and deleted. |

No RLS policy, grant, function, trigger or migration was changed to work around these findings. Fixing PREI6-REC-01 requires an explicit LA decision (a scoped self-read policy on `app.platform_roles`, or rewriting the inline legs to `effective_user_role()`); fixing PREI6-REC-02 is an application serialization change.

### 12.6 WS-05 Workstream Dispositions

| Item | Focus | Status / Disposition |
|---|---|---|
| **WS-05-A** | Transporter Booking Accept/Decline | **REFERRED TO LIFECYCLE:** Handoff operates via the established match/negotiation/contract lifecycle (`PROMPT 0 v1.3 §MOD-001`, `MOD-002`). No separate booking accept/decline mechanism was added. |
| **WS-05-B** | Proof of Pickup (DIV) Operational Flow | **RECORDED ACCURATELY:** Schema table `driver_identity_verifications`, RLS policies (070/071/072), API route `POST /api/tracking/[id]/pickup-proof`, and end-to-end execution verified via leg I1.5 (persisted status `SUCCESS` pinned to driver primary key). |
| **WS-05-C** | Transporter-Facing POD Verification | **REMAINS PLATFORM-CONTROLLED:** Preserved strict separation of duties (`MOD-003 §7.5`). Transporters cannot verify their own PODs (denial 403 verified live in leg I1.10/I1.10b). VERIFIED-POD invariant enforced prior to shipment completion. |

### 12.7 Documentation corrections applied

1. **Verifier count.** The original run is now stated as **35 executed PASS / 0 FAIL / 3 unexecuted placeholders** (38 declared). It is not "38 executed" and not "38 PASS".
2. **071 read scope.** The Driver SELECT policies are **assignment-scoped**, not "only the row just written". A linked role-less Driver may read every GPS/DIV/POD row for a shipment with a PLANNED/ACTIVE assignment.
3. **PUBLIC-scoped INSERT policies.** `Driver inserts GPS updates`, `Driver inserts verifications` and `Transporter submits POD for own booking` do have `polroles = {PUBLIC}` (no `TO authenticated`). The mitigation is table privilege, not predicate shape alone: live measurement shows `anon` holds **zero** table grants across `logistics_schema`, `marketplace_schema` and `app`, so the policies are unreachable anonymously. The predicates also fail closed (`auth.uid()` NULL, resolvers NULL).

### 12.8 Quality gates (current tree)

| Gate | Command | Window | Exit | Result | Log |
|---|---|---|---|---|---|
| Production build | `npm run build` | 10:50:06–10:50:46 | **0** | compiled 9.1 s, TypeScript 14.8 s, 72/72 static pages | `...\prei6-final\build.log` |
| Full Vitest | `npm test` (`vitest run`) | 11:06:42–11:09:33 | **0** | **2802/2802 passed, 133 files**, 168.92 s | `...\prei6-final\vitest.log` |
| TypeScript | `npx tsc --noEmit` | 11:06:42–11:06:49 | **0** | no diagnostics | `...\prei6-final\tsc.log` |
| Lint | `npm run lint` (`eslint`) | 11:08:31–11:08:33 | **1** | **586 problems (269 errors, 317 warnings)** | `...\prei6-final\lint.log` |

Lint is **pre-existing and unchanged**: 586 is exactly the count recorded for the baseline in `NXC-PREI6-RECOVERY-REPORT.md` (line 374). No code file was edited in this reconciliation. The `NativeCommandError` lines in the build/tsc logs are PowerShell rendering `npm notice` on stderr; both exited 0.

### 12.9 Cleanup and preservation

Deleted in FK-safe order: document row, POD, DIV, GPS, `tracking_events`, assignment, tracking, contract, booking, match, offer, listing, driver, fleet, the three temporary role rows, and the temporary storage object/bucket.

Post-cleanup live counts equal the pre-run baseline exactly: fleets 1, drivers 1, vehicles 1, assignments 1, tracking 1, tracking_events 6, GPS 0, DIV 0, POD 2, bookings 6, contracts 2, documents 0, listings 18, offers 9, matches 1, platform_roles 2. Protected state re-read: tracking `ce28e62d-ded6-4dcf-8e3c-ba9febb0e4e7` `DELIVERED` version 6 `completed_at` null; booking `827194cf-185f-4ef3-b59b-61d5284bad46` `CONFIRMED`; PODs `afc61a36…` and `a55addcd…` `PENDING`. No residue.

### 12.10 Git and server

HEAD `a956d650e896c55a2f2543bb998c8edcc24dc69a`, branch `main`, 0 staged, 0 conflicts; working tree unchanged apart from authorized documentation edits: 6 pre-existing modified files plus the closeout/recovery reports and migrations 071–073 untracked. No stage, commit, push, merge, rebase, reset, clean, stash, branch or deploy. Verification server stopped; port 3211 confirmed closed. I-6 not begun.
