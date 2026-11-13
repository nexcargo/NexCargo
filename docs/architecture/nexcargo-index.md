NEXCARGO SPECIFICATION INDEX \& KNOWLEDGE ROUTING MAP v1.3



Document ID: NEXCARGO-INDEX

Document Name: NexCargo Specification Index \& Knowledge Routing Map

Version: v1.3

Status: Approved

Classification: Canonical Registry

Audience: AI Builders, Software Engineers, Architects, Technical Reviewers

**Changelog:** v1.3 — Updated §7.2 PROMPT 0 Version Registry to reflect HAO decision HD-RT-8 (NXC-HOA-DECISION-HD-RT-8, 2026-10-30): PROMPT 0 v1.2 SUPERSEDED / HISTORICAL, PROMPT 0 v1.3 CURRENT / AUTHORITATIVE. §7.1 INDEX layer version raised v1.2 → v1.3; no other layer version changed.

**Prior:** v1.2 — Updated §7.2 PROMPT 0 Version Registry to reflect HAO authorization NXC-HOA-AUTH-ROLE-001 (2026-10-30, decisions HD-RT-1 → HD-RT-7): PROMPT 0 v1.1 SUPERSEDED, PROMPT 0 v1.2 CURRENT / AUTHORITATIVE. §7.1 Layer Version Registry unchanged; per §7.2 closing rule, a version update in one layer does not imply a version change in any other layer.

**Previous:** v1.1 — Updated Version Registry (§7) to reflect HAO decision 2026-08-17: PROMPT 0 v1.0 DEPRECATED, PROMPT 0 v1.1 CURRENT / AUTHORITATIVE.



1\. Purpose



The NexCargo Index is the authoritative knowledge routing layer of the NexCargo specification ecosystem.



Its purpose is to provide deterministic discovery of all approved specifications required to design, implement, validate and maintain the NexCargo platform.



Rather than containing business rules or implementation logic, the Index acts as a navigation system that identifies where authoritative knowledge resides and how the various specifications relate to one another.



Every implementation activity begins with the Index.



The Index defines:



document registry

document relationships

specification discovery

capability mapping

structural dependencies

version registry

document locations



The Index does not define:



product requirements

business behaviour

runtime behaviour

implementation logic

security policies

engineering standards

conflict resolution

2\. System Role



The Index is the central navigation layer of the NexCargo documentation ecosystem.



It provides a deterministic mechanism for locating the authoritative specifications required to implement any platform capability.



The Index functions as:



specification registry

knowledge router

dependency map

capability locator

version registry

document catalogue



The Index identifies where knowledge exists but never interprets that knowledge.



3\. Documentation Architecture



The NexCargo documentation ecosystem is organised into distinct responsibility layers.



&#x20;                       PRODUCT



&#x20;                    AI-EPRS



&#x20;                        │



&#x20;                        ▼



&#x20;                   GOVERNANCE



&#x20;       BOOT

&#x20;       INDEX

&#x20;       Development Manifest

&#x20;       Arbitration Layer



&#x20;                        │



&#x20;                        ▼



&#x20;                   ENGINEERING



&#x20;       ESS Specifications

&#x20;       MOD Specifications

&#x20;       Primitive Registry

&#x20;       Event Registry



&#x20;                        │



&#x20;                        ▼



&#x20;                 IMPLEMENTATION



&#x20;     Source Code

&#x20;     Infrastructure

&#x20;     Deployment

&#x20;     Operations



Each layer has a single, well-defined responsibility.



No document shall duplicate responsibilities assigned to another layer.



4\. Documentation Responsibility Matrix





|Requirement|Authoritative Specification|
|-|-|
|\|AI behaviour and system principles|BOOT|
|Document discovery|INDEX|
|Product vision and capabilities|AI-EPRS|
|\|Development methodology|Development Manifest|
|Engineering standards|ESS Specifications|
|Capability implementation|MOD Specifications|
|Canonical domain objects|Primitive Registry|
|Canonical events|Event Registry|
|Conflict resolution|Arbitration Layer|



When uncertainty exists, the Index identifies which specification is authoritative.



5\. Source of Truth Model



The Index is authoritative only for:



document existence

document identification

document relationships

capability mapping

dependency mapping

version tracking

specification discovery



The Index is not authoritative for:



behavioural rules

execution policies

implementation decisions

runtime execution

product requirements

business logic

architectural governance



These responsibilities belong exclusively to their respective specifications.



6\. Core Documentation Registry



6.1 Governance Layer



|Document|Responsibility|
|-|-|
|NEXCARGO_BOOT.md|Behavioural Kernel|
|NEXCARGO_INDEX.md|Knowledge Routing Layer|
|Development Manifest|Development Workflow|
|Arbitration Layer|Conflict Resolution|
|Development State Registry|Current Project Status and Progress Tracking|





