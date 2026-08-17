\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-3.module-implementation.v1

module: PROMPT-3

version: v1.0



loads:

&#x20; - BOOT@v1.0

&#x20; - INDEX@v1.0

&#x20; - ESS@v1.0

&#x20; - ARBITRATION@v1.0

&#x20; - PROMPT-0@v1.0

&#x20; - PROMPT-1@v1.0

&#x20; - PROMPT-2@v1.0



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

&#x20; - PROMPT-1 status=FROZEN

&#x20; - PROMPT-2 status=FROZEN

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

&#x20; - /specs/modules/mod-001-to-mod-018/



expected\_outputs:

&#x20; - Complete module scaffold implementations for MOD-001 to MOD-018

&#x20; - Fully compliant with Prompt 0, Prompt 1, and Prompt 2

&#x20; - No behaviour outside the scope of module specifications

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - PROMPT-1 architectural rules respected

&#x20; - PROMPT-2 data rules respected

&#x20; - ESS constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity

&#x20; - Module-specific constraints enforced (No Custody, No Execution, No Dispatch, etc.)



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



🚨 PROMPT 3 — MODULE IMPLEMENTATION BOOTSTRAP



NexCargo Modular Code Generation Layer (MOD-001 → MOD-018)



\---



\## 🧠 ROLE CONTINUATION



You are operating under:



\- PROMPT 0 — NEXCARGO MASTER SYSTEM_v1.1.md

\- PROMPT 1 — Architecture Bootstrap

\- PROMPT 2 — Database + Event Store Design



All rules from previous prompts are strictly inherited and must never be violated.



If any conflict exists → Prompt 0 always overrides.



\---



\## 🧱 PURPOSE OF THIS PROMPT



You are responsible for generating:



\*\*FULL MODULE SCAFFOLD IMPLEMENTATIONS\*\* for all modules MOD-001 → MOD-018



This includes:



\- Domain layer structure

\- Application layer use cases

\- Infrastructure implementations

\- API routes (Next.js App Router)

\- Event publishing hooks

\- Repository implementations

\- TypeScript models

\- Module boundaries



You are NOT building features.



You are building production-grade modular system scaffolds.



\---



\## 🚨 CRITICAL IMPLEMENTATION RULES



You MUST:



\- Follow strict module boundaries (NO cross-module leakage)

\- Use TypeScript strict mode everywhere

\- Use clean architecture (Domain / Application / Infrastructure / Interfaces)

\- Implement event publishing for all state changes

\- Align ALL modules with Prompt 2 database schemas

\- Enforce RBAC at API level

\- Keep business logic OUT of UI

\- Enforce module-specific constraints at code level (No Custody, No Execution, No Dispatch, No Intervention, No Auto-Booking, No Computation, No Legal Execution, No Decision Authority, Contract Immutability, Asset Truth)



You MUST NOT:



\- Merge modules

\- Skip layers (no shortcuts)

\- Hardcode logic inside API routes

\- Duplicate logic across modules

\- Create undocumented endpoints

\- Invent new modules or domains



\---



\## 🧩 MODULE IMPLEMENTATION STANDARD (MANDATORY TEMPLATE)



Every module MUST follow this structure:



\### 📦 MODULE STRUCTURE TEMPLATE

/modules/MOD-XXX-module-name/

│

├── domain/

│ ├── entities/

│ ├── services/

│ ├── events/

│ ├── repositories/

│

├── application/

│ ├── use-cases/

│ ├── dtos/

│

├── infrastructure/

│ ├── repositories/

│ ├── event-handlers/

│ ├── external-integrations/

│

├── interfaces/

│ ├── http/

│ │ ├── routes/

│ │ ├── controllers/

│

├── module.config.ts



text



\---



\## 🧠 MODULE IMPLEMENTATION RULES



Each module MUST:



\*\*1. Domain Layer\*\*

\- Define business entities

\- Define domain events

\- Define domain services

\- NO external dependencies allowed



\*\*2. Application Layer\*\*

\- Use-case driven architecture

\- One use-case per file

\- Orchestrates domain logic

\- NO database access directly



\*\*3. Infrastructure Layer\*\*

\- Implements repositories

\- Handles DB access (PostgreSQL)

\- Publishes events to event store

\- Handles external APIs



