**SS-007 - Coding Standards Specification**

**Document ID:** ESS-007
**System:** NexCargo
**Stack:** Next.js 14 + TypeScript + Supabase
**Version:** 1.0
**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the \*\*mandatory coding standards and structural rules\*\* for all NexCargo code generation and implementation.



It ensures:



\- consistent architecture across AI-generated code

\- maintainability for a single developer

\- strict module separation

\- Supabase-safe patterns

\- production-grade TypeScript discipline

\- module-specific constraints are enforced at code level



2\. CORE CODING PRINCIPLES



2.1 Predictability Principle



Code must be predictable, typed, modular, and boring.



2.2 Module Constraint Enforcement Principle



Every module's specific constraints (No Custody, No Execution, No Dispatch, etc.) must be enforced at code level — not just in documentation.



2.3 Localization-Ready Principle



All user-facing code must support Portuguese (pt) and English (en) from the outset.



3\. TECHNOLOGY RULES (NON-NEGOTIABLE)



3.1 Required Stack



\- Next.js 14+ (App Router only)

\- TypeScript (strict mode ON)

\- Supabase (Auth + DB + RLS)

\- Tailwind CSS

\- Server Actions (preferred over API routes where applicable)



3.2 Forbidden Patterns



\- no JavaScript (TypeScript only)

\- no mixed routing (Pages Router forbidden)

\- no untyped functions

\- no direct DB access bypassing Supabase client rules

\- no inline business logic inside UI components



4\. ARCHITECTURE RULES



4.1 Module Boundary Rule (CRITICAL)



All code MUST respect module structure:



\- no cross-module logic leakage

\- no shared business logic without explicit service layer

\- no direct access to other modules' internals



4.2 Layer Separation



Each feature MUST follow:



UI Layer → Server Actions → Service Layer → Supabase Layer



4.3 No Logic in UI Rule



UI components MUST:



\- render data only

\- call actions/services

\- never contain business logic



5\. TYPE SAFETY RULES



5.1 Strict Mode Mandatory



strict: true



5.2 No ANY Rule



\- any is forbidden except in:

&#x20; - external API adapters (temporary)

&#x20; - TODO-mapped legacy integration



5.3 Domain Types First



All entities MUST be explicitly typed:



Examples:



\- Shipment

\- UserRole

\- PaymentTransaction

\- EscrowState

\- LanguagePreference



5.4 Module-Specific Types



Each module MUST define its own domain types. Cross-module types MUST reside in a shared kernel.



6\. NAMING CONVENTIONS



6.1 Files



\- kebab-case for files

\- example:

&#x20; - shipment-service.ts

&#x20; - escrow-actions.ts



6.2 Functions



\- camelCase

\- must be verb-first



Examples:



\- createShipment()

\- calculateRouteCost()

\- validateEscrowState()

\- getLocalizedContent()



6.3 Components



\- PascalCase

\- example:

&#x20; - ShipmentCard.tsx

&#x20; - DriverDashboard.tsx

&#x20; - LanguageSwitcher.tsx



7\. SUPABASE INTEGRATION RULES



7.1 Client Usage



\- use Supabase client only via centralized provider

\- no raw instantiation inside components



7.2 RLS Dependency (ESS-006)



\- all queries assume RLS is active

\- no manual filtering as security substitute



7.3 Query Rules



\- prefer server-side queries

\- avoid over-fetching

\- never expose sensitive fields to client



8\. SERVER ACTION RULES (NEXT.JS)



\- all mutations MUST use Server Actions or service layer

\- no direct DB mutation from client

\- actions MUST be typed and validated



9\. ERROR HANDLING RULE (LINKED TO ESS-001E)



All errors MUST:



\- use standardized error codes

\- never throw raw strings

\- include correlationId where applicable



10\. STATE MANAGEMENT RULE



\- local UI state → React state only

\- global state → server-driven (Supabase or server actions)

\- no unnecessary external state libraries unless required later



11\. REUSABILITY RULE



\- no duplicate logic across modules

\- shared logic MUST go into service layer

\- components MUST be reusable but not abstracted prematurely



12\. PERFORMANCE RULE



\- avoid unnecessary re-renders

\- avoid heavy client-side computation

\- prefer server-side processing for logistics + AI + pricing logic



13\. SECURITY-AWARE CODING RULE



Every function MUST assume:



\- user is untrusted

\- data is partially malicious

\- API responses can fail



14\. AI CODE GENERATION RULES



AI MUST:



\- follow module boundaries strictly

\- never invent new architecture patterns

\- never bypass Supabase RLS assumptions

