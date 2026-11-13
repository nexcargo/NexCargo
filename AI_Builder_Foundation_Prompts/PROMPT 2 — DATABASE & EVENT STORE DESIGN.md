# NEXCARGO PROMPT ENVELOPE v1.0

task_id: PROMPT-2.database.v1
module: PROMPT-2
version: v1.0

loads:
  - BOOT@v1.0
  - INDEX@v1.0
  - ESS@v1.0
  - ARBITRATION@v1.0
  - PROMPT-0@v1.0
  - PROMPT-1@v1.0

prerequisites:
  - PROMPT-0 status=FROZEN
  - PROMPT-1 status=FROZEN
  - BOOT loaded
  - INDEX loaded
  - ESS loaded
  - ARBITRATION loaded

inputs:
  - /specs/nexcargo_boot.md
  - /specs/nexcargo_index.md
  - /specs/ess/
  - /specs/nexcargo_arbitration_layer.md
  - /specs/prompt-0-master-system.md
  - /specs/prompt-1-architecture-bootstrap.md

expected_outputs:
  - Complete database and event store design fully compliant with Prompt 0 and Prompt 1
  - No behaviour outside the scope of the data foundation
  - STOP → TODO for any missing authoritative specification

validation:
  - PROMPT-0 behavioural rules respected
  - PROMPT-1 architectural rules respected
  - ESS constraints respected
  - No conflict with ARBITRATION rules
  - No conflicts with INDEX dependencies
  - No unauthorised assumptions
  - No new features introduced
  - No scope drift
  - STOP on ambiguity

completion_criteria:
  - All validation checks pass
  - OR emit STOP → TODO

---

PROMPT 2 — DATABASE & EVENT STORE DESIGN

NexCargo Data Foundation (PostgreSQL + Event-Driven Architecture)

---

## ROLE CONTINUATION

You are operating under:

- PROMPT 0 — NEXCARGO MASTER SYSTEM_v1.3.md
- PROMPT 1 — Architecture Bootstrap

All rules, governance constraints, and architectural boundaries are inherited and MUST NOT be violated.

Prompt 0 always overrides all decisions.

---

## PURPOSE OF THIS PROMPT

You are responsible for designing the complete data foundation of NexCargo, including:

- PostgreSQL relational schema
- Event store architecture
- Audit logging system
- Multi-domain data separation
- Repository structure alignment
- Data consistency rules
- Financial-grade immutability model
- Localization and internationalization data support

This is NOT application logic.

This is the system of truth storage layer.

---

## NON-NEGOTIABLE DATA RULES

You MUST:

- Use PostgreSQL as the primary database
- Enforce strict relational integrity
- Implement immutable ledger patterns for financial data
- Support event sourcing for critical domains
- Maintain auditability for all entities
- Ensure multi-domain separation of tables
- Never mix financial and non-financial tables
- Include language preference and localization fields
- Enforce module-specific constraints at the database level (No Custody, No Execution, No Dispatch, etc.)

You MUST NOT:

- Flatten schema for convenience
- Duplicate entities across domains
- Remove audit fields
- Allow direct modification of financial balances
- Skip event tracking for state-changing operations
- Store escrow balances directly (No Custody)

---

## DATA ARCHITECTURE OVERVIEW

The NexCargo data system consists of:

**1. Core Relational Database (PostgreSQL)**
- System of record
- Domain-separated schemas
- Strong referential integrity

**2. Event Store (Critical System Layer)**
- Immutable event log
- Source of truth for state changes
- Used for replay, audit, and analytics

**3. Redis Cache Layer**
- Ephemeral state
- Tracking optimization
- Session + real-time logistics updates

---

## DOMAIN-BASED DATABASE STRUCTURE

You MUST create schema separation per domain:

### 1. marketplace_schema
- shipments
- bids
- bookings
- load_requests
- matching_recommendations (advisory only — No Auto-Booking)

### 2. logistics_schema
- trips
- routes
- tracking_points
- asset_assignments (advisory linkage — actual execution by MOD-002/003)
- asset_registry (MOD-014 — read-only asset registry)
- pod (Proof of Delivery)

**Constraint:** MOD-014 is an asset registry only. No fleet management, no dispatch.

### 3. financial_schema (CRITICAL ISOLATION)
- escrow_accounts (logical state only — funds held by bank)
- transactions (append-only)
- settlements (append-only)
- payout_records (append-only)
- reconciliation_records
- escrow_intervention_requests (governed Escrow Intervention Request records — auditable; an intervention is requested and decided through the ESS-001F §15.3 pathway, it is not an "Admin override")

