# C6 Architecture Reconciliation Report

**Document Type:** Documentation-Only Reconciliation  
**Date:** 2026-09-09  
**Status:** AWAITING DOCUMENT UPDATES PER HAO DIRECTIVE  
**Basis:** HAO Directives H-01 through H-05 and H-11  
**Predecessor Reports:**  
- C6 Readiness & Boundary Analysis (`docs/governance/c6-readiness-boundary-analysis.md`)  
- UI/UX Interface Recovery Audit (`docs/governance/uiux-interface-recovery-audit.md`)  
- C6 Architectural Adjudication Brief (`docs/governance/c6-architectural-adjudication-brief.md`)  

---

## Classification Legend

| Code | Meaning |
|------|---------|
| **A** | Authoritatively specified (in existing or updated specs) |
| **B** | Implied by existing documents |
| **C** | Already implemented in codebase |
| **D** | Not implemented |
| **E** | Contradicted by existing specifications |
| **F** | Unspecified in any document |

---

## A. C6 Architecture Reconciliation Report

### 1. C0–C5 Baseline (Unchanged)

All milestones C0 through C5 remain COMPLETE / VERIFIED / CLOSED per `docs/governance/nexcargo-development-state.md` (last updated 2026-09-09). No modifications to C0–C5 status are proposed or required by this reconciliation.

| Milestone | Status |
|-----------|--------|
| C0 – Foundation | CLOSED |
| C1 – Marketplace RLS & Auth Hardening | CLOSED |
| C2 – Marketplace → Booking Vertical Slice | CLOSED |
| C3 – Booking → Contract → Escrow Integration | CLOSED |
| C4 – Payment → Financial Execution | CLOSED |
| C5 – Notifications + Observability | CLOSED |

Quality gates: TypeScript 0 errors; 70 test files, 1,454 passing; Track B frozen at `4153dc0`.

### 2. Impact of HAO Decisions on Existing Documents

#### H-01 / OAD-002: Public-Facing UI Ownership → Platform-Level Layer

**What the HAO decided:** Public-facing UI ownership shall be a platform-level Public Web / Product UX ownership layer. It shall NOT be assigned to MOD-001 or MOD-007.

**Documents affected by this decision:**

| Document | Section | Current Statement | Post-HAO Assessment | Action Required |
|----------|---------|------------------|--------------------|----------------|
| **nexcargo-index.md §8 Product Capability Registry** | MOD-007 = Presentation domain | Assigns MOD-007 to "Presentation" | IMPLICITLY RESOLVED — MOD-007 handles authenticated dashboards (application presentation), while a new platform-level layer owns public web. No contradiction if "Presentation" in INDEX scope is clarified. | UPDATE INDEX to distinguish: MOD-007 = Application Presentation (authenticated); NEW ENTITY = Platform/Public Presentation |
| **nexcargo-index.md §9 Module Registry** | MOD-007 domain = "Presentation" | Same as above | Same as above | Same as above |
| **MOD-007 spec §2 Purpose** | "It does not define visual design implementation or frontend frameworks" | Already disclaims visual/frontend | SUPPORTS HAO decision — confirms MOD-007 is NOT appropriate owner for public web | NO CHANGE NEEDED |
| **MOD-007 spec §9 Integration Boundaries** | Lists MOD-007 owning "all user dashboards" | Authenticated-only | UNCHANGED — MOD-007 retains dashboard ownership, which is authenticated application layer | NO CHANGE NEEDED |
| **BRAND_UIUX_AUDIT_REPORT §1.5** | "UI/UX requirements are well-owned" with MOD-007 as application-layer authority | Partially correct pre-HAO | NEEDS UPDATE — MOD-007 is application-layer for AUTHENTICATED dashboards; public web has separate platform ownership | UPDATE TO CLARIFY TWO LAYER MODEL |
| **PROMPT 4 §PURPOSE** | "Creating the frontend structural layer" including role-based dashboards | No module assignment | CONSISTENT with HAO decision — PROMPT 4 defines STRUCTURE, not module ownership | NO CHANGE NEEDED (PROMPT 4 is generation guidance, not ownership assignment) |
| **ESS-008 §18 Module UI Responsibility Matrix** | All 18 modules mapped to UI surfaces | Does not include public/web surfaces | GAP — matrix omits platform/public interface layer | ADD ROW FOR PLATFORM/PUBLIC WEB LAYER |

**Contradictions introduced:** NONE. H-01 resolves the gap identified in OAD-002 rather than creating one.

#### H-02 / OAD-003: Anonymous Users May Access Public Discovery/Browsing

**What the HAO decided:** Anonymous users may access public discovery/browsing functionality. Transactional actions shall require authentication and authorization.

**Documents affected by this decision:**

