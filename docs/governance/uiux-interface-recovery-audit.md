# UI/UX Interface Recovery Audit — Pre-C6 Governance Activity

**Document Classification:** READ-ONLY — Findings Only  
**Status:** Findings inform HAO decisions; does NOT authorize implementation  
**Redefined C6:** NO  
**Implementation Sequence Established:** NO  

---

## 0. Scope and Authority

This document is a **pre-C6 governance/recovery activity audit**. It records exhaustive findings from reading every NexCargo specification document relating to user interface design, routing structure, design systems, and module ownership. These findings inform HAO (Handover Approval Office) architectural decisions but do **NOT** authorize implementation, redefine C6 readiness criteria, or establish an implementation sequence.

### 0.1 Document Convention

Every claim cites the exact source document and section. Classification codes:

| Code | Meaning |
|------|---------|
| **A** | SPECIFIED |
| **B** | IMPLIED BUT NOT EXPLICIT |
| **C** | IMPLEMENTED |
| **D** | NOT IMPLEMENTED |
| **E** | CONTRADICTED |
| **F** | UNSPECIFIED |

### 0.2 Document Inventory and Authoritative Hierarchy

The following documents were read exhaustively for this audit, in hierarchical order:

**Governance Layer**
- `PROMPT 0 v1.1` (Master System Prompt) — highest authority
- `nexcargo-boot.md` (Behavioral Kernel)
- `nexcargo-arbitration-layer.md` (Conflict Resolution)
- `nexcargo-index.md` (Specification Index/Knowledge Routing Map)
- `nexcargo-development-manifesto.md` (Development Lifecycle Methodology)
- `nexcargo-ai-specification-interpretation-policy.md`

**Architecture Layer**
- `nexcargo-primitive-registry.md` (Canonical domain objects)
- `nexcargo-event-registry.md` (Business event vocabulary — 620 lines, 14 MOD-001 events enumerated)

**Engineering Standards Specifications (ESS-001 through ESS-009)**
- `ESS-001`: External Integrations (+ appendices A-G)
- `ESS-002`: Lean Testing and QA
- `ESS-003`: AI Intelligence
- `ESS-004`: Integration Contracts
- `ESS-005`: Operational Runbook
- `ESS-006`: Security and Compliance
- `ESS-007`: Coding Standards Specification
- **`ESS-008`**: UI/UX Standards (PRIMARY UI/UX AUTHORITY — 617 lines, 19 sections)
- `ESS-009`: Data Governance

**Module Specifications (MOD-001 through MOD-018)**
Each ~1300–1700 lines covering domain scope, entities, state machines, business rules, integration boundaries, ESS dependencies. Key modules for this audit:

- **MOD-007** (User Dashboards & Experience) — 1436 lines. Defines user interface structure, dashboard architecture, role-based views, widget model, AI insight rendering, i18n model. **Key finding:** "It does not define visual design implementation or frontend frameworks." OWNERSHIP: All user dashboards, localization support.
- **MOD-008** (Mobile Applications & Edge Operations) — 1266 lines. Defines mobile interaction model, offline-first operations, driver/transporter edge workflows. **Key finding:** "It does not define mobile frameworks or app implementation details." OWNERSHIP: Mobile driver interface, offline capability.
- **MOD-015** (Customer Support & Dispute Resolution) — 1680 lines. Multi-channel support, dispute lifecycle, admin investigation tools. OWNERSHIP: Support/dispute interfaces.

**Implementation Prompts**
- **PROMPT 4** (UI/UX Integration Boot) — PRIMARY FRONTEND STRUCTURAL SPECIFICATION
- **PROMPT 5** (Full Design System) — DESIGN SYSTEM SPECIFICATION
- PROMPT 0, 1, 6, 7, 8 (foundational context)

---

## 1. Public Experience Map

### 1.1 Homepage/Landing Page

**Source:** PROMPT 4 §5 ("APP ROUTER STRUCTURE") specifies `/app/(public)` as a route group containing landing page and public information pages. PROMPT 1 §5 references root "/" for application landing.

**Authority Level:** Authoritative specification per PROMPT 4 (UI structural layer mandate).

**Status:** PARTIALLY IMPLEMENTED. Landing page exists at `[locale]/page.tsx` with static JSX (hero, value props, CTAs). However, it lives under `[locale]` routing group rather than `(public)`. No dedicated `(public)/layout.tsx` content exists beyond empty wrapper.

**Classification:** D — NOT IMPLEMENTED (fully planned) / B — IMPLEMENTED (partial stub)

### 1.2 Promotional/Marketing Role

**Source:** ESS-008 Final Principle states "NexCargo feels like one unified operating system, not multiple disconnected apps." This implies the product should present itself as cohesive infrastructure, not marketing-heavy.

**Authority Level:** Interpretive — no explicit marketing/promotional UI specification found.

**Classification:** F — UNSPECIFIED

**Note:** The landing page mentions "CargoLink Marketplace" and "AI-native logistics infrastructure" but no formal marketing copy guidance exists in any documented source.

### 1.3 Onboarding Entry / Registration

**Source:** PROMPT 4 defines `(auth)` route group for login/signup/forgot-password/reset-password. PROMPT 4 §5 explicitly lists: "login, signup, forgot-password, reset-password". ESS-008 §17 requires all UI text to be localized (pt/en).

**Authority Level:** Authoritative specification (PROMPT 4 UI structural layer mandate).

**Status:** NOT IMPLEMENTED. Auth pages do NOT exist. `(auth)/layout.tsx` renders only `{children}`. No sign-in, register, or password recovery pages exist. Landing page links reference `/auth/sign-in` and `/auth/register` which return 404.

**Classification:** D — NOT IMPLEMENTED

### 1.4 Role Selection During Registration

**Source:** The eight canonical classifications (SHIPPER / TRANSPORTER / DRIVER / DISPATCHER / MODERATOR / ADMIN / SUPER_ADMIN / SYSTEM) are now carried by the specification layer: PROMPT 0 v1.3 §USER ROLES, ESS-006 §4.1, MOD-010 §3.1 and §4.1, MOD-006, MOD-007 §3.1/§4.1 and PROMPT 7, all reconciled on 2026-10-30 under HAO authorization NXC-HOA-AUTH-ROLE-001. Previously this list existed only in the Development State Registry (HAO-RRL-001, HAO-R-003) while PROMPT 0 v1.1 §USER ROLES and ESS-006 §4.1 omitted SUPER_ADMIN, MOD-010 omitted DISPATCHER and SUPER_ADMIN, and MOD-007 §5 provided no Admin dashboard. PROMPT 7 formerly also listed the non-role "Fleet Owner"; that entry was removed on 2026-10-30. MOD-007 §5.1–5.7 now maps seven role surfaces to dashboards (Dispatcher §5.4 and Admin §5.6 added). Role **authority boundaries** are now specified in PROMPT 0 v1.3 §ROLE PROVISIONING AND DELEGATION; the registration/onboarding **user-interface flow** is still not specified anywhere.

**Authority Level:** MISSING — ROLES ARE DEFINED but ROLE SELECTION PROCESS IS UNSPECIFIED.

**Finding [UX-R001]:** User role selection during registration is NOT specified in any authoritative document. Users are mapped to SHIPPER/TRANSPORTER/DRIVER/DISPATCHER/MODERATOR/ADMIN/SUPER_ADMIN but no registration flow, onboarding wizard, or role-choice screen is documented.

**Update 2026-10-30 (NXC-HOA-AUTH-ROLE-001, HD-RT-6):** the governing boundary now exists — PROMPT 0 v1.3 §ROLE PROVISIONING AND DELEGATION states that only SHIPPER and TRANSPORTER are self-service at registration, that DRIVER is onboarded exclusively by an authorised Transporter and is not publicly selectable, that DISPATCHER exists only by explicit Transporter delegation, and that MODERATOR/ADMIN/SUPER_ADMIN are platform-assigned. The registration and onboarding **UI flow** remains unspecified, so the UX gap in this finding stands; only the authority question is closed.

