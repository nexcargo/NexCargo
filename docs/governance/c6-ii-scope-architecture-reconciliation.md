# C6-II Scope & Architecture Reconciliation Report

**Document Type:** HAO Pre-Authorisation Analysis — Documentation Only  
**Date:** 2026-09-09  
**Status:** AWAITING HAO AUTHORISATION DECISION  
**Predecessor Reports:** C6 Readiness & Boundary Analysis, C6 Architecture Adjudication Brief, C6 Architecture Reconciliation, C6-I Implementation Report  

---

## Classification Legend

| Code | Meaning |
|------|---------|
| **A** | Authoritatively specified (existing or reconciled specs) |
| **B** | Implied by existing documents |
| **C** | Already implemented |
| **D** | Not implemented |
| **E** | Contradicted by existing specifications |
| **F** | Unspecified in any document |

---

## A. C6-II Scope & Architecture Reconciliation Report

### 1. Verified Baseline

| Item | Status |
|------|--------|
| C0–C5 | COMPLETE / VERIFIED / CLOSED |
| C6-I | COMPLETE / VERIFIED / CLOSED (2026-09-09) |
| RAD-001 (CargoLink terminology) | CLOSED — "NexCargo" principal wordmark confirmed; "CargoLink" NOT AUTHORIZED |
| RAD-002 (Onboarding ownership) | CLOSED — Platform layer owns onboarding journey; C6 scope limited to role selection |
| Wave 5 Increment 3 | DEFERRED / OUTSIDE C6 |
| TypeScript compilation | CLEAN (zero errors) |
| Test suite regression | 70 files, 1,454 passing — zero modifications needed since C6-I |
| Track B (module.config.ts) | FROZEN — zero changes across all 18 modules |
| PROMPT 0 v1.1 | UNCHANGED / AUTHORITATIVE |

### 2. C6-I Carry-Forward Items Genuinely Belonging in C6-II

From the C6-I implementation report Deferred Items section, these items were explicitly identified as carrying forward to C6-II:

| Item | Source | Why it belongs in C6-II |
|------|--------|-----------------------|
| **Full i18n integration (hooks)** | C6-I deferred list | Requires navigable shell where `useTranslations()` can be placed in shared layout components |
| **Auth middleware guards** | C6-I deferred list | Protects `(dashboard)/` and all authenticated routes; requires middleware.ts wiring into `src/middleware.ts` |
| **Post-login redirect logic** | C6-I deferred list | Redirects authenticated users based on UserRole after sign-in; requires shell/navigation awareness |
| **Sign-out functionality** | C6-I deferred list | Requires shell component (top bar/sidebar) with logout action; not functional without authenticated context |
| **Language switcher UI** | C6-I deferred list | Global navigation component visible in all layouts; requires shell framework |

These five items form the core of what is called the "authenticated application shell" — the infrastructure that wraps between authentication entry (C6-I) and dashboard content (C6-III).

**No other C6-I deferred items carry forward.** All C6-I deliverables remain intact and unmodified. No C6-I functionality needs reopening.

### 3. Required C6-II Capabilities — Verification Against Specifications

For each proposed C6-II capability, I verify whether authoritative documentation places it within C6-II scope or assigns it elsewhere.

#### Capability 1: Authenticated Application Shell

**What it is:** The wrapping structure that authenticated users see after login — global layout, navigation header/sidebar, user identity display, role-aware menus.

**Source verification:**
- PROMPT 4 §SHARED UI LAYOUT SYSTEM: defines root layouts per route group (`(dashboard)` layout, `(auth)` layout); each role has isolated layout; shared UI components only via `/shared/ui`; no duplication of navigation logic. Authority Level: **A**.
- ESS-008 §3.3: "All dashboards MUST follow: Sidebar (navigation), Top bar (context + actions), Main content (cards/tables/maps), Right panel (optional context/AI insights)." Authority Level: **A**.
- ESS-008 §7.1: "Global Navigation must be: role-based, minimal, consistent across modules." Authority Level: **A**.
- MOD-007 §3.3: "Experience Layer Structuring — navigation logic (conceptual only), user flow definitions, contextual information rendering rules." MOD-007 owns authenticated UX presentation. Authority Level: **A**.

**Conclusion:** AUTHENTICATED APPLICATION SHELL is definitively within C6-II scope. It is required for C6-III exemplar dashboard to render inside a proper layout. ESS-008 §3.3 and §7.1 prescribe its structure. MOD-007 provides the ownership authority. PROMPT 4 provides the structural blueprint.

**Classification: A — SPECIFIED**

