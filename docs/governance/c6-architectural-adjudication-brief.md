# C6 Architectural Adjudication Brief

**Document Type:** HAO Review Preparation — Analysis Only  
**Generated:** 2026-09-09  
**Status:** AWAITING HAO DECISION  
**Reference:** `docs/governance/uiux-interface-recovery-audit.md` (UI/UX Interface Recovery Audit)  
**Predecessor Reports:** C6 Readiness & Boundary Analysis (`docs/governance/c6-readiness-boundary-analysis.md`)  
**Governance Constraint:** READ-ONLY ANALYSIS. Does NOT authorize C6, does NOT resolve OADs, does NOT establish implementation sequence, does NOT revive Wave 5 Increment 3.

---

## A. Current C0–C5 Baseline (Verified at Time of Analysis)

| Milestone | Status | Closure Date | Scope Summary |
|-----------|--------|--------------|---------------|
| **C0** | CLOSED | 2026-09-09 | Foundation bootstrap — architecture, specification baseline, governance model |
| **C1** | CLOSED | 2026-09-09 | Marketplace RLS & Auth Hardening — 14 RLS policies on 4 tables, Pattern A session-only auth |
| **C2** | CLOSED | 2026-09-09 | Marketplace → Booking Vertical Slice — bookings table live, API routes, atomic handoff via PostgreSQL RPC |
| **C3** | CLOSED | 2026-09-09 | Booking → Contract → Escrow Integration — contracts table, escrow RPCs, E2E verified T1–T19 |
| **C4** | CLOSED | 2026-09-09 | Payment → Financial Execution — settlement pipeline with full E2E lifecycle verified: PENDING_CREATION → FUNDS_INITIATED → FUNDS_LOCKED → EXECUTED → FINAL_RELEASE → ESCROW_CLOSED |
| **C5** | CLOSED | 2026-09-09 | Notifications + Observability — MOD-016 persistence + provider-ready adapter; MOD-017 monitoring_schema with alerts/incidents/log_entries/metrics/traces/health_checks |

### Quality Gates Confirmed
- **TypeScript:** 0 errors (`tsc --noEmit` clean)
- **Tests:** 70 files, 1,454 passing
- **Track B:** Frozen at commit `4153dc0`
- **PROMPT 0 v1.1:** Unchanged
- **ESS Documents:** Unchanged
- **Supabase Dev Environment:** Live verification completed for C1–C5 milestones

### Session Metadata State
> "Next governance gate: Wave 5 Increment 3 authorization OR C6 milestone proposal (neither currently authorized)."

---

## B. The 10 Open Architectural Decisions (OADs)

Source: `docs/governance/uiux-interface-recovery-audit.md` §12

| # | Decision ID | Description | Impacted By | Classification |
|---|------------|-------------|------------|----------------|
| 1 | OAD-001 | Landing page route group placement (`[locale]/` vs `(public)/`) | PROMPT 4 §APP ROUTER STRUCTURE | DOCUMENTATION GAP |
| 2 | OAD-002 | Public-facing UI ownership assignment | PROMPT 4 defines structure; MOD-007 disclaims visual implementation | HAO DECISION REQUIRED |
| 3 | OAD-003 | Anonymous/public marketplace browsing access | MOD-007 §6.3 RBAC visibility; PROMPT 4 `(public)` route group | HAO DECISION REQUIRED |
| 4 | OAD-004 | Role selection during registration | HAO PE-H04 taxonomy; PROMPT 7 auth scope | HAO DECISION REQUIRED |
| 5 | OAD-005 | Post-registration onboarding flow | NO DOCUMENT DESCRIBES THIS | HAO DECISION REQUIRED |
| 6 | OAD-006 | Minimum viable dashboard scope for C6 | MOD-007 §5.1–5.5 (5 full dashboards defined) | HAO DECISION REQUIRED |
| 7 | OAD-007 | Role-specific vs generic authenticated landing | MOD-007 role dashboards; `(dashboard)/` layout exists but empty | IMPLEMENTATION GAP |
| 8 | OAD-008 | Native mobile vs responsive web sufficiency | MOD-008 §3.1 (native apps planned); Manifest Phase 8 (deferred) | AUTHORITATIVE FACT — deferred to Phase 8 |
| 9 | OAD-009 | Precedence order for UI document conflicts | MOD-007, PROMPT 4, PROMPT 5, ESS-008 multiple governances | DOCUMENTATION GAP |
| 10 | OAD-010 | Component library build approach (scratch vs existing) | ESS-008 §3.1 ("no external CSS frameworks") | IMPLEMENTATION GAP |

---

## C. Detailed OAD Analysis

