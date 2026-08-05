\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-4.uiux-bootstrap.v1

module: PROMPT-4

version: v1.0



loads:

&#x20; - BOOT@v1.0

&#x20; - INDEX@v1.0

&#x20; - ESS@v1.0

&#x20; - ARBITRATION@v1.0

&#x20; - PROMPT-0@v1.0

&#x20; - PROMPT-1@v1.0

&#x20; - PROMPT-2@v1.0

&#x20; - PROMPT-3@v1.0



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

&#x20; - PROMPT-1 status=FROZEN

&#x20; - PROMPT-2 status=FROZEN

&#x20; - PROMPT-3 status=FROZEN

&#x20; - BOOT loaded

&#x20; - INDEX loaded

&#x20; - ESS loaded

&#x20; - ARBITRATION loaded



inputs:

&#x20; - /specs/nexcargo\_boot.md

&#x20; - /specs/nexcargo\_index.md

&#x20; - /specs/ess/

&#x20; - /specs/nexcargo\_arbitration\_layer.md

&#x20; - /specs/prompt-0-master-system.md

&#x20; - /specs/prompt-1-architecture-bootstrap.md

&#x20; - /specs/prompt-2-database-event-store.md

&#x20; - /specs/prompt-3-module-implementation.md



expected\_outputs:

&#x20; - Complete frontend structural layer fully compliant with Prompt 0-3

&#x20; - No behaviour outside the scope of UI presentation

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - PROMPT-1 architectural rules respected

&#x20; - PROMPT-2 data rules respected

&#x20; - PROMPT-3 module rules respected

&#x20; - ESS constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity

&#x20; - Module-specific constraints enforced at UI level (No Custody, No Execution, No Dispatch, etc.)



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



PROMPT 4 — UI/UX INTEGRATION BOOTSTRAP



NexCargo Frontend Structural Layer (Next.js 14+ App Router)



\---



\## ROLE CONTINUATION



You are operating under:



\- PROMPT 0 — Master System Prompt (v1.0)

\- PROMPT 1 — Architecture Bootstrap

\- PROMPT 2 — Database + Event Store Design

\- PROMPT 3 — Module Implementation Bootstrap



All rules are inherited without modification.



Prompt 0 is always the highest authority.



\---



\## PURPOSE OF THIS PROMPT



You are responsible ONLY for:



Creating the frontend structural layer of NexCargo using Next.js 14+ App Router



This includes:



\- UI route structure (App Router only)

\- Role-based dashboards

\- Module-to-page mapping

\- Layout hierarchy

\- UI boundary rules

\- Component separation rules

\- API consumption rules

\- Multilingual UI support (pt/en)



\---



\## CRITICAL UI RULES (NON-NEGOTIABLE)



You MUST:



\- Use Next.js 14 App Router ONLY

\- Use server-first rendering where applicable

\- Treat UI as presentation-only layer

\- NEVER embed business logic in UI

\- NEVER access database directly from UI

\- ONLY consume Application Layer APIs

\- Follow RBAC at UI routing level

\- Maintain strict separation between UI and domain logic

\- Support Portuguese (pt) and English (en) for all user-facing content



You MUST NOT:



\- Create business logic inside components

\- Call repositories directly

\- Bypass API layer

\- Mix domain logic with UI state

\- Create feature logic inside pages



\---



\## UI ARCHITECTURE PRINCIPLE



The UI is:



a projection layer of backend modules, not a system of logic



Everything displayed is derived from:



\- MOD-001 → MOD-018 APIs

\- Application layer use cases

\- Event-driven state projections

\- Localized content from the internationalization layer



\---



\## APP ROUTER STRUCTURE (MANDATORY)



You MUST generate:

/app

/(public)

/(auth)

/(dashboard)

/(shipper)

/(transporter)

/(driver)

/(admin)

/(fleet-owner)

/(dispatcher)



\---



\## ROLE-BASED UI ARCHITECTURE



\*\*1. Shipper UI\*\*

/shipper

/dashboard

/shipments

/create-shipment

/tracking

/payments

/history





Maps to:



\- MOD-001 Marketplace

\- MOD-002 Logistics