**Classification:** F — UNSPECIFIED — REQUIRES ARCHITECTURAL DECISION

### 1.5 Public Marketplace Discovery (Anonymous Listings/Search)

**Source:** MOD-001 §5.2 defines Shipper UI includes "Create and manage shipment requests" and Transporter UI includes "Browse available loads (filtered by route, capacity)." However, these are ROLE-BASED (authenticated) experiences. MOD-007 §6.3 states "UI reflects RBAC constraints" and "hiding unauthorized actions from view."

**Authority Level:** Authoritative — anonymous/public listing discovery is NOT specified. Marketplace browsing appears to be authenticated-only.

**Finding [UX-R002]:** Whether non-authenticated users can discover/search marketplace listings (listings, offers) is NOT specified. MOD-007 §6.3 mandates RBAC visibility — implying role-restricted access — but neither confirms nor denies public browsing intent.

**Classification:** F — UNSPECIFIED for anonymous access

### 1.6 Public vs Authenticated Experience Boundary

**Source:** PROMPT 4 defines three route groups: `(public)`, `(auth)`, `(dashboard)`. PROMPT 4 §RBAC UI ENFORCEMENT: "Each route MUST enforce: authentication, role validation, permission checks." MOD-007 §7.1: "UI is NOT a Security Layer. Backend enforces security." ESS-006 §3.3: JWT claims include `languagePreference`.

**Authority Level:** Authoritative.

**Status:** Route groups exist structurally but middleware auth is NOT wired. Middleware function exists in `web/src/lib/supabase/middleware.ts` but no `src/middleware.ts` calls `updateSession()`. Protected routes (`/dashboard/*`, `/dispatcher/*`) are unprotected.

**Classification:** D — NOT IMPLEMENTED (auth guards) / C — IMPLEMENTED (route group structure)

---

## 2. Onboarding Flow Map

### 2.1 Visitor → Registration → Account/Profile → Verification → First Use

**Source:** NO document in the entire NexCargo specification documents a progressive onboarding flow. Registration endpoints are defined in PROMPT 4 but the subsequent steps (profile setup, verification, first-use guidance) are NOT described.

**Authority Level:** MISSING

**Finding [UX-R003]:** Progressive onboarding (visitor → registration → profile → verification → first use) is NOT documented anywhere in the NexCargo specification. Only registration/auth entry points are defined; the post-registration journey is undefined.

**Classification:** F — UNSPECIFIED

### 2.2 Shipper/Transporter/Organisation Onboarding Variants

**Source:** MOD-007 defines role-specific dashboards (Shipper, Transporter, Driver, Dispatcher, Moderator, Admin, Super Admin). Each has distinct capabilities (§5.1–§5.7; Dispatcher §5.4 and Admin §5.6 added and the section renumbered on 2026-10-30). But NO separate onboarding flows per role type are specified.

**Classification:** F — UNSPECIFIED

### 2.3 Identity Verification Flow

**Source:** MOD-007 §5.5 (Moderator Dashboard, renumbered from §5.4 on 2026-10-30): "Approve or reject identity verifications". This implies identity verification EXISTS as a workflow. MOD-010 §5.1 describes compliance/governance framework. However, the actual verification UI/flow for end-users is NOT specified.

**Authority Level:** IMPLIED but NOT EXPLICITLY specified in terms of UI/screens/workflow.

**Classification:** B — IMPLIED BUT NOT EXPLICIT

---

## 3. Authenticated Application Experience Map

### 3.1 Dashboard/Workspace Structure

**Source:** MOD-007 §4.1 — Dashboard View Object with attributes: `dashboardId`, `roleContext` (SHIPPER/TRANSPORTER/DRIVER/MODERATOR/ADMIN), `moduleScope` (array of MOD refs), `layoutType` (OPERATIONAL/ANALYTICAL/HYBRID), `widgetCollection`, `refreshPolicy`, `visibilityRules`.

MOD-007 §4.2 — Widget Object with types: TABLE/CHART/TIMELINE/KPI/AI_INSIGHT/MAP/FORM/LIST.

MOD-007 §5.1–5.7 — Seven role-specific dashboards each with specific feature sets (Dispatcher §5.4 and Admin §5.6 added 2026-10-30; Moderator, Super Admin, Module-Based Views and Internationalization renumbered to §5.5, §5.7, §5.8, §5.9).

**Authority Level:** Authoritative specification (MOD-007).

**Status:** NOT IMPLEMENTED. Domain types/interfaces exist in working tree (design-time Wave 3 artifacts) but NO actual dashboard UI/pages exist. `(dashboard)/layout.tsx` renders only `{children}`.

**Classification:** D — NOT IMPLEMENTED

### 3.2 Navigation

**Source:** ESS-008 §7: Global navigation must be "role-based, minimal, consistent across modules." Section 7.2: "avoid deep nesting beyond 3 levels, breadcrumbs required for complex flows." PROMPT 4 §SHARED UI LAYOUT SYSTEM: language switcher component available in all layouts, each role has isolated layout, shared UI components only via `/shared/ui`, no duplication of navigation logic.

**Authority Level:** Authoritative (ESS-008 §7 + PROMPT 4).

**Status:** NOT IMPLEMENTED. No sidebar, no topbar, no breadcrumb, no global navigation component exists. Each page is self-contained with inline JSX.

**Classification:** D — NOT IMPLEMENTED

### 3.3 Role-Specific Interfaces

#### 3.3.1 Shipper Dashboard (MOD-007 §5.1)
**Features:** Create/manage shipments, View active shipments & status, Compare transporter bids, Track real-time, Access invoices/documents, Manage escrow payments, View AI recommendations, Analyze performance metrics.

**Classification:** D — NOT IMPLEMENTED

#### 3.3.2 Transporter Dashboard (MOD-007 §5.2)
**Features:** Browse loads (filtered), Submit/manage bids, Accept/manage shipments, Manage fleet/drivers, Track active trips, View earnings/payouts, Access performance analytics, View AI load recommendations.

**Classification:** D — NOT IMPLEMENTED

#### 3.3.3 Driver Interface (MOD-007 §5.3)
**Features:** View assigned trips, Navigation/route guidance, Check-in/out, Capture POD, Upload docs offline, Receive SOS alerts, Sync GPS, Chat with dispatcher/shipper.

**Classification:** D — NOT IMPLEMENTED

#### 3.3.4 Moderator Dashboard (MOD-007 §5.5 — renumbered from §5.4)
**Features:** Review/resolve disputes, Approve/reject identity verifications, Monitor suspicious activity, Manage user reports, Oversee transaction holds, Access audit logs, Handle rating disputes.

**Classification:** D — NOT IMPLEMENTED

#### 3.3.5 Super Admin Dashboard (MOD-007 §5.7 — renumbered from §5.5)
**Features:** Global analytics, User management, System configuration, Payment integration monitoring, Escrow bank monitoring, AI oversight, Audit logs, Feature toggles/settings.

**Classification:** D — NOT IMPLEMENTED

#### 3.3.6 Module-Based Views (MOD-007 §5.8 — renumbered from §5.6)
| Module | UI Surface |
|--------|-----------|
| MOD-001 | Marketplace UI |
| MOD-002 | Booking/Contract UI |
| MOD-003 | Tracking UI |
| MOD-004 | Document Management UI |
| MOD-005 | Financial UI (restricted) |
| MOD-006 | Intelligence UI |

**Classification:** D — NOT IMPLEMENTED

### 3.4 Dispatcher Interface

**Source:** PROMPT 4 §Role-Based UI Architecture lists `/dispatcher` with sub-routes: `/live-ops`, `/assignments`, `/tracking`, `/exceptions`. Approved by HAO-R-002 (Dispatcher Dashboard Approval).

**Authority Level:** Authoritative.

**Status:** PARTIALLY IMPLEMENTED. Dispatcher dashboard home page exists and is fully styled with nav cards. Sub-pages exist but contain only structural headers. No backend API wiring for live data.

**Classification:** B — IMPLEMENTED (structural only)

### 3.5 Marketplace, Booking, Contract, Tracking, Financial, Notification, Support/Dispute Interfaces