### OAD-001: Landing Page Route Group Placement

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-001 — Landing page route group placement |
| **Exact Issue** | Whether the landing/homepage belongs under `[locale]/page.tsx` (current implementation) or `(public)/` route group (per PROMPT 4 structure). Currently the landing page is at `[locale]/page.tsx`, outside the `(public)` group. |
| **Authoritative Source(s)** | PROMPT 4 §APP ROUTER STRUCTURE: defines both `[locale]` as internationalized root AND `(public)` as "Contains: landing page, public information pages" |
| **What Documentation Establishes** | PROMPT 4 explicitly includes landing page in `(public)` group definition. But the `[locale]` wrapper provides multilingual capability for the same page. Neither source contradicts the other directly — they can coexist. |
| **What Remains Unresolved** | Which structural convention takes precedence for routing. Whether `(public)/layout.tsx` should contain the landing page content instead of `[locale]/page.tsx`. |
| **Conflict** | CONFIRMED — PROMPT 4 defines landing page inside `(public)`, but implementation places it at `[locale]/page.tsx`. Severity: LOW (functional equivalency possible either way). |
| **Impact on C6** | MINOR. Affects which route group contains C6-I auth entry links and whether landing page respects i18n locale routing consistently. Does not block C6 auth page implementation. |
| **Dependencies** | Depends on OAD-002 (who owns the landing page?) and i18n infrastructure already configured (next-intl installed, locales folder populated). |
| **Required Before C6?** | NO — Implementation can proceed with current `[locale]/page.tsx` arrangement if HAO approves this as acceptable deviation from PROMPT 4 plan. |
| **Consequences of Leaving Unresolved** | Minor structural inconsistency between PROMPT 4 route plan and actual codebase. No functional impact. |

**Classification:** DOCUMENTATION GAP / MINOR STRUCTURAL INCONSISTENCY

---

### OAD-002: Public-Facing UI Ownership Assignment (CRITICAL)

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-002 — Ownership of the public-facing interface |
| **Exact Issue** | No module (MOD-N) or architectural component is designated to own the public-facing UI (landing page, auth entry points, promotional content, public information pages). Responsibility falls into a gap between PROMPT 4 (structural blueprint), PROMPT 7 (auth mechanisms), and ESS-008 (design rules that apply universally without ownership assignment). |
| **Authoritative Sources** | PROMPT 4 (defines `(public)` and `(auth)` route groups), PROMPT 7 (governs authentication), ESS-008 (applies design rules globally), INDEX (§9 assigns MOD-007 to "Presentation" domain), MOD-007 §2 ("does not define visual design implementation or frontend frameworks") |

#### Documentary Evidence by Interface Area:

**(a) Public Homepage/Landing Experience**
- **AUTHORITATIVE FACT:** PROMPT 4 §APP ROUTER STRUCTURE lists landing page under `(public)` route group. `[locale]/page.tsx` is the current location (partially implemented).
- **DOCUMENTATION GAP:** No MOD-N assigned. MOD-007 INDEX listing says "Presentation" but MOD-007 §2 disclaims visual/frontend implementation.
- **CONFLICT:** MOD-007 is labeled "Presentation" in the INDEX yet disclaims being responsible for the very thing its label describes.

**(b) Public Information Pages (about, terms, privacy)**
- **AUTHORITATIVE FACT:** PROMPT 4 lists "(public)" containing "landing page, public information pages."
- **DOCUMENTATION GAP:** No document specifies what content these pages contain, who writes it, or who maintains it.
- **IMPLEMENTATION GAP:** `(public)/layout.tsx` is an empty `{children}` wrapper. No page files exist.

**(c) Public Marketplace/Discovery Experience**
- **AUTHORITATIVE FACT:** MOD-007 §6.3 mandates RBAC visibility constraints at the UI layer, implying user actions are hidden when unauthorized. MOD-001 spec defines marketplace functionality (listings, offers, matching) but does not specify whether anonymous users can browse them.
- **DOCUMENTATION GAP:** No explicit rule stating whether non-authenticated users may view listings/search offers. The presence of a `(public)` route group suggests some public surface area, but no public discovery feature is specified.
- **HAO DECISION REQUIRED:** Should the marketplace be visible anonymously (discovery-before-authentication model) or strictly authenticated?

**(d) Onboarding Entry (visitor → sign-up)**
- **AUTHORITATIVE FACT:** PROMPT 4 defines register page under `(auth)`. HAO PE-H04 established UserRole taxonomy (SHIPPER/TRANSPORTER/DRIVER/DISPATCHER/MODERATOR/ADMIN/SUPER_ADMIN).
- **DOCUMENTATION GAP:** No registration form schema, no role-choice mechanism, no post-registration workflow documented anywhere.
- **IMPLEMENTATION GAP:** `(auth)/layout.tsx` renders only `{children}`. No sign-in, register, forgot-password, or reset-password pages exist.

**(e) Authentication Entry**
- **AUTHORITATIVE FACT:** PROMPT 4 defines `(auth)` route group. PROMPT 7 governs authentication mechanisms and RBAC. Supabase auth client infrastructure fully implemented (`api-auth.ts`, `middleware.ts`).
- **DOCUMENTATION GAP:** How authentication connects to subsequent onboarding/user journey is unspecified.
- **HAO DECISION REQUIRED:** What happens immediately after successful authentication? Redirect? Dashboard selection? Onboarding wizard?