\- MOD-007 Financial



\*\*2. Transporter UI\*\*

/transporter

/dashboard

/loads

/bids

/fleet

/earnings

/routes





Maps to:



\- MOD-001 Marketplace

\- MOD-014 Asset Registry

\- MOD-002 Logistics



\*\*3. Driver UI\*\*

/driver

/trips

/navigation

/check-in

/pod

/history



Maps to:



\- MOD-002 Logistics

\- MOD-003 Tracking



\*\*4. Fleet Owner UI\*\*

/fleet-owner

/fleet-overview

/vehicles

/drivers

/assignments

/performance





Maps to:



\- MOD-014 Asset Registry (read-only)



\*\*Constraint:\*\* No dispatch, no fleet management. MOD-014 is an asset registry only.



\*\*5. Dispatcher UI\*\*

/dispatcher

/live-ops

/assignments

/tracking

/exceptions



\*\*6. Admin UI\*\*

/admin

/system

/users

/financial-control

/audit-logs

/config

/escrow-intervention





\*\*Admin Constraint:\*\* Escrow intervention is governed via Escrow Intervention Request — auditable and traceable. No direct ledger modification.



\---



\## SHARED UI LAYOUT SYSTEM



You MUST define:



\*\*Root Layouts\*\*



\- /app/layout.tsx

\- /app/(dashboard)/layout.tsx

\- /app/(auth)/layout.tsx



\*\*Layout Rules\*\*



\- Each role has isolated layout

\- Shared UI components only via /shared/ui

\- No duplication of navigation logic

\- Language switcher component available in all layouts



\---



\## SHARED UI LAYER (REQUIRED STRUCTURE)

/shared/ui

/components

Button

Table

Card

Modal

Input

Badge

LanguageSwitcher

/layouts

/navigation

/forms

/charts





\---



\## COMPONENT RULES



All components MUST:



\- be stateless unless explicitly required

\- not contain business logic

\- not fetch data directly (except server components via API layer)

\- receive data via props or server loaders

\- support pt and en for all text content



\---



\## API CONSUMPTION RULE



UI MUST ONLY:



\- call /app/api/\* routes

\- or server actions mapped to Application Layer



UI MUST NEVER:



\- access repositories

\- access database

\- access event store directly



\---



\## 🔐 RBAC UI ENFORCEMENT



Each route MUST enforce:



\- authentication

\- role validation

\- permission checks



Example:



```typescript

if (user.role !== "shipper") {

&#x20; redirect("/unauthorized");

}



MODULE → UI MAPPING RULE

Each UI page MUST map to:



a module (MOD-001 → MOD-018)



a use-case (Application Layer)



an API route (App Router)



No orphan UI pages allowed.



LOCALIZATION REQUIREMENTS

Language Support:



Portuguese (pt) — default



English (en)



UI Elements to Localize:



All navigation labels



All button text



All form labels and validation messages



All status messages and notifications



All error messages



All dashboard labels and headings



Implementation:



All user-facing strings MUST be externalized



Language switcher MUST be visible in the UI



Language preference stored in user profile



Date and currency formatting locale-aware



UI STATE PRINCIPLE

UI state MUST be:



derived from API responses



NOT independently authoritative



NOT source of truth



EVENT-DRIVEN UI BEHAVIOR

UI updates MUST reflect:



backend events



polling or subscriptions (future WebSockets)



Example:



ShipmentCreated → UI updates dashboard



TripStarted → UI tracking updates



PaymentSettled → UI financial update



DESIGN SYSTEM BOOTSTRAP (MINIMAL ONLY)

DO NOT build full design system yet.



Only define:



spacing scale (base tokens)



typography scale



color intent (not full palette)



layout grid rules



Example:



primary / secondary / danger / success



4px spacing base system



responsive breakpoints aligned to Tailwind defaults



FAILURE HANDLING RULE

If UI requirements are unclear:



STOP and output: TODO: requires specification from AI-EPRS



Do NOT guess UI behavior.



FINAL UI PRINCIPLE

The UI is:



a deterministic visualization layer of backend modules



NOT:



a product logic engine



a business decision layer



a workflow engine

