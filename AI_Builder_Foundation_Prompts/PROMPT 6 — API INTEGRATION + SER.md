\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-6.api-server.v1

module: PROMPT-6

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

&#x20; - PROMPT-4@v1.0

&#x20; - PROMPT-5@v1.0



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

&#x20; - PROMPT-1 status=FROZEN

&#x20; - PROMPT-2 status=FROZEN

&#x20; - PROMPT-3 status=FROZEN

&#x20; - PROMPT-4 status=FROZEN

&#x20; - PROMPT-5 status=FROZEN

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

&#x20; - /specs/prompt-4-uiux-integration.md

&#x20; - /specs/prompt-5-design-system.md



expected\_outputs:

&#x20; - Complete API Layer and Server Actions layer fully compliant with Prompt 0-5

&#x20; - No behaviour outside the scope of API orchestration

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - PROMPT-1 architectural rules respected

&#x20; - PROMPT-2 data rules respected

&#x20; - PROMPT-3 module rules respected

&#x20; - PROMPT-4 UI rules respected

&#x20; - PROMPT-5 design system rules respected

&#x20; - ESS constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity

&#x20; - Financial isolation enforced (MOD-005, MOD-013 only)

&#x20; - AI isolation enforced (MOD-006, MOD-018 read-only, advisory)

&#x20; - Module-specific constraints enforced at API boundary (No Custody, No Execution, No Dispatch, etc.)



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



PROMPT 6 — API INTEGRATION + SERVER ACTIONS LAYER



NexCargo Application Interface Layer (Next.js 14+)



\---



\## ROLE CONTINUATION



You are operating under:



\- PROMPT 0 — Master System Prompt (v1.0)

\- PROMPT 1 — Architecture Bootstrap

\- PROMPT 2 — Database + Event Store Design

\- PROMPT 3 — Module Implementation Bootstrap

\- PROMPT 4 — UI/UX Integration Bootstrap

\- PROMPT 5 — Full Design System



All rules are inherited without modification.



Prompt 0 remains the highest authority.



\---



\## PURPOSE OF THIS PROMPT



You are responsible for building:



The API Layer + Server Actions layer that connects UI → Application Layer → Modules (MOD-001 → MOD-018)



This includes:



\- Next.js App Router API routes

\- Server Actions (where appropriate)

\- API orchestration layer

\- Request validation layer

\- RBAC enforcement layer

\- Module-to-API mapping

\- Event publishing triggers

\- Error handling standardization



\---



\## CRITICAL RULES



You MUST:



\- Use Next.js 14 App Router route handlers ONLY

\- Use Server Actions only for internal UI flows

\- Enforce strict TypeScript typing

\- Validate all requests before reaching Application Layer

\- Enforce RBAC at API boundary

\- Trigger events ONLY via modules

\- NEVER expose domain logic in API layer



You MUST NOT:



\- Call database directly from API routes

\- Bypass Application Layer (use-cases)

\- Duplicate business logic in API layer

\- Mix UI logic with API logic

\- Expose internal domain structure externally



\---



\## ARCHITECTURE POSITION



The API layer sits between:

UI (Prompt 4–5)

↓

API / Server Actions (THIS PROMPT)

↓

Application Layer (MOD-001 → MOD-018)

↓

Domain Layer

↓

Database + Event Store (Prompt 2)



text



\---



\## API STRUCTURE (MANDATORY)



You MUST generate:

/app/api/

/marketplace/

/logistics/

/fleet/

/financial/

/ai/

/compliance/

/communication/

/analytics/

/auth/





Each domain MUST map to:



MOD-001 → MOD-018



\---



\## API DESIGN RULES



Each API route MUST:



\- Call a use-case from Application Layer

\- NOT contain business logic

\- Validate input using DTOs

\- Enforce RBAC

\- Emit or trigger domain events

\- Return structured responses



\---



\## STANDARD API RESPONSE FORMAT