**(f) Authenticated Application Shell (post-login experience)**
- **AUTHORITATIVE FACT:** MOD-007 defines 5 role-based dashboards (Shipper, Transporter, Driver, Moderator, Super Admin) with specific feature sets each (§5.1–§5.5). PROMPT 4 defines `(dashboard)`, `(shipper)`, `(transporter)`, `(driver)`, `(admin)` route groups. Development Manifest Phase 7–8: mobile follows web platform completion.
- **DOCUMENTATION GAP:** Who OWNS the transition from auth to dashboard? Which document governs the post-login shell, sidebar navigation, global header, and role-aware menu?
- **AUTHORITATIVE FACT:** MOD-007 §9 integration boundaries list "all user dashboards" as MOD-007 responsibility. MOD-007 §6.1 establishes "defining how users interact with system data" and "organizing workflows into structured dashboards."
- **CLAIM:** MOD-007 IS the authoritative owner of authenticated application dashboards per INDEX designation and MOD-007 §9, but it disclaims visual implementation per §2.

**(g) Design System Ownership**
- **AUTHORITATIVE FACT:** PROMPT 5 §PURPOSE states it is responsible for "A production-grade design system and reusable UI component library for NexCargo." ESS-008 §3 applies design system rules universally. INDEX §10 lists ESS-008 as "UI/UX Standards."
- **AUTHORITATIVE FACT:** PROMPT 5 is a PROMPT (implementation guidance prompt), NOT a MODULE specification. It governs HOW to implement the design system but does not assign ownership within the MOD-N module framework.
- **DOCUMENTATION GAP:** If PROMPT 5 defines the design system but is not a module, and ESS-008 enforces design standards but is a standard not an owner — WHO MAINTAINS and EXTENDS the component library as new modules are added?
- **IMPLICATION:** Design system ownership sits outside the module framework entirely, similar to how public UI sits outside the module framework.

| **Impact on C6** | CRITICAL. Without clear ownership of the public-facing interface, C6 implementation has no clear architectural authority to reference. Every decision about landing page content, auth flows, onboarding screens, and design system adoption would lack a single accountable specification. |
| **Dependencies** | OAD-001 (route group placement), OAD-003 (public marketplace access), OAD-004 (role selection), OAD-006/C6 scope boundary, OAD-009 (document precedence), OAD-010 (component library strategy) |
| **Required Before C6?** | YES — This is THE critical precondition for C6 authorization. Without resolving OAD-002, there is no architectural anchor for C6 scope, no designated owner for deliverables, and no clear specification to validate against. |
| **Consequences of Leaving Unresolved** | C6 implementation proceeds without architectural anchor. Risk of duplicated effort, specification contradictions, rework when ownership is later assigned, and accountability ambiguity for delivered artifacts. |

**Classification:** HAO DECISION REQUIRED — CRITICAL PATH

---

### OAD-003: Anonymous/Public Marketplace Browsing Access

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-003 — Whether non-authenticated users can browse marketplace listings |
| **Exact Issue** | MOD-007 §6.3 mandates RBAC visibility constraints at the UI layer ("hiding unauthorized actions from view"). This implies authenticated-only access. However, PROMPT 4 defines `(public)` route group, suggesting some public-facing functionality. The tension is unresolved. |
| **Authoritative Sources** | MOD-007 §6.3 (RBAC visibility), MOD-007 §7.1 (UI reflects access constraints but is not security enforcement), PROMPT 4 `(public)` route group definition, ESS-008 §2.3 (Role-Clarity Principle: "No role sees functionality they cannot use") |
| **What Documentation Establishes** | Market place functionality (listings creation by shippers, offer submission by transporters, matching engine) is described entirely in authenticated role contexts. No document describes anonymous listing browsing or search. |
| **What Remains Unresolved** | The business question of whether prospective users should discover value through anonymous browsing before creating accounts. This is a product/business decision, not purely technical. |
| **Conflict** | IMPLIED CONFLICT — MOD-007 RBAC-driven visibility model suggests authenticated-only; PROMPT 4 `(public)` route group implies some public surface area. Not directly contradictory but creates ambiguity. |
| **Impact on C6** | MEDIUM. If anonymous browsing is required, C6-I (auth pages) must include alternative CTAs and landing page messaging that supports pre-authentication discovery. If authenticated-only, C6 scope simplifies significantly. |
| **Dependencies** | OAD-002 (ownership of public UI determines who designs anonymous experience), marketplace backend APIs already exist (listings CRUD endpoints are live) |
| **Required Before C6?** | YES — Determines landing page content, CTA labels, and whether any `(public)/` routes beyond auth pages are needed. |
| **Consequences of Leaving Unresolved** | C6-I landing page may send wrong signals to visitors (e.g., presenting "Sign In" without explaining why, or showing "Create Account" when discovery was intended). Product positioning risk. |

