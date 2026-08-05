NEXCARGO SPECIFICATION INDEX \& KNOWLEDGE ROUTING MAP v1.0



Document ID: NEXCARGO-INDEX

Document Name: NexCargo Specification Index \& Knowledge Routing Map

Version: v1.0

Status: Approved

Classification: Canonical Registry

Audience: AI Builders, Software Engineers, Architects, Technical Reviewers



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
|NEXCARGO\_BOOT.md|Behavioural Kernel|
|NEXCARGO\_INDEX.md|Knowledge Routing Layer|
|Development Manifest|Development Workflow|
|Arbitration Layer|Conflict Resolution|





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



Each documentation layer evolves independently.



|Layer|Version|
|-|-|
|BOOT|v1.0|
|INDEX|v1.0|
|AI-EPRS|v1.0|
|Development Manifest|v1.0|
|ESS Specifications|v1.0|
|MOD Specifications|v1.0|
|Primitive Registry|v1.0|
|Event Registry|v1.0|
|Arbitration Layer|v1.0|





Version updates within one layer shall not imply changes to any other layer unless explicitly stated.



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

