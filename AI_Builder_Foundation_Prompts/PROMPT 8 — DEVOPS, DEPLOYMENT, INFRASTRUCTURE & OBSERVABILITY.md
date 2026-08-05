\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-8.devops-observability.v1

module: PROMPT-8

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

&#x20; - PROMPT-6@v1.0

&#x20; - PROMPT-7@v1.0



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

&#x20; - PROMPT-1 status=FROZEN

&#x20; - PROMPT-2 status=FROZEN

&#x20; - PROMPT-3 status=FROZEN

&#x20; - PROMPT-4 status=FROZEN

&#x20; - PROMPT-5 status=FROZEN

&#x20; - PROMPT-6 status=FROZEN

&#x20; - PROMPT-7 status=FROZEN

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

&#x20; - /specs/prompt-6-api-integration.md

&#x20; - /specs/prompt-7-auth-rbac.md



expected\_outputs:

&#x20; - Complete production operating environment design

&#x20; - Fully compliant with Prompt 0-7 and ESS-005, ESS-006, ESS-009

&#x20; - No behaviour outside the scope of operations and infrastructure

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - PROMPT-1 architectural rules respected

&#x20; - PROMPT-2 data rules respected

&#x20; - PROMPT-3 module rules respected

&#x20; - PROMPT-4 UI rules respected

&#x20; - PROMPT-5 design system rules respected

&#x20; - PROMPT-6 API rules respected

&#x20; - PROMPT-7 security rules respected

&#x20; - ESS-005 (Operational Runbook) constraints respected

&#x20; - ESS-006 (Security \& Compliance) constraints respected

&#x20; - ESS-009 (Data Governance) constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity

&#x20; - No Intervention principle (MOD-017) enforced — observability observes only, does NOT fix errors or restart services

&#x20; - All module-specific constraints reflected in operational governance (No Custody, No Execution, No Dispatch, etc.)



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



PROMPT 8 — DEVOPS, DEPLOYMENT, INFRASTRUCTURE \& OBSERVABILITY



NexCargo Production Operations Layer



\---



\## ROLE CONTINUATION



You are operating under:



\- PROMPT 0 — Master System Prompt (v1.0)

\- PROMPT 1 — Architecture Bootstrap

\- PROMPT 2 — Database + Event Store Design

\- PROMPT 3 — Module Implementation Bootstrap

\- PROMPT 4 — UI/UX Integration Bootstrap

\- PROMPT 5 — Full Design System

\- PROMPT 6 — API Integration + Server Actions

\- PROMPT 7 — Authentication + RBAC + Security Core



All governance, architecture and implementation rules remain mandatory.



Prompt 0 is the highest authority.



\---



\## PURPOSE



You are responsible for designing the complete production operating environment for NexCargo.



This includes:



\- Infrastructure architecture

\- CI/CD pipelines

\- Environment management

\- Deployment strategy

\- Monitoring

\- Logging

\- Distributed tracing

\- Disaster recovery

\- Secrets management

\- Operational governance



This prompt does NOT define business functionality.



It defines how the platform operates safely in production.



\---



\## NON-NEGOTIABLE PRINCIPLES



Infrastructure MUST be:



\- reproducible

\- automated

\- secure

\- observable

\- horizontally scalable

\- fault tolerant

\- auditable



Manual production changes are prohibited.



Everything must be deployable from source control.



\*\*No Intervention Principle (MOD-017):\*\*



Observability observes only. It does NOT fix errors or restart services. All operational responses must be human-approved. Automation is limited to detection and alerting, never autonomous remediation.



\---



\## ENVIRONMENT STRATEGY



Maintain isolated environments:



\- Local Development

\- Development

\- Integration

\- QA

\- Staging

\- Production

\- Disaster Recovery



Each environment must have:



\- independent configuration

\- independent secrets

\- isolated databases

\- isolated storage

\- isolated monitoring



Production data must never be copied into lower environments without approved sanitization.



\---



\## INFRASTRUCTURE ARCHITECTURE



Infrastructure must support:



\- Web Application

\- API Layer

\- Background Workers

\- Scheduler

\- Event Processing

\- Redis

\- PostgreSQL

\- Object Storage

\- CDN

\- Monitoring Stack



Prefer containerized deployments.



Infrastructure must remain cloud-provider portable.



Avoid vendor lock-in where practical.



\---



\## CONTAINERIZATION



Every deployable service must include:



\- Dockerfile

\- health check

\- readiness probe

\- graceful shutdown

\- environment configuration



Containers must remain stateless.



Persistent data belongs only in managed storage systems.



\---



\## CI/CD PIPELINE



Every commit must execute:



\*\*Static Validation\*\*



\- TypeScript compilation

\- linting

\- formatting verification

\- dependency validation



\*\*Quality Validation\*\*



\- unit tests

\- integration tests

\- API contract tests



\*\*Security Validation\*\*



\- dependency vulnerability scan

\- secret detection

\- license validation

\- container scan



\*\*Build\*\*



Generate:



\- production build

\- Docker image

\- deployment artifact



\*\*Deployment\*\*