**Classification:** HAO DECISION REQUIRED

---

### OAD-004: Role Selection During Registration

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-004 — How new users select their role during registration |
| **Exact Issue** | The approved HAO role taxonomy (SHIPPER/TRANSPORTER/DRIVER/DISPATCHER/MODERATOR/ADMIN/SUPER_ADMIN) is well-defined in shared enums and enforced everywhere. However, NO document describes how a new visitor chooses their role when registering. Is it a dropdown? A multi-step wizard? Assigned by admin invitation only? |
| **Authoritative Sources** | HAO PE-H04 (approved UserRole taxonomy), shared/types/enums.ts (UserRole enum values), PROMPT 7 (Auth + RBAC — governs auth mechanisms), MOD-007 §5.1–§5.5 (role dashboards exist but assume role is known) |
| **What Documentation Establishes** | Roles exist as enumerated types. RBAC enforcement checks `user.user_metadata?.role ?? null`. Null means unassigned/onboarding state (HAO PE-H04). This implies role CAN BE null at some point post-registration. |
| **What Remains Unresolved** | The mechanism by which role transitions from null to assigned. Self-selection during registration? Invitation-by-admin? Profile update post-onboarding? Multi-role support (can a user be both shipper and transporter)? |
| **Conflict** | NONE explicit. The gap is absence of specification, not contradiction. |
| **Impact on C6** | HIGH. Registration page design depends on this. If self-selection: register page needs role choice UI. If admin-assigned: register page is simpler but requires separate invite flow. If multi-role: significantly more complex. |
| **Dependencies** | OAD-005 (onboarding flow), Supabase user_metadata schema (role stored in metadata), MOD-010 RBAC (role affects permissions) |
| **Required Before C6?** | YES — Registration page cannot be designed without knowing who selects the role and how. |
| **Consequences of Leaving Unresolved** | Cannot implement functional registration flow. Register page would be speculative. User confusion at first login if expected role choices are absent. |

**Classification:** HAO DECISION REQUIRED

---

### OAD-005: Post-Registration Onboarding Flow

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-005 — Post-registration onboarding journey |
| **Exact Issue** | After registration/authentication, what is the guided experience before a user reaches their role dashboard? Steps potentially include: profile setup, identity verification, language preference, region selection, role confirmation, introductory walkthrough. None documented. |
| **Authoritative Sources** | MOD-009 §19.1/19.2 (region-to-language mapping governed by MOD-009), MOD-007 §3.7/§7.8 (i18n preferences), MOD-010 §5.1 (compliance/governance framework — may imply KYC/KYB), MOD-007 §5.4 (Moderator reviews identity verifications) |
| **What Documentation Establishes** | Language preference storage (MOD-007, ESS-009 §19), Region-to-language mapping (MOD-009), Identity verification workflow exists (MOD-007 §5.4 confirms moderators review identity verifications — meaning verification STEP EXISTS). |
| **What Remains Unresolved** | Complete absence of any onboarding flow specification. The existence of "identity verification review by moderator" implies a verification step exists somewhere, but where in the user journey, how is it triggered, and what precedes/follows it is completely unspecified. |
| **Conflict** | NONE. Pure documentation gap. |
| **Impact on C6** | HIGH. C6 objective is "Authenticated Product UX Operational." If onboarding is skipped, a registered user lands on an empty dashboard (no dashboard pages exist yet anyway). If onboarding exists, C6 must include at minimum a skeleton onboarding flow. |
| **Dependencies** | OAD-004 (role selection completes first or during onboarding), MOD-009 (region-language), MOD-010 (verification compliance) |
| **Required Before C6?** | PARTIAL — At minimum, C6 should define whether onboarding is a prerequisite for dashboard access or a parallel/reusable process. Full onboarding details deferred to later milestone. |
| **Consequences of Leaving Unresolved** | Registered users experience dead-end authentication (sign in → nowhere). Product feels broken. Post-launch rework required. |

**Classification:** HAO DECISION REQUIRED

---