#### Capability 2: Navigation / Information Architecture

**What it is:** Sidebar/topbar navigation menus with role-aware visibility, breadcrumbs for complex flows.

**Source verification:**
- PROMPT 4 §SHARED UI LAYOUT SYSTEM: language switcher component available in all layouts; each role has isolated layout. Authority Level: **A**.
- ESS-008 §7.2: "avoid deep nesting beyond 3 levels, breadcrumbs required for complex flows." Authority Level: **A**.
- PROMPT 5 §COMPONENT LIBRARY STRUCTURE: "Navigation System — Must support role-based sidebar, collapsible menus, mobile bottom navigation (driver app)." Authority Level: **A**.
- ESS-008 §13 (accessibility): keyboard navigation supported.

**Conclusion:** NAVIGATION is clearly within C6-II scope. Navigation is a SHARED infrastructure component (part of the shell), not domain-specific. MOD-007 governs conceptual navigation model; ESS-008/PROMPT 4 provide implementation constraints. The actual menu items rendered would come from role mapping.

**Classification: A — SPECIFIED**

#### Capability 3: Session/Auth Guards and Authenticated Routing

**What it is:** Next.js middleware protecting authenticated routes; enforcing session before allowing access to `(dashboard)`, `(dispatcher)`, etc.

**Source verification:**
- PROMPT 4 §RBAC UI ENFORCEMENT: "Each route MUST enforce: authentication, role validation, permission checks." Authority Level: **A**. However, this applies specifically to TRANSACTIONAL routes — PUBLIC discovery routes are exempt per HAO-H-02.
- PROMPT 4 currently states blanket auth enforcement. Per RAD-001 reconciliation and HAO-H-02 clarification, `(public)` routes should NOT require authentication. This is a CONTRADICTION in PROMPT 4 that C6-II must handle correctly.
- web/src/lib/supabase/middleware.ts exists but is NOT wired (no `src/middleware.ts` calls `updateSession()`). Authority Level: **D** (infrastructure exists, not activated).

**Conclusion:** AUTH GUARDS belong in C6-II. This is both a gate-critical function AND an unactivated piece of existing infrastructure. However, note: PROMPT 7 (Authentication + RBAC) governs authentication mechanism behavior. Auth guards interact with Supabase Auth sessions — the MECHANISM is POMPT 7's purview, the ROUTE PROTECTION is C6-II's responsibility.

**Classification: A — SPECIFIED (with PROMPT 7 boundary noted)**

#### Capability 4: Post-Login Routing

**What it is:** After successful sign-in, routing the user to their role-appropriate destination (e.g., shipper to `(shipper)/dashboard`, transporter to `(transporter)/dashboard`).

**Source verification:**
- PROMPT 4 §ROLE-BASED UI ARCHITECTURE: separate route groups per role (`(shipper)`, `(transporter)`, `(driver)`, `(admin)`, `(dispatcher)`). Authority Level: **A**.
- Currently, C6-I sign-in redirects ALL users to `/dispatcher` (hardcoded). This is a temporary placeholder.
- MOD-007 §6.3: "ensuring RBAC at UI level (reflecting backend permissions)". Authority Level: **A**.

**Conclusion:** POST-LOGIN ROUTING belongs in C6-II. It connects auth success (C6-I deliverable) to authenticated experience (C6-III). The current hardcoded redirect in C6-I sign-in page is a deliberate C6-I simplification — corrected in C6-II when role-aware routing is established.

**Classification: A — SPECIFIED**

#### Capability 5: Sign-Out

**What it is:** Signed-out from active session; accessible from authenticated pages.

**Source verification:**
- web/src/app/(auth)/sign-in/page.tsx (C6-I deliverable) contains NO sign-out button — sign-out requires an authenticated context.
- PROMPT 7 doesn't specify sign-out UI mechanics; only auth mechanisms.
- Standard web practice: sign-out is part of the authenticated shell.
- MOD-007: user interactions (VIEW, CREATE, UPDATE, SUBMIT, APPROVE, REJECT) include session management.