6.2 Product Layer



Document	Responsibility

AI-EPRS		Product Requirements Specification



6.3 Engineering Layer



|Document Group|Responsibility|
|-|-|
|ESS-001 → ESS-009|Engineering Standards|
|MOD-001 → MOD-018|Capability Specifications|
|Primitive Registry|Canonical Domain Objects|
|Event Registry|Canonical Events|





6.4 External Systems



&#x09;	

&#x09;



|Document Group|Responsibility|
|-|-|
|Integration Specifications|External System Interfaces|





7\. Version Registry
### 7.1 Layer Version Registry



Each documentation layer evolves independently.



|Layer|Version|
|-|-|
|BOOT|v1.0|
|INDEX|v1.3|
|AI-EPRS|v1.0|
|Development Manifest|v1.0|
|ESS Specifications|v1.0|
|MOD Specifications|v1.0|
|Primitive Registry|v1.0|
|Event Registry|v1.0|
|Arbitration Layer|v1.0|





### 7.2 PROMPT 0 Version Registry

PROMPT 0 versions are tracked separately due to the dependency taxonomy revision introduced by v1.1, the canonical role taxonomy revision introduced by v1.2, and the SUPER_ADMIN executive authority domain revision introduced by v1.3.

|Version|Status|Effective Date|Notes|
|-|-|-|-|
|v1.0|DEPRECATED|2026-08-17|Superseded by v1.1 per HAO decision. Retained as historical reference only.|
|v1.1|SUPERSEDED / HISTORICAL|2026-08-17|Superseded by v1.2 per HAO authorization NXC-HOA-AUTH-ROLE-001 (HD-RT-1), effective 2026-10-30. Retained in the repository unchanged as historical reference only. Its dependency taxonomy (SC, IC, DO, ES, AU, IS, BC, OB) is carried forward verbatim by v1.2. Its §USER ROLES list omitted SUPER_ADMIN and is superseded by v1.2.|
|v1.2|SUPERSEDED / HISTORICAL|2026-10-30|Superseded by v1.3 per HAO decision HD-RT-8 (NXC-HOA-DECISION-HD-RT-8), effective 2026-10-30. Retained in the repository unchanged as historical reference only. It introduced the canonical eight-classification role taxonomy (Shipper, Transporter, Driver, Dispatcher, Moderator, Admin, SUPER_ADMIN, System), the Moderator → Admin → SUPER_ADMIN hierarchy, Transporter-controlled Driver onboarding and Dispatcher delegation, and the ROLE PROVISIONING AND DELEGATION section; that content is carried forward unchanged by v1.3.|
|v1.3|CURRENT / AUTHORITATIVE|2026-10-30|Sole active authoritative version. Adds the five SUPER_ADMIN executive authority domains approved under HD-RT-8 — Financial Escrow and Dispute Override; Master Integration and API Gateway Control; Global Compliance, Data Privacy and Immutable Audit Log Oversight; Platform-Wide Feature Flags and Emergency Kill-Switches; Enterprise Tenant and Subscription Management — each with its mandatory boundaries, together with the accountability and separation-of-duties rules. The canonical role taxonomy, the administrative hierarchy, the role provisioning and delegation rules, dependency semantics, module boundaries, business domains, the financial model and implementation-sequence governance are unchanged from v1.2. No source code, schema, RLS, RBAC or runtime change is authorized or implied.|


Version updates within one layer shall not imply changes to any other layer unless explicitly stated.


### 7.3 INDEX Change History

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | INDEX version raised v1.1 → v1.2. §7.2 records PROMPT 0 v1.2 as CURRENT / AUTHORITATIVE and PROMPT 0 v1.1 as SUPERSEDED / HISTORICAL. §7.1 Layer Version Registry intentionally unchanged. | HAO authorization NXC-HOA-AUTH-ROLE-001, decision HD-RT-1 |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | INDEX version raised v1.2 → v1.3 (§7.1). §7.2 records PROMPT 0 v1.3 as CURRENT / AUTHORITATIVE and re-labels PROMPT 0 v1.2 as SUPERSEDED / HISTORICAL; the v1.0 and v1.1 rows are retained unchanged. Loader and citation pointers to PROMPT 0 v1.2 across the governance layer repointed to v1.3. No role classification, permission boundary, invariant or module boundary was altered, and no superseded document was edited. | HAO decision HD-RT-8 (NXC-HOA-DECISION-HD-RT-8) |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-2 | §7.4 rule 1: the Authority basis column of the required change-history template now reads "LA decision and governing specification references", so that entries required going forward cite the current designation. Every historical HAO citation in this document is retained unchanged: the §7.2 PROMPT 0 version rows, the two rows above in this table, the §7.4 commencement statement and §7.4 rule 6. §7.4 itself continues to be recorded as established by the Stage 1 authorisation. No section numbering, version record, precedence rule, approval boundary or governance provision was altered; INDEX remains v1.3 and §7.1 and §7.2 are unchanged. | LA authorisation NXC-HOA-AUTH-D01-ITEM-06-STAGE-2 (2026-11-03); PROMPT 0 v1.3 §11 Designation Successor |