### OAD-006: Minimum Viable Dashboard Scope for C6

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-006 — Minimum viable dashboard for C6 |
| **Exact Issue** | MOD-007 defines FIVE full dashboards (Shipper, Transporter, Driver, Moderator, Super Admin) each with extensive feature sets (8–12 capabilities each). C6 title is "Public Web + Authenticated Product UX Operational." Implementing five full dashboards would exceed C6 scope dramatically. What constitutes "minimum viable"? |
| **Authoritative Sources** | C6 milestone title ("Public Web + Authenticated Product UX Operational"), MOD-007 §5.1–§5.5 (five role dashboards), PROMPT 4 §ROLE-BASED UI ARCHITECTURE (route groups for each role), ESS-008 §4 (role-based UI rules), PROMPT 0 §5 (preserve accessibility, respect design system) |
| **What Documentation Establishes** | Each dashboard has distinct requirements. MOD-007 describes them as structural interaction models, not visual implementations. C6 objective implies operational authenticated experience, not necessarily five full dashboards. |
| **What Remains Unresolved** | Threshold for "operational." Is one working dashboard sufficient for C6? One per key role (Shipper, Transporter)? Generic authenticated landing for all roles? All five partially implemented? |
| **Conflict** | NONE explicit. Tension between ambitious C5 backend scope and minimal frontend reality. |
| **Impact on C6** | HIGH — Directly defines C6 implementation scope. Drastically affects increment planning and authorization package. |
| **Dependencies** | OAD-002 (ownership determines what dashboard specs to follow), OAD-007 (role-specific vs generic), backend API availability (marketplace APIs exist; others are scaffolding) |
| **Required Before C6?** | YES — Scope definition is prerequisite for authorization. |
| **Consequences of Leaving Unresolved** | C6 authorization could be over-scoped (impossible timeline) or under-scoped (delivers nothing meaningful). HAO cannot issue precise authorization without defined scope threshold. |

**Classification:** HAO DECISION REQUIRED

---

### OAD-007: Role-Specific vs Generic Authenticated Landing

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-007 — Role-specific dashboards vs generic authenticated landing |
| **Exact Issue** | Should C6 create a single generic dashboard landing page showing available modules based on role, or should each role get its own dedicated route/group? PROMPT 4 plans separate route groups `(shipper)`, `(transporter)`, `(driver)`, `(admin)`. `(dashboard)/` layout exists but is empty. |
| **Authoritative Sources** | PROMPT 4 (separate route groups per role), MOD-007 §3.1 (role-based dashboards), ESS-008 §2.3 (Role-Clarity Principle), ESS-008 §7.1 (Global Navigation must be role-based) |
| **What Documentation Establishes** | Clear intent for role-separated experiences. PROMPT 4 explicitly defines separate route groups for each role type. |
| **What Remains Unresolved** | Whether C6 should implement the full role separation or start with a unified shell that later branches into role-specific sub-pages. |
| **Conflict** | NONE. Consistent across documents toward role-specific experiences. |
| **Impact on C6** | MEDIUM. Affects `(dashboard)/layout.tsx` design and navigation structure. |
| **Dependencies** | OAD-006 (which dashboards at minimum), middleware auth wiring (required before any protected route works) |
| **Required Before C6?** | PARTIAL — Can proceed with generic shell if HAO defers role-specific branching. |
| **Consequences of Leaving Unresolved** | Dashboard shell may serve all roles generically (wasted effort if role differentiation needed) or overly complex upfront (too much work for C6 MVP). |

**Classification:** IMPLEMENTATION GAP / SCOPING DECISION

---

### OAD-008: Native Mobile vs Responsive Web Sufficiency

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-008 — Native mobile (Android/iOS) vs responsive web |
| **Exact Issue** | MOD-008 §3.1 declares "native mobile applications for Android and iOS." Development Manifest Phase 8 says mobile follows web platform completion. For C6 purposes, is responsive web sufficient, or does native mobile intent affect web architecture decisions? |
| **Authoritative Sources** | MOD-008 §3.1 ("native mobile applications for Android and iOS"), Development Manifest §6 Phase 7–8 (web→mobile sequence), PROMPT 0 v1.1 §Mobile-First Infrastructure Layer |
| **What Documentation Establishes** | Native mobile applications ARE planned. Phase 8 of development lifecycle explicitly sequences web platform maturity BEFORE mobile application development. Mobile reuses web's shared services/APIs/database/business logic. Only presentation and device capabilities differ. |
| **What Remains Unresolved** | Timeline for native mobile. Whether C6 web architecture should anticipate native mobile consumption patterns (API contract stability, token management, deep linking). |
| **Conflict** | NONE. Sequence is clearly defined: web first, then mobile. |
| **Impact on C6** | LOW-MEDIUM. C6 should follow web-first principles with reasonable assumptions about future mobile consumption but need not architect specifically for native mobile delivery. |
| **Dependencies** | Development Manifest Phase 8 (deferred), API contract stability (already established pattern) |
| **Required Before C6?** | NO — Deferred per Development Manifest. Web platform completion is prerequisite for mobile phase regardless. |
| **Consequences of Leaving Unresolved** | None for C6. Native mobile remains in Phase 8 queue. |

**Classification:** AUTHORITATIVE FACT — DEFERRED TO PHASE 8 PER EXPLICIT DOCUMENT

---