**Source:** MOD-007 §5.8 (renumbered from §5.6 on 2026-10-30) maps each module's functionality to a UI surface. MOD-007 §9 integration boundaries specify UI display responsibility per module.

**Authority Level:** Authoritative (interface RESPONSIBILITY is specified, concrete UI implementation is deferred).

**Classification:** D — NOT IMPLEMENTED for all

---

## 4. Role → Interface Matrix

| Role | Source Role Definition | Assigned Dashboard(s) | Primary UI Surfaces | Permission Differences | Status |
|------|----------------------|---------------------|--------------------|--------------------|--------|
| SHIPPER | UserRole enum, HAO PE-H04 taxonomy | MOD-007 §5.1 Shipper Dashboard | Shipment creation, tracking, bid comparison, escrow payment, AI recommendations, performance analytics | Can create listings, submit bookings, view own data | D |
| TRANSPORTER | UserRole enum | MOD-007 §5.2 Transporter Dashboard | Load discovery, bidding, shipment acceptance, fleet/driver management, trip tracking, earnings, analytics, AI recommendations | Can browse listings, submit offers/bids, manage own fleet | D |
| DRIVER | UserRole enum | MOD-007 §5.3 Driver Mobile App Interface | Trip viewing, navigation, check-in/out, POD capture, offline doc upload, SOS alerts, GPS sync, chat | Minimal navigation, simplified UI, offline-first, field execution focus | D |
| DISPATCHER | Canonical classification, PROMPT 0 v1.3 / HAO-R-002 approved | MOD-007 §5.4 Dispatcher Dashboard (specified 2026-10-30), `(dispatcher)/` route group | Live operations monitoring, assignment allocation, fleet tracking, exception resolution — bounded by explicit Transporter delegation | Delegated operational control only within the Transporter's scope; no Driver onboarding, personnel, financial or administrative authority by default | B (structural only; specification newer than implementation) |
| MODERATOR | Canonical classification, PROMPT 0 v1.3 | MOD-007 §5.5 Moderator Dashboard | Dispute resolution, identity verification review, suspicious activity monitoring, user reports, transaction holds, audit logs, rating disputes | Review/investigation authority, no financial execution authority | D |
| ADMIN | Canonical classification, PROMPT 0 v1.3 / HAO-R-003 | MOD-007 §5.6 Admin Dashboard (added 2026-10-30; previously only §5.7 Super Admin existed) | System config, user mgmt, payment monitoring, escrow monitoring, AI oversight, audit logs, feature toggles | Approved Admin permission set + governed escrow intervention; SUPER_ADMIN-exclusive controls excluded | D (specification newer than implementation — no /admin surface has been built) |
| SUPER_ADMIN | Canonical classification, PROMPT 0 v1.3 §USER ROLES / HAO-R-003 | MOD-007 §5.7 Super Admin Dashboard | All approved Moderator and Admin permissions plus enumerated SUPER_ADMIN-exclusive controls | Explicit permission superset — governance-role administration, enactment of HAO-approved taxonomy changes, and the five HD-RT-8 executive authority domains documented in PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS; no financial authority from hierarchy position | D (specification newer than implementation) |
| SYSTEM | Canonical non-human classification, PROMPT 0 v1.3 §USER ROLES (added 2026-10-30) | Not applicable | Not applicable | Non-human platform actor; never provisioned as a human login role | N/A |
| AI_SYSTEM_AGENT | AI designation inside the SYSTEM classification (not a separate human-accessible role) | Not applicable | Not applicable | Internal processing actor per ESS-003; read + recommend only | N/A |

**Notes:**
- USER is NOT an application role. Unauthenticated accounts use null pending/onboarding state per HAO PE-H04.
- FLEET_OWNER removed from UserRole enum as top-level role. Fleet ownership preserved as business concept in MOD-014.

---

## 5. UI/UX Ownership Matrix

### 5.1 Critical Finding [UX-R004]

Public experience (landing page, auth pages, promotional content) is NOT owned by any business module. It falls under PROMPT 4 (UI/UX Integration Boot) for route structure and PROMPT 7 (Authentication + RBAC) for auth flows. No MOD-N designation exists for public-facing UI. This is a deliberate architectural separation — the 18 modules cover BACKEND domain capabilities, while the PUBLIC PRESENTATION LAYER is implicitly handled outside the MOD ecosystem.

### 5.2 Full Ownership Matrix

| UI Capability | Domain Ownership | UI/UX Presentation Ownership | Design System Ownership | Auth/Public Experience Ownership | Document Sources |
|--------------|-----------------|----------------------------|----------------------|-------------------------------|-----------------|
| Marketplace Listings & Matching | MOD-001 | MOD-007 (display only, §9) | ESS-008 §5, PROMPT 5 | None (authenticated-only per MOD-007 §6.3) | MOD-007 §5.8, MOD-007 §9, MOD-001 |
| Booking & Contracts | MOD-002 | MOD-007 (display only) | ESS-008 §5, PROMPT 5 | None | MOD-007 §5.8, MOD-007 §9 |
| Tracking & Visibility | MOD-003 | MOD-007 (real-time map, status updates, §9) | ESS-008 §5, §10 (map rules) | None | MOD-007 §5.8, MOD-007 §9 |
| Documents | MOD-004 | MOD-007 (upload, download, signature) | ESS-008 §5, §10 | None | MOD-007 §5.8, MOD-007 §9 |
| Escrow & Payments | MOD-005 | MOD-007 (financial dashboards, restricted views, §9) | ESS-008 §11 (financial UI rules), §5 | None | MOD-007 §5.8, MOD-007 §9 |
| AI Intelligence | MOD-006 | MOD-007 (advisory panels, §7.5 AI Rendering Rule) | ESS-008 §12 (AI UI rules) | None | MOD-007 §5.8, MOD-007 §9 |
| User Dashboards & Experience | **MOD-007 (Primary UI Owner)** | **MOD-007 (SELF)** | ESS-008 §5 + PROMPT 5 | N/A | MOD-007 §§3,4,5,6,7,8,9 |
| Mobile Applications | MOD-008 | MOD-008 (native device screens, §3) | ESS-008 §8 (mobile UX rules) | None | MOD-008 §3, §5 |
| Regional/Cross-Border | MOD-009 | MOD-007 (information panels, advisory) | ESS-008 §17 (i18n rules) | None | MOD-007, MOD-009 |
| Security/Compliance | MOD-010 | MOD-007 (settings, audit logs, §9) | ESS-008 §5, §13 (accessibility) | N/A | MOD-007 §5.8, MOD-007 §9 |
| Platform Integration/API | MOD-011 | MOD-007 (API management UI, webhook logs) | ESS-008 §5 | N/A | MOD-007 §5.8, MOD-007 §9 |
| Analytics/Data Platform | MOD-012 | MOD-007 (analytics dashboards, read-only) | ESS-008 §6 (data viz rules) | None | MOD-007 §5.8, MOD-007 §9 |
| Financial Infrastructure | MOD-013 | MOD-007 (settlement views, reconciliation) | ESS-008 §11 (financial UI) | None | MOD-007 §5.8, MOD-007 §9 |
| Fleet/Asset Management | MOD-014 | MOD-007 (fleet asset viewer) | ESS-008 §5 | None | MOD-007 §5.8, MOD-007 §9 |
| Customer Support/Disputes | MOD-015 | MOD-007 (support dashboard UI, §9) | ESS-008 §5 | None | MOD-007 §9, MOD-015 |
| Notifications/Communication | MOD-016 | MOD-007 (notification preferences, channel delivery display) | ESS-008 §5, §14 (error UI) | N/A | MOD-007 §9, MOD-016 |
| Observability/Monitoring | MOD-017 | MOD-007 (monitoring dashboards, no intervention rule) | ESS-008 §5 | N/A | MOD-007 §9, MOD-017 |
| Growth/Pricing | MOD-018 | MOD-007 (pricing suggestions display, advisory labels) | ESS-008 §12 (AI UI rules) | None | MOD-007 §9, MOD-018 |
| **Public Pages (landing, auth)** | **NOT ASSIGNED TO ANY MODULE** | **PROMPT 4 (UI route structure)** | **ESS-008** | **PROMPT 4 + PROMPT 7** | PROMPT 4 §5, PROMPT 7 |
| **Design System Components** | **NONE** | **PROMPT 5 (Full Design System)** | **PROMPT 5 + ESS-008 §3** | **N/A** | PROMPT 5, ESS-008 §3 |
| **Authentication Flows** | **NOT ASSIGNED TO A BUSINESS MODULE** | **PROMPT 4 (auth route group)** | **ESS-008 §5** | **PROMPT 7 (Auth + RBAC)** | PROMPT 4 §5, PROMPT 7 |
| **Navigation/Layout System** | **NONE** | **PROMPT 4 (Shared UI Layout System)** | **ESS-008 §3.3** | **N/A** | PROMPT 4, ESS-008 §7 |
| **Multilingual/i18n** | **MOD-009 (region-language mapping)** | **MOD-007 + PROMPT 4 §LOCALIZATION** | **ESS-008 §17, ESS-007 §18** | **MOD-007 §3.7, ESS-009 §19** | MOD-007 §7.8, ESS-008 §17 |