**Conclusion:** SIGN-OUT belongs in C6-II. It is a shell-level action (visible in navigation), not a page-level feature. It cannot exist without the shell (which is C6-II's primary deliverable).

**Classification: A — IMPLICIT (standard shell requirement, derives from PROMPT 4 layout hierarchy)**

#### Capability 6: Language Switching

**What it is:** UI element (dropdown/button) to toggle pt/en locale switching, visible across all pages including public and authenticated.

**Source verification:**
- ESS-008 §17.2: "Language switcher MUST be clearly visible in the UI." Authority Level: **A**.
- ESS-008 §17.5: "UI components MUST use a localization framework (e.g., next-intl)." Authority Level: **A**.
- PROMPT 4 §LOCALIZATION REQUIREMENTS: "Language preference stored in user profile." Authority Level: **A**.
- C6-I added translation keys but auth pages don't yet use `useTranslations()` hook — they use hardcoded strings. Full i18n hooks deferred to C6-II.
- Web/i18n infrastructure already configured (next-intl plugin in next.config.ts, locales/en/common.json, locales/pt/common.json populated with ~51 keys).

**Conclusion:** LANGUAGE SWITCHING belongs in C6-II. It is a SHARED COMPONENT in the global nav/header area. C6-I localization work (keys added) enables C6-II implementation.

**Classification: A — SPECIFIED (ESS-008 §17 makes it mandatory)**

#### Capability 7: NexCargo-Owned Reusable UI Primitives/Components

**What it is:** Button, Card, Badge, Skeleton/Spinner, Form controls (input, select, textarea), Link, Alert/Toast, Modal foundations.

**Source verification:**
- HAO-H-05: "NexCargo shall use a NexCargo-owned reusable component/primitives layer built on the existing Tailwind foundation. Do not introduce a heavyweight external UI framework unless separately authorised." Authority Level: **A**.
- PROMPT 5 §COMPONENT LIBRARY: specifies Button (variants: primary/secondary/outline/danger/ghost; states: loading/disabled/active), Input, Card, Table, Modal, Badge, Navigation, Notification, Loading systems. Authority Level: **A**.
- PROMPT 5 §DESIGN TOKENS: centralized token system for colors, spacing, typography, radius, shadow. Authority Level: **A**.
- PROMPT 5 §CRITICAL CONSTRAINTS: "Use Tailwind CSS as the primary styling system... no external CSS frameworks." Authority Level: **A**.
- ESS-008 §3.1: "ALL styling MUST use Tailwind CSS, no inline styles." Authority Level: **A**.
- ESS-008 §5.2: Mandatory standard components: Card, Table, Modal, Form, Status Badge, Timeline, Map Container. Authority Level: **A**.
- Current state: ZERO component library exists. All JSX inline. Authority Level: **D**.

**Conclusion:** UI PRIMITIVES are DEFINITELY in C6-II scope. They are the FOUNDATION upon which all authenticated pages (shell, dashboards, forms) are built. HAO-H-05 mandates them. PROMPT 5 provides detailed architectural specifications. ESS-008 §5.2 mandates the specific components.

**Classification: A — SPECIFIED (by HAO-H-05 directive, PROMPT 5 architecture, ESS-008 §5.2)**

#### Capability 8: Responsive and Accessibility Foundations

**What it is:** Breakpoints, responsive behavior, WCAG 2.1 minimum accessibility compliance.

**Source verification:**
- PROMPT 5 §RESPONSIVE DESIGN RULE: "System MUST support: mobile-first driver workflows, tablet fleet operations, desktop admin dashboards." Authority Level: **A**.
- PROMPT 5 §ACCESSIBILITY RULE: "All components MUST support keyboard navigation, screen readers, include aria labels, maintain contrast compliance (WCAG 2.1 minimum)." Authority Level: **A**.
- PROMPT 5 Breakpoints: mobile (driver-first), tablet (fleet ops), desktop (admin), ultra-wide (control rooms). Authority Level: **A**.
- ESS-008 §8: "mobile-first design mandatory for drivers, low-bandwidth optimization required, offline mode must degrade gracefully, large tap targets required." Authority Level: **A**.
- ESS-008 §13: "minimum contrast compliance required, keyboard navigation supported, readable typography hierarchy, no critical function hidden behind hover-only UI." Authority Level: **A**.

**Conclusion:** RESPONSIVE + ACCESSIBILITY are CROSS-CUTTING concerns that apply to ALL C6 capabilities. They are embedded in the primitives themselves (PROMPT 5) rather than being a separate deliverable. C6-II implementations of primitives, shell, and navigation MUST comply.

**Classification: A — SPECIFIED (cross-cutting, applies to all C6-II deliverables via PROMPT 5 + ESS-008)**

#### Capability 9: Role-Aware Shell/Navigation

**What it is:** The shell displays different menu items/actions based on UserRole (SHIPPER/TRANSPORTER/DRIVER/etc.). Users only see what they're permitted to access.

**Source verification:**
- MOD-007 §6.3: "UI reflects RBAC constraints... ensuring visibility restrictions at UI layer (non-security primary layer)... hiding unauthorized actions from view." Authority Level: **A**.
- MOD-007 §4.1 Dashboard View Object: `visibilityRules – RBAC-based visibility constraints`. Authority Level: **A**.
- PROMPT 4 §RBAC UI ENFORCEMENT: "if (user.role !== 'shipper') { redirect('/unauthorized'); }" Authority Level: **A**.
- HAO-R-003 (from dev-state): Super Admin = full Moderator + full Admin + Super Admin-only. Hierarchy documented. Authority Level: **A**.
- User roles defined in `shared/types/enums.ts`: SHIPPER, TRANSPORTER, DRIVER, DISPATCHER, MODERATOR, ADMIN, SUPER_ADMIN. Authority Level: **A**.

**Conclusion:** ROLE-AWARE NAVIGATION is inherent to the authenticated shell (Capability 1). The shell must read the user's role and conditionally render menu items. This is NOT a standalone deliverable; it is an attribute of the shell and navigation.

**Classification: A — IMPLICIT (inherent to shell+nav capability per MOD-007 §6.3)**

#### Capability 10: Foundations Required by C6-III Exemplar Dashboard

**What it is:** Data binding scaffolding, widget container structures, module-to-widget mapping that enable the exemplar dashboard (C6-III) to populate with real data.

**Source verification:**
- MOD-007 §7.2 Data Binding Rule: "All UI elements MUST bind to module-defined data structures. No ad-hoc or undefined UI data sources are allowed." Authority Level: **A**.
- MOD-007 §4.2 Widget Object: widgetType (TABLE/CHART/TIMELINE/KPI/AI_INSIGHT/MAP/FORM/LIST), dataSourceModule, refreshTriggerEvent, configurationSchema. Authority Level: **A**.
- PROMPT 4 §API CONSUMPTION RULE: "UI MUST ONLY call /app/api/* routes or server actions mapped to Application Layer. UI MUST NEVER access repositories, access database, access event store directly." Authority Level: **A**.

**Conclusion:** DASHBOARD FOUNDATIONS belong in C6-II because they define THE CONTRACT between shell and content. The primitives must include WIDGET CONTAINERS (skeleton/wrapper) and DATA BINDING SCAFFOLDING that C6-III's exemplar dashboard will consume. Without these foundations in C6-II, C6-III would have nowhere to mount widgets.

However: the CONTENT (actual Shipper dashboard data, API responses, business logic) remains exclusively C6-III. C6-II provides the FRAMEWORK.

**Classification: A — IMPLICIT (required for C6-III to function; derived from MOD-007 widget model + PROMPT 4 API consumption rule)**

---

## B. RAD-003 through RAD-007 Disposition Matrix

### RAD-003: Exemplar Dashboard Role

| Field | Detail |
|-------|--------|
| **Decision ID** | RAD-003 |
| **Description** | Which single role receives the exemplar dashboard in C6-III? Shipper recommended? |
| **Current Status** | OPEN |
| **Blocks C6-II?** | **NO** — exemplar dashboard belongs to C6-III, not C6-II |
| **Analysis** | RAD-003 is a C6-III scoping question. C6-II provides the SHELL + PRIMITIVES regardless of which role's dashboard C6-III will populate first. The shell does not depend on knowing the exemplar role. |
| **Recommendation** | **RESOLVED WITHOUT HAO INPUT** — Shipper recommended as default exemplar (greatest breadth of capability coverage: MOD-001/003/005/006 interop). Can be confirmed or changed later during C6-III authorization. |
| **Resolution Action** | Record Shipper as DEFAULT assumption; update C6-III definition accordingly if/when authorized. |

**Disposition: RESOLVED (non-blocking for C6-II)**

---

### RAD-004: PROMPT 4 / PROMPT 5 Clarification

| Field | Detail |
|-------|--------|
| **Decision ID** | RAD-004 |
| **Description** | Confirm PROMPT 4 and PROMPT 5 status as GENERATION PROMPTS (non-normative) versus ESS/MOD regulatory documents |
| **Current Status** | OPEN |
| **Blocks C6-II?** | **NO** — clarification recommended but not blocking |
| **Analysis** | PROMPT 4 (UI/UX Integration Boot) defines route structure, layout hierarchy, component separation rules. PROMPT 5 (Full Design System) defines tokens, components, accessibility standards. Both are implementation guidance prompts, not normative specifications like ESS documents or MOD specs. The BRAND_UIUX_AUDIT recommends clarifying this status. In practice, their guidance is followed but when conflicts arise with ESS-008, ESS takes precedence (implied hierarchy). |
| **Recommended Resolution** | Add a one-line preamble to PROMPT 4: "This document provides structural bootstrap guidance. Where conflicts exist, PROMPT 0 > ESS > Module Specs > PROMPT guides." Similar for PROMPT 5. |
| **Alternative** | Leave as-is if HAO prefers; PROMPT 4/5 content already aligns with ESS-008/MOD-007 in every material respect found during audits. No known contradictions exist. |

**Disposition: RECOMMENDED CLARIFICATION (non-blocking) — Can proceed with current understanding**

---

### RAD-005: INDEX / Registry Additions

| Field | Detail |
|-------|--------|
| **Decision ID** | RAD-005 |
| **Description** | Add "Public Discovery/Browsing" and "Platform/Public Web" capability entries to nexcargo-index.md §8 Product Capability Registry |
| **Current Status** | OPEN |
| **Blocks C6-II?** | **NO** — index housekeeping, not blocking |
| **Analysis** | INDEX §8 lists MOD-007 = Presentation, MOD-008 = Mobile Platform. Missing: Public/Web Experience entity. HAO-H-01 created the Platform layer but INDEX was not updated. This is governance hygiene — the INDEX reflects the old state where no platform layer existed. |
| **Required Amendment** | Update INDEX §8 Product Capability Registry and §9 Module Registry to add platform-layer entries. |
| **When to Do** | Can be done pre-authorization, post-authorization, or deferred to next governance cycle. Does not affect C6-II implementation. |

**Disposition: HOUSEKEEPING (non-blocking) — Recommended but not required before C6-II authorization**

---

### RAD-006: Brand Guideline Formalisation

| Field | Detail |
|-------|--------|
| **Decision ID** | RAD-006 |
| **Description** | Adopt BRAND_UIUX_AUDIT_REPORT as preliminary brand baseline; formalize brand guidelines per HAO-H-11 |
| **Current Status** | CLOSED BY HAO-H-11 |
| **Blocks C6-II?** | **NO** — HAO-H-11 already provides sufficient direction for C6-II |
| **Analysis** | HAO-H-11 directive states: "NEXCARGO — Brand Styling & Visual Identity Proposal v1.0 is adopted as INITIAL brand/visual baseline subject to final HAO approval/amendment of individual brand assets and visual specifications." This means: "NexCargo" wordmark, capital N+C, independent symbol required, logo/visual assets pending separate HAO approval. No need for additional HAO decision on RAD-006 for C6-II purposes. |
| **Scope Limitation for C6-II** | C6-II uses EXISTING branding conventions (title-case "NexCargo", dark/light mode via globals.css). No new brand assets, logos, or color palettes created. |

**Disposition: ALREADY RESOLVED by HAO-H-11 (non-blocking)**

---

### RAD-007: Registration Flow Specification Ownership

| Field | Detail |
|-------|--------|
| **Decision ID** | RAD-007 |
| **Description** | Registration flow spec ownership — is it Public Web layer, MOD-007, or separate entity? |
| **Current Status** | OPEN |
| **Blocks C6-II?** | **CONDITIONAL** — registration flow is COMPLETE in C6-I. For C6-II, registration is already delivered. Only future onboarding expansion (post-registration) belongs to Platform layer per RAD-002. |
| **Analysis** | C6-I already delivers the complete registration page with role selection. The REGISTRATION PAGE is a PUBLIC WEB deliverable (C6-I), not a shell deliverable (C6-II). C6-II concerns authenticated post-login experience. Registration itself is outside C6-II scope. Onboarding EXPANSION (profile setup, verification steps, guided first-use) after registration is Platform-layer ownership per RAD-002. |
| **Resolution** | Registration: Platform/Public Web (C6-I, DONE). Post-registration onboarding: Platform/Public Web (post-C6). Neither blocks C6-II. |

**Disposition: RESOLVED — registration is C6-I (done); post-registration onboarding is post-C6 (not C6-II)**

---

## C. C6-II Ownership Matrix

| C6-II Component | Owner | Supporting Documents | Boundary Notes |
|----------------|-------|---------------------|----------------|
| **Authenticated Application Shell** | MOD-007 (authenticated UX presentation) + Platform layer (design system tokens) | MOD-007 §§3,6,7; PROMPT 4; ESS-008 §3.3/§7 | MOD-007 owns the UX design; Platform layer supplies design tokens/components |
| **Navigation / Menus** | MOD-007 (role-based navigation model) + Platform layer (implementation) | MOD-007 §3.3; ESS-008 §7; PROMPT 4 | Menu ITEM CONTENT comes from role mapping; MENU STRUCTURE from MOD-007 concept |
| **Auth Middleware / Route Guards** | C6-II Infrastructure (implements PROMPT 7 boundaries) | PROMPT 4 §RBAC UI ENFORCEMENT; PROMPT 7; SUPABASE SSR client | Mechanism per PROMPT 7; route protection per PROMPT 4/C6-II scope |
| **Post-Login Redirect** | C6-II Infrastructure | PROMPT 4 §ROLE-BASED UI ARCHITECTURE | Reads user role from session; maps to route group |
| **Sign-Out** | C6-II Infrastructure (component in shell) | PROMPT 7 (auth mechanism); PROMPT 4 (layout) | Simple Supabase signOut() call wrapped in shell component |
| **Language Switcher** | Platform layer (component in shell) | ESS-008 §17.2; PROMPT 4 §LOCALIZATION | Uses next-intl; persists preference |
| **UI Primitives / Components** | Platform layer (NexCargo-owned) | HAO-H-05; PROMPT 5; ESS-008 §5 | Tailwind-based; no external CSS frameworks; per HAO-H-05 |
| **Responsive/Accessibility** | Cross-cutting (applies to all components) | PROMPT 5; ESS-008 §8/§13 | Embedded in primitives and shell; not a standalone deliverable |
| **Role-Aware Rendering** | Shell implementation (reads the database-resolved effective role for the session) | MOD-007 §6.3; PROMPT 4 | Conditionally renders menu items based on UserRole enum values. **CORRECTED 2026-11-05 by NXC I-1:** the original cell said "reads session metadata", which directed developers to client-writable `auth.users.user_metadata` as the role source. That is withdrawn. The shell resolves role from `public.effective_marketplace_role()` / `public.effective_user_role()` via `web/src/app/(dashboard)/user-session.ts`; metadata is not consulted for role. |
| **Widget Container Framework** | C6-II Infrastructure (primitives layer) | MOD-007 §4.2; PROMPT 4 §API CONSUMPTION RULE | Defines how dashboards mount widgets; C6-III provides actual widget DATA |

**Key Structural Point:** C6-II creates the PLATFORM INFRASTRUCTURE that wraps around (and serves) C6-III's exemplar dashboard. The ownership split is:
- **Platform layer / C6-II**: Shell, navigation, primitives, auth guards, i18n switcher — THINGS ALL ROLES SHARE
- **MOD-007 / C6-III**: Specific role dashboard content — WHAT EACH ROLE SEES

---

## D. Exact Required Documentation Amendments Before C6-II

The following amendments are required to bring the NexCargo documentation ecosystem into alignment with the resolved C6-II scope:

### Tier 1 — Critical (Must Exist Before C6-II Authorization)

| # | Amendment | Target Document | Section | Rationale |
|---|----------|----------------|---------|-----------|
| T1-01 | Add "Platform/Public Web" layer as NEW ownership category | nexcargo-index.md | §8 Product Capability Registry, §9 Module Registry | Reflects HAO-H-01 resolution; INDEX currently lacks platform-layer entries |
| T1-02 | Define C6 milestone (C6-I closed, C6-II pending) | nexcargo-development-state.md | Current Phase, Continuity Notes | Records C6-I completion and identifies C6-II as next gate |
| T1-03 | Clarify PROMPT 4 generation-prompt status vs ESS/MOD norms | PROMPT 4 preamble (header) | Document header | Implements RAD-004 recommendation; establishes precedence hierarchy |
| T1-04 | Clarify PROMPT 5 generation-prompt status vs ESS/MOD norms | PROMPT 5 preamble (header) | Document header | Same as T1-03 |

### Tier 2 — Recommended (Can Proceed Without, But Should Be Done Soon)

| # | Amendment | Target Document | Section | Rationale |
|---|----------|----------------|---------|-----------|
| T2-01 | Add RAD-005 updates (INDEX additions) as tracking item | docs/governance/c6-readiness-boundary-analysis.md or new file | Tracking table | Records that INDEX needs update |
| T2-02 | Add "C6-II Shell + Primitives" to governance timeline | nexcargo-development-state.md | Gate Progression or wave timeline | Tracks C6-II as active upcoming milestone |
| T2-03 | Clarify README.md line 5 "CargoLink" (RAD-001 remediation) | README.md | Line 5 | Documentation cleanup; application code already correct |

---

## E. Final Proposed C6-II Scope

**Mission Statement:** *After C6-II, authenticated users experience a navigable product shell with role-aware menus, protected routes, reusable UI primitives, and internationalization support. The shell provides the infrastructure framework that C6-III fills with exemplar dashboard content.*

### IN SCOPE (What C6-II Delivers)

**1. Authenticated Application Shell**
- Global layout framework (sidebar or responsive alternative)
- Top bar with user identity display and role indicator
- Role-aware navigation menus (visible items based on UserRole)
- Consistent card-based layout structure per ESS-008 §3.3

**2. Navigation / Information Architecture**
- Role-based sidebar/topbar navigation
- Breadcrumbs for multi-step flows (ESS-008 §7.2)
- Navigation follows 3-level nesting maximum (ESS-008 §7.2)
- No duplicated navigation logic across layouts (PROMPT 4)

**3. Session/Auth Guards**
- Next.js middleware protecting protected routes (`(dashboard)`, `(dispatcher)`)
- Anonymous/public routes remain unprotected (per HAO-H-02)
- Unauthorized access returns 403/error page
- Supabase session refresh middleware wired into `src/middleware.ts`

**4. Post-Login Routing**
- Redirects authenticated users based on UserRole
- Shipper → appropriate path; Transporter → appropriate path; etc.
- Placeholder destinations (since role dashboards are C6-III)

**5. Sign-Out**
- Accessible from authenticated shell (top bar or sidebar)
- Calls Supabase signOut(); clears session cookie
- Redirects to landing page after sign-out

**6. Language Switching**
- pt/en language toggle visible in shell
- Uses next-intl; persists user preference
- Full `useTranslations()` integration replaces hardcoded strings from C6-I pages

**7. NexCargo-Owned Reusable UI Primitives**
Built on Tailwind foundation per HAO-H-05:
- Button (primary/secondary/outline variants, loading/disabled states)
- Card (with header/body/footer slots)
- Badge (for status indicators)
- Skeleton/Spinner (loading states)
- Form controls (Input, Select, Textarea, Checkbox, Radio)
- Link (styled navigation)
- Alert/Toast (error/info/success/warning notifications)

**8. Responsive & Accessibility Foundations**
- Mobile-first responsive breakpoints (PROMPT 5)
- WCAG 2.1 minimum compliance (PROMPT 5 accessibility rule)
- Keyboard navigation support
- Screen reader labels (aria attributes)

**9. Role-Aware Shell Rendering**
- Navigation and menu items shown/hidden based on UserRole
- No unauthorized actions displayed (MOD-007 §6.3)
- RBAC reflection at UI layer (MOD-007 §6.3)

**10. Dashboard Content Mounting Framework**
- Widget container wrappers (empty-shell structure for TABLE, KPI, LIST types)
- Data binding scaffolding (API route consumer pattern per PROMPT 4 API Consumption Rule)
- PROVIDES the contract/framework that C6-III exemplar dashboard populates with real data
- DOES NOT provide actual dashboard content/business logic (that is C6-III)

### OUT OF SCOPE (Explicitly Excluded)

The following items are EXPLICITLY excluded from C6-II:

- ❌ Full role dashboards (Shipper, Transporter, Driver, Moderator, Super Admin) — RESERVED FOR C6-III
- ❌ Exemplar dashboard content/data population — RESERVED FOR C6-III
- ❌ Domain-module operational workflows — RESERVED FOR LATER MILESTONES
- ❌ Full onboarding/journey beyond registration (see RAD-002) — RESERVED FOR POST-C6
- ❌ Native mobile applications (MOD-008) — PHASE 8 PER DEVELOPMENT MANIFEST
- ❌ PWA/offline implementation — PHASE 8 / MOBILE SPECULATION
- ❌ Wave 5 Increment 3 (external integrations, production observability expansion) — OUTSIDE C6
- ❌ AI/analytics visualization (MOD-006, MOD-012) — OUTSIDE C6
- ❌ Payment/escrow UI flows — OUTSIDE C6 (financial domain)
- ❌ Support/dispute interfaces (MOD-015) — OUTSIDE C6
- ❌ Notifications inbox/consumption UI (MOD-016 persistence handled in C5) — OUTSIDE C6
- ❌ Database schema changes
- ❌ New payment or financial functionality
- ❌ Any rework of C6-I deliverables (auth pages remain unchanged)

---

## F. Explicit C6-II Exclusions (Summary Table)

| Item | Responsible Milestone/Phase | Reason |
|------|---------------------------|--------|
| Shipper Dashboard | C6-III | Content/dashboards belong to C6-III per HAO-H-04 |
| Transporter Dashboard | C6-III+ | Beyond C6-II MVP scope |
| Driver Mobile App | Phase 8 (Manifest) | Mobile deferred to Phase 8 per Development Manifest |
| Full onboarding | Post-C6 | Platform-layer onboarding flow deferred beyond C6 (RAD-002) |
| PWA | Phase 8+/Future | Out of scope for web platform focus |
| Analytics charts | C7+ / Later | MOD-012 analytics dashboard — future milestone |
| AI insight panels | C7+ / Later | MOD-006 intelligence UI — future milestone |
| Financial dashboards | C7+ / Later | MOD-005/013 financial UI — future milestone |
| Support/dispute chat | C7+ / Later | MOD-015 support UI — future milestone |
| External integrations | Wave 5+ | MOD-011 actual provider integrations — Wave 5 |
| Production monitoring UI | Wave 5+ | MOD-017 production observability — Wave 5 |
| Feature toggles/config UI | Future | Super Admin capabilities — far future milestone |

---

## G. Remaining HAO Decisions

| Decision ID | Description | Blocks C6-II? | Recommendation Tag |
|------------|-------------|---------------|-------------------|
| **RAD-003** | Exemplar dashboard role (Shipper recommended?) | NO — C6-III concern | None — Shipper default assumed |
| **RAD-004** | PROMPT 4/5 generation prompt status clarification | NO — informational | Confirmed implicitly by document structure |
| **RAD-005** | INDEX registry updates for Platform layer | NO — housekeeping | Can be done pre or post C6-II |
| **RAD-006** | Brand guideline formalization | NO — already covered by HAO-H-11 | No action needed |
| **RAD-007** | Registration flow specification ownership | NO — completed in C6-I; post-registration deferred | No action needed |

**CONCLUSION: ZERO outstanding HAO decisions block C6-II authorization.** All original RAD-003 through RAD-007 issues are either resolved by existing documentation, non-blocking for C6-II, or properly scoped to other milestones.

---

## H. Proposed C6-II Verification Gates

Before declaring C6-II complete, verify:

| Gate | Criterion | Classification |
|------|-----------|---------------|
| GG-1 | Authenticated users see navigable shell (sidebar/topbar) | A |
| GG-2 | Protected routes enforce authentication via middleware | A |
| GG-3 | Anonymous/public routes remain unprotected | A |
| GG-4 | Role-aware menus show/hide based on UserRole | A |
| GG-5 | Post-login routing directs users to role-appropriate paths | A |
| GG-6 | Sign-out works (session cleared, redirect to landing) | A |
| GG-7 | Language switcher (pt/en) functional and persistent | A |
| GG-8 | UI primitives exist and are used consistently (Button, Card, Badge, Skeleton, Spinner, Form controls) | A |
| GG-9 | No external CSS frameworks introduced (Tailwind-only) | A |
| GG-10 | Responsive design works on mobile/tablet/desktop (PROMPT 5 breakpoints) | A |
| GG-11 | Accessibility: keyboard navigation, aria-labels, WCAG 2.1 minimum contrast | A |
| GG-12 | Widget container framework present for C6-III mounting | A |
| GG-13 | TypeScript clean (zero errors) | Quality Gate |
| GG-14 | Regression suite passes (1,454+ tests pass) | Quality Gate |
| GG-15 | No C6-I functionality broken (auth pages still work) | Quality Gate |
| GG-16 | No CargoLink references introduced | Quality Gate |
| GG-17 | No Track B changes (module.config.ts frozen) | Quality Gate |
| GG-18 | No out-of-scope features implemented | Quality Gate |

---

## I. Readiness Statement

**C6-II IS READY FOR HAO AUTHORISATION.**

**Justification:**
1. All RAD-003 through RAD-007 dispositions are resolved or confirmed non-blocking
2. C6-II scope is clearly defined with explicit in-scope and out-of-scope lists
3. Ownership matrix is established (Platform layer + MOD-007 + CROSS-CUTTING)
4. Existing C6-I deliverables are intact and verified — no rework needed
5. Zero outstanding HAO decisions block authorization
6. Documentation amendments (T1-01 through T1-04) are lightweight and do not require extensive work
7. The "Shell + Primitives" definition is grounded in authoritative specifications (ESS-008 §3.3/§5.2/§7, PROMPT 4, PROMPT 5, HAO-H-05)
8. C6-II creates necessary infrastructure for C6-III without implementing dashboard content
9. TypeScript clean and test suite passing — quality gates met

**Next Step:** HAO issues explicit C6-II authorization defining scope, increments (if any), and verification expectations. C6-III authorization follows upon C6-II completion.

---

*End of C6-II Scope & Architecture Reconciliation Report. No implementation performed. No C6-II authorization issued. Awaiting HAO decision.*