| Document | Section | Current Statement | Post-HAO Assessment | Action Required |
|----------|---------|------------------|--------------------|----------------|
| **MOD-007 §6.3 RBAC Visibility** | "hiding unauthorized actions from view" | Suggests authenticated-only | REQUIRES CLARIFICATION — "unauthorized actions" ≠ "unauthenticated browsing." Browsing listings is a passive action; creating/booketing is transactional. This distinction must be documented. | ADD CLARIFICATION TO MOD-007 OR CREATE PUBLIC DISCOVERY SPEC |
| **MOD-007 §7.1 UI is NOT Security Layer** | "Backend enforces security. UI only reflects access constraints." | CONSISTENT | CONFIRMED — Backend enforces what anonymous vs authenticated users can do; UI simply hides/shows accordingly | NO CHANGE NEEDED |
| **ESS-008 §2.3 Role-Clarity Principle** | "No role sees functionality they cannot use" | Applies to roles | EXTENDABLE — Null/unauthenticated state is also a valid classification; anonymous users see different content than logged-in users | POSSIBLE UPDATE IF ESS-008 interpreted strictly |
| **PROMPT 4 §RBAC UI ENFORCEMENT** | "Each route MUST enforce: authentication, role validation, permission checks" | Requires auth on routes | REQUIRES AMENDMENT — `(public)` routes should NOT enforce authentication. Only transactional routes should. Current blanket statement is too broad. | AMEND PROMPT 4 or create clarification: "(public) routes exempt from auth enforcement; authenticated routes enforced" |
| **ESS-006 §16 Module Security Responsibility Matrix** | Per-module security duties | No explicit public/discovery entry | MISSING — No document specifies who governs public discovery security rules | ADD TO ESS-006 MATRIX |
| **INDEX §8 Product Capability Registry** | No public discovery entry | Capability registry incomplete for public-facing | MISSING CAPABILITY | ADD "Public Discovery/Browsing" capability entry |

**Contradictions:** 
- MOD-007 §6.3 "hiding unauthorized actions" now ambiguously includes/excludes anonymous browsing depending on interpretation.
- PROMPT 4 blanket auth enforcement conflicts with H-02 public discovery intent.

#### H-03 / OAD-004: Role Selection During Registration

**What the HAO decided:** User role selection shall occur during registration, followed by role-specific profile/onboarding completion.

**Documents affected by this decision:**

| Document | Section | Current Statement | Post-HAO Assessment | Action Required |
|----------|---------|------------------|--------------------|----------------|
| **shared/types/enums.ts UserRole enum** | SHIPPER/TRANSPORTER/DRIVER/DISPATCHER/MODERATOR/ADMIN/SUPER_ADMIN | Enum values defined | CONSISTENT | NO CHANGE NEEDED |
| **HAO PE-H04 (from nexcargo-development-state.md)** | role = null = unassigned/onboarding state | Null role implies pending | NOW SUPPLEMENTED — role selection happens AT registration; null is transient between registration and onboarding completion | DOCUMENT CLARIFICATION IN API-Auth layer docs |
| **api-auth.ts getApiAuthContext** | `role: user.user_metadata?.role ?? null` | Read role from metadata | **SUPERSEDED 2026-11-05 by NXC I-1** — the CONSISTENT assessment is withdrawn. `user_metadata` is client-writable, so it cannot be role authority. The statement recorded here also describes the pre-I-1 code, not current code. | CODE CHANGE APPLIED — `getApiAuthContext` now resolves role from the database resolvers (`public.effective_marketplace_role()` for SHIPPER/TRANSPORTER, `public.effective_user_role()` for platform tiers) via `web/src/lib/auth/role-authority.ts`; no metadata role is read. |
| **MOD-007 §5.1–§5.5** | Dashboards assume known role context | Dashboard View Object uses roleContext | REQUIRES AMENDMENT — registration creates provisional role selection that becomes confirmed after profile/onboarding step | ADD POST-REGISTRATION ONBOARDING STATE TO MOD-007 |
| **PROMPT 7 (Auth + RBAC)** | Defines auth mechanisms, role taxonomy | No registration flow detail | GAPPED — No document describes registration page design or role-selection UI | CREATION OF REGISTRATION FLOW SPEC NEEDED |
| **nexcargo-development-state.md Known Issues BLK-001 through BLK-011** | No blocker about role selection | Previously classified as gap | NOW RESOLVED BY HAO DECISION | UPDATE DEVELOPMENT STATE — mark role selection decision as resolved by HAO directive |

**Contradictions:** None. Decision fills a documented gap (OAD-004).

#### H-04 / OAD-006: C6 Dashboard Scope Limited to Operational Shell + MVP Role Dashboard

**What the HAO decided:** C6 dashboard scope is limited to operational authenticated shell, role-aware navigation and minimum viable role dashboard. C6 shall NOT implement all future domain-module functionality.

**Documents affected by this decision:**

| Document | Section | Current Statement | Post-HAO Assessment | Action Required |
|----------|---------|------------------|--------------------|----------------|
| **MOD-007 §5.1–§5.5** | Five full dashboards defined | Each has 8–12 capabilities listed | NOT CHANGED — MOD-007 defines the FULL target state. C6 implements a SUBSET as a milestone gate. MOD-007 remains authoritative for long-term scope. | NO CHANGE to MOD-007; ADD C6 SCOPE CLARIFICATION to development state |
| **PROMPT 4 §ROLE-BASED UI ARCHITECTURE** | Separate route groups per role | Full implementation plan | IMPLIES FULL IMPLEMENTATION but does NOT prescribe milestone timing | POSSIBLE CLARIFICATION NEEDED: distinguish architecture blueprint from milestone scope |
| **ESS-008 §4 Role-Based UI Rules** | Must prioritise specific features per role | Full feature sets | NOT CHANGED — these define END STATE, not C6 milestone scope | NO CHANGE NEEDED |
| **C6 Readiness & Boundary Analysis (§C)** | Proposed ACs reference full dashboard | Over-scoped vs HAO decision | CONFLICT WITH HAO DECISION | UPDATE C6 ACCEPTANCE CRITERIA to match HAO scope limitation |
| **nexcargo-development-state.md Continuity Notes** | Next governance gate references Wave 5 Inc 3 OR C6 | Unspecified C6 scope | NEEDS UPDATE | DEFINE C6 SCOPE PER HAO DECISION |