---

## 6. Design System Requirements

### 6.1 Visual Language / Styling Framework

**Source:** ESS-008 §3.1: "ALL styling MUST use Tailwind CSS, no inline styles (except rare dynamic cases), no external CSS frameworks."

**Implementation:** `globals.css` has basic Tailwind import, light/dark theme variables. Minimal custom design tokens.

**Classification:** C — Partially implemented (Tailwind configured, minimal tokens)

### 6.2 Design Tokens

**Source:** PROMPT 5 §DESIGN TOKENS (CORE FOUNDATION): centralized token system with colors (primary/secondary/success/warning/danger/neutral), spacing (4px base scale: 4,8,12,16,24,32,48,64), typography (font-sans, font-mono, scale xs→sm→md→lg→xl→2xl→4xl), radius (sm/md/lg/xl), shadow (sm/md/lg/xl).

**Implementation:** `globals.css` defines `--background` and `--foreground` CSS variables only. NO design token system for colors beyond light/dark mode defaults. No spacing/typography/radius/shadow tokens defined.

**Classification:** D — NOT IMPLEMENTED

### 6.3 Typography

**Source:** PROMPT 5 defines font-sans, font-mono, scale from xs to 4xl. `globals.css` imports geist-sans and geist-mono fonts.

**Implementation:** Fonts declared in @theme inline block but no usage hierarchy defined in CSS.

**Classification:** B — IMPLEMENTED (fonts loaded, no typographic scale applied)

### 6.4 Color System