### 7.4 Document Change-History Standard

Established by HAO decision D-01 Item 6 Stage 1 (authorisation NXC-HOA-AUTH-D01-ITEM-06-STAGE-1, 2026-11-03). This section is the normative home of the standard. PROMPT 0 v1.3 §8 Documentation Governance requires that every change include revision history, and §5 of this document makes the Index authoritative for version tracking. This section creates no authority, permission, role or architectural rule of its own.

Applies to: the active authoritative specifications registered in §6 — the governance layer, AI-EPRS, the Primitive and Event registries, ESS-001 with its appendices and ESS-002 to ESS-009, MOD-001 to MOD-018, and the foundation prompts. It does not apply to superseded or deprecated documents retained unchanged as historical reference, nor to audit, analysis, adjudication, closure or wave artefacts, which are not part of the authoritative corpus.

1. Required table and placement. Each document carries one block at the end of the document, after a horizontal separator, headed "DOCUMENTATION CHANGE HISTORY", containing this four-column table:

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| YYYY-MM-DD | Authorisation ID | Actual document changes at section level, including what was expressly not changed | LA decision and governing specification references |

2. Mandatory version statement. A "Version effect:" statement is required immediately below the table and must state accurately whether the document version changed. A documentation-consistency edit does not by itself justify a version increase. Where the version genuinely changes, the statement gives the actual previous and new versions and names the version records updated — §7.1 or §7.2 of this document and the Development State record, as applicable.

3. One entry per authorised change. Every authorised change that affects a document adds exactly one row, dated the day the change was actually made, citing the authorisation ID under which it was made. A pass that edits several documents adds a row to each document it edited.

4. Append-only history. Rows are appended. No existing row, annotation or historical statement is silently deleted, rewritten, reordered or reworded.

5. Correction of erroneous entries. An erroneous historical entry is answered by a new row that names the entry being corrected and states the error, or by a bracketed dated annotation in the form **[SUPERSEDED YYYY-MM-DD by AUTHORISATION ID: …]**, which is the convention already used in the Development State register. The original text stays in place.

6. Document histories and the central register. The Development State decision register is the corpus-wide record of what the HAO authorised and why. A change-history block is the record of what changed inside one document. Neither substitutes for the other: an authorised documentation change is expected to appear in both, and a block cites the register's authorisation ID rather than restating the decision.

7. Evidence standard for historical entries. Every row must be supported by existing evidence — the register entry for the change, or the document's own inline citation of the authority it implements. Dates, versions, approvals, authorisation IDs and changes that cannot be evidenced are not recorded. Undocumented history is not reconstructed, and a block is never presented as the complete historical life of its document.

8. Commencement rule. Where a document's earlier history cannot be reliably reconstructed, the first entry of its block states: "History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register."

9. Block creation trigger. An active specification that has no change-history block receives the canonical block at its first authorised change, and not before. Documents that have received no authorised change of their own are not given blocks in a bulk pass.

10. Grandfathered equivalents. The five-column blocks already present in AI-EPRS, PROMPT 4 and PROMPT 7, and §7.3 of this section, satisfy this standard in their existing structure: they are extended in that structure and are not restructured. The superseded versions of PROMPT 0 (v1.0, v1.1 and v1.2) receive no block at all — they are retained byte-for-byte, and their history is recorded in §7.2, in the Development State PROMPT 0 Version History and in PROMPT 0 v1.3 itself.



8\. Product Capability Registry



The product is organised around business capabilities.



Implementation details are delegated to the corresponding module specifications.



|	<br />Product Capability|Primary Specification|Supporting Specifications|
|-|-|-|
|Marketplace|MOD-001|AI-EPRS, ESS, Primitive Registry, Event Registry|
|Booking \& Contracts|MOD-002|AI-EPRS, ESS, Event Registry|
|Tracking \& Visibility|MOD-003|AI-EPRS, MOD-011, Event Registry|
|Document Management|MOD-004|AI-EPRS, ESS|
|Financial Orchestration|MOD-005, MOD-013|ESS-001F, Event Registry|
|AI Intelligence|MOD-006|ESS-003, Primitive Registry, Event Registry|
|User Experience|MOD-007|ESS-008|
|Mobile Applications|MOD-008|ESS-008|
|Regional Logistics|MOD-009|ESS, Integration Specifications|
|Security \& Compliance|MOD-010|ESS-006|
|Platform Integration|MOD-011|ESS-004|
|Analytics \& Business Intelligence|MOD-012|ESS-009|
|Asset Management|MOD-014|Event Registry|
|Customer Support \& Dispute Resolution|MOD-015|ESS-006|
|Notifications \& Communication|MOD-016|Event Registry|
|Platform Observability|MOD-017|ESS-005|
|Marketplace Growth \& Commercial Optimisation|MOD-018|ESS-003, AI-EPRS, Event Registry, Analytics (MOD-012)|