**Contradictions:** C6 Readiness & Boundary Analysis over-scopes C6 relative to HAO decision.

#### H-05 / OAD-010: NexCargo-Owned Component Primitives Layer on Tailwind

**What the HAO decided:** NexCargo shall use a NexCargo-owned reusable component/primitives layer built on the existing Tailwind foundation. Do not introduce a heavyweight external UI framework unless separately authorised.

**Documents affected by this decision:**

| Document | Section | Current Statement | Post-HAO Assessment | Action Required |
|----------|---------|------------------|--------------------|----------------|
| **ESS-008 §3.1 Tailwind-First Rule** | "ALL styling MUST use Tailwind CSS, no inline styles, no external CSS frameworks" | Explicit prohibition of external CSS frameworks | NOW SUPPLEMENTED — component primitives are allowed, but must be NexCargo-owned and build on Tailwind, not wrapped around another framework | ADD CLARIFICATION: "Component libraries consuming/extending Tailwind are permitted; CSS frameworks providing alternative theming are not" |
| **PROMPT 5 §CRITICAL CONSTRAINTS** | "Use Tailwind CSS as primary styling system", "no external CSS frameworks" | Same prohibition | CONSISTENT with HAO decision | NO CHANGE NEEDED |
| **PROMPT 5 §COMPONENT LIBRARY STRUCTURE** | `/shared/ui/components/`, `/primitives/`, `/layouts/` etc. | Defines expected component locations | AUTHORITATIVE — aligns with NexCargo-owned primitives location | NO CHANGE NEEDED |
| **PROMPT 5 §DESIGN TOKENS** | Centralized token system for colors, spacing, typography, radius, shadow | Design system architecture | AUTHORITATIVE — tokens define the NexCargo design system foundation | NO CHANGE NEEDED |
| **globals.css** | Minimal custom properties only | Basic light/dark mode | CURRENT STATE — insufficient per PROMPT 5 token requirements; reconciliation confirms these tokens must be created | NO CHANGE to reconciled docs (implementation observation) |

**Contradictions:** None. HAO decision resolves the ambiguity in OAD-010 and aligns with existing Tailwind-first mandate.

#### H-11: Brand Styling & Visual Identity Adoption

**What the HAO decided:** Adopted as INITIAL brand/visual baseline (subject to final HAO approval/amendment). Wordmark: "NexCargo" with capital N and C. Independent symbol required for mobile/app use. Final logo/visual assets subject to explicit HAO approval. Not permission to implement automatically.

**Documents affected by this decision:**

| Document | Section | Current Statement | Post-HAO Assessment | Action Required |
|----------|---------|------------------|--------------------|----------------|
| **BRAND_UIUX_AUDIT_REPORT §2** | Consolidated Brand Usage Register (B-001 through B-028) | Confirms NexCargo title-case consistency | NOW SUPERSEDED AS PRELIMINARY AUDIT — decisions in register confirmed and formalised by HAO directive | ADD HAO DECISION REFERENCE SECTION documenting adoption |
| **BRAND_UIUX_AUDIT REPORT §1.1** | Primary finding: HAO-supplied brand decision already consistent convention | Correct conclusion | VALIDATED by HAO confirmation | UPDATE TO REFLECT HAO FORMAL ADOPTION |
| **BRAND_UIUX_AUDIT §1.4 Contradiction A** | README vs PROMPT 0 on product positioning | README claims "Enterprise-grade cargo marketplace platform"; PROMPT 0 says "NOT freight forwarder, insurer, bank or trucking company" | PERSISTS — requires resolution regardless of HAO brand decision. H-11 does not resolve README contradiction | REMAINS OPEN — SEPARATE HAO DECISION REQUIRED (not addressed by brand directives) |
| **BRAND_UIUX_AUDIT §1.7 HAO Decisions Required** | Two items: CargoLink status and "Nexcargo" legacy variant | Pending HAO decisions | ONE RESOLVED BY HAO-WIDE STANDARDIZATION; CargoLink item remains unresolved | UPDATE: mark "Nexcargo" standardization as resolved by H-11; CargoLink still requires decision |
| **README.md Line 5** | "### The CargoLink Marketplace" | Subtitle reference | CONTRADICTION WITH HAO WORDMARK DECISION | MARK FOR REVIEW — is "CargoLink" an approved sub-brand or deprecated term? |
| **nexcargo-ai-eprs.md Line 1** | "Nexcargo" (lowercase-except-first) | Typographical error | ERRONEOUS — contradicts HAO wordmark | CORRECTION RECOMMENDED to "NexCargo" |
| **web/src/app/[locale]/layout.tsx Line 18** | "NexCargo — AI-Native Logistics Marketplace" | Browser tab title | CONSISTENT with HAO wordmark | NO CHANGE NEEDED |
| **All layout files ((public), (auth), (dashboard))** | "NexCargo — [context]" titles | Consistent usage | CONSISTENT with HAO wordmark | NO CHANGE NEEDED |
| **web/.env.local NEXT_PUBLIC_APP_NAME** | "NexCargo" | Runtime name | CONSISTENT | NO CHANGE NEEDED |