### OAD-009: Document Precedence for UI Conflicts

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-009 — Precedence order when UI governing documents conflict |
| **Exact Issue** | Four+ documents govern UI aspects: PROMPT 4 (route structure, component rules), PROMPT 5 (design system, component library), ESS-008 (UI/UX execution standards, 19 sections), MOD-007 (dashboard structure, widget model). When they disagree, which prevails? |
| **Authoritative Sources** | PROMPT 0 v1.1 §5 UI Governance (highest level rules), ESS Control Map (PROMPT 0 §1352: ESS-008 linked to MOD-007), PROMPT 0 §143–150 (authority hierarchy: PROMPT 0 > ESS > module specifications), nexcargo-boot.md §13 (prompt hierarchy awareness) |
| **What Documentation Establishes** | Implicit hierarchy exists via PROMPT 0's general authority structure: PROMPT 0 > ESS > Module Specs. PROMPT 0 §150 states conflict resolution order: PROMPT 0 > BOOT/INDEX/ESS/ARBITRATION. ESS-008 carries "execution authority" status. |
| **What Remains Unresolved** | Where PROMPT 4 and PROMPT 5 sit relative to ESS-008 in the precedence chain. Are PROMPT 4/5 implementation guides subordinate to ESS-008 execution standards? Or are they equal-tier PROMPT documents? |
| **Conflict** | IMPLICIT ONLY — No direct contradictions found in documents themselves, but no explicit precedence chain for UI-specific documents is stated. |
| **Impact on C6** | MEDIUM. During C6 implementation, developers need to know which document to consult first when requirements seem misaligned. Affects implementation speed and confidence. |
| **Dependencies** | OAD-002 (ownership determines whose interpretation is primary) |
| **Required Before C6?** | RECOMMENDED but not BLOCKING — Implicit hierarchy (PROMPT 0 > ESS > PROMPT > MOD) can guide implementation if HAO confirms it. |
| **Consequences of Leaving Unresolved** | Developers may follow conflicting instructions. Rework risk when precedence clarification emerges mid-implementation. |

**Classification:** DOCUMENTATION GAP / BEST-PRACTICE RECOMMENDATION FOR HAO CONFIRMATION

---

### OAD-010: Component Library Build Approach

| Field | Detail |
|-------|--------|
| **Decision ID / Title** | OAD-010 — Component library: scratch-built vs existing library |
| **Exact Issue** | ESS-008 §3.1 states "ALL styling MUST use Tailwind CSS, no inline styles, no external CSS frameworks." The question is whether pre-built UI component libraries (shadcn/ui, Radix, Chakra UI, etc.) qualify as "external CSS frameworks" or as independent component abstractions built on top of Tailwind. |
| **Authoritative Sources** | ESS-008 §3.1 (Tailwind-first rule), PROMPT 5 §COMPONENT LIBRARY (requires Button, Table, Card, Modal, Form, Badge systems), PROMPT 5 §CRITICAL CONSTRAINTS ("no external CSS frameworks", "use Tailwind CSS as the primary styling system") |
| **What Documentation Establishes** | Tailwind CSS IS the mandated styling system. No pre-built component library is specified. PROMPT 5 expects components to be built on the Tailwind foundation. |
| **What Remains Unresolved** | Definition boundary: What counts as a "CSS framework" versus a "component library"? shadcn/ui is a component library that uses Tailwind (not a CSS framework). Chakra UI wraps Tailwind AND provides its own theming (closer to CSS framework). The distinction is architecturally significant. |
| **Conflict** | AMBIGUITY — ESS-008/PROMPT 5 prohibit "external CSS frameworks" but do not address component libraries that consume/build upon Tailwind. Both scratch-built AND tailwind-native component libraries comply with spirit of the constraint. |
| **Impact on C6** | MEDIUM. Scratch-built: slower initial progress, full control. Existing library: faster delivery, potential maintenance dependency, must verify Tailwind purity. |
| **Dependencies** | OAD-002 (who decides?), NPM ecosystem landscape, team skill assessment |
| **Required Before C6?** | YES — Affects C6 III increment (component primitives). Implementation approach must be decided before component coding begins. |
| **Consequences of Leaving Unresolved** | Implementation stalls while team debates approach. Risk of building components that later require migration if different strategy chosen. |

**Classification:** IMPLEMENTATION GAP / TECHNICAL DECISION

---

## D. OAD → C6 Impact Matrix

| OAD | Required Before C6? | Impact Level | Blocking? | C6 Increment Affected |
|-----|-------------------|-------------|-----------|---------------------|
| OAD-001 (Landing page route placement) | NO | LOW | NO | C6-I (partial — existing landing stays) |
| OAD-002 (Public UI ownership) | YES | CRITICAL | YES | ALL increments — no architectural anchor without this |
| OAD-003 (Anonymous marketplace access) | YES | MEDIUM | YES | C6-I (CTAs, landing page messaging, public info pages) |
| OAD-004 (Role selection during registration) | YES | HIGH | YES | C6-I (register page design) |
| OAD-005 (Post-registration onboarding) | PARTIAL | HIGH | CONDITIONAL | C6-I/C6-II (post-login redirect targets) |
| OAD-006 (Minimum dashboard scope) | YES | HIGH | YES | C6-III (dashboard shell content) |
| OAD-007 (Role-specific vs generic dashboard) | PARTIAL | MEDIUM | CONDITIONAL | C6-III (dashboard layout structure) |
| OAD-008 (Native mobile vs responsive web) | NO | LOW | NO | N/A — deferred per Manifest Phase 8 |
| OAD-009 (Document precedence) | RECOMMENDED | MEDIUM | NO | ALL (implementation clarity) |
| OAD-010 (Component library approach) | YES | MEDIUM | YES | C6-III (component primitive strategy) |