Deployment must support:



\- rolling deployment

\- blue/green deployment

\- automatic rollback



\---



\## CONFIGURATION MANAGEMENT



Configuration must never be hardcoded.



Configuration sources include:



\- environment variables

\- secrets manager

\- runtime configuration



Every configuration item must have:



\- owner

\- purpose

\- default policy

\- validation



\---



\## SECRET MANAGEMENT



Secrets include:



\- API keys

\- JWT secrets

\- payment credentials

\- database credentials

\- encryption keys

\- cloud credentials



Secrets MUST:



\- never exist in source code

\- never exist in Git

\- rotate periodically

\- be centrally managed



\---



\## DATABASE OPERATIONS



All schema changes must use versioned migrations.



Every migration must support:



\- forward execution

\- rollback strategy

\- validation



Production migrations require:



\- backup verification

\- execution logging

\- audit registration



\---



\## BACKGROUND PROCESSING



Long-running operations must execute asynchronously.



Examples:



\- notification delivery

\- OCR processing

\- AI predictions

\- analytics aggregation

\- document verification

\- report generation



Workers must be:



\- idempotent

\- retry-safe

\- observable



\---



\## OBSERVABILITY



The platform must implement three pillars:



\*\*Logging\*\*



Structured logging only.



Every log includes:



\- timestamp

\- level

\- correlationId

\- module

\- requestId

\- userId (when applicable)



No sensitive information may appear in logs.



\*\*Metrics\*\*



Capture:



\- request latency

\- throughput

\- error rate

\- queue depth

\- worker utilization

\- payment success rate

\- shipment lifecycle metrics



\*\*Distributed Tracing\*\*



Every request receives:



\- traceId

\- spanId

\- correlationId



Tracing must connect:

UI

↓

API

↓

Application Layer

↓

Database

↓

Event Store

↓

External Integrations



text



\---



\## HEALTH CHECKS



Every service exposes:



\- liveness endpoint

\- readiness endpoint

\- dependency status



Health endpoints must verify:



\- database

\- Redis

\- event bus

\- storage

\- external integrations



\---



\## ALERTING



Critical alerts include:



\- deployment failure

\- payment failures

\- event processing failures

\- authentication failures

\- queue backlog

\- database connectivity

\- infrastructure degradation



Alert severity:



\- Critical

\- High

\- Medium

\- Low



\---



\## PERFORMANCE OBJECTIVES



Define Service Level Objectives (SLOs).



Examples:



Availability:



\- 99.9% minimum



API latency:



\- P95 < 300ms



Authentication:



\- P95 < 200ms



Shipment search:



\- P95 < 500ms



Escrow operations:



\- P95 < 2 seconds



These values should be configurable and reviewed as the platform evolves.



\---



\## BACKUP STRATEGY



Implement:



\- automated backups

\- encrypted backups

\- point-in-time recovery

\- periodic restore testing



Backups must include:



\- PostgreSQL

\- object storage

\- configuration metadata



\---



\## DISASTER RECOVERY



Document:



\- Recovery Time Objective (RTO)

\- Recovery Point Objective (RPO)

\- Recovery procedures

\- Failover process

\- Data restoration process

\- Recovery validation checklist



\---



\## EXTERNAL INTEGRATIONS



All external providers must support:



\- retry policies

\- timeout policies

\- circuit breakers

\- exponential backoff

\- idempotency

\- monitoring

\- audit logging



Includes:



\- regulated banking partners

\- mobile money aggregators

\- mapping providers

\- notification providers

\- customs integrations

\- AI providers



\*\*Financial Integration Constraint:\*\*



\- No Custody: NexCargo NEVER holds funds. Bank is the ONLY execution authority.

\- Financial integrations must be monitored for settlement anomalies

\- Refer to ESS-001F for financial integration architecture



\---



\## FEATURE FLAGS



All major functionality should support runtime feature flags.



Feature flags must allow:



\- gradual rollout

\- testing

\- rollback

\- regional enablement

\- role-based enablement



\---



\## RELEASE MANAGEMENT



Every release requires:



\- version number

\- release notes

\- migration notes

\- rollback plan

\- approval workflow



\---



\## OUTPUT REQUIREMENTS



Generate:



\*\*SECTION 1\*\*



Infrastructure architecture



\*\*SECTION 2\*\*



Environment strategy



\*\*SECTION 3\*\*



CI/CD pipeline



\*\*SECTION 4\*\*



Secrets management



\*\*SECTION 5\*\*



Observability architecture



\*\*SECTION 6\*\*



Operational monitoring



\*\*SECTION 7\*\*



Disaster recovery



\*\*SECTION 8\*\*



Production deployment standards



\*\*SECTION 9\*\*



Operational governance



\---



\## FAILURE HANDLING



If operational requirements are incomplete:



Output:



TODO: requires specification from AI-EPRS



Never invent operational procedures.



\---



\## FINAL PRINCIPLE



NexCargo must operate as:



A production-grade, continuously deployable, fully observable, secure, fault-tolerant logistics operating system suitable for enterprise and financial workloads.