**RULES:**
- ONLY Financial Modules (MOD-005, MOD-013) can write here
- All tables must be immutable or append-only
- No balance storage — balance is derived
- MOD-005 handles escrow initiation and release
- MOD-013 handles settlement and reconciliation

### 4. ai_schema
- predictions
- pricing_models (advisory only)
- anomaly_flags (advisory only)
- route_optimizations (advisory only)

**Constraint:** AI data is advisory-only. No execution data stored here.

### 5. compliance_schema
- kyc_records
- kyb_records
- license_verification
- audit_flags
- compliance_status

### 6. communication_schema
- notifications
- messages
- alerts
- notification_templates (supporting pt and en)

### 7. analytics_schema (derived data only — No Computation)
- corridor_metrics
- performance_stats
- shipment_aggregates

**Constraint:** Analytics is read-only derived data. No KPI computation executed here.

### 8. platform_infrastructure_schema
- integrations
- system_configs
- feature_flags
- integration_contracts (ESS-004)

### 9. localization_schema
- region_language_mapping (MOD-009)
- translation_entries (UI content)
- user_language_preferences

---

## STANDARD ENTITY BASE FIELDS (MANDATORY)

Every table MUST include:

```sql
id: UUID (primary key)
created_at: timestamp
updated_at: timestamp
created_by: UUID | null
updated_by: UUID | null
is_deleted: boolean (soft delete)
version: integer
correlation_id: string (event traceability)
User profile tables MUST additionally include:

sql
language_preference: string (default: 'pt')
region: string (for region-to-language mapping)
Financial tables MUST additionally include:

immutable ledger constraints

no update/delete after insert (append-only)

FINANCIAL LEDGER RULE (CRITICAL)
All financial data MUST follow double-entry ledger principles:

Tables:

ledger_entries

escrow_transactions

settlement_records

reconciliation_logs

Rules:

No UPDATE allowed on financial records

No DELETE allowed

Only INSERT allowed

Balance is derived, NOT stored

Escrow State:

Escrow state is logical only — funds are held by bank

No balance storage in NexCargo (No Custody)

Financial Intervention:

escrow_intervention_requests table stores governed Escrow Intervention Requests (ESS-001F §15.7)

Requests are initiated within the §15.6 closed trigger list and decided under the §15.9 authority tiers — Admin within delegated authority, or SUPER_ADMIN for Tier 2 matters

An Admin record is not an override: approval of a request is not approval of the underlying financial instrument, and no internal approval executes a bank transaction (ESS-001F §15.3)

All interventions are auditable and traceable

EVENT STORE ARCHITECTURE (CORE SYSTEM)
You MUST design an append-only event store.

EVENT STORE TABLE
sql
event_store
Required fields:

event_id (UUID)

event_type (string)

timestamp (ISO)

source_module (string)

aggregate_id (UUID)

aggregate_type (string)

payload (JSONB)

correlation_id (string)

causation_id (string)

version (integer)

EVENT RULES
Events are immutable

Events are append-only

Events are the system of record for state changes

All critical actions MUST emit events

STANDARD EVENT FORMAT
json
{
  "eventId": "string",
  "eventType": "string",
  "timestamp": "string",
  "sourceModule": "string",
  "aggregateId": "string",
  "aggregateType": "string",
  "correlationId": "string",
  "causationId": "string",
  "version": "number",
  "payload": "unknown"
}
EVENT SOURCES (MANDATORY)
All modules MUST emit events:

Marketplace events

ShipmentListed

BidPlaced

MatchSuggested (advisory only — No Auto-Booking)

Logistics events

TripStarted

TrackingPointUpdated

DeliveryConfirmed

Financial events

EscrowCreated

FundsLocked (bank confirmed)

SettlementInitiated

SettlementCompleted

PaymentFailed

Escrow intervention events (governance events — classified Compliance, not Financial, in the Event Registry)

escrowInterventionRequested (initiated by Admin within delegated authority, or by SUPER_ADMIN — ESS-001F §15.6 authority distinction; canonical business event registered in docs/architecture/nexcargo-event-registry.md §13 MOD-005 Owned Events, owner and producer MOD-005, consumers MOD-013, MOD-015, MOD-010; classified Compliance there, not Financial, and constrained by that registry's §17 Escrow Intervention Request Events block; it identifies the Escrow Intervention Request reference, the related booking and contract references, the related escrow and dispute references where present, the initiating actor and the applicable eligibility trigger from the closed list in ESS-001F §15.6, and records an auditable governance fact only — it authorises no financial execution: the bank or authorised payment provider remains the sole execution authority, ESS-001F §2.2, §15.3, §15.5)

escrowInterventionDecided (the decision recorded on an existing Escrow Intervention Request by the authority tier applicable under ESS-001F §15.9; canonical business event registered in the same §13 MOD-005 Owned Events catalogue, owner and producer MOD-005, consumers MOD-013, MOD-015, MOD-010; classified Compliance there, not Financial; it identifies the request reference, the deciding actor, the decision authority tier applied under ESS-001F §15.9 and the resulting lifecycle context, and neither grants authority nor names or confirms an instruction to a bank or provider — only a bank or authorised payment provider confirmation changes a financial state, ESS-001F §2.2, §15.3, §15.5; Event Registry §17 Escrow Intervention Request Events)

AI events

PredictionGenerated (advisory only)

AnomalyDetected (advisory only)

RecommendationGenerated (advisory only)

Compliance events

KYCPassed

KYBFailed

ComplianceFlagged

EVENT-DRIVEN CONSISTENCY RULE
You MUST ensure:

State changes ONLY via events

Read models derived from events or DB projections

No silent state mutation

No direct cross-table updates without events

REPOSITORY LAYER ALIGNMENT
Each domain MUST implement:

Repository interfaces

PostgreSQL implementations

Event publishing hooks

Pattern:

BaseRepository<T>

DomainRepository

EventSourcedRepository (for financial/logistics critical flows)

FINANCIAL DATA ISOLATION RULE (HARD BOUNDARY)
financial_schema:

MUST NOT be accessed directly by:

AI Layer

Marketplace Layer

Logistics Layer

ONLY:

Financial Modules (MOD-005, MOD-013)

can write or modify.

MOD-005 handles escrow initiation and release.

MOD-013 handles settlement and reconciliation.

AI DATA ACCESS RULE
AI MAY:

read from all schemas

analyze data

generate predictions

AI MAY NOT:

write to financial_schema

modify compliance records

mutate transactional truth

execute actions based on data

AUDIT LOGGING SYSTEM (MANDATORY)
Every write operation MUST generate:

audit_log entry

event_store entry

correlation tracking

audit_logs table:

user_id

action

entity_type

entity_id

timestamp

before_state

after_state

correlation_id

DATA CONSISTENCY RULES
You MUST enforce:

eventual consistency for AI + analytics

strong consistency for financial operations

idempotency for all writes

deterministic event replay capability

EVENT REPLAY CAPABILITY (REQUIRED)
System MUST support:

replay events per aggregate

rebuild projections

audit full shipment lifecycle

reconstruct financial state

DOMAIN → DATA MAPPING RULE
Each module MUST map:

MOD → schema → tables → events

Module mapping:

Module	Schema	Key Constraint
MOD-001	marketplace_schema	No Auto-Booking
MOD-002	marketplace_schema	Contract Immutability
MOD-003	logistics_schema	No Dispatch
MOD-004	logistics_schema	No Legal Execution
MOD-005	financial_schema	No Custody
MOD-006	ai_schema		No Execution
MOD-007	marketplace_schema	Localization
MOD-008	logistics_schema	Offline sync
MOD-009	logistics_schema	No Legal Execution
MOD-010	compliance_schema	Security enforcement
MOD-011	platform_infrastructure_schema	Integration governance
MOD-012	analytics_schema	No Computation
MOD-013	financial_schema	No Custody
MOD-014	logistics_schema	Asset Truth, No Dispatch
MOD-015	compliance_schema	No Decision Authority
MOD-016	communication_schema	Localization
MOD-017	platform_infrastructure_schema	No Intervention
MOD-018	marketplace_schema	No Execution

LOCALIZATION DATA REQUIREMENTS

User Language Preference
Stored in user profile:

sql
user_id: UUID
language_preference: string (default: 'pt')
region: string
Region-to-Language Mapping
Stored in localization_schema (managed by MOD-009):

sql
region_code: string (e.g., 'MZ', 'ZA', 'ZW', 'ZM', 'MW', 'SZ', 'BW')
default_language: string
supported_languages: string[]
Translation Tables
For UI content and notification templates:

sql
translation_key: string
locale: string ('pt' or 'en')
content: text
context: string (optional)
Notification Templates (MOD-016)
sql
template_id: UUID
template_key: string
locale: string ('pt' or 'en')
subject: string (email/SMS subject)
body: text
template_type: string (EMAIL / SMS / PUSH)
DATABASE CONSTRAINT ENFORCEMENT
At the database level, the following constraints MUST be enforced via schema design, RLS policies, or triggers:

Constraint	Database Enforcement
No Custody	No table storing escrow balances. Balance is derived from append-only ledger.
No Execution	AI tables are read-only for AI. No write permissions.
No Dispatch	No dispatch/assignment tables. Only advisory assignment records.
No Intervention	Observability tables are read-only. No modification triggers.
Contract Immutability	Contract tables are append-only after signing. No UPDATE allowed.
Asset Truth	Asset registry is single source. No other module can redefine asset schema.

FAILURE HANDLING RULE

If schema is unclear:

STOP and output: TODO: requires specification from AI-EPRS

Never guess or invent tables.

FINAL DATA PRINCIPLE

NexCargo data layer is:

a hybrid relational + event-sourced financial logistics system

Therefore:

PostgreSQL = system of record

Event store = system of truth for state changes

Audit logs = compliance layer

AI = read-only intelligence layer

Localization = core system layer

---

DOCUMENTATION CHANGE HISTORY

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-1 | Change-history block established under the INDEX §7.4 Document Change-History Standard. History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register. The rows below record the evidenced changes that the register and this document's own inline citations support, each dated when the change was actually made. Creating this block altered no storage rule, schema isolation principle, event-store requirement or module write-boundary in this prompt. | HAO decision D-01 Item 6 Stage 1 (NXC-HOA-AUTH-D01-ITEM-06-STAGE-1); INDEX §7.4 |
| 2026-11-02 | NXC-HOA-DECISION-D01-ITEM-02 | The financial_schema record list gained escrow_intervention_requests as the governed Escrow Intervention Request record (auditable, and explicitly not an "Admin override"), and the Financial Intervention section records that the record stores the logical object defined in ESS-001F §15.7, is initiated only within the §15.6 closed trigger list, is decided under the §15.9 authority tiers and remains auditable and traceable. No DDL, migration, SQL, column set, index, constraint, RLS policy or storage implementation was written; this document remains a design brief and the append-only, immutable and no-balance-storage rules are unchanged. | HAO decision D-01 Item 2 (NXC-HOA-DECISION-D01-ITEM-02); Development State register, D-01 Item 2 row; ESS-001F §15.6, §15.7, §15.9 |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | The approval-versus-execution boundary was made explicit: an Admin record is not an override, approval of a request is not approval of the underlying financial instrument, and no internal approval executes a bank transaction (ESS-001F §15.3). The event-catalogue entry for an escrow intervention request was annotated as raised under §15.6 and as unregistered in the Event Registry rather than as a registered event. No role gained a permission, no financial module's write boundary changed and the No Custody rules are unchanged. | HAO decision D-01 Item 3, direction 3-A (NXC-HOA-AUTH-D01-ITEM-03-001); Development State register, D-01 Item 3 row; ESS-001F §15.1 to §15.5 |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-05-R1 | The unregistered annotation was superseded by reconciliation with the registration: the two Escrow Intervention Request events are now named in canonical camelCase as escrowInterventionRequested and escrowInterventionDecided, each pointing to its Event Registry §13 MOD-005 Owned Events entry with owner and producer MOD-005, consumers MOD-013, MOD-015 and MOD-010 and Compliance classification, and restating that neither event authorises, executes or confirms a bank or payment-provider transaction. Event semantics, storage rules and module boundaries are otherwise unchanged; no schema or payload was defined. | HAO decision D-01 Item 5 correction pass (NXC-HOA-AUTH-D01-ITEM-05-001; NXC-HOA-AUTH-D01-ITEM-05-R1); Development State register, D-01 Item 5 row; Event Registry §13 and §17 |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-05-R2 | The two Escrow Intervention Request events were grouped under their own heading, marked as governance events classified Compliance and not Financial in the Event Registry, so that they are no longer presented inside the financial event list. No other catalogue entry was renamed or moved, the surrounding illustrative event names keep their existing form as this document's own implementation-representation examples, and the escrow_intervention_requests table name remains a storage-level identifier rather than a canonical event name. A Development State register entry was not created for this correction pass because its authorisation expressly excluded creating one; the change is evidenced by the authorisation and by the resulting text. | HAO decision D-01 Item 5 second correction pass (NXC-HOA-AUTH-D01-ITEM-05-R2); Event Registry §5 and §13 |

Version effect: PROMPT 2 remains v1.0 — no version increase, no envelope or loader pointer change (its loads list was not touched by any of these passes) and no INDEX version-registry change. This block records changes already made and, where the register carries them, registered under the authorisations cited in it; creating the block changed no storage or event requirement in this prompt.