**Summary:**
- **CRITICAL/BLOCKING:** OAD-002 (only one)
- **HIGH/BLOCKING:** OAD-003, OAD-004, OAD-006
- **MEDIUM/CONDITIONAL:** OAD-005, OAD-007, OAD-009, OAD-010
- **LOW/NON-BLOCKING:** OAD-001, OAD-008

---

## E. Critical Decisions Required Before C6 Authorization

The following decisions are prerequisites for the HAO to issue a valid C6 authorization. Each represents a point where C6 cannot be properly scoped or validated without an HAO determination.

### Tier 1 — Absolute Prerequisites (Must Be Resolved Before Authorization)

1. **OAD-002:** Assign ownership of the public-facing interface. Without this, C6 has no architectural anchor, no single authoritative specification to target, and no accountable deliverable owner.

2. **OAD-003:** Decide whether non-authenticated users may browse marketplace listings/discover cargo loads. This fundamentally shapes the landing page, CTAs, and public experience architecture.

3. **OAD-004:** Decide how users select their role during registration. This determines register page structure and post-registration behavior.

### Tier 2 — High Priority (Should Be Resolved Before Authorization)

4. **OAD-006:** Define minimum viable dashboard scope for C6. Determines whether C6 delivers one dashboard, several, or a generic shell. Drastically affects increment sizing.

5. **OAD-010:** Decide component library build approach (scratch vs existing Tailwind-native library). Affects C6-III implementation velocity and quality floor.

### Tier 3 — Clarifying (Can Proceed With Assumptions, But Resolution Recommended)

6. **OAD-005:** Partially resolved — C6 can proceed with generic post-login redirect if full onboarding flow is deferred. Full resolution recommended for consistency.

7. **OAD-007:** Clarification recommended — role-specific vs generic dashboard structure. Can default to generic shell for C6 if HAO prefers minimal scope.

8. **OAD-009:** Confirmation of implied precedence chain recommended. No blocker if implicit hierarchy accepted.

9. **OAD-001:** Accept current `[locale]/page.tsx` placement as acceptable deviation, or mandate move to `(public)/`. Functional equivalency either way.

10. **OAD-008:** Already resolved by documents — deferred to Phase 8 per explicit Development Manifest statement.

---

## F. Wave 5 Increment 3 Reassessment

### Current Status
- **Wave 5 Increment 3: NOT AUTHORIZED. NOT IMPLEMENTED.**
- Documented in `docs/governance/nexcargo-development-state.md`: "Wave 5 Increment 3: NOT AUTHORIZED"
- Also confirmed in `docs/implementations/c2-003-completion-report.md`: "Wave 5 Increment 3 | ❌ NOT AUTHORIZED/NOT IMPLEMENTED"

### Wave 5 Context
- Wave 5 itself is **AUTHORIZED CONDITIONAL ON ENTRY CRITERIA** (HAO-WAVE5-AUTH-001, 2026-09-01)
- Wave 5 Increments 1 and 2 were implemented (MOD-011 adapters/gateway/contracts/tests + MOD-017 metrics/tracing/health runtime)
- Increment 3 has never been scoped, authorized, or discussed in any governance decision record
- Wave 5 scope covers: MOD-011 actual external integrations + MOD-017 full production observability

### Relevance to C6 OADs

| OAD | Relevant to Wave 5 Inc 3? | Assessment |
|-----|-------------------------|------------|
| OAD-002 (Public UI ownership) | NO | Wave 5 Inc 3 concerns external integrations and production observability, neither of which addresses public interface ownership |
| OAD-003 (Anonymous marketplace access) | NO | External integrations (banks, payment providers, customs, logistics) are unrelated to anonymous browsing policy |
| OAD-004 (Role selection) | NO | Registration/role selection is a web UI concern, unrelated to Wave 5 scope |
| OAD-005 (Onboarding flow) | NO | Onboarding is a web UX concern, unrelated to Wave 5 scope |
| OAD-006 (Dashboard scope) | NO | Dashboards belong to MOD-007/Web UX, unrelated to Wave 5 scope |
| OAD-007 (Role-specific dashboard) | NO | Same as above |
| OAD-008 (Mobile vs responsive) | NO | Already resolved per Manifest |
| OAD-009 (Document precedence) | NO | Governance structure question, unrelated to Wave 5 |
| OAD-010 (Component library) | NO | Design system decision, unrelated to Wave 5 |

### Conclusion on Wave 5 Increment 3

