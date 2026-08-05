**ESS-009 - Data Governance Specification**

**Document ID:** ESS-009
**System:** NexCargo
**Stack:** Supabase (PostgreSQL + RLS + Auth)
**Version:** 1.0
**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the rules for data ownership, structure, lifecycle, and truth management within NexCargo.



It ensures:



\- single source of truth per data type

\- no conflicting data states between modules

\- clean separation between operational data and financial data

\- event consistency across the system

\- module-specific constraints enforced at data level



2\. CORE DATA PRINCIPLES



2.1 Single Source of Truth Principle



Every piece of data must have a single owner and a single source of truth.



2.2 No Custody Principle (Data Level)



NexCargo NEVER stores or holds funds. Financial data reflects bank-ledger state only.



2.3 No Execution Principle (Data Level)



AI data is advisory-only. No AI-generated data may trigger autonomous state changes.



2.4 No Computation Principle (Data Level)



Analytics data is read-only. No computed KPI or BI logic is stored as source of truth.



3\. DATA OWNERSHIP MODEL (CRITICAL)



3.1 Ownership Rule



Every table MUST have:



\- a single owning module (MOD-001 → MOD-018)

\- a clearly defined responsibility boundary



3.2 Ownership Examples



|Data Type|Owning Module|Constraint|
|-|-|-|
|Shipments|MOD-003|No Dispatch|
| Payments / Escrow|MOD-005, MOD-013|No Custody|
|Users / Roles|MOD-010|Security enforcement|
|AI Scores / Predictions|MOD-006|No Execution|
|Contracts|MOD-002|Contract Immutability|
|Fleet Assets|MOD-014|Asset Truth, No Dispatch|
|Analytics Datasets|MOD-012|No Computation|
|Notifications|MOD-016|Localization|
|Observability Logs|MOD-017|No Intervention|





3.3 No Shared Ownership Rule



\- no table may be "owned by multiple modules"

\- shared access is allowed, shared ownership is NOT



4\. SOURCE OF TRUTH RULE



Each data entity MUST have:



\- ONE canonical source

\- derived copies allowed ONLY for caching or analytics



Example:



|Data Type|Source of Truth|
|-|-|
|Shipment Status|Event Store / Logistics Module (MOD-003)|
|Payment Status|Bank Ledger (ESS-001F)|
|User Identity|Supabase Auth (MOD-010)|
|Fraud Score|AI Module (MOD-006) — advisory only|
|Fleet Asset Structure|MOD-014 (Asset Truth)|
|Contract State \| MOD-002|(Contract Immutability)|



5\. EVENT VS DATABASE RULE (CRITICAL)



5.1 Event Store = Truth of State Changes



Events represent:



\- transitions

\- actions

\- system changes



Example:



\- ShipmentCreated

\- PaymentLocked

\- DeliveryConfirmed



5.2 Database = Current State Snapshot



Tables represent:



\- latest known state

\- optimized query layer

\- NOT historical truth



5.3 Rule:



Events define history. Tables define current state.



\---



\## 6. SUPABASE DATA STRUCTURE RULES



\*\*6.1 RLS Mandatory (linked to ESS-006)\*\*



\- ALL tables MUST have Row Level Security enabled

\- no exceptions



6.2 Naming Conventions



\- tables → plural (shipments, users, payments)

\- fields → snake\_case

\- IDs → UUID preferred



6.3 Audit Fields (MANDATORY)



Every critical table MUST include:



\- created\_at

\- updated\_at

\- created\_by (if applicable)

\- correlation\_id



6.4 Localization Fields



User profile tables MUST include:



\- language\_preference (default: 'pt')

\- region (for region-to-language mapping)



7\. DATA LIFECYCLE RULE



Each entity MUST follow:



Created → Updated → Evented → Archived → (Optional) Deleted



7.1 Deletion Rule



\- soft delete preferred

\- hard delete only for compliance/legal cases



7.2 Archival Rule



\- historical logistics data MUST be retained

\- financial data MUST NEVER be deleted (ESS-001F compliance)



8\. DATA CONSISTENCY RULE



System MUST ensure:



\- no mismatch between event state and table state

\- no orphan records

\- no conflicting shipment/payment states



If mismatch occurs:



system triggers ESS-005 incident flow



9\. DENORMALIZATION RULE



Allowed ONLY for:



\- analytics dashboards

\- performance optimization

\- read-heavy views



NOT allowed for:



\- financial data

\- compliance data

\- shipment state logic



10\. ANALYTICS DATA RULE