\- always prefer service layer abstraction

\- enforce module-specific constraints in generated code



AI MUST NOT:



\- refactor unrelated modules

\- optimize by removing required logic

\- introduce new libraries without approval

\- generate code that violates No Custody, No Execution, No Dispatch, or any other module constraint



15\. IMPORT RULES



\- absolute imports preferred

\- no circular dependencies

\- shared utilities must live in /lib



16\. LOGGING RULE



All critical actions MUST:



\- log structured events

\- include moduleId

\- include correlationId

\- avoid logging sensitive data



17\. MODULE-SPECIFIC CONSTRAINT ENFORCEMENT (CRITICAL)



At code level, each module MUST enforce its designated constraints:



|Module|Constraint|Code-Level Enforcement|
|-|-|-|
|MOD-001|No Auto-Booking|Matching functions return recommendations only. Confirmation required before booking creation.|
|MOD-002|Contract Immutability|Contracts are immutable once signed. Update operations prohibited after signing.|
|MOD-005|No Custody|No wallet balance storage. All fund operations delegated to bank API via MOD-013.|
|MOD-006|No Execution|AI functions return advisory outputs only. No state mutations. All outputs flagged as advisory.|
|MOD-009|No Legal Execution|Customs functions provide advisory information only. No enforcement logic.|
|MOD-012|No Computation|Analytics functions read and present data only. No KPI computation or BI logic execution.|
|MOD-013|No Custody|No fund storage. Settlement and reconciliation only via bank API.|
|MOD-014|No Dispatch|Fleet functions read asset state only. No dispatch or assignment logic.|
|MOD-015|No Decision Authority|Support functions provide information only. No outcome decisions or compensation execution.|
|MOD-017|No Intervention|Observability functions observe and log only. No error fixing or service restart logic.|
|MOD-018|No Execution|Pricing functions return recommendations only. No price enforcement or finalization.|





18\. LOCALIZATION AND INTERNATIONALIZATION REQUIREMENTS



18.1 Language Support



All user-facing code MUST support:



\- Portuguese (pt) — default

\- English (en)



18.2 Detection and Override



\- Automatic detection: IP geolocation → country → language

\- User override: Language preference stored in user profile



18.3 Code-Level Requirements



\- UI components MUST use a localization framework (e.g., next-intl)

\- All user-facing strings MUST be externalized

\- Notification templates (MOD-016) MUST support pt and en

\- Region-to-language mapping (MOD-009) MUST be configurable

\- Dates, currency, and numbers MUST be locale-aware



18.4 File Structure



Localization files MUST reside in a dedicated folder:



/locales

&#x20; /pt

&#x20;   common.json

&#x20;   dashboard.json

&#x20;   notifications.json

&#x20; /en

&#x20;   common.json

&#x20;   dashboard.json

&#x20;   notifications.json



19\. MODULE CODE OWNERSHIP SUMMARY



|Module|Code Responsibility|Key Constraint|
|-|-|-|
|MOD-001|Marketplace matching logic|No Auto-Booking|
|MOD-002|Contract and booking logic|Contract Immutability|
|MOD-003|Tracking event processing|No Dispatch|
|MOD-004|Document upload and retrieval|No Legal Execution|
|MOD-005|Escrow orchestration|No Custody|
|MOD-006|AI advisory outputs|No Execution|
|MOD-007|UI dashboards|Localization support|
|MOD-008|Mobile and edge logic|Offline capability|
|MOD-009| Cross-border advisory|No Legal Execution|
|MOD-010|Security, RBAC, compliance|Security enforcement|
|MOD-011|API adapters, integrations|Contract adherence|
|MOD-012|Read-only analytics|No Computation|
|MOD-013|Settlement and reconciliation|No Custody|
|MOD-014|Fleet asset state|No Dispatch|
|MOD-015|Support and dispute information|No Decision Authority|
|MOD-016|Notification orchestration|Localization|
|MOD-017|Observability and monitoring|No Intervention|
|MOD-018|Pricing recommendations|No Execution|





20\. EXTERNAL INTEGRATION REFERENCES



\- ESS-001A — External Systems Catalogue

\- ESS-001E — Error Code Standardization

\- ESS-001F — Financial Integration Architecture

\- ESS-003 — AI Behavior Constraints

\- ESS-006 — Security \& Compliance

\- ESS-008 — UI/UX Standards (multilingual UI)

\- ESS-009 — Data Governance



FINAL PRINCIPLE



ESS-007 ensures:



NexCargo code remains clean, predictable, and maintainable — with module constraints enforced at the code level and localization built in from day one.