**NO unresolved OAD genuinely makes Wave 5 Increment 3 relevant to C6.** The two tracks address entirely separate domains:
- **C6** = Public Web + Authenticated Product UX (presentation layer, user interfaces, authentication flows)
- **Wave 5 Inc 3** = MOD-011 external integrations + MOD-017 production observability enhancement (backend infrastructure, third-party connectors, monitoring surface expansion)

There is NO documented relationship, dependency, overlap, or cross-reference between Wave 5 Increment 3 (which does not exist as a defined scope item) and any C6 requirement or OAD.

**Recommendation for HAO consideration (not decision):** Wave 5 Increment 3 should be addressed independently when Wave 5 entry criteria are satisfied and a separate authorization package is prepared. It bears zero relevance to C6 preparation, authorization, or boundary definition.

---

## G. Consolidated HAO Decision List

Below is the ordered list of decisions the HAO must make regarding C6. These are presented for HAO deliberation. **No decisions are made herein.**

### Immediate Decisions (Block C6 Authorization Until Resolved)

| # | Decision | Reference | Options Presented | Recommendation Tag |
|---|---------|-----------|------------------|-------------------|
| **H-01** | Assign ownership of the public-facing interface (landing page, auth pages, public info pages, public discovery) | OAD-002 | (a) Create new MOD-N for public experience<br>(b) Assign to existing MOD-007 with expanded scope<br>(c) Assign to PROMPT 4 structural layer as standalone<br>(d) Other | None — Awaiting HAO judgment |
| **H-02** | Permit non-authenticated users to browse marketplace listings/search offers | OAD-003 | (a) Yes — public discovery before authentication<br>(b) No — authenticated-only marketplace | None — Awaiting HAO judgment |
| **H-03** | Specify how new users select their role during registration | OAD-004 | (a) Self-selection during registration (dropdown/radio/wizard)<br>(b) Admin-invitation only (no role choice at registration)<br>(c) Role assignment post-onboarding<br>(d) Multi-role support | None — Awaiting HAO judgment |

### Priority Decisions (Recommended Before Authorization)

| # | Decision | Reference | Options Presented | Recommendation Tag |
|---|---------|-----------|------------------|-------------------|
| **H-04** | Define minimum viable dashboard scope for C6 | OAD-006 | (a) Single generic authenticated shell for all roles<br>(b) One role-specific dashboard per key role (Shipper + Transporter minimum)<br>(c) All five MOD-007 dashboards (full scope — likely too large for C6)<br>(d) Hybrid: generic shell + one exemplar role dashboard | None — Awaiting HAO judgment |
| **H-05** | Decide component library build approach | OAD-010 | (a) Scratch-built components using Tailwind only<br>(b) Adopt Tailwind-native component library (e.g., shadcn/ui, Radix Primitive + Tailwind classes)<br>(c) Hybrid: scratch for critical paths, library for decorative elements | None — Awaiting HAO judgment |

### Clarifying Decisions (Recommended, Not Blocking)

| # | Decision | Reference | Options Presented | Recommendation Tag |
|---|---------|-----------|------------------|-------------------|
| **H-06** | Confirm or modify landing page route placement | OAD-001 | (a) Keep `[locale]/page.tsx` (accept deviation from PROMPT 4)<br>(b) Move to `(public)/` (align with PROMPT 4) | None — Awaiting HAO judgment |
| **H-07** | Define post-registration onboarding scope for C6 | OAD-005 | (a) Include basic onboarding (profile setup + language selection)<br>(b) Skip onboarding — direct to dashboard<br>(c) Defer onboarding entirely to later milestone | None — Awaiting HAO judgment |
| **H-08** | Determine dashboard structure: role-specific vs generic | OAD-007 | (a) Generic dashboard shell for all roles<br>(b) Role-specific route groups per PROMPT 4<br>(c) Single shell that adapts content by role | None — Awaiting HAO judgment |
| **H-09** | Confirm UI document precedence chain | OAD-009 | (a) Confirm implicit chain: PROMPT 0 > ESS-008 > PROMPT 4/5 > MOD-007<br>(b) Redefine explicit precedence chain<br>(c) Leave as-is (implicit) | None — Awaiting HAO judgment |
| **H-10** | Acknowledge mobile/mobile-app timeline | OAD-008 | (a) Acknowledge deferred per Development Manifest Phase 8<br>(b) Accelerate mobile decision | None — Awaiting HAO judgment |

### Separate Track Decision

| # | Decision | Reference | Notes |
|---|---------|-----------|-------|
| **H-11** | Wave 5 Increment 3 scope and authorization | N/A | Independent of C6. Wave 5 Inc 3 has no defined scope, no documented relationship to C6, and zero blocking OAD relevance. Should be handled in separate Wave 5 entry-criteria authorization cycle. |

---

*End of C6 Architectural Adjudication Brief. This document presents analysis only. No decisions are made. No C6 implementation is authorized. No Wave 5 Increment 3 revival is proposed. Awaiting HAO review and decisions.*