**Contradictions:** README.md line 5 ("CargoLink") persists as unauthorised brand variant.

### 3. Authoritative Ownership Model (Post-HAO Reconciliation)

| Aspect | Owner | Authority Level | Supporting Documents |
|--------|-------|----------------|---------------------|
| **Brand Identity (wordmark, symbol, logo, color palette, typography, visual language)** | HAO (governing authority) + Platform-level Design System Layer | HAO decides; Platform layer implements | H-11 directive; ESS-008 §3; PROMPT 5 |
| **Design System (tokens, primitives, component library)** | Platform-level Design System Layer | Built on Tailwind; NexCargo-owned | PROMPT 5 (design tokens, component structure); ESS-008 §3.1; HAO-H-05 |
| **Public Web (landing, public info, discovery pages, marketing surfaces)** | Platform-level Public Web / Product UX Layer | Distinct from all MOD-N modules | HAO-H-01; PROMPT 4 (route structure); ESS-008 (applies cross-cutting) |
| **Authentication Entry (sign-in, register, forgot-password, reset-password pages)** | Platform-level Public Web / Product UX Layer + PROMPT 7 (auth mechanisms) | Pages owned by Public Web; auth mechanism governed by PROMPT 7 | HAO-H-03; PROMPT 4 §(auth); PROMPT 7 |
| **Onboarding (post-registration profile setup, verification, guided first use)** | Platform-level Onboarding Flow Layer (new — neither MOD-007 nor Public Web alone) | Bridges registration to authenticated dashboard | Inferred from HAO-H-03; NOT explicitly assigned yet |
| **Authenticated Application Shell (post-login navigation, sidebar, topbar, global header)** | MOD-007 (User Dashboards & Experience) | MOD-007 owns authenticated UX structure | MOD-007 §§3,6,7,9; INDEX §9 |
| **Role Dashboards (Shipper, Transporter, Driver, Moderator, Super Admin)** | MOD-007 (User Dashboards & Experience) | Clear and established | MOD-007 §§4,5; ESS-008 §4; INDEX §8 |
| **Domain-Module UI Surfaces (marketplace display, tracking views, financial views, etc.)** | Individual MOD-N modules | Each module owns its data; MOD-007 owns rendering/presentation coordination | MOD-007 §9 integration boundaries; ESS-008 §18 Module UI Responsibility Matrix |
| **Mobile Applications (native Android/iOS)** | MOD-008 (Mobile Applications & Edge Operations) | Deferred to Development Manifest Phase 8 | MOD-008 §3; Manifest §6 Phase 7–8 |
| **Internationalisation/Localization (i18n infrastructure, pt/en, locale formatting)** | MOD-007 (language preference management) + Platform layer (infrastructure) | Shared responsibility | ESS-008 §17; MOD-007 §7.8; MOD-009 §19; ESS-009 §19 |
| **Notification Delivery UI** | MOD-016 (communication orchestration) + MOD-007 (presentation) | MOD-016 owns delivery logic; MOD-007 owns in-app notification display | MOD-007 §9; MOD-016 §3.7 |
| **AI Insight Rendering** | MOD-006 (source intelligence) + MOD-007 (rendering/advisory labeling) | Shared | MOD-007 §7.5; ESS-008 §12 |

**Key Structural Clarification:**

```
AUTHORITATIVE OWNERSHIP HIERARCHY (POST-HAO):

HAO (Governance)
├── Brand Identity (H-11) — wordmark, symbol, logo, colors, typography
├── Design System — tokens, primitives, component library (TAILWIND FOUNDATION)
├── Platform Layer
│   ├── Public Web — landing, public info, discovery, auth entry points
│   ├── Authentication Entry — sign-in, register, password recovery
│   ├── Onboarding Flow — post-registration journey (bridges public→authenticated)
│   └── Global Navigation Shell — shared sidebar/topbar/header (renders per-role)
├── MOD-007 — Authenticated UX (dashboards, widgets, AI rendering, i18n prefs)
├── MOD-001..MOD-018 — Domain-module UI surfaces (data binding, display responsibility)
├── MOD-008 — Mobile Applications (deferred Phase 8)
└── ESS Documents — Cross-cutting constraints (apply to ALL layers)
```

This hierarchy is NOT present in any current document and REQUIRES DOCUMENTATION ADDITION to INDEX and governance layer.

### 4. Authoritative C6 Scope and Boundary

**Defined by HAO-H-04:** C6 dashboard scope is limited to operational authenticated shell, role-aware navigation and minimum viable role dashboard.

#### C6 IN SCOPE (what C6 delivers):

1. **Public Web Foundation**
   - Updated landing page with NexCargo branding (consistent with HAO-H-11 wordmark)
   - Functional authentication pages: sign-in, register (with role selection per HAO-H-03), forgot-password
   - Sign-out functionality from authenticated pages
   - Public discovery/browsing surface enabling anonymous access to basic listings search (per HAO-H-02)