All endpoints MUST return:



```json

{

&#x20; "success": "boolean",

&#x20; "data": "unknown",

&#x20; "error": {

&#x20;   "code": "string",

&#x20;   "message": "string"

&#x20; },

&#x20; "meta": {

&#x20;   "timestamp": "string",

&#x20;   "correlationId": "string"

&#x20; }

}



RBAC ENFORCEMENT LAYER (CRITICAL)

Every API request MUST:



Authenticate user



Validate role



Validate permissions



Validate resource ownership



If invalid:



return 403 (Forbidden)



log security event



SERVER ACTIONS RULE (NEXT.JS 14)

Server Actions MUST:



be used ONLY for UI-triggered mutations



call Application Layer use-cases



NEVER bypass RBAC



NEVER access DB directly



Example usage:



create shipment (shipper UI)



place bid (transporter UI)



confirm delivery (driver UI)



APPLICATION LAYER INTEGRATION RULE

All API routes MUST call:



/application/use-cases/\*



Example:



POST /api/marketplace/create-shipment

→ CreateShipmentUseCase.execute()

No exceptions.



📡 EVENT TRIGGER RULE

API layer MUST:



NOT emit events directly



ONLY trigger events via Application Layer



ensure correlationId is passed through



Events flow:



API → Use Case → Domain → Event Store

🧱 MODULE → API MAPPING RULE

Each module MUST expose APIs like:



MOD-001 Marketplace



text

POST /api/marketplace/shipment/create

GET /api/marketplace/shipment/:id

POST /api/marketplace/bid/place

MOD-002 Logistics



text

POST /api/logistics/trip/start

POST /api/logistics/trip/update

GET /api/logistics/tracking/:id

MOD-014 Asset Registry



GET /api/fleet/vehicles

GET /api/fleet/drivers

⚠️ MOD-014 is read-only asset registry. No dispatch operations.



MOD-005 / MOD-013 Financial (CRITICAL ISOLATION)



text

POST /api/financial/escrow/create

POST /api/financial/escrow/release

POST /api/financial/settlement/trigger

POST /api/financial/escrow/intervention

⚠️ Only Financial Modules (MOD-005, MOD-013) can execute these operations.

⚠️ No Custody: NexCargo NEVER holds funds.



MOD-006 / MOD-018 AI



GET /api/ai/match-loads

GET /api/ai/pricing-suggestion

GET /api/ai/route-optimization

⚠️ AI is READ-ONLY (no execution authority). All outputs advisory-only.



🧠 VALIDATION LAYER RULE

All API inputs MUST:



be validated via DTOs



reject invalid payloads



never trust client input



Use:



zod (preferred) OR equivalent strict validator



🔁 ERROR HANDLING STANDARD

All API errors MUST:



include error code



include human-readable message



include correlationId



Example:



json

{

&#x20; "success": false,

&#x20; "error": {

&#x20;   "code": "SHIPMENT\_CREATION\_FAILED",

&#x20;   "message": "Invalid cargo weight"

&#x20; },

&#x20; "meta": {

&#x20;   "timestamp": "...",

&#x20;   "correlationId": "..."

&#x20; }

}



SECURITY RULES (CRITICAL)

API layer MUST enforce:



authentication (session/token)



authorization (RBAC)



rate limiting (future-ready)



request validation



audit logging



📊 OBSERVABILITY RULE

Every API call MUST generate:



correlationId



log entry



traceable event chain



audit record (if mutation)



SERVER ACTION DESIGN RULE

Server Actions MUST:



be thin wrappers



call use-cases only



never contain logic



be typed and reusable



FAILURE HANDLING RULE

If API behavior is unclear:



STOP and output: TODO: requires specification from AI-EPRS



No assumptions allowed.



FINAL PRINCIPLE

The API layer is:



a secure orchestration gateway between UI and domain logic



NOT:



a business logic layer



a data layer



a shortcut layer

