# NXC-PREI6-RECOVERY-REPORT

**Date:** 2026-11-20
**Authority:** NexCargo Lead Architect (LA) — Post-Outage Recovery & Pre-I-6 Completion Directive
**Baseline HEAD:** `a956d650e896c55a2f2543bb998c8edcc24dc69a` (`main`)
**Execution mode:** Read-only recovery, evidence reconciliation and reporting
**Status:** Recovery complete. **No persistent state was changed.** I-6 not started.

---

## 1. Recovery Scope and Authority

This report establishes the actual state of the workspace and live database after the power outage that interrupted the Pre-I-6 work on 2026-11-19. It covers:

- Phase 1 — workspace and Git recovery.
- Phase 2 — read-only database inspection.
- Phase 3 — reconstruction of the previous execution point.
- Read-only portions of Phases 4, 5 and 6 (migration 071–073 security review, task #189 state, WS-01…WS-05 reconciliation).

**No** migration, policy, grant, role, fixture, application file, ledger or Git state was modified. The only file created is this report.

---

## 2. Evidence Classification

Throughout this report, evidence is labelled:

| Class | Meaning |
|---|---|
| **HISTORICAL** | Claimed in a prior report/ledger entry; not independently re-executed during recovery. |
| **INSPECTED** | Independently read during recovery (Git, filesystem, live catalog, live rows). |
| **VERIFIED** | Independently confirmed by a new read-only inspection during recovery. |
| **UNVERIFIED** | No preserved evidence or not reproducible read-only. |

---

## 3. Workspace Identity

| Item | Value | Class |
|---|---|---|
| Workspace | `G:\NexCargo\nexcargov2` | INSPECTED |
| Repository root | `G:/NexCargo/nexcargov2` | INSPECTED |
| Remote | `https://github.com/nexcargo/NexCargo.git` (`origin`) | INSPECTED |
| Branch | `main`, tracking `origin/main` | INSPECTED |
| HEAD | `a956d650e896c55a2f2543bb998c8edcc24dc69a` | INSPECTED |
| HEAD author/date | Grácio Filimão — `2026-11-18 16:07:33 +0200` | INSPECTED |
| HEAD subject | `Commit 18 11 2026` | INSPECTED |
| HEAD vs `origin/main` | `0` ahead / `0` behind | INSPECTED |
| HEAD vs reported baseline | **identical** (`a956d65…`) | VERIFIED |
| Merge/rebase/cherry-pick state | none; no `index.lock`; no stashes | INSPECTED |

HEAD has **not** moved since the previously reported baseline. No commit was created by the interrupted task.

---

## 4. Git Working-Tree Status

### 4.1 Summary

- **Staged:** 0 files.
- **Modified (unstaged):** 6 files.
- **Untracked:** 4 files.
- **Deleted / renamed:** none in the working tree.
- **Conflicts:** none.
- **Diffstat:** 111 insertions, 3 deletions across the 6 modified files.
- **Ignored files:** expected only (`web/.env.local`, `web/.env.production`, `web/.next/`, `web/node_modules/`, `web/tsconfig.tsbuildinfo`, `.opencode/`).

### 4.2 Modified files

| File | Change |
|---|---|
| `docs/governance/nexcargo-development-state.md` | +1 ledger row `NXC-PREI6-FC-001` |
| `web/src/__tests__/i5-operations.test.tsx` | +50 lines: API-ID-CONTRACT-01 resolution tests |
| `web/src/__tests__/ws03-sibling-updated-at.test.ts` | +6/−2: includes `getDriverByBusinessKey` in the hostile-row read set |
| `web/src/app/api/fleet/assignments/route.ts` | +28: business-key/UUID resolution + ownership guard + 404 |
| `web/src/app/api/fleet/fleet-write-guard.ts` | +15: FK / `chk_assignment_has_asset` → `400 ERR_4001` |
| `web/src/modules/mod-014-fleet-assets/infrastructure/repositories/fleet-repository.ts` | +14: `getDriverByBusinessKey()` |

### 4.3 Untracked files (retained work product)

| File | Size | Created |
|---|---|---|
| `docs/governance/NXC-PREI6-FC-001-closeout-report.md` | 14,973 B | 2026-11-19 15:28:02 |
| `web/src/infrastructure/migrations/071_prei6_driver_select_returning.sql` | 5,852 B | 2026-11-19 14:44:19 |
| `web/src/infrastructure/migrations/072_prei6_div_driver_fk_alignment.sql` | 1,278 B | 2026-11-19 14:48:32 |
| `web/src/infrastructure/migrations/073_prei6_pod_booking_guard.sql` | 4,158 B | 2026-11-19 14:51:08 |

**Conclusion:** the FC-001 work product survived intact. It matches the closeout report's described state. It is uncommitted, as the report stated.

### 4.4 Timestamp reconstruction

| Time (2026-11-19, local) | Event |
|---|---|
| 14:07:40 | Production build log `fc-build.log` (pre-fix build) |
| 14:15:43 | `fc-fixtures.json` created |
| 14:21–14:24 | `fc-resume.mjs`, `fc-resume2.mjs`; pre-fix verifier 27 PASS / 7 FAIL / 3 BLOCKED |
| 14:44:19 | Migration 071 file created |
| 14:48:32 | Migration 072 file created |
| 14:51:08 | Migration 073 file created |
| 14:54:50–14:56:16 | Application + test files edited |
| 14:57:24 | `web/tsconfig.tsbuildinfo` written (tsc run) |
| 15:02:46–15:02:50 | Production build artifacts (`.next/BUILD_ID`, `standalone/server.js`) |
| 15:06:08 | Verification server started (`next start -p 3211`) |
| 15:08:32 | `fc-resume3.mjs` first run |
| 15:09:29 | `fc-resume3.mjs` corrected (3 legs) |
| 15:11:01 | Final verifier: 35 PASS / 0 FAIL / 3 BLOCKED; results JSON written |
| 15:28:04 | Closeout report written |
| 15:28:10 | Ledger row written |
| 15:45:32–15:46:16 | `next dev` artifacts generated (post-closeout) |
| 18:23:40 | `.next/dev/trace` last write — dev server activity; **no source writes** |

No source, migration, report or ledger file was written after 15:28:10. The outage therefore did **not** interrupt a file write. The next phase (security review, #189, WS-05 reconciliation, final readiness report) had **not begun**.

---

## 5. Database State

### 5.1 Connectivity

- Direct Postgres MCP (`supabase-postgres`) failed: `getaddrinfo ENOTFOUND db.cvdggspiudmudbbdkjrc.supabase.co` (the `db.` host resolves only to IPv6 in this environment).
- The Supabase API MCP succeeded against project `cvdggspiudmudbbdkjrc` (`https://cvdggspiudmudbbdkjrc.supabase.co`), which matches `web/.env.local` and `web/.env.production`.
- **This is the expected NexCargo project**, not a branch or unrelated environment.

### 5.2 Migration journal — 066…073

| Version | Name | State |
|---|---|---|
| `20261117103042` | `066_prei6_ws01_pod_completion_invariant` | applied |
| `20261117111737` | `067_prei6_ws02_handoff_booking_id` | applied |
| `20261117114649` | `068_prei6_ws02_dead_marketplace_predicates` | applied |
| `20261118091814` | `069_prei6_ws02_match_persistence` | applied |
| `20261118111537` | `070_prei6_final_driver_operations` | applied |
| `20261119124400` | `071_prei6_driver_select_returning` | applied |
| `20261119124802` | `072_prei6_div_driver_fk_alignment` | applied |
| `20261119125200` | `073_prei6_pod_booking_guard` | applied |

VERIFIED: all three FC-001 journal versions match the closeout report exactly. There are no duplicate rows and no partial-migration signature.

**Known journal gaps (pre-existing, already dispositioned):**

- `061_i4_marketplace_schema_rest_exposure.sql` has **no journal row** (WS-04A no-action disposition; LA decision retained).
- `062_i5_tracking_policy_recursion_containment.sql` has no row under that filename; its effect is journaled as `20261112082945 i5_tracking_policy_recursion_containment`.

Neither gap was introduced by the interrupted task.

### 5.3 Live object state relevant to 071–073

| Object | Live state | Class |
|---|---|---|
| `logistics_schema.gps_location_updates` RLS | enabled; 3 policies (2 pre-existing + `Driver reads own GPS updates`) | VERIFIED |
| `logistics_schema.driver_identity_verifications` RLS | enabled; 4 policies (3 pre-existing + `Driver reads own verifications`) | VERIFIED |
| `logistics_schema.proof_of_delivery` RLS | enabled; 4 policies (incl. recreated `Transporter submits POD for own booking` and `Driver reads own POD`) | VERIFIED |
| `driver_identity_verifications_driver_id_fkey` | `FOREIGN KEY (driver_id) REFERENCES logistics_schema.drivers(id)` | VERIFIED |
| `public.booking_is_not_deleted(uuid)` | `LANGUAGE sql`, `STABLE`, `SECURITY DEFINER`, owner `postgres`, `search_path=pg_catalog, public`, returns `boolean` | VERIFIED |
| Function ACL | `postgres=X`, `authenticated=X`, `service_role=X`; **PUBLIC and anon revoked** | VERIFIED |
| Driver access to `logistics_schema.bookings` | **no driver-scoped SELECT policy was added.** The `authenticated` role holds table-level `INSERT/SELECT/UPDATE` on `bookings` as a class (pre-existing), but row visibility is governed by RLS; the driver path has no matching policy. Prior live legs measured 0 visible booking rows for the driver. | VERIFIED (grants/RLS) / HISTORICAL (0-row leg) |
| `anon` INSERT privilege anywhere in `logistics_schema` | 0 tables | VERIFIED |

### 5.4 Data state

| Table | Count |
|---|---|
| fleets | 1 |
| drivers | 1 |
| vehicles | 1 |
| asset_assignments | 1 |
| shipment_tracking_records | 1 |
| tracking_events | 6 |
| proof_of_delivery | 2 |
| gps_location_updates | 0 |
| driver_identity_verifications | 0 |
| bookings | 6 |
| contracts | 2 |
| documents | 0 |
| listings | 18 |
| offers | 9 |
| matches | 1 |

These equal the post-cleanup baseline recorded in `NXC-PREI6-FC-001`. All task-owned FC fixture rows are gone.

**Protected I-5 chain — VERIFIED intact:**

| Record | ID | State |
|---|---|---|
| Tracking | `ce28e62d-ded6-4dcf-8e3c-ba9febb0e4e7` | `DELIVERED`, version 6, `completed_at = null`, `is_deleted = false` |
| Booking | `827194cf-185f-4ef3-b59b-61d5284bad46` | `CONFIRMED` |
| POD 1 | `afc61a36-6b8b-4d02-875b-9b61e7451643` | `PENDING` |
| POD 2 | `a55addcd-6050-4f06-bab6-392730ac28ed` | `PENDING` |
| Seed listing/offer/match | `aaaaaaaa…`, `cccccccc…`, `dddddddd…` | `PUBLISHED` / `SUBMITTED` / `PROPOSED` |

### 5.5 Platform roles and memberships (live)

| User | Email | Role |
|---|---|---|
| `11111111-1111-1111-1111-111111111111` | `shipper@test.nexcargo` | `SUPER_ADMIN` |
| `33333333-3333-3333-3333-333333333333` | `unrelated@test.nexcargo` | `DISPATCHER` |

Marketplace memberships: SHIPPER ×3, TRANSPORTER ×3.

**No MODERATOR or ADMIN row exists.**

### 5.6 Task fixture identities still present

| Account | UID | Created | Last sign-in | Role row |
|---|---|---|---|---|
| `fc.moderator.1795002622861@nexcargo-mail.test` | `84a253d4-8fe7-44ea-9834-25c852ad86ae` | 2026-11-18 | 2026-11-19 13:09 | **none** |
| `fc.admin.1795002622861@nexcargo-mail.test` | `67ecbba9-ec07-4eeb-a29d-25342275dd8e` | 2026-11-18 | 2026-11-19 12:14 | **none** |
| `fc.superadmin.1795002622861@nexcargo-mail.test` | `c8f47236-573c-4a90-8c50-a6efe4869acd` | 2026-11-18 | 2026-11-19 12:14 | **none** |
| `fc.driver.1795002622861@nexcargo-mail.test` | `5691c885-8dba-4e53-9f1c-637d3c87c9dd` | 2026-11-18 | 2026-11-19 13:09 | n/a |

All four are confirmed auth users. They are the only FC-001 residue not covered by the closeout report's "all task-owned rows deleted" statement (that statement concerned database rows, not auth identities).

---

## 6. Migrations 071–073 — Current State

### 6.1 071 — Driver SELECT policies

Applied and journaled. Live predicates (abridged):

- `Driver reads own GPS updates` — `TO authenticated`; role-less (`effective_marketplace_role() IS NULL AND effective_user_role() IS NULL`); the caller must have a linked driver row (`drivers.platform_user_id = auth.uid()`) with a `PLANNED`/`ACTIVE` assignment for the row's `tracking_id`.
- `Driver reads own verifications` — same role-less/assignment scope, **plus** `d.id = driver_identity_verifications.driver_id`, tracking and booking pins, and non-deleted tracking.
- `Driver reads own POD` — same role-less/assignment scope, tracking/booking pins, non-deleted tracking/booking. (Superseded by 073's recreated version, which adds `booking_is_not_deleted`.)

071's `DO` block is atomic and guards pre/post policy counts (2→3, 3→4, 3→4), confirming it did not silently double-apply.

### 6.2 072 — DIV foreign-key alignment

Applied. Live FK is `logistics_schema.drivers(id)`. The table had 0 rows when changed. No `auth.users(id)` FK remains on `driver_id` (the `booking_id` and `tracking_id` FKs are unrelated and correct).

### 6.3 073 — POD booking guard

Applied. `public.booking_is_not_deleted(uuid)` is boolean-only, `SECURITY DEFINER`, owned by `postgres`, pinned search path, and not executable by `PUBLIC`/`anon`. The POD INSERT and SELECT policies both call it and both still require the assignment-scoped driver predicate for the driver branch. No driver SELECT on `logistics_schema.bookings` was added.

---

## 7. Targeted Security Review — Migrations 071–073

This is the review that the interrupted task had not yet produced. It is read-only and based on the exact live predicates (Section 6) and the repository definitions.

| Area | Finding | Risk | Classification | Required action |
|---|---|---|---|---|
| **GPS SELECT** | Any role-less account linked to a driver with a `PLANNED`/`ACTIVE` assignment on that `tracking_id` can read **all** GPS rows for that tracking, not only the row it inserted. GPS rows carry no submitter column (`id, tracking_id, latitude, longitude, timestamp, speed_kmh, heading_degrees, accuracy_meters, source, is_offline, battery_level, created_at`). | Low. Telemetry only; no commercial data; scope is the correct operational shipment. | **QUALIFICATION** | Correct the closeout report wording ("only the row just written") — the policy is assignment-scoped, not row-scoped. Optionally add a `submitted_by` column in a future increment if per-driver telemetry isolation is required. No change needed for I-6. |
| **DIV SELECT** | Pins `driver_id` to the caller's own linked driver row **and** pins tracking/booking to the active assignment. Another driver cannot read it; another transporter's driver cannot reach it; a role-holder is excluded by the role-less conjunct. | None material. Historical DIV rows become invisible once the assignment leaves `PLANNED`/`ACTIVE`, which is acceptable for the immediate `RETURNING` use and does not expose history. | **PASS** | None. |
| **POD SELECT** | Does **not** pin a submitter (POD has no `driver_id` column). Any role-less driver with a live assignment on the same tracking can read the POD, including one submitted by another assigned driver or by the Transporter. Protected by tracking/booking non-deletion and `booking_is_not_deleted`. No `offer_price`/commercial booking columns are reachable. | Low. Recipient name/signature/photo/GPS are operational evidence within the same assigned shipment, not commercial data. | **QUALIFICATION** | Correct the closeout report's "only the row just written" wording. Do not add a submitter pin in this increment; POD lacks the column and adding one is a schema change. |
| **DIV FK** | References `logistics_schema.drivers(id)`, matching the Driver-as-Transporter-asset model and the application path that supplies `drivers.id` (verified by G2/G3 live legs). No code path still assumes `auth.users(id)`. | None. | **PASS** | None. |
| **POD helper** | `SECURITY DEFINER`, owner `postgres`, `STABLE`, `search_path = pg_catalog, public`, returns only `boolean`, `PUBLIC`/`anon` EXECUTE revoked, `authenticated` granted. `public` schema has no CREATE for `authenticated`/`anon`, so the pinned path cannot be hijacked. | Negligible. An authenticated caller can invoke `POST /rest/v1/rpc/booking_is_not_deleted` with a known booking UUID and learn existence/non-deletion as a boolean. UUIDs are not enumerable. `service_role` retains EXECUTE, which is irrelevant (it bypasses RLS). | **PASS** (with note) | Optional hardening in a future increment: move the helper to a non-exposed schema or grant only the policy owner. Not required for I-6. |

### 7.1 Additional observations (not defects)

1. **INSERT policies are PUBLIC-scoped.** The live INSERT policies `Driver inserts GPS updates`, `Driver inserts verifications`, `Transporter submits POD for own booking` have `polroles = {PUBLIC}` (no `TO authenticated` clause). This is a repository/live match (migrations 070/073 omit the clause), and it is mitigated because **`anon` holds INSERT on zero `logistics_schema` tables**. All three predicates also fail closed for an anonymous caller (`auth.uid()` NULL and role resolvers NULL).
   **Classification: QUALIFICATION (defence-in-depth).** A future migration may add `TO authenticated` for clarity; no behavioural gain.
2. **Role-less conjuncts are correct.** The `effective_marketplace_role() IS NULL AND effective_user_role() IS NULL` guard prevents a Shipper/Transporter/platform-role holder from gaining driver fallback through a driver link — consistent with migration 070's stated boundary.
3. **Policy counts match the migrations' own guards** (3 / 4 / 4), so no drift from a later ad-hoc change.

**Security review conclusion:** no concrete security defect was found. Two qualifications (assignment-scoped rather than row-scoped GPS/POD reads; PUBLIC-scoped INSERT policies) and one documentation inaccuracy must be corrected. None blocks I-6.

---

## 8. Previous Execution Point — Reconstruction

| Work item | Last confirmed state | Evidence | Current status | Remaining work |
|---|---|---|---|---|
| Migration 071 review | Applied + journaled; closeout summary only | Journal `20261119124400`; live policy | **PARTIALLY COMPLETE** (formal review absent; completed read-only in this report) | Correct report wording; accept review |
| Migration 072 review | Applied + journaled; live FK aligned | Journal `20261119124802`; live FK | **PARTIALLY COMPLETE** (completed in this report) | Accept review |
| Migration 073 review | Applied + journaled; helper live | Journal `20261119125200`; live function/ACL | **PARTIALLY COMPLETE** (completed in this report) | Accept review |
| #189 investigation | Identities exist; no role rows; C8/H4/I1 are verifier **stubs** | `fc-accounts.json`, live `app.platform_roles`, `fc-resume3.mjs:209-211` | **PARTIALLY COMPLETE** | LA decision + authorization; implement legs |
| C8 — MODERATOR | Not implemented; placeholder | `blocked(...)` stub | **BLOCKED** | Needs role fixture **and** an LA decision on expected behaviour (see 9.3) |
| H4 — ADMIN | Not implemented; placeholder | `blocked(...)` stub | **BLOCKED** | MODERATOR role row + document fixture |
| I1 — SUPER_ADMIN | Not implemented; placeholder | `blocked(...)` stub | **BLOCKED** | Governance role + task-owned POD/tracking fixture |
| WS-05 reconciliation | Ledger row only; no post-070 reconciliation | Ledger `NXC-PREI6-WS05-001` | **NOT STARTED** | Reconcile D/A/B/C/E against 070/069; LA decisions |
| Final readiness report | Does not exist | Filesystem search | **NOT STARTED** | Produce after authorized completion |

### 8.1 Execution-point conclusion

The interrupted task **completed** FC-001 (DEF-01 + API-ID-CONTRACT-01), produced the closeout report and ledger row, cleaned its database fixtures, and stopped its verification server. The **next** phase — the targeted 071–073 review, #189/C8/H4/I1, WS-05 reconciliation and the final readiness report — had **not started**. Nothing is half-written.

The only post-closeout activity was a `next dev` session (artifacts 15:45–18:23). It changed no source, database or Git state.

---

## 9. Task #189 — C8 / H4 / I1

### 9.1 What actually exists

- The verifier legs are **placeholders**, not implementations. `fc-resume3.mjs` lines 209–211 call `blocked(...)` unconditionally. No HTTP requests are made for C8, H4 or I1.
- The identities intended for those legs exist (`fc.moderator`, `fc.admin`, `fc.superadmin`), confirmed, with a stored fixture password (`fc-accounts.json`).
- None of them has a row in `app.platform_roles`.
- `app.platform_roles` has `PRIMARY KEY (user_id)` — **one role per user** — so three distinct users are required for MODERATOR + ADMIN + SUPER_ADMIN.
- The seeded `shipper@test.nexcargo` **does** hold `SUPER_ADMIN`, but its `encrypted_password` length is **0** (no usable password) and it has never signed in. It cannot be used as a live governance session without changing its credential.

### 9.2 Per-leg viability (read-only assessment)

| Leg | Requirement | Current state | Viable after role grant? |
|---|---|---|---|
| **H4** | MODERATOR metadata/preview/download | HEAD `document-access.ts` **admits MODERATOR**; `documents:read` matrix admits it; RLS `I2 delegated reads documents` admits it. `documents` table is empty. | **Yes**, with a MODERATOR row and at least one task-owned document fixture. |
| **I1** | POD verification + COMPLETED | POD verify route requires `pod:update` (MODERATOR/ADMIN/SUPER_ADMIN); RLS UPDATE policy admits them. Protected I-5 PODs must not be touched. | **Yes**, with a governance role and a **task-owned** booking/tracking/POD fixture. |
| **C8** | "MODERATOR/ADMIN/SUPER_ADMIN positive match-access" | **No governance read path exists.** `marketplace_schema.matches` SELECT is participants-only; `GET /api/marketplace/matches` requires `listing.shipperId === authCtx.userId` and returns 404 otherwise. | **Uncertain / likely negative.** A role grant alone will not produce a positive match read. This needs an LA definition before execution. |

### 9.3 C8 is not merely a role-fixture problem

The closeout report characterises C8 as blocked only by `app.platform_roles` rows. The recovery inspection shows an additional architectural fact: governance roles have **no authorised path** to marketplace match records at either layer. If C8 expects a `200` with match data for MODERATOR/ADMIN/SUPER_ADMIN, executing it after a role grant would produce a **FAIL/404**, not a PASS. If C8 expects governance roles to be **denied** (i.e. a negative check), it can be executed as such.

**LA decision required:** state the intended C8 expectation. Do **not** add a governance match-read policy or change the route without a separate authorization.

### 9.4 Authorization request — exact setup (NOT executed)

To complete #189, the following persistent changes would be required. **None has been performed.**

**A. Temporary platform-role assignments (owner-class SQL, RLS bypass):**

```sql
INSERT INTO app.platform_roles (user_id, role, assigned_by) VALUES
  ('84a253d4-8fe7-44ea-9834-25c852ad86ae', 'MODERATOR',   '11111111-1111-1111-1111-111111111111'),
  ('67ecbba9-ec07-4eeb-a29d-25342275dd8e', 'ADMIN',       '11111111-1111-1111-1111-111111111111'),
  ('c8f47236-573c-4a90-8c50-a6efe4869acd', 'SUPER_ADMIN', '11111111-1111-1111-1111-111111111111');
```

- `assigned_by` references the existing SUPER_ADMIN seed; no auth change.
- `assigned_at`, `created_at`, `updated_at` default to `now()`.
- The `platform_roles_role_check` constraint is `NOT VALID` but admits all three values.
- **Temporary:** all three rows deleted after verification.
- **Risk:** temporary governance authority for fixture accounts whose password is stored in the workspace. Safeguards: no production users, no financial operations, cleanup verified by count, and the rows are removed before the report is accepted.

**B. Fixtures:**

- **H4:** one task-owned document (linked to an existing booking or a task-owned booking) plus optional upload; `documents` is currently 0. Delete after.
- **I1:** one task-owned booking → contract → tracking → POD chain (do **not** verify the protected I-5 PODs). Verify the POD as a governance role, then transition to `COMPLETED`, then delete in FK-safe order.
- **C8:** no fixture needed for a negative test; a positive test additionally needs an approved design decision.

**C. Cleanup:** delete the three role rows; delete all task-owned fixtures; re-measure counts; confirm protected I-5 chain and seeds untouched; optionally delete the four `fc.*` auth users (separate destructive decision).

**D. Verification:** real authenticated sessions over HTTP; capture status codes and DB read-back; run each leg individually and report PASS/FAIL/BLOCKED. Never report a blocked leg as passed.

---

## 10. WS-01 … WS-05 Reconciliation

| Item | Ledger status | Actual supporting evidence | Current status | Remaining work / LA decision |
|---|---|---|---|---|
| **WS-01** — POD completion invariant | `NXC-PREI6-WS01-002` COMPLETED under D-WS01-1/D-WS01-2 | Migration 066 journaled `20261117103042`; function gate present | **CLOSED** | None. Preserve. |
| **WS-02** — LIM-001 / handoff / match lifecycle | `NXC-PREI6-WS02-002` + `WS02-003` COMPLETED | Migrations 067–069 journaled; 069 live-verified with 40 legs; matches now persist | **CLOSED** | The WS-02-002 referral (matches UPDATE privilege + persisted match path) was resolved by 069. No reopen. |
| **WS-03** — sibling `updated_at` | `NXC-PREI6-WS03-001` COMPLETED | Code + 28 tests; live 9/9 per ledger | **CLOSED** | None. |
| **WS-04** — migration 061 / fixtures | `NXC-PREI6-WS04-001` DISPOSITIONED | 061 still has no journal row; live effect present | **CLOSED (with LA-retained gap)** | LA must decide whether the 061 journal gap is acceptable indefinitely. No action taken. |
| **WS-05 D** — document read path | IMPLEMENTED | `document-access.ts` + routes; 18/18 live legs (historical) | **CLOSED** | Ledger text is stale on MODERATOR (see 11.1). |
| **WS-05 E** — email/SMS/push/WhatsApp | ESCALATED — external dependency | Stubs report `PROVIDER_NOT_CONFIGURED`; no credentials in repo | **DEFERRED (external)** | No I-6 blocker. Remains an external dependency. |
| **WS-05 A** — Transporter booking accept/decline | STOPPED / referred | No booking-level DECLINED status; booking RBAC excludes TRANSPORTER | **OPEN** | LA product decision. Not a defect. Confirm whether required before I-6. |
| **WS-05 B** — Proof of Pickup | STOPPED / referred | **Effectively delivered by migration 070 + DIV pickup-proof route** (G2/G3 live PASS) | **DELIVERED, not ledger-reconciled** | LA to confirm the 070 disposition supersedes the WS-05 B referral and record it. |
| **WS-05 C** — Transporter-facing POD verification | STOPPED / referred | POD verify remains governance-only (`pod:update` + RLS) | **OPEN** | LA separation-of-duties decision. I1 tests the governance path, not C. |

**No unfinished WS item is hidden.** A/B/C/E are explicit referrals/deferrals, not partially implemented code.

---

## 11. DEF-01 and API-ID-CONTRACT-01

| Item | Status | Recovery evidence |
|---|---|---|
| **DEF-01** (Driver `INSERT … RETURNING`) | **CLOSED** | 071–073 journaled and live; 071 SELECT policies present; 072 FK correct; 073 helper + POD policies correct; prior live legs G2/G3/G5/G6/G9/G10 PASS (historical). |
| **API-ID-CONTRACT-01** (business key vs PK) | **CLOSED** | Working-tree diff matches the report: `getDriverByBusinessKey`, route resolution, 404 `ERR_1004`, FK → `400 ERR_4001`; focused tests added. F4-pre/E-pre live legs PASS (historical). |

Both remain valid; no contradictory evidence was found.

---

## 12. Test, TypeScript and Build Evidence

| Gate | Reported | Preserved evidence | Class |
|---|---|---|---|
| Focused tests (4 files, 177) | PASS | none preserved | HISTORICAL |
| Full Vitest suite 2802/2802, 133 files | PASS | **no preserved log** | UNVERIFIED |
| `tsc --noEmit` 0 errors | PASS | `web/tsconfig.tsbuildinfo` written 2026-11-19 14:57:24 (corroborates a run, not the result) | HISTORICAL |
| Production build | PASS, 72 static pages, BUILD_ID `mvsknSkdUGOL2wfHvt8hI` | `.next` artifacts 15:02:46–15:02:50; `fc-build.log` is an **earlier** 14:07 build log | HISTORICAL (artifacts verify a build occurred) |
| Lint | 586 pre-existing problems, 0 new | none preserved | HISTORICAL |
| Live verifier | 35 PASS / 0 FAIL / 3 BLOCKED | `fc-resume3-results.json` (10,980 B, 15:11:01), `fc-resume3b.stdout.log` (14,632 B) | VERIFIED (artifact exists and content matches) |
| Verification server stopped | PID 27804, port 3211 closed | port 3211 has **0** listeners | VERIFIED |

**Caveat:** `fc-build.log` predates the final code edits (14:54–14:56). The final build is evidenced by the 15:02 `.next` artifacts, not by a log. The "2802/2802" claim has no machine-readable artifact. Both should be re-run on the final tree before the final readiness report (this is a verification gap, not a contradiction).

---

## 13. Cleanup and Fixture Concerns

| Concern | State | Action |
|---|---|---|
| FC task database fixtures (fleets, drivers, assignments, tracking, POD, GPS, DIV, listings, offers, matches, bookings, contracts) | **deleted**; counts match baseline | None |
| `fc-fixtures.json` (Qoder workspace) | stale by design; describes deleted rows | Do not treat as live state; retain as historical evidence |
| Four `fc.*` auth users | **remain** (confirmed, password in workspace) | LA decision: retain for #189 execution or delete after; deletion is destructive and unauthorized now |
| Protected I-5 chain | intact | Preserve |
| Seeds (listing/offer/match/booking/contract/escrow) | intact | Preserve |
| Old I-4/I-5 residue (4 `REQUESTED` bookings, 3 offers without bookings, earlier test identities) | pre-existing, retained by prior WS-04 disposition | No cleanup without LA |
| Verification server | stopped | None |
| `next dev` artifacts | stale, no listener | Harmless; no cleanup performed |

---

## 14. Discrepancies Between Historical Reports and Actual State

1. **"Only the row just written" is inaccurate.** The 071/073 SELECT policies are **assignment-scoped**: a linked driver can read *all* GPS rows and *all* PODs for a tracking they are actively assigned to. This is not a defect, but the closeout report overstates row-level precision. → Correct the wording.
2. **"No governance account exists without the #189 grant" is imprecise.** A `SUPER_ADMIN` row already exists for `shipper@test.nexcargo`, but the account has an empty/absent password and cannot be used. Three `fc.*` identities exist but have no role rows. → State the precise condition.
3. **WS-05 ledger text is stale.** `NXC-PREI6-WS05-001` says non-owner MODERATOR document reads are denied. HEAD `document-access.ts` and `ws05-document-read-authz.test.ts` **admit MODERATOR**, citing "PRE-I-6 FINAL COMPLETION DIRECTIVE Item 2". The change is committed in `a956d65` but has no ledger row and is not mentioned in the FC-001 report. → LA should confirm the change was authorised and record it; otherwise it is an undocumented authorization broadening.
4. **C8 is not only a role-fixture gap.** No governance match-read path exists at app or RLS level (see 9.3). → LA definition required before execution.
5. **"All task-owned rows deleted"** is true for logistics/marketplace rows, but four fixture **auth users** remain and were not mentioned. → Disclose and decide.
6. **"38 legs"** counts three placeholder stubs; only **35** were executed. The report is transparent about the block, but the leg count overstates executed coverage.
7. **Build/test evidence gap.** The final build log was not preserved and the full-suite result has no artifact. → Re-run on the final tree.
8. **Post-closeout dev session.** `next dev` ran until ~18:23 on 19 Nov. It produced no source/database changes; it does not affect state, but it explains the `.next/dev` timestamps.
9. **Migration journal gaps.** 061 and the 062 filename are not journaled; this is pre-existing and already dispositioned, not a new outage artifact.

---

## 15. Actions Already Authorized

Completed during this recovery (read-only):

- Repository/Git inspection.
- Live migration journal, policy, FK, function, ACL, role, identity and row inspection.
- Reading of verification artifacts, reports, ledger and temp evidence.
- Creation of this report.

No other action is authorized.

---

## 16. Actions Requiring LA Authorization

| # | Action | Why | Persistent change |
|---|---|---|---|
| A1 | Insert 3 temporary `app.platform_roles` rows (MODERATOR/ADMIN/SUPER_ADMIN) for the existing `fc.*` identities | Required for H4/I1 (and C8 if positive) | Yes |
| A2 | Create task-owned H4 document fixture | `documents` is empty; H4 needs a readable document | Yes |
| A3 | Create task-owned I1 booking/tracking/POD fixture | Protected I-5 PODs must not be verified | Yes |
| A4 | Execute C8/H4/I1 live and capture evidence | Task #189 completion | No (reads/writes to task fixtures) |
| A5 | Delete the 3 role rows and all task fixtures; verify counts | Cleanup | Yes |
| A6 | Decide C8 expectation (positive governance match read vs negative denial) | No governance path exists | No (decision) |
| A7 | Decide WS-05 A (Transporter booking accept/decline) | Open product decision | No (decision) |
| A8 | Confirm WS-05 B is superseded by migration 070 and record it | Ledger reconciliation | No (governance record) |
| A9 | Decide WS-05 C (Transporter POD verification) | Separation-of-duties decision | No (decision) |
| A10 | Decide whether the four `fc.*` auth users are retained or deleted | Fixture residue | Yes (if deleted) |
| A11 | Authorize a full gate re-run (Vitest, tsc, build, lint) on the final tree | Evidence gap | No (build artifacts only) |
| A12 | Authorize correcting the closeout report wording and ledger WS-05 text | Accuracy/governance | Yes (docs only) |
| A13 | Decide on committing the FC-001 work (6 modified + 4 untracked) | Currently uncommitted | Yes (Git) |

---

## 17. Recommended Next Execution Sequence

1. **LA review of this report** and acceptance of FC-001 (if not already accepted).
2. **LA decisions:** C8 expectation (A6), WS-05 A/C (A7/A9), WS-05 B reconciliation (A8), `fc.*` identity disposition (A10), Git commit (A13).
3. **If authorized:** apply A1–A3, execute C8/H4/I1 individually with real sessions, report each as PASS/FAIL/BLOCKED, then clean up A5 and verify zero residue.
4. **Re-run gates** on the final tree and preserve logs (A11).
5. **Correct documentation** (A12) and update the Development State ledger **only** for genuinely completed work, with the LA's authority.
6. **Produce `NXC-PREI6-FINAL-READINESS-REPORT.md`** with the security review, #189 results, WS dispositions, gates, cleanup evidence and an explicit READY / NOT YET READY recommendation.
7. **Only then** consider I-6 authorization.

---

## 18. Evidence Index

| Evidence | Path | Timestamp |
|---|---|---|
| This report | `docs/governance/NXC-PREI6-RECOVERY-REPORT.md` | 2026-11-20 |
| Closeout report | `docs/governance/NXC-PREI6-FC-001-closeout-report.md` | 2026-11-19 15:28:04 |
| Development ledger | `docs/governance/nexcargo-development-state.md` | 2026-11-19 15:28:10 |
| Migration 071 | `web/src/infrastructure/migrations/071_prei6_driver_select_returning.sql` | 2026-11-19 14:44:20 |
| Migration 072 | `web/src/infrastructure/migrations/072_prei6_div_driver_fk_alignment.sql` | 2026-11-19 14:48:34 |
| Migration 073 | `web/src/infrastructure/migrations/073_prei6_pod_booking_guard.sql` | 2026-11-19 14:51:58 |
| Final verifier stdout | `C:\Users\geral\AppData\Local\Temp\opencode\fc-resume3b.stdout.log` | 2026-11-19 15:11:01 |
| Final verifier JSON | `C:\Users\geral\Documents\Qoder\2026-10-28\5f775026\fc-resume3-results.json` | 2026-11-19 15:11:01 |
| Pre-fix verifier | `C:\Users\geral\AppData\Local\Temp\opencode\fc-resume2.stdout.log` | 2026-11-19 14:24:47 |
| Verifier script | `C:\Users\geral\AppData\Local\Temp\opencode\fc-resume3.mjs` | 2026-11-19 15:09:29 |
| Fixture accounts | `C:\Users\geral\Documents\Qoder\2026-10-28\5f775026\fc-accounts.json` | 2026-11-18 13:50:26 |
| Build artifacts | `web/.next/BUILD_ID` = `mvsknSkdUGOL2wfHvt8hI` | 2026-11-19 15:02:46 |
| TypeScript cache | `web/tsconfig.tsbuildinfo` | 2026-11-19 14:57:24 |
| Dev-server trace | `web/.next/dev/trace` | 2026-11-19 18:23:40 |
| Live project | `cvdggspiudmudbbdkjrc` | inspected 2026-11-20 |

---

**End of report. No persistent state was modified. Awaiting LA review and authorization.**