2. **Authenticated Shell**
   - Global navigation framework (sidebar/sidebar-less responsive layout)
   - Top bar with user identity, language switcher (pt/en)
   - Role-aware menu (visible items based on UserRole)
   - Protected route middleware (authentication enforcement per HAO-H-02)
   - Post-login redirect to role-specific destination

3. **Minimum Viable Role Dashboard**
   - One exemplar role dashboard implementing the MOD-007 dashboard pattern (Shipper recommended as exemplar per its breadth of capability coverage)
   - Demonstrates widget model (TABLE, KPI, LIST types from MOD-007 §4.2)
   - Demonstrates module-to-widget binding (per MOD-007 §7.2 Data Binding Rule)
   - Uses NexCargo-owned component primitives (per HAO-H-05)

4. **Component Primitives Layer (NexCargo-owned)**
   - Button, Card, Badge, Skeleton/Spinner, Link, Form controls (text, input, select)
   - Built on Tailwind foundation per HAO-H-05
   - Located under `/shared/ui/` per PROMPT 5 structure
   - Implements minimal design tokens from PROMPT 5 (§colors, spacing, typography)

5. **Error/Loading States**
   - 404 page, 403/unauthorized page (per ESS-008 §14)
   - Loading skeleton patterns (per ESS-008 §9)

#### C6 OUT OF SCOPE (explicitly excluded):

- Full Shipper/Transporter/Moderator/Admin dashboards (beyond the one exemplar)
- Module-specific dashboard content beyond the exemplar
- Native mobile applications (Phase 8, per Development Manifest)
- Complete onboarding flow beyond role selection during registration
- Brand asset creation (logo, symbols, full color palette — subject to separate HAO approval per H-11)
- PWA service workers / offline storage
- Analytics/reports charting
- Notification inbox/UI consumption (beyond basic indicator)
- Support/dispute chat interface (MOD-015)
- Payment/escrow UI flows
- Any Wave 5 scope (external integrations, production observability expansion)
- Database schema changes unrelated to auth/onboarding
- Changes to Track B (module.config.ts)

### 5. Correct C6 Implementation Increments (Post-Reconciliation)

Based on HAO decisions, the following increments provide logical, verifiable boundaries:

**C6-I: Public Surface + Authentication Foundation**

Deliverables:
- Sign-in page (email/password, Supabase auth integration)
- Register page (account creation + role selection per HAO-H-03)
- Forgot-password page (password recovery email)
- Sign-out functionality
- Updated landing page (NexCargo branding, CTAs per HAO-H-02)
- Basic public information pages (about/privacy/terms as structural stubs)
- Middleware auth guard protecting protected routes
- Session restoration on page refresh

Boundary: Anonymous users can reach landing page and auth pages. After auth, redirect to authenticated shell.

**C6-II: Authenticated Shell + Component Primitives**

Deliverables:
- Middleware enforcement fully active (auth routes protected)
- Global navigation framework (sidebar or horizontal nav, responsive)
- Top bar (user identity, language switcher pt/en)
- Post-login redirect (role-aware routing)
- NexCargo component primitives layer (Button, Card, Badge, Skeleton, Spinner, Form controls, Link)
- Error pages (404, 403/unauthorized)
- Role-aware menu visibility

Boundary: Authenticated users see navigable shell with role-appropriate menus. Components available for dashboard population.

**C6-III: Minimum Viable Role Dashboard (Exemplar)**

Deliverables:
- One exemplar role dashboard (Shipper recommended) using MOD-007 dashboard pattern
- Widget implementations: TABLE, KPI, LIST (per MOD-007 §4.2)
- Module data binding demonstration (per MOD-007 §7.2)
- Role-based access control rendered in UI (per MOD-007 §6.3)
- Loading states and empty states on dashboard widgets
- Accessibility compliance baseline (WCAG 2.1 minimum per PROMPT 5)

Boundary: Single working dashboard demonstrates complete pattern. Template for future role dashboards.

**Increment Relationships:**
- C6-I → C6-II → C6-III are sequential dependencies (auth before shell, shell before dashboard)
- Each increment is independently deployable and verifiable
- None requires database migration beyond what already exists

### 6. Remaining HAO Decisions Required Before C6-I

| Decision ID | Description | Source | Blocking C6-I? |
|------------|-------------|--------|---------------|
| **RAD-001** | Official status of "CargoLink" reference in README.md line 5 — is it an approved sub-brand, deprecated, or error? | BRAND_UIUX_AUDIT_REPORT §1.4 Contradiction A | PARTIAL — Does not block C6 implementation but affects README alignment |
| **RAD-002** | Who specifically OWNS the onboarding flow documentation/spec? Is it the Public Web layer, MOD-007, or a new onboarding entity? | Derived from ownership model gap (Section 3 above) | CONDITIONAL — C6 can proceed with role-selection-at-registration only; full onboarding spec deferred |
| **RAD-003** | Which single role receives the exemplar dashboard in C6-III? Shipper, Transporter, or another? | C6-III scoping | NO — Can default to Shipper if HAO defers this choice |
| **RAD-004** | Confirmation that PROMPT 4 and PROMPT 5 retain their status as GENERATION PROMPTS (not normative specifications) and should defer to ESS-008 for requirements | BRAND_UIUX_AUDIT §1.5 | NO — Clarification recommended, not blocking |
| **RAD-005** | Whether "Public Discovery/Browsing" capability needs a dedicated entry in nexcargo-index.md §8 Product Capability Registry | Derived from HAO-H-02 decision | NO — Index update is housekeeping, not blocking |