\*\*4. Interfaces Layer (API)\*\*

\- Next.js App Router route handlers ONLY

\- No business logic allowed

\- Must call use-cases only

\- Enforce RBAC

\- Enforce module-specific constraints



\---



\## 🚨 MODULE BOUNDARY RULE (CRITICAL)



Each module MUST:



\- Own its own domain logic

\- NEVER directly access another module's internals

\- Communicate ONLY via:

&#x20; - events

&#x20; - application services

&#x20; - defined interfaces



\---



\## 🔁 EVENT INTEGRATION RULE



Every module MUST:



\- Emit events on state changes

\- Subscribe ONLY to relevant events

\- NEVER mutate external module state directly



\*\*Example Event Flow:\*\*



ShipmentCreated (Marketplace)

→ triggers Matching Engine (AI)

→ triggers Notification Service

→ triggers Analytics Update



\---



\## 🧱 MODULE IMPLEMENTATION SCOPE (MOD-001 → MOD-018)



You MUST generate scaffolds for:



| Module | Domain | Key Constraint |

|--------|--------|----------------|

| MOD-001 | Marketplace | No Auto-Booking |

| MOD-002 | Booking \& Contracts | Contract Immutability |

| MOD-003 | Tracking \& Visibility | No Dispatch |

| MOD-004 | Document Management | No Legal Execution |

| MOD-005 | Escrow \& Payment Management | No Custody |

| MOD-006 | AI Intelligence Platform | No Execution |

| MOD-007 | User Dashboards \& Experience | Localization |

| MOD-008 | Mobile Applications \& Edge Operations | Offline sync |

| MOD-009 | Regional \& Cross-Border Logistics | No Legal Execution |

| MOD-010 | Security, Compliance \& Governance | Security enforcement |

| MOD-011 | Platform Integration APIs \& Ecosystem | Integration governance |

| MOD-012 | Data Platform Analytics \& BI | No Computation |

| MOD-013 | Payments Escrow Settlement \& Financial Infrastructure | No Custody |

| MOD-014 | Asset \& Logistics Operations Management | Asset Truth, No Dispatch |

| MOD-015 | Customer Support, Dispute Resolution \& OCC | No Decision Authority |

| MOD-016 | Notifications, Messaging \& Communication | Localization |

| MOD-017 | System Observability, Monitoring \& DevOps | No Intervention |

| MOD-018 | Marketplace Growth, Pricing, Incentives \& Commercial Optimization | No Execution |



\---



\## 🔐 RBAC ENFORCEMENT RULE (MANDATORY)



All API routes MUST enforce:



\- role validation

\- permission checks

\- resource ownership validation



No exception.



\---



\## 📡 EVENT STORE INTEGRATION RULE



Every module MUST:



\- publish events to event\_store table (Prompt 2)

\- include correlation\_id

\- ensure idempotency

\- prevent duplicate event emission



\---



\## 🧠 TYPE SAFETY RULE



All modules MUST:



\- use strict TypeScript

\- define DTOs for every input/output

\- avoid any

\- use shared kernel types only



\---



\## 🧱 SHARED KERNEL USAGE RULE



Modules MAY ONLY use:



\- /shared/types

\- /shared/events

\- /shared/utils

\- /shared/errors



NO direct cross-module imports allowed.



\---



\## 🚨 FAILURE HANDLING RULE



If implementation details are unclear:



STOP and output: TODO: requires specification from AI-EPRS



DO NOT GUESS.



\---



\## 🧠 OUTPUT REQUIREMENT



You MUST generate:



\*\*SECTION 1 — MODULE FOLDER STRUCTURE\*\*



Full scaffold per MOD-001 → MOD-018



\*\*SECTION 2 — DOMAIN LAYER CODE\*\*



Entities, services, events per module



\*\*SECTION 3 — APPLICATION LAYER\*\*



Use-case implementations



\*\*SECTION 4 — INFRASTRUCTURE LAYER\*\*



Repositories + event publishers



\*\*SECTION 5 — API ROUTES (Next.js App Router)\*\*



route.ts files per module



\*\*SECTION 6 — EVENT FLOW MAP\*\*



Cross-module event interactions



\---



\## 🧠 FINAL PRINCIPLE



You are not building features.



You are generating:



a fully modular, event-driven, enterprise-grade logistics operating system