This registry enables AI builders to identify the authoritative specifications required for a requested capability.



9\. Module Registry



The NexCargo platform consists of eighteen immutable implementation modules.



|Module|Capability|Domain|
|-|-|-|
|MOD-001|Marketplace|Marketplace|
|MOD-002|Booking \& Contract Management|Marketplace Operations|
|MOD-003|Tracking \& Visibility|Logistics Execution|
|MOD-004|Document Management|Documentation|
|MOD-005|Escrow \& Payment Management|Financial Infrastructure|
|MOD-006|AI Intelligence Platform|Artificial Intelligence|
|MOD-007|User Dashboards \& Experience|Presentation|
|MOD-008|Mobile Applications \& Edge Operations|Mobile Platform|
|MOD-009|Regional \& Cross-Border Logistics|Regional Operations|
|MOD-010|Security, Compliance \& Governance|Governance|
|MOD-011|Platform Integration \& APIs|Platform Infrastructure|
|MOD-012|Data Platform, Analytics \& BI|Analytics|
|MOD-013<br />|Infrastructure|Financial Infrastructure|
|MOD-014|Fleet, Asset \& Logistics Operations|Fleet Operations|
|MOD-015|Customer Support \& Dispute Resolution|Customer Operations|
|MOD-016|Notifications, Messaging \& Communication|Communication|
|MOD-017|System Observability \& DevOps|Platform Infrastructure|
|MOD-018|Marketplace Growth \& Commercial Optimisation|Marketplace|





These modules define the permanent structural decomposition of the platform.



Modules may only change through formal architectural revision.



10\. Engineering Standards Registry



The Index recognises the following engineering specifications.



|Specification|Responsibility|
|-|-|
|ESS-001|External Integration Standards|
|ESS-002|Testing \& Quality Assurance|
|ESS-003|AI Intelligence Standards|
|ESS-004|Integration Contracts|
|ESS-005|Operations \& Runbooks|
|ESS-006|Security \& Compliance|
|ESS-007|Coding Standards|
|ESS-008|UI/UX Standards|
|ESS-009|Data Governance|





ESS-001 includes the following appendices:



ESS-001A — External Systems Catalogue

ESS-001B — Authentication Standards Matrix

ESS-001C — Retry \& Timeout Policies

ESS-001D — Webhook Governance

ESS-001E — Error Code Standards

ESS-001F — Financial Integration Architecture

ESS-001G — Future Integration Roadmap



11\. Specification Resolution Process



Every implementation request shall resolve specifications using the following process.



Development Request

&#x20;       │

&#x20;       ▼

Read BOOT

&#x20;       │

&#x20;       ▼

Read INDEX

&#x20;       │

&#x20;       ▼

Identify Product Capability

&#x20;       │

&#x20;       ▼

Locate Primary Specification

&#x20;       │

&#x20;       ▼

Locate Supporting Specifications

&#x20;       │

&#x20;       ▼

Validate Completeness

&#x20;       │

&#x20;       ▼

Begin Implementation



The Index identifies where specifications exist.



It never interprets their contents.



12\. Repository Structure



The canonical documentation repository shall follow the structure below.



/docs



&#x20;   boot/



&#x20;   index/



&#x20;   ai-eprs/



&#x20;   development-manifest/



&#x20;   ess/



&#x20;   modules/



&#x20;   registries/



Actual filenames and directory organisation shall remain consistent with this structure.



13\. Integrity Principles



The Index shall:



accurately reflect the documentation ecosystem;

maintain deterministic document discovery;

preserve responsibility separation;

avoid behavioural interpretation;

remain implementation-independent;

remain technology-neutral.



Where inconsistencies are detected between specifications, implementation shall stop and the conflict shall be referred to the Arbitration Layer.



14\. Design Principles



The NexCargo Index exists to provide deterministic navigation through the entire specification ecosystem.



It enables AI builders and engineers to discover authoritative knowledge without embedding product logic, implementation behaviour or execution policies.



The Index shall remain:



declarative;

deterministic;

referential;

non-executing;

non-interpretive;

implementation-independent.