---

## B. Decision Impact Matrix

| HAO Decision | Documents Resolved | Documents Superseded | Documents Contradicted | New Documents Needed | New Specifications Needed |
|-------------|-------------------|---------------------|----------------------|---------------------|--------------------------|
| **H-01** (Public UI ownership = platform layer) | MOD-007 §2 (confirms disclaimers), MOD-007 §9 (confirms dashboard ownership) | BRAND_UIUX_AUDIT §1.5 (partial supersession — MOD-007 is app-layer, not platform-layer) | NONE | nexcargo-index.md additions; governance ownership matrix addition | Public Web ownership spec; Platform layer charter |
| **H-02** (Anonymous browsing permitted) | ESS-006 §16 matrix addition needed | PROMPT 4 §RBAC UI ENFORCEMENT (blanket statement narrowed) | MOD-007 §6.3 interpretation tension (resolved via distinction: actions=auth required, browsing=anonymous OK) | Public discovery security spec | Clarification of anonymous vs authenticated visibility rules |
| **H-03** (Role selection at registration) | HAO PE-H04 (supplemented), api-auth.ts (clarified) | NONE (gap-filled) | NONE | Registration flow specification; PROMPT 7 extension | Detailed registration page spec |
| **H-04** (C6 limited dashboard scope) | C6 Readiness & Boundary Analysis (§C acceptance criteria need update) | None (specifications unchanged; C6 scope narrowed) | C6 Readiness & Boundary Analysis over-scoped assumptions | C6 milestone definition document | C6 acceptance criteria revision |
| **H-05** (NexCargo-owned primitives on Tailwind) | ESS-008 §3.1 (supplemented with clarification); PROMPT 5 (confirmed as guiding principle) | None | NONE | Component primitives layer charter | Component API contract for primitives |
| **H-11** (Brand adopted as initial baseline) | BRAND_UIUX_AUDIT §1.1 (validated); all layout files (confirmed consistent) | BRAND_UIUX_AUDIT §1.7 items regarding "Nexcargo" variant (resolved) | README.md:5 ("CargoLink") — PERSISTS as unresolved contradiction | Brand guideline document (formal proposal document to replace informal HAO oral/written direction) | Formal brand asset specifications (separate track) |

---

## C. Required Documentation / Specification Amendments

The following amendments are required to bring the NexCargo documentation ecosystem into alignment with HAO directives. This is a RECONCILIATION list, not an implementation list.

### Tier 1 — Critical Updates (Must Exist Before C6 Authorization)

| # | Amendment | Target Document | Section | Rationale |
|---|----------|----------------|---------|-----------|
| T1-01 | Add "Platform Layer / Public Web" as new ownership category in INDEX §8 Product Capability Registry and §9 Module Registry | nexcargo-index.md | §8, §9 | Implements HAO-H-01; closes ownership gap |
| T1-02 | Update C6 scope boundary definition in development-state.md to reflect HAO-H-04 limitations | docs/governance/nexcargo-development-state.md | Continuity Notes / Current Phase rows | Eliminates over-scoped assumptions |
| T1-03 | Create public discovery security rules clarifying anonymous vs authenticated visibility | ESS-006 (new section) OR MOD-007 (clarification appendix) | New or Appendix | Implements HAO-H-02; resolves MOD-007 §6.3 tension |
| T1-04 | Add registration flow specification defining role selection at registration screen | PROMPT 7 (extension) OR new Registration Flow Spec document | New | Implements HAO-H-03; fills documented gap |
| T1-05 | Add brand naming clarification noting HAO-H-11 adoption and resolving "CargoLink" status | README.md + BRAND_UIUX_AUDIT_REPORT | README.md:5; AUDIT §1.7 | Implements HAO-H-11; resolves Contradiction A |

### Tier 2 — Recommended Updates (Should Exist Before C6 Completion)

| # | Amendment | Target Document | Section | Rationale |
|---|----------|----------------|---------|-----------|
| T2-01 | Add clarifying note to ESS-008 §3.1: component libraries extending Tailwind are permitted; CSS frameworks with independent theming are not | ESS-008 | §3.1 | Implements HAO-H-05; resolves OAD-010 ambiguity |
| T2-02 | Update MOD-007 §7.2 to acknowledge post-registration onboarding state transition | MOD-007 spec | §7.2 | Implements HAO-H-03; connects auth to dashboard |
| T2-03 | Update ESS-008 §18 Module UI Responsibility Matrix to add Platform/Public Web layer row | ESS-008 | §18 | Implements HAO-H-01; completes responsibility mapping |
| T2-04 | Publish C6 milestone definition document with exact scope, deliverables, acceptance criteria per HAO-H-04 | New governance document | — | Standalone C6 definition replacing scattered references |
| T2-05 | Clarify PROMPT 4/5 status as generation prompts (non-normative) versus ESS-008/MOD/N regulatory documents | PROMPT 4 preamble; PROMPT 5 preamble | Document headers | Implements HAO implicit guidance from BRAND_UIUX_AUDIT |
| T2-06 | Define "Public Discovery/Browsing" capability in PRODUCT CAPABILITY REGISTRY | nexcargo-index.md | §8 | Implements HAO-H-02; maintains registry completeness |

