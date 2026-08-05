\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-1.bootstrap.v1

module: PROMPT-1

version: v1.0



loads:

&#x20; - BOOT@v1.0

&#x20; - INDEX@v1.0

&#x20; - ESS@v1.0

&#x20; - ARBITRATION@v1.0

&#x20; - PROMPT-0@v1.0



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

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



expected\_outputs:

&#x20; - Production-grade architecture scaffold fully compliant with Prompt 0

&#x20; - No behaviour outside the scope of the defined architecture

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - ESS constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



PROMPT 1 — ARCHITECTURE BOOTSTRAP



NexCargo System Initialization (Next.js 14+ / TypeScript / App Router)



\---



\## ROLE CONTINUATION



You are operating under:



\*\*PROMPT 0 — NEXCARGO MASTER SYSTEM PROMPT (v1.0)\*\*



All governance rules, constraints, and architectural boundaries defined in Prompt 0 are mandatory and inherited without modification.



If any conflict exists, Prompt 0 always overrides.



\---



\## PURPOSE OF THIS PROMPT



You are now responsible for:



Generating the initial production-grade architecture scaffold for NexCargo using Next.js 14+ App Router and strict TypeScript.



This includes:



\- Folder structure

\- Domain boundaries

\- Core architectural layers

\- Module mapping (MOD-001 → MOD-018)

\- Base system primitives

\- Shared kernel setup

\- Event-driven infrastructure foundation



\---



\## NON-NEGOTIABLE ARCHITECTURE RULES



You MUST:



\- Use Next.js 14+ App Router ONLY

\- Use strict TypeScript

\- Use domain-driven folder structure

\- Enforce modular boundaries (MOD-001 → MOD-018)

\- Separate UI from domain logic completely

\- Avoid any business logic in UI components

\- Use server-first architecture where applicable

\- Ensure all modules are extensible and event-ready



You MUST NOT:



\- Create pages router structure

\- Mix domains inside UI components

\- Merge modules

\- Flatten architecture for simplicity

\- Skip abstraction layers



\---



\## OUTPUT REQUIREMENT



You MUST generate:



\### 1. Project Root Architecture



A complete Next.js 14 App Router structure.



\### 2. Domain-Driven Folder Structure



Organized strictly by:



\- Marketplace Domain

\- Logistics Execution Domain

\- Financial Infrastructure Domain

\- AI Intelligence Domain

\- Compliance \& Trust Domain

\- Communication Domain

\- Data \& Analytics Domain

\- Platform Infrastructure Domain



\### 3. Module Mapping Layer (CRITICAL)



You MUST map:



MOD-001 → MOD-018



into the correct domain folders.



Each module must have:

/domain/module-name/

/application/

/domain/entities/

/domain/services/

/infrastructure/

/interfaces/





No exceptions.



\### 4. Shared Kernel (MANDATORY)



Create a /shared/ layer containing:



\- types/

\- utils/

\- constants/

\- events/

\- errors/

\- base-classes/



This is the only allowed shared logic layer.



\### 5. Event-Driven Foundation



You MUST create:



\- Event System Core

\- Event bus interface

\- Event emitter abstraction

\- Event handler registry

\- Base event type structure

\- Standard Event Format



All events MUST follow:



```json

{

&#x20; "eventId": "string",

&#x20; "eventType": "string",

&#x20; "timestamp": "string",

&#x20; "sourceModule": "string",

&#x20; "correlationId": "string",

&#x20; "payload": "unknown"

}

6\. API ARCHITECTURE (App Router)

You MUST define:



/app/api/ structure aligned with domains



Route handlers using route.ts only



No legacy API patterns



Domain-scoped API separation



Example:



/app/api/

&#x20; /marketplace/

&#x20;   /listings/

&#x20;   /offers/

&#x20;   /matching/

&#x20; /logistics/

&#x20;   /tracking/

&#x20;   /mobile-sync/

&#x20;   /cross-border/

&#x20;   /asset-registry/

&#x20; /booking/

&#x20;   /bookings/

&#x20;   /contracts/

&#x20;   /negotiations/

&#x20; /financial/

&#x20;   /escrow/

&#x20;   /payments/

&#x20;   /settlements/

&#x20;   /wallet/

&#x20; /documents/

&#x20;   /upload/

&#x20;   /retrieve/

&#x20;   /verify/

&#x20; /ai/

&#x20;   /predictions/

&#x20;   /recommendations/

&#x20;   /insights/

&#x20; /compliance/

&#x20;   /kyc/

&#x20;   /audit/

&#x20;   /disputes/

&#x20; /communication/

&#x20;   /notifications/

&#x20;   /messaging/

&#x20; /data/

&#x20;   /analytics/

&#x20;   /reports/

&#x20; /platform/

&#x20;   /integrations/

&#x20;   /observability/

&#x20;   /health/

&#x20; /mobile/

&#x20;   /dashboard/

&#x20;     /driver/

&#x20;     /shipper/

&#x20;     /transporter/

&#x20;   /sync/

&#x20;     /priority/

&#x20;     /critical/

&#x20;     /background/

Mobile-Optimized API Routes:





/app/api/mobile/

&#x20; /dashboard/

&#x20;   /driver/     → Aggregated driver dashboard data (single request)

&#x20;   /shipper/    → Aggregated shipper dashboard data (single request)

&#x20;   /transporter/→ Aggregated transporter dashboard data (single request)

&#x20; /sync/

&#x20;   /priority/   → High-priority offline sync (POD, delivery confirmation)

&#x20;   /critical/   → Critical event sync (escrow, contract events)

&#x20;   /background/ → Low-priority background sync (analytics, status updates)

These endpoints MUST:



Return lean, minimal payloads



Support field filtering



Aggregate data from multiple modules in a single request



Reduce round-trips for mobile clients



7\. DATABASE LAYER STRUCTURE

You MUST prepare structure for:



PostgreSQL (primary)



Redis (cache layer)



Event store (future-ready)



Define:



/infrastructure/database/

/infrastructure/repositories/

/infrastructure/migrations/

8\. FINANCIAL LAYER ISOLATION (CRITICAL)

You MUST ensure:



Financial logic exists ONLY in:



Financial Infrastructure Domain (MOD-005, MOD-013)



No other module may:



process payments



settle escrow



modify wallet balances



MOD-005 handles escrow initiation and release.



MOD-013 handles settlement and reconciliation.



9\. AI LAYER SEPARATION

AI must be isolated under:



AI Intelligence Domain



It can:



read data



generate predictions



emit recommendations



It cannot:



execute financial actions



override domain logic



modify stored truth



dispatch shipments (No Dispatch)



finalize bookings (No Auto-Booking)



MOD-006 is the primary AI engine.



MOD-018 handles pricing and incentives (advisory only).



10\. CORE SYSTEM PRIMITIVES (MUST GENERATE)

You MUST create base building blocks:



Entities Base



BaseEntity



AuditableEntity



SoftDeletableEntity



Services Base



BaseService



DomainService



Repository Pattern



BaseRepository



Use Case Pattern



BaseUseCase



11\. MODULE INITIALIZATION CONTRACT

Each module MUST contain:



/domain

/application

/infrastructure

/interfaces

/module.config.ts

Each module MUST define:



responsibilities



dependencies



event subscriptions



exposed services



12\. DEPENDENCY RULES

Marketplace depends on nothing



Logistics depends on Marketplace



Financial depends on Logistics



AI depends on all read-only data domains



Compliance applies globally



Infrastructure supports all modules



No circular dependencies allowed.



13\. DESIGN PRINCIPLES

Mobile-First Design:



All APIs are designed for mobile constraints first



Lean payloads, aggregated endpoints, field filtering



Offline-first for field operations



Battery and bandwidth optimized



Real-time communication supported



You MUST enforce:



Separation of concerns



High cohesion, low coupling



Event-driven communication



Dependency inversion



Domain isolation



Module constraint enforcement (No Custody, No Execution, No Dispatch, No Intervention, No Auto-Booking, No Computation, No Legal Execution, No Decision Authority, Contract Immutability, Asset Truth)



OUTPUT FORMAT

You MUST output:



SECTION 1 — FULL FOLDER TREE



Complete Next.js App Router structure



SECTION 2 — DOMAIN STRUCTURE MAP



How modules map to domains



SECTION 3 — SHARED KERNEL STRUCTURE



Full shared system layout



SECTION 4 — EVENT SYSTEM SCAFFOLD



Core event architecture code



SECTION 5 — BASE PRIMITIVES CODE



Entities, repositories, services base classes



FINAL BOOTSTRAP PRINCIPLE

You are not building features.



You are building:



the foundational operating system architecture for NexCargo



Everything must be:



scalable



modular



event-driven



auditable



production-ready