**Source:** PROMPT 5: primary/secondary/success/warning/danger/neutral. `globals.css`: `--background` (#ffffff/#0a0a0a), `--foreground` (#171717/#ededed).

**Implementation:** ONLY background/foreground defined. NO semantic color palette (success, warning, danger, primary, secondary) implemented.

**Classification:** D — NOT IMPLEMENTED

### 6.5 Component Library (Mandatory Standard Components)

**Source:** ESS-008 §5.2: Mandatory standard components: Card, Table, Modal, Form, Status Badge, Timeline (shipment tracking), Map Container.

PROMPT 5 §COMPONENT LIBRARY STRUCTURE defines:
- Button System (primary/secondary/outline/danger/ghost variants, loading/disabled/active states)
- Input System (text/number/password/select/textarea/search/file upload, validation/error/helper states)
- Card System (header/body/footer/clickable variants)
- Table System (pagination/sorting/filtering/row selection/expandable rows/loading skeletons)
- Modal System (confirm/form/alert/full-screen)
- Badge System (shipment/payment/verification/risk status)
- Navigation System (role-based sidebar, collapsible menus, mobile bottom nav, admin dashboard nav)
- Notification System (success/error/warning/info, toast notifications, persistent alerts)
- Loading System (skeleton loaders, spinner states, progress indicators)

**Authority Level:** Authoritative (both ESS-008 and PROMPT 5).

**Implementation:** ZERO component library exists. All pages use raw inline JSX. No Card, Button, Table, Modal, Form, Badge, Skeleton, Spinner, Toast, Sidebar, TopBar, or any reusable component exists anywhere in `web/src/`.

**Classification:** D — NOT IMPLEMENTED

### 6.6 Forms

**Source:** ESS-008 §5.2 (Form as mandatory component). PROMPT 5 §Input System with validation states, error display, helper text. PROMPT 4 §Localisation Requirements: "All form labels and validation messages" must be localized. ESS-007 §8: "all mutations MUST use Server Actions or service layer, no direct DB mutation from client."

**Classification:** D — NOT IMPLEMENTED

### 6.7 Cards, Tables, Modals

**Source:** ESS-008 §5.2 (Card, Table, Modal mandatory). PROMPT 5 defines detailed specs for each.

**Classification:** D — NOT IMPLEMENTED

### 6.8 Status Badges / State Indication

**Source:** ESS-008 §5.2, §15: "Every entity MUST clearly show state." ESS-008 §5.2: Badge as mandatory component.

Shared enums.ts contains `ShipmentStatus`, `EscrowState`, `ContractStatus`, `ListingStatus`, `OfferStatus`, `MatchStatus` — all domain state enums exist.

**Classification:** D — NOT IMPLEMENTED (types exist, no visual representation)

### 6.9 Loading/Error/Empty States

**Source:** ESS-008 §9: "loading states must always exist, skeleton loaders required for tables/cards, no blank screens allowed, optimistic UI allowed only for non-financial actions." ESS-008 §14: "All errors MUST use ESS-001E standardized codes, be user-readable, avoid technical jargon, provide retry option."

**Classification:** D — NOT IMPLEMENTED

### 6.10 Responsive / Accessibility

**Source:** ESS-008 §8: "mobile-first design mandatory for drivers, low-bandwidth optimization required, offline mode must degrade gracefully, large tap targets required." ESS-008 §13: "minimum contrast compliance required, keyboard navigation supported, readable typography hierarchy, no critical function hidden behind hover-only UI."

PROMPT 5 §RESPONSIVE DESIGN RULE: "System MUST support: mobile-first driver workflows, tablet fleet operations, desktop admin dashboards."

PROMPT 5 §ACCESSIBILITY RULE: "All components MUST support keyboard navigation, screen readers, include aria labels, maintain contrast compliance (WCAG 2.1 minimum)."

**Implementation:** `globals.css` media query for dark mode only. No responsive breakpoints defined in CSS. No aria-labels, no keyboard navigation testing, no WCAG compliance measures in codebase.

**Classification:** D — NOT IMPLEMENTED

### 6.11 Dark/Light Mode

**Source:** PROMPT 5 defines theming via Tailwind config.

**Implementation:** `globals.css` has `@media (prefers-color-scheme: dark)` with `--background` and `--foreground` swap. Basic dark mode support EXISTS.

**Classification:** C — IMPLEMENTED (basic)

### 6.12 Multilingual/i18n

**Source:** ESS-008 §17: pt default, en for SADC. Automatic detection (IP geolocation → country → language), manual override, locale-aware formatting (dates/currency/numbers), all UI text/buttons/navigation localized, no hardcoded strings. next-intl configured. locales/en/common.json and locales/pt/common.json exist with 4 stub keys each.

**Implementation:** next-intl configured, i18n/request.ts handles locale resolution, translation files exist but nearly empty (4 keys each).

**Classification:** B — PARTIALLY IMPLEMENTED (infrastructure configured, translations nearly empty)

---

## 7. Mobile/PWA Requirements

### 7.1 Responsive Web

**Source:** ESS-008 §8 (mobile-first for drivers). PROMPT 5 responsive breakpoints: mobile/tablet/desktop/ultra-wide.

**Classification:** D — NOT IMPLEMENTED

### 7.2 PWA / Offline

**Source:** MOD-008 §5.2: offline behavior model — ONLINE → OFFLINE DETECTED → LOCAL DATA CAPTURE → QUEUE STORAGE → CONNECTIVITY RESTORED → SYNCHRONISATION.

MOD-008 §7.4: "Mobile layer MUST only expose required operational data. No full system visibility on edge devices. Sensitive data MUST be encrypted locally."

PROMPT 1 §DESIGN PRINCIPLES: "Offline-first for field operations, battery and bandwidth optimized."

PROMPT 0 v1.1 §Mobile-First Infrastructure Layer: "offline-first synchronization, priority queuing, idempotent API design."

**Implementation:** NO PWA manifest, NO service workers, NO offline storage, NO sync queue engine exists. Domain types/entities exist in working tree (Wave 3 design-time artifacts).

**Classification:** D — NOT IMPLEMENTED

### 7.3 Mobile-Specific Workflows

**Source:** MOD-008 §5.1 Field Execution Flow: Task Assigned → Task Received → Acknowledged → Trip Execution → Edge Event Captured → Local Queue → Sync.

MOD-007 §5.3: Driver mobile app interface — view trips, navigation, check-in, POD capture, offline docs, SOS alerts, GPS sync, chat.

**Classification:** D — NOT IMPLEMENTED (domain definitions only)

### 7.4 Native Mobile Plans

**Source:** MOD-008 §3.1: "native mobile applications for Android and iOS." Development Manifest §6 Phase 8: "Mobile applications reuse the platform's shared services while providing native device experiences. Only presentation and device-specific functionality differ from the web implementation."

**Classification:** D — NOT IMPLEMENTED (spec exists, implementation deferred to Phase 8)

---

## 8. Routing / Information Architecture Map

### 8.1 Planned Route Structure (Per PROMPT 4)

```
/app
├── /[locale]                    ← Internationalized root (multilingual)
│   └── page.tsx                 ← Landing/home
├── (public)                     ← Public pages (no auth needed)
│   └── *                        ← Information pages, about, terms
├── (auth)                       ← Authentication pages
│   ├── sign-in                  ← Login page
│   ├── register                 ← Create account
│   ├── forgot-password          ← Password recovery
│   └── reset-password           ← Set new password
├── (shipper)                    ← Shipper workspace
│   ├── /dashboard               ← Shipper overview
│   ├── /shipments               ← List/create/manage shipments
│   ├── /create-shipment         ← New shipment wizard
│   ├── /tracking                ← Active shipment tracking
│   ├── /payments                ← Escrow/financial status
│   └── /history                 ← Past shipments
├── (transporter)                ← Transporter workspace
│   ├── /dashboard               ← Transporter overview
│   ├── /loads                   ← Available loads (browse/search)
│   ├── /bids                    ← Submitted bids
│   ├── /fleet                   ← Fleet management
│   ├── /earnings                ← Earnings/payouts
│   └── /routes                  ← Active/completed routes
├── (driver)                     ← Driver mobile-first interface
│   ├── /trips                   ← Assigned trips
│   ├── /navigation              ← Route guidance
│   ├── /check-in                ← Pickup/delivery checkpoints
│   ├── /pod                     ← Proof of Delivery capture
│   └── /history                 ← Completed trips
├── (fleet-owner)                ← Fleet owner workspace
│   ├── /fleet-overview          ← Fleet summary
│   ├── /vehicles                ← Vehicle registry
│   ├── /drivers                 ← Driver assignments
│   ├── /assignments             ← Active assignments
│   └── /performance             ← Fleet analytics
├── (dispatcher)                 ← Dispatcher operations
│   ├── /live-ops                ← Real-time monitoring
│   ├── /assignments             ← Allocation management
│   ├── /tracking                ← Fleet/shipment tracking
│   └── /exceptions              ← Incident resolution
├── (admin)                      ← Administrator workspace
│   ├── /system                  ← System overview
│   ├── /users                   ← User management
│   ├── /financial-control       ← Escrow/payment oversight
│   ├── /audit-logs              ← Audit log viewer
│   ├── /config                  ← System configuration
│   └── /escrow-intervention     ← Governed escrow controls
└── api                          ← API Routes
    ├── api/mobile/dashboard     ← Aggregated mobile dashboards
    ├── api/webhooks/*           ← External provider webhooks
    ├── api/marketplace/*        ← Listing/offer/match/quote CRUD
    ├── api/booking/*            ← Booking lifecycle
    └── ... (one per module domain)
```

### 8.2 Current Actual Route Structure

```
/app
├── /[locale]/page.tsx           ← Landing (static JSX)
├── (public)/layout.tsx          ← Empty wrapper
├── (auth)/layout.tsx            ← Empty wrapper
├── (dashboard)/layout.tsx       ← Empty wrapper
├── (dispatcher)/                ← Structured!
│   ├── page.tsx                 ← Nav cards (4 sections)
│   ├── live-ops/page.tsx        ← Stub
│   ├── assignments/page.tsx     ← Stub
│   ├── exceptions/page.tsx      ← Stub
│   └── tracking/page.tsx        ← Stub
└── api/                         ← Full API route structure
    ├── api/route.ts             ← Health check
    ├── api/marketplace/*        ← CRUD routes (fully implemented)
    ├── api/booking/*            ← Routes with confirm endpoint
    ├── api/settlements/*        ← Settlement API
    ├── api/webhooks/*           ← MPESA + settlement webhooks
    ├── api/reconciliation/*     ← Reconciliation API
    ├── api/disputes/*           ← Dispute hold/resolution
    ├── api/notifcations/*       ← Notification routes
    ├── api/documents/*          ← Document routes
    ├── api/communication/*      ← Communication routes
    ├── api/data/*               ← Analytics routes
    ├── api/platform/*           ← Platform health
    ├── ai/*                     ← AI routes
    ├── logistics/*              ← Logistics routes
    ├── compliance/*             ← Compliance routes
    ├── financial/*              ← Financial routes
    ├── mobile/dashboard/*       ← Mobile dashboard
    ├── mobile/sync/*            ← Mobile sync
    └── settlements/*            ← Settlement routes
```

### 8.3 Route Implementation Summary

| Route Group | Status |
|------------|--------|
| `[locale]/` | C — IMPLEMENTED (landing page) |
| `(public)/` | D — NOT IMPLEMENTED (empty layout only) |
| `(auth)/` | D — NOT IMPLEMENTED (empty layout only) |
| `(dashboard)/` | D — NOT IMPLEMENTED (empty layout only) |
| `(shipper)/` | D — NOT CREATED as route group |
| `(transporter)/` | D — NOT CREATED as route group |
| `(driver)/` | D — NOT CREATED as route group |
| `(fleet-owner)/` | D — NOT CREATED as route group |
| `(dispatcher)/` | B — PARTIALLY IMPLEMENTED (home page + 4 stub sub-pages) |
| `(admin)/` | D — NOT CREATED as route group |
| `api/` | C — FULLY STRUCTURED (one per domain, many with full CRUD implementation) |

---

## 9. Current Implementation vs Specification Comparison

| Spec Area | Planned (Per Docs) | Actual (In Code) | Classification |
|-----------|-------------------|-----------------|---------------|
| **Landing/Home Page** | `[locale]/page.tsx` or `(public)/` layout, per PROMPT 4 | `[locale]/page.tsx` — static JSX, hero/value props/CTAs, NexCargo branding | C — Partially Implemented |
| **Public Info Pages** | `(public)/` route group with about/terms/privacy | `(public)/layout.tsx` exists but is empty `{children}` wrapper | D — Not Implemented |
| **Sign-In Page** | `(auth)/sign-in` — email/password login | DOES NOT EXIST | D |
| **Register Page** | `(auth)/register` — create account | DOES NOT EXIST | D |
| **Forgot-Password Page** | `(auth)/forgot-password` | DOES NOT EXIST | D |
| **Reset-Password Page** | `(auth)/reset-password` | DOES NOT EXIST | D |
| **Sign-Out Functionality** | Any logged-in page | DOES NOT EXIST | D |
| **Auth Middleware Guards** | Protect `(dashboard)`, `(shipper)`, etc. | NOT WIRED. Middleware function exists but no `src/middleware.ts` calls it. | D |
| **Shipper Dashboard** | `(shipper)/dashboard` + sub-pages | DOES NOT EXIST | D |
| **Transporter Dashboard** | `(transporter)/dashboard` + sub-pages | DOES NOT EXIST | D |
| **Driver Interface** | `(driver)/trips` etc. | DOES NOT EXIST | D |
| **Admin Dashboard** | `(admin)/system` etc. | DOES NOT EXIST | D |
| **Dispatcher Dashboard** | `(dispatcher)/` with live-ops, assignments, tracking, exceptions | PARTIALLY IMPLEMENTED — home page styled with 4 nav cards; sub-pages are structural stubs | B |
| **Sidebar/Global Nav** | Role-based sidebar, consistent across modules (ESS-008 §7.1) | DOES NOT EXIST — each page self-contained | D |
| **Breadcrumbs** | Required for complex flows (ESS-008 §7.2) | DOES NOT EXIST | D |
| **Language Switcher** | Visible in all layouts (PROMPT 4) | DOES NOT EXIST | D |
| **Component Library** | Card, Table, Modal, Form, Badge, Button, Skeleton, etc. (ESS-008 §5.2, PROMPT 5) | DOES NOT EXIST — all JSX inline | D |
| **Cards** | Mandatory standard component (ESS-008 §5.2) | USED AS INLINE JSX DIVS everywhere (not extracted to component) | D |
| **Tables** | Mandatory with pagination/sorting/filtering (PROMPT 5) | DOES NOT EXIST | D |
| **Forms** | Mandatory with validation/error states (PROMPT 5) | DOES NOT EXIST | D |
| **Modals** | Mandatory system (PROMPT 5) | DOES NOT EXIST | D |
| **Badges** | Mandatory for status display (ESS-008 §5.2) | DOES NOT EXIST | D |
| **Skeleton Loaders** | Required for tables/cards (ESS-008 §9) | DOES NOT EXIST | D |
| **Spinner States** | Required (PROMPT 5) | DOES NOT EXIST | D |
| **Toast Notifications** | Required (PROMPT 5) | DOES NOT EXIST | D |
| **Error Pages** | 404, 500, unauthorized (ESS-008 §14) | DOES NOT EXIST | D |
| **Dark Mode** | Light/dark toggle (globals.css media query) | BASIC SUPPORT — dark mode via `prefers-color-scheme` only, no toggle | B |
| **Typography Scale** | xs→sm→md→lg→xl→2xl→4xl (PROMPT 5) | FONTS LOADED (geist-sans/mono) but NO SCALE APPLIED | B |
| **Color System** | primary/secondary/success/warning/danger/neutral (PROMPT 5) | ONLY --background/--foreground CSS vars defined | D |
| **Spacing System** | 4px base scale (PROMPT 5) | NO SPACING TOKENS DEFINED | D |
| **i18n Infrastructure** | next-intl configured, pt/en default (ESS-008 §17) | CONFIGURED — next-intl plugin in next.config.ts, i18n/request.ts, locales/ folder | C |
| **i18n Content** | All UI text externalized (ESS-008 §17.5) | ONLY 4 translation keys in en/common.json and pt/common.json | D |
| **API Routes** | One per module domain (PROMPT 4) | FULLY STRUCTURED — 40+ route handlers across 15+ domains | C |
| **Supabase Auth Clients** | Browser client, server client, middleware helpers | FULLY IMPLEMENTED — client.ts, server.ts, middleware.ts, api-auth.ts | C |
| **RBAC Engine** | evaluateRBAC() with role/resource/action (PROMPT 4 §RBAC UI ENFORCEMENT) | IMPLEMENTED in mod-001/integration-wiring.ts | C |
| **Event Bus** | EventBus, EventEmitter, EventHandler interfaces | IMPLEMENTED in shared/events/ | C |
| **Shared Base Classes** | BaseEntity, BaseService, etc. | IMPLEMENTED in shared/base-classes/ | C |
| **Domain Enums/Types** | UserRole, ShipmentStatus, EscrowState, etc. | IMPLEMENTED in shared/types/enums.ts and module-local enums | C |
| **Module Config Files** | All 18 module.config.ts with dependency graph | ALL 18 FILES PRESENT and Track B frozen | C |

---

## 10. Document-to-UI/UX Requirement Matrix

| Document | UI/UX Authority Level | Governs | Specific Sections |
|----------|---------------------|---------|------------------|
| **PROMPT 0 v1.1** | Highest (Governance) | UI Governance Rules (preserve accessibility, respect design system, reuse components), Mobile-First Infrastructure Layer (offline sync, PostGIS), i18n Layer (pt/en, locale-aware formatting) | §5 UI Governance, §Architecture Layers (Mobile-First, i18n), §ESS Control Map |
| **PROMPT 4** | Structural (UI Layout) | UI route structure, role-based dashboards, layout hierarchy, module-to-page mapping, component separation, API consumption rules, RBAC UI enforcement, localization of UI elements, state principle | §PURPOSE, §CRITICAL UI RULES, §UI ARCHITECTURE PRINCIPLE, §ROLE-BASED UI ARCHITECTURE, §SHARED UI LAYOUT SYSTEM, §SHARED UI LAYER, §COMPONENT RULES, §API CONSUMPTION RULE, §RBAC UI ENFORCEMENT, §LOCALIZATION REQUIREMENTS, §UI STATE PRINCIPLE, §FINAL UI PRINCIPLE |
| **PROMPT 5** | Design System (Components/Tokens) | Design tokens, Tailwind config, component library architecture, accessibility standards (WCAG 2.1), responsive design, UI consistency rules, layout primitives | §PURPOSE, §CRITICAL CONSTRAINTS, §DESIGN TOKENS, §TAILWIND CONFIGURATION, §COMPONENT LIBRARY STRUCTURE, §CORE COMPONENTS, §UI DESIGN PRINCIPLES, §ACCESSIBILITY RULE, §RESPONSIVE DESIGN RULE |
| **ESS-008** | Execution Standards (MANDATORY) | UI/UX rules, layout constraints, interaction standards, design system rules, role-based UI rules, component design rules, data visualization rules, navigation rules, mobile UX rules, performance UX rules, map/tracking UI rules, financial UI rules, AI UI rules, accessibility rules, error UI rules, state indication rules, internationalization requirements, module UI responsibility matrix | ALL 19 SECTIONS (§1–§19) |
| **ESS-007** | Coding Standards (Supporting) | UI coding standards, layer separation (UI → Server Actions → Service → Supabase), component naming conventions (PascalCase), localization requirements, forbidden patterns (inline business logic in UI) | §3.2 Forbidden Patterns, §4.2 Layer Separation, §4.3 No Logic in UI, §6.3 Components, §8 Server Action Rules, §18 Localization |
| **ESS-006** | Security (Supporting) | XSS prevention, sensitive data handling, JWT claims including languagePreference, module security responsibility matrix | §3.3 JWT Claims, §6.2 Sensitive Data, §10.2 XSS Prevention, §16 Module Security Responsibility Matrix |
| **ESS-009** | Data Governance (Supporting) | User profile fields (language_preference, region), region-to-language mapping, localization data requirements, module data ownership | §6.4 Localization Fields, §19 Localization Data Requirements |
| **ESS-002** | Testing (Supporting) | UI validation requirements (form submission, role-based access, navigation integrity, mobile responsiveness, multilingual pt/en), localization testing, regression testing | §3.5 UI Validation, §7 Minimum Test Coverage, §12 Module Testing Responsibility Matrix |
| **MOD-007** | Domain (PRESENTATION) | User dashboard structure, role-based views, widget model, AI insight rendering, i18n model, experience structuring, data binding rules, state consistency, offline state consistency, localization rule, event model (DashboardLoaded, WidgetRendered, etc.), integration boundaries | ALL 13 SECTIONS (§1–§13), especially §3–§5, §7, §8, §9 |
| **MOD-008** | Domain (MOBILE PLATFORM) | Mobile interaction model, offline-first operations, driver/transporter edge workflows, mobile dashboard endpoints, sync engine, network efficiency, battery optimization | ALL 13 SECTIONS (§1–§13), especially §3, §4, §5, §7 |
| **MOD-015** | Domain (SUPPORT/DISPUTE) | Multi-channel support intake, dispute lifecycle, admin investigation tools | §§2–3, §4, §9 (integration boundaries) |
| **INDEX** | Registry | MOD-007 = Presentation domain, MOD-008 = Mobile Platform domain, ESS-008 = UI/UX Standards | §8 Product Capability Registry, §9 Module Registry, §10 ESS Registry |
| **PRIMITIVE REGISTRY** | Domain Ontology | Zero UI-related primitives found. All priorities cover backend concerns. | NONE |
| **EVENT REGISTRY** | Event Vocabulary | MOD-007 owns "UI preference and dashboard events"; specific names NOT enumerated | §16 Module Event Ownership Summary |

---

## 11. Specification Conflicts and Gaps

### 11.1 Conflict-001: Public Experience Module Ownership Gap

**Requirement:** Clear ownership of public-facing UI (landing page, auth entry, promotional content).

**Sources:** PROMPT 4 defines `(public)` route group and auth routes. MOD-001 covers Marketplace but no module owns "public/experience." INDEX (§9) assigns MOD-007 to "Presentation" but MOD-007 §2 says "It does not define visual design implementation or frontend frameworks."

**Severity:** HIGH — No module explicitly owns the public experience layer.

**Interpretation:** The public UI falls into an architectural blind spot between PROMPT 4 (structural route definition) and MOD-007 (presentation domain, which explicitly disclaims visual/frontend implementation). Neither PROMPT 4 nor MOD-007 takes clear ownership.

### 11.2 Conflict-002: Dashboard Ownership Tension

**Requirement:** Clarify relationship between MOD-007 (User Dashboards spec) and PROMPT 5 (Design System).

**Sources:** MOD-007 §9 says MOD-007 owns "all user dashboards." PROMPT 5 defines the design system and component library. PROMPT 4 defines the UI route structure. Three documents govern UI without clarifying precedence when they conflict.

**Severity:** MEDIUM

**Interpretation:** When a MOD-007 dashboard widget conflicts with PROMPT 5 component spec or ESS-008 layout rules, the precedence chain is implied but not explicitly stated: **PROMPT 0 > ESS-008 > MOD-007 > PROMPT 4 > PROMPT 5**.

### 11.3 Gap-001: Onboarding Flow Completely Missing

**Requirement:** Document the visitor → registration → profile setup → verification → first-use guided experience.

**Sources:** NO source documents describe this flow. Only registration auth endpoints are mentioned (PROMPT 4).

**Severity:** HIGH

**Interpretation:** The product cannot deliver "authenticated product UX operational" (C6 objective) without knowing what happens AFTER registration. Complete gap.

### 11.4 Gap-002: Anonymous/Public Marketplace Access Undefined

**Requirement:** Specify whether non-authenticated users can browse listings/search offers.

**Sources:** MOD-007 §6.3 mandates RBAC visibility at UI layer, suggesting authenticated-only access. But PROMPT 4 defines `(public)` route group, implying some public presence. No explicit statement either way.

**Severity:** MEDIUM

**Interpretation:** NOT SPECIFIED — REQUIRES ARCHITECTURAL DECISION.

### 11.5 Gap-003: Role Selection During Registration Undefined

**Requirement:** How does a new user choose their role (Shipper/Transporter/Driver)?

**Sources:** Roles are defined in shared enums. HAO taxonomy confirmed. But no registration form schema, no role-choice screen, no post-registration role assignment workflow is documented.

**Severity:** HIGH

**Interpretation:** NOT SPECIFIED — REQUIRES ARCHITECTURAL DECISION.

### 11.6 Gap-004: Error Page / Not Found Pages Not Specified

**Requirement:** 404 and error page specifications.

**Sources:** ESS-008 §14 specifies ERROR UI RULE (use ESS-001E standardized codes, be user-readable, avoid jargon, provide retry). No document defines the ACTUAL 404 page layout/content or general error page template.

**Severity:** LOW

**Interpretation:** Behavior prescribed but actual page structure unspecified.

### 11.7 Gap-005: Mobile PWA Technical Specs Absent

**Requirement:** PWA manifest, service worker strategy, offline data caching approach.

**Sources:** MOD-008 describes OFFLINE BEHAVIOR MODEL abstractly (store-and-forward, chronological sync). Development Manifest Phase 8 says mobile follows web. No PWA manifest spec, no service worker spec, no concrete offline data strategy documented.

**Severity:** MEDIUM (for C6 phase)

**Interpretation:** Abstract offline model exists; concrete implementation spec deferred to Phase 8.

### 11.8 Conflict-003: PROMPT 4 Says "(auth)" Route Group but Code Uses "[locale]" Landing

**Requirement:** Consistent route group organization.

**Sources:** PROMPT 4 §APP ROUTER STRUCTURE shows landing page inside `[locale]` root. But PROMPT 4 also defines `(public)` route group for "landing page, public information pages." The actual implementation places the landing page at `[locale]/page.tsx` outside the `(public)` group.

**Severity:** LOW

**Interpretation:** Minor structural deviation from planned route grouping.

---

## 12. Open Architectural Decisions Required

| Decision ID | Description | Impacted By | Status |
|------------|-------------|------------|--------|
| **OAD-001** | Does the landing page belong under `[locale]/` or `(public)/` route group? | PROMPT 4 §APP ROUTER STRUCTURE | UNRESOLVED |
| **OAD-002** | Who OWNS the public-facing UI (landing, auth pages, promotional content)? No MOD-N designation exists. | PROMPT 4 defines structure; MOD-007 disclaims visual implementation | UNRESOLVED — REQUIRES ARCHITECTURAL DECISION |
| **OAD-003** | Should non-authenticated users be able to browse marketplace listings? | MOD-007 §6.3 RBAC visibility implies authenticated-only; but (public) route group implies some public presence | UNRESOLVED — REQUIRES ARCHITECTURAL DECISION |
| **OAD-004** | How do new users select their role during registration? Shipper/Transporter/Driver/etc.? | HAO PE-H04 taxonomy; PROMPT 7 auth scope | UNRESOLVED — REQUIRES ARCHITECTURAL DECISION |
| **OAD-005** | What is the post-registration onboarding flow? Profile setup → verification → first-use? | NO DOCUMENT DESCRIBES THIS | UNRESOLVED — REQUIRES ARCHITECTURAL DECISION |
| **OAD-006** | What is the minimum viable dashboard for C6? | MOD-007 defines seven role-specific dashboard surfaces (§5.1–§5.7 after the 2026-10-30 renumbering); none are C6-ready | UNRESOLVED — REQUIRES GOVERNANCE DECISION |
| **OAD-007** | Should C6 implement role-specific dashboard shells or just a generic authenticated landing? | MOD-007 §5.1–§5.7 defines role-specific dashboards (renumbered 2026-10-30); `(dashboard)/` layout exists but is empty | UNRESOLVED |
| **OAD-008** | Is native mobile (Android/iOS) planned or is responsive web sufficient? | MOD-008 §3.1: "native mobile applications for Android and iOS" vs Development Manifest Phase 8 (deferred) | UNRESOLVED — PHASE 8 DEFERRAL CONFIRMED BY DOCS |
| **OAD-009** | Precedence order when MOD-007, PROMPT 4, PROMPT 5, and ESS-008 conflict on UI decisions? | Multiple documents govern UI without explicit conflict-resolution chain | UNRESOLVED — implied: PROMPT 0 > ESS > MOD > PROMPT |
| **OAD-010** | Should the component library be built from scratch or adopt an existing library (shadcn/ui, Radix, Chakra)? | ESS-008 §3.1: "no external CSS frameworks" — but component libraries are not CSS frameworks | UNRESOLVED — NEEDS CLARIFICATION |

---

## 13. Answer to Core Question

**Question:** Based strictly on the existing NexCargo documentation, what is the planned public-facing interface of NexCargo, what is its relationship to onboarding, and which architectural component/module is intended to own it?

**Answer:**

The existing NexCargo documentation PLANS a public-facing interface consisting of:

1. **A homepage/landing page** at the root path (`/` or `/[locale]/`) presenting NexCargo branding, value propositions, and CTAs leading to authentication.

2. **Authentication entry points** — sign-in, register, forgot-password, and reset-password pages within an `(auth)` route group.

3. **Potentially public information pages** (about, terms, privacy) within a `(public)` route group.

Its relationship to onboarding is **STRICTLY LIMITED**: the documentation defines auth pages as ENTRY POINTS to authentication but DOES NOT document any post-registration onboarding flow. There is no documented connection between the public experience and what happens after registration. The onboarding journey (post-registration profile setup, verification, guided first use, role assignment) is entirely absent from the specification.

**Regarding ownership:** There is NO explicit module (MOD-N) designated to own the public-facing interface. The responsibility falls through a gap between:
- **PROMPT 4 (UI/UX Integration Boot)** which defines the `(public)` and `(auth)` route structures as the UI structural layer
- **PROMPT 7 (Authentication + RBAC)** which governs authentication mechanisms
- **ESS-008 (UI/UX Standards)** which applies design rules to all UI but doesn't own any specific interface

**MOD-007 (User Dashboards & Experience)** is explicitly stated to NOT own public-facing UI because it "does not define visual design implementation or frontend frameworks" and its scope begins at the authenticated dashboard layer.

**Conclusion:** The public-facing interface is architecturally PLANNED but has NO OWNER. It exists as a structural blueprint in PROMPT 4 but lacks both module assignment and implementation specification. This is a documented architectural gap requiring an HAO decision (**OAD-002**).

---

## 14. Source Index

All findings derived from reading the following documents exhaustively:

**Governance:**
1. `docs/governance/nexcargo-development-state.md` — Development continuity record
2. `docs/governance/nexcargo-boot.md` — Behavioral Kernel v1.0
3. `docs/governance/nexcargo-arbitration-layer.md` — Conflict resolution authority
4. `docs/governance/nexcargo-development-manifesto.md` — Development lifecycle methodology
5. `docs/governance/nexcargo-ai-specification-interpretation-policy.md` — Spec interpretation rules
6. `docs/governance/c4-readiness-report-corrected.md` — C4 readiness (contains C6 reference at line 211)
7. `docs/governance/phase-2a-authorization-package.md` — Authorization documentation

**Architecture:**
8. `docs/architecture/nexcargo-index.md` — Specification index/knowledge routing map v1.1
9. `docs/architecture/nexcargo-primitive-registry.md` — Canonical domain objects
10. `docs/architecture/nexcargo-event-registry.md` — Business event vocabulary v1.0
11. `docs/architecture/nexcargo-ai-eprs.md` — Product requirements specification v1.0

**ESS Documents:**
12. `docs/ess/ess-001-external-integrations.md` + appendices A–G (7 files)
13. `docs/ess/ess-002-lean-testing-and-quality-assurance.md`
14. `docs/ess/ess-003-ai-intelligence.md`
15. `docs/ess/ess-004-integration-contracts.md`
16. `docs/ess/ess-005-operational-runbook.md`
17. `docs/ess/ess-006-security-and-compliance.md`
18. `docs/ess/ess-007-coding-standards-specification.md`
19. **`docs/ess/ess-008-uiux-standards.md`** — PRIMARY UI/UX AUTHORITY
20. `docs/ess/ess-009-data-governance.md`

**Module Specifications:**
21. `docs/modules/mod-001-ai-erps-marketplace-layer.md`
22. `docs/modules/mod-007-ai-erps-user-dashboards.md` — UI DASHBOARD OWNER
23. `docs/modules/mod-008-ai-erps-mobile-applications.md` — MOBILE PLATFORM OWNER
24. `docs/modules/mod-015-ai-erps-customer-support-dispute-resolution-and-operations-control-center-module.md` — SUPPORT/DISPUTE OWNER
25–38. MOD-002 through MOD-006, MOD-009 through MOD-014, MOD-016 through MOD-018 (read for UI/UX cross-references)

**PROMPT Foundation Documents:**
39. `AI_Builder_Foundation_Prompts/PROMPT 0 - NEXCARGO MASTER SYSTEM_v1.1.md` — MASTER AUTHORITY
40. `AI_Builder_Foundation_Prompts/PROMPT 4 - UIUX INTEGRATION BOOT.md` — UI STRUCTURAL LAYER
41. `AI_Builder_Foundation_Prompts/PROMPT 5 - FULL DESIGN SYSTEM.md` — DESIGN SYSTEM SPEC
42. `AI_Builder_Foundation_Prompts/PROMPT 1 - ARCHITECTURE BOOTSTRAP.md` — PROJECT STRUCTURE
43. `AI_Builder_Foundation_Prompts/PROMPT 6 - API INTEGRATION + SERVICES.md` — API/CLIENT BOUNDARY
44. `AI_Builder_Foundation_Prompts/PROMPT 7 - AUTHENTICATION + RBAC.md` — AUTH/GOVERNANCE
45. `AI_Builder_Foundation_Prompts/PROMPT 8 - DEVOPS, DEPLOYMENT, INFRASTRUCTURE & OBSERVABILITY.md`

**Current Implementation Source Files Read:**
46. `web/src/app/[locale]/page.tsx` — Landing page (current state)
47. `web/src/app/(public)/layout.tsx` — Public layout (current state)
48. `web/src/app/(auth)/layout.tsx` — Auth layout (current state)
49. `web/src/app/(dashboard)/layout.tsx` — Dashboard layout (current state)
50. `web/src/app/(dispatcher)/` — Dispatcher pages (current state)
51. `web/src/lib/supabase/client.ts` — Supabase browser client
52. `web/src/lib/supabase/server.ts` — Supabase server client
53. `web/src/lib/supabase/middleware.ts` — Session middleware function
54. `web/src/lib/supabase/api-auth.ts` — API auth utilities
55. `web/src/lib/env.ts` — Environment variable loader
56. `web/src/i18n/request.ts` — next-intl request config
57. `web/src/app/globals.css` — Global styles (design tokens)
58. `web/src/shared/types/enums.ts` — Domain enums (UserRole, etc.)
59. `web/locales/en/common.json` — English translations
60. `web/locales/pt/common.json` — Portuguese translations
61. `web/src/modules/mod-007-dashboards/` — Wave 3 domain definitions (working tree)

---

*End of audit report. This document is READ-ONLY. No implementation is authorized by this audit.*

---

DOCUMENTATION CHANGE HISTORY (role taxonomy reconciliation — NXC-HOA-AUTH-ROLE-001)

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | Citation maintenance only. §5.x references to MOD-007 updated for the dashboard renumbering (5.4 Moderator→5.5, 5.5 Super Admin→5.7, 5.6 Module-Based Views→5.8, 5.7 Internationalization→5.9; new 5.4 Dispatcher and 5.6 Admin). Role-source paragraph and role-status table rows realigned with PROMPT 0 v1.2 §USER ROLES and §ROLE PROVISIONING AND DELEGATION. FINDING [UX-R001] annotated: authority boundaries now specified, UI flow gap still open. No implementation status was re-tested or upgraded. | HAO decisions HD-RT-1…HD-RT-6 |
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | Second-pass citation maintenance: eleven UI Capability Ownership rows (§3.6 capability matrix) corrected from MOD-007 §5.6 to §5.8 where the citation meant Module-Based Views; §2.2 dashboard source list and OAD-006 / OAD-007 dashboard counts updated for the new §5.1–§5.7 range. No finding, classification or open-question conclusion was altered. | MOD-007 §5 renumbering under HD-RT-3 |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | Citation maintenance: the role-source references and the capability-matrix role rows now cite PROMPT 0 v1.3, which carries the v1.2 role taxonomy and provisioning rules forward unchanged. The SUPER_ADMIN row additionally records the five HD-RT-8 executive authority domains at specification level only. No finding, classification, gap or open-question conclusion was altered. | HAO decision HD-RT-8 |