### Tier 3 — Housekeeping Updates (Nice to Have)

| # | Amendment | Target Document | Section | Rationale |
|---|----------|----------------|---------|-----------|
| T3-01 | Standardize "Nexcargo" to "NexCargo" in nexcargo-ai-eprs.md line 1 | nexcargo-ai-eprs.md | Line 1 | Implements HAO-H-11 typographical standardization |
| T3-02 | Resolve "CargoLink" in README.md (approve, rebrand, or remove) | README.md | Line 5 | Eliminates Contradiction A from BRAND_UIUX_AUDIT |
| T3-03 | Add clarification to development-state.md marking OAD/H-01 through H-05 as resolved by directive | docs/governance/nexcargo-development-state.md | Decisions Affecting Record table | Governance hygiene; prevents future confusion |
| T3-04 | Add C6-ready flag/check to development-state.md indicating readiness assessment complete, awaiting authorization | docs/governance/nexcargo-development-state.md | Session metadata | Operational clarity |

---

## D. Final Proposed C6 Boundary

### C6 Mission Statement
*After C6, authenticated users shall experience a functional navigable product shell with role-aware routing and a demonstrable dashboard pattern. Anonymous users shall access a branded landing page and perform basic marketplace discovery without authentication.*

### C6 Inputs (preconditions)
- C0–C5 completed and verified
- HAO-H-01 through H-05 and H-11 issued
- Development-state.md updated with C6 scope
- C6 milestone definition document published

### C6 Outputs (what exists after successful C6)
1. Landing page with NexCargo branding (H-11 wordmark)
2. Auth pages: sign-in, register (+role selection per H-03), forgot-password
3. Sign-out from authenticated sessions
4. Public discovery/browsing (anonymous, per H-02)
5. Middleware-enforced auth guards on protected routes
6. Global navigation framework (role-aware)
7. Language switcher (pt/en)
8. Component primitives layer (Tailwind-based, NexCargo-owned, per H-05)
9. Error pages (404, 403)
10. One exemplar role dashboard demonstrating MOD-007 pattern
11. Loading skeletons and empty states

### C6 Non-Outputs (explicitly excluded)
- All items in Section "C6 OUT OF SCOPE" above

### Acceptance Criteria Summary (per HAO-H-04 and reconciliation)

| AC # | Criterion | Classification |
|------|-----------|---------------|
| AC-1 | Anonymous user lands on branded landing page at root URL | C6-IN |
| AC-2 | Anonymous user can browse/search listings without authentication | C6-IN (per H-02) |
| AC-3 | Auth pages functional: sign-in creates session, register captures role (H-03), forgot-password sends email | C6-IN |
| AC-4 | Protected routes enforce authentication via middleware | C6-IN |
| AC-5 | Authenticated user lands on navigable shell with role-aware menu | C6-IN |
| AC-6 | Language switcher displays pt/en options | C6-IN |
| AC-7 | Component primitives exist and are used consistently (no one-off inline JSX for common patterns) | C6-IN (per H-05) |
| AC-8 | Exemplar role dashboard renders with widget pattern (TABLE/KPI/LIST) | C6-IN (H-04 scoped) |
| AC-9 | 404 and 403 error pages accessible | C6-IN |
| AC-10 | TypeScript clean (0 errors), regression suite passes (1,454+ tests pass) | Quality Gate |

---

## E. Proposed C6-I / C6-II / C6-III Definitions (Post-Reconciliation)

### C6-I: Public Surface + Authentication Foundation

| Field | Detail |
|-------|--------|
| **Objective** | Deliver public-facing web surface with functional authentication and anonymous discovery |
| **Scope** | Landing page (updated branding), sign-in, register (with role selection), forgot-password, sign-out, basic public info stubs, auth middleware, anonymous listing discovery |
| **Not in Scope** | Authenticated shell, dashboard, component library, error pages, onboarding flow beyond registration |
| **Boundaries** | Stops at auth gateway — authenticated user redirected to (still-unbuilt) shell |
| **Deliverables** | 4 auth pages, updated landing page, middleware guard, anonymous discovery endpoint wiring |
| **Tests Required** | Auth flow tests, middleware protection tests, landing page render tests, anonymous browse accessibility tests |
| **Database Changes** | Original assessment (superseded 2026-11-05 by NXC I-1): "None required (Supabase auth handles user creation; role stored in user_metadata)" — incorrect as an authority statement: `user_metadata` is client-writable and no longer stores any authoritative role. Marketplace membership is persisted in `app.marketplace_memberships` (migration 040, RLS enabled, service_role write grants only) and written server-side through `public.record_marketplace_membership()` (migration 041). |
| **Track B Impact** | None (no module.config.ts changes) |

### C6-II: Authenticated Shell + Component Primitives

| Field | Detail |
|-------|--------|
| **Objective** | Deliver authenticated navigable shell with role-aware routing and component primitives |
| **Scope** | Global navigation (sidebar/header), top bar (user identity, language switcher), post-login redirect, role-aware menus, component primitives library (Button, Card, Badge, Skeleton, Spinner, Form controls), error pages (404, 403) |
| **Not in Scope** | Dashboard content/module data display |
| **Boundaries** | Shell works for all roles; populated with placeholder/mock data until C6-III |
| **Deliverables** | Layout system, 8+ primitives, role menu, language switcher, error pages |
| **Tests Required** | Component unit tests, navigation render tests, role menu visibility tests, error page accessibility tests |
| **Database Changes** | None |
| **Track B Impact** | None |