Analytics data MUST:



\- be derived from events or snapshots

\- never be used as source of truth

\- be explicitly marked as "derived"

\- comply with No Computation principle (MOD-012)



11\. AI DATA ACCESS RULE (CRITICAL)



AI MUST:



\- only access authorized datasets (ESS-006)

\- never assume missing data

\- never fabricate state

\- rely only on:

&#x20; - Event Store

&#x20; - Supabase tables

&#x20; - Ledger system (ESS-001F)



AI MUST NOT:



\- infer shipment/payment states

\- overwrite or mutate data

\- generate synthetic records

\- execute actions based on data (No Execution)



12\. DATA INTEGRITY RULE



System MUST enforce:



\- referential integrity (PostgreSQL constraints)

\- no orphan records

\- consistent foreign key relationships

\- UUID-based entity linking



13\. VERSIONING RULE



Any schema change MUST:



\- be backward compatible OR

\- include migration strategy

\- never break existing API contracts (ESS-004)



14\. EVENT LINKING RULE



Every important record MUST link to:



\- correlationId

\- related events (event IDs)

\- module origin



15. DATA SECURITY RULE (REFERENCE ESS-006)



\- sensitive data MUST be RLS-protected

\- no direct frontend exposure without policy

\- encryption required for sensitive fields



16\. FAILURE MODE RULE



If data inconsistency is detected:



\- freeze affected module

\- trigger ESS-005 incident flow

\- prioritize reconciliation (ESS-001F for financial data)



17\. GEO DATA STORAGE REQUIREMENT



\- All geospatial data MUST use PostgreSQL PostGIS extension

\- Spatial indexes MUST be created for all location fields

\- Geofencing queries MUST be optimized with spatial indexes

\- Location history MUST support historical querying via indexed fields



18\. MODULE DATA OWNERSHIP MATRIX



|Module|Data Owned|Key Constraint|
|-|-|-|
|MOD-001|Marketplace listings, matches|No Auto-Booking|
|MOD-002|Contracts, bookings|Contract Immutability|
|MOD-003|Shipments, tracking events|No Dispatch|
|MOD-004|Documents, PODs|No Legal Execution|
|MOD-005|Escrow state (logical)|No Custody|
|MOD-006|AI predictions, scores|No Execution|
|MOD-007|User dashboard preferences|Localization|
|MOD-008|Mobile offline data|Offline sync|
|MOD-009|Cross-border metadata|No Legal Execution|
|MOD-010|Users, roles, audit logs|Security enforcement|
|MOD-011|API contracts, webhook logs|Integration governance|
|MOD-012|Analytics datasets (derived)|No Computation|
|MOD-013|Settlement records, ledger sync|No Custody|
|MOD-014|Fleet assets, vehicles|Asset Truth, No Dispatch|
|MOD-015|Support tickets, disputes|No Decision Authority|
|MOD-016|Notification templates, preferences|Localization|
|MOD-017|Observability logs, metrics|No Intervention|
|MOD-018|Pricing data, incentives|No Execution|



19\. LOCALIZATION DATA REQUIREMENTS



19.1 Language Preference Storage



User profiles MUST store:



\- language\_preference (default: 'pt')

\- region (for region-to-language mapping)



19.2 Region-to-Language Mapping



MOD-009 manages region-to-language mapping:



| \*\*\*\* | \*\*\*\* |

|------------|----------------------|

|  |  |

|  |  |

| | en |

| | en |

|  | en |

| DRC | pt |

|  | en |



|Region|Default Language|
|-|-|
|Mozambique|pt|
|South Africa|en|
|Zimbabwe|en|
|Zambia|en|
|Malawi|en|
|Botswana|en|
|ESwatini|en|





19.3 Content Localization



\- Notification templates (MOD-016) MUST support pt and en

\- UI content MUST be externalized and localized

\- Document templates MUST support pt and en



20\. EXTERNAL INTEGRATION REFERENCES



\- ESS-001A — External Systems Catalogue

\- ESS-001D — Webhook Governance Standard (event storage)

\- ESS-001E — Error Code Standardization

\- ESS-001F — Financial Integration Architecture

\- ESS-003 — AI Behavior Constraints

\- ESS-004 — Integration Contracts

\- ESS-005 — Operational Runbook

\- ESS-006 — Security \& Compliance

\- ESS-007 — Coding Standards

\- ESS-008 — UI/UX Standards



FINAL PRINCIPLE



ESS-009 ensures:



NexCargo has one truth per data point, and every system layer respects it.