### C6-III: Minimum Viable Role Dashboard (Exemplar)

| Field | Detail |
|-------|--------|
| **Objective** | Demonstrate complete MOD-007 dashboard pattern with real module data binding |
| **Scope** | One exemplar role dashboard (Shipper recommended) using MOD-007 widget model; actual API data binding for key metrics; loading/empty states; accessibility compliance |
| **Not in Scope** | Other role dashboards, full module feature coverage, analytics charts, mobile adaptation |
| **Boundaries** | One dashboard demonstrating the pattern; subsequent dashboards follow same template |
| **Deliverables** | Shipper dashboard with 3+ widget types bound to live APIs, accessible, responsive |
| **Tests Required** | Dashboard integration tests, API data binding tests, accessibility audit, responsive layout tests |
| **Database Changes** | None |
| **Track B Impact** | None |

### Increment Dependency Graph

```
C6-I (Public + Auth)
    │
    ▼ (shell redirects here after login)
C6-II (Shell + Primitives)
    │
    ▼ (shell hosts this)
C6-III (Exemplar Dashboard)
```

Each increment is independently deployable. C6-I can be verified in isolation. C6-II adds authenticated navigation. C6-III validates the dashboard pattern end-to-end.

---

## F. Remaining HAO Decision Register

| ID | Description | Status | Blocks C6-I? |
|----|-------------|--------|-------------|
| **RAD-001** | Official status of "CargoLink" in README.md:5 — approve, rebrand, or remove? | OPEN | PARTIAL — README can stay as-is provisionally |
| **RAD-002** | Document the onboarding flow ownership — which layer (Public Web, MOD-007, or new entity)? | OPEN | CONDITIONAL — C6 can proceed with registration-only; full onboarding deferred |
| **RAD-003** | Confirm exemplar dashboard role for C6-III (Shipper recommended)? | OPEN | NO — Shipper can serve as default assumption |
| **RAD-004** | Confirm PROMPT 4/5 status as generation prompts (non-normative) | OPEN | NO — Clarification only |
| **RAD-005** | Add "Public Discovery/Browsing" capability entry to INDEX §8 | OPEN | NO — Index housekeeping |
| **RAD-006** | Adopt BRAND_UIUX_AUDIT_REPORT as preliminary brand baseline per H-11, pending formal brand guideline document | OPEN | NO — H-11 already adopts the concept; formal guideline document is Phase 8 |
| **RAD-007** | Clarify whether PROMPT 7 should be extended with Registration Flow specification, or if a separate Registration Flow document should be created | OPEN | CONDITIONAL — Registration spec needed for C6-I |

---

## G. C6-I Authorization Readiness Statement

**After reconciliation against HAO-H-01 through H-05 and H-11, and accounting for all documentation gaps, contradictions, and ownership clarifications:**

C6-I is **CONDITIONALLY READY FOR HAO AUTHORIZATION**, subject to resolution of the following blocking conditions:

### BLOCKING CONDITIONS (Must Be Addressed Before C6-I Authorization)

1. **RAD-002 (Onboarding flow ownership)** must be resolved or explicitly accepted as deferred to post-C6. HAO must confirm whether C6-I's registration page includes ONLY role selection (minimal) or extends into full onboarding (deferred).

2. **RAD-001 (CargoLink resolution)** should be acknowledged even if not blocked — the README contradiction undermines documentation coherence. HAO should issue a brief ruling or accept the existing state as provisional.

### NON-BLOCKING (Can Proceed With Default Assumptions)

3. RAD-003 — Exemplar role: Shipper assumed by default unless HAO directs otherwise.
4. RAD-004 — PROMPT 4/5 generation prompt status: implied by document structure; explicit confirmation welcomed.
5. RAD-005 — INDEX update: can be done post-C6-I.
6. RAD-006 — Brand baseline: HAO-H-11 already provides sufficient direction for C6-I branding (NexCargo wordmark as used throughout existing codebase).
7. RAD-007 — Registration flow: C6-I registration page scope is sufficiently bounded by HAO-H-03 ("role selection during registration"); detailed onboarding can be deferred.

### VERDICT

**C6-I is conditionally ready for HAO authorization upon:**
- Formal confirmation that C6-I registration scope = role selection at registration only (full onboarding deferred)
- Acknowledgment of RAD-001 (CargoLink status) as either approved or noted-for-later-review

All documentation amendment requirements (Tiers 1-3) are identified but most are NOT blocking C6-I implementation. T1-01 (INDEX update), T1-02 (development-state C6 scope), T1-03 (public discovery rules), and T1-04 (registration spec) are the only Tier 1 items that arguably impact C6-I planning. These can be produced as part of the authorization package rather than prerequisites.

**Recommendation for HAO consideration:** Issue C6 authorization encompassing C6-I, C6-II, and C6-III as a single authorization decision, with the understanding that each increment will be delivered sequentially and independently verifiable. Alternatively, authorize C6-I first, then C6-II, then C6-III in sequence.

---

*End of C6 Architecture Reconciliation Report. This document presents analysis and recommendations only. No decisions are made. No code changes. No documentation modifications. No C6 implementation authorized. Awaiting HAO review and authorization decisions.*
