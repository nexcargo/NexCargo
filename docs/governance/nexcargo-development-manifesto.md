NEXCARGO DEVELOPMENT MANIFEST (NEXCARGO-DM)



Document Metadata



Document ID:	NEXCARGO-DM
Document Name:	NexCargo Development Manifest
Version:	1.0
Status:		Approved
Classification:	Engineering Governance
Audience: 	AI Builders, Software Architects, Engineers, Technical Leads



1. Purpose



The NexCargo Development Manifest defines the engineering methodology used to transform approved product specifications into production-ready software.

It establishes the principles, workflows and validation processes that guide the development of the NexCargo platform throughout its lifecycle.

Rather than describing product functionality, this document defines how the platform is built, ensuring that implementation remains consistent with the authoritative specification ecosystem.



It provides a common development model for AI-assisted engineering tools and human development teams alike.



2. Development Philosophy



NexCargo follows a Specification-Driven Development methodology.

Product requirements define what is built.

Governance documents define how specifications are interpreted.

Engineering specifications define how capabilities are implemented.

Source code represents the implementation of approved specifications and never becomes the authoritative definition of the platform.

Every implementation activity begins with specification resolution and concludes with engineering validation.



3. Documentation Architecture



The NexCargo documentation ecosystem is organised into four complementary layers.



Product Layer:



AI-EPRS

↓

Governance Layer:

BOOT
INDEX
Arbitration Layer
Specification Interpretation Rules

↓

Engineering Layer:

ESS Specifications
MOD Specifications
Primitive Registry
Event Registry

↓

Implementation Layer:

Source Code
Infrastructure
Deployments

Each layer serves a distinct purpose while contributing to a unified development process.



4. Authoritative Source Principle



Every implementation decision originates from the highest authoritative specification available.



|Information Required|Primary Source|
|-|-|
|Product vision and business capabilities|AI-EPRS|
|AI interpretation rules|BOOT|
|Document relationships|INDEX|
|Specification conflicts|Arbitration Layer|
|External integrations|ESS Specifications|
|Functional implementation|MOD Specifications|
|Canonical entities and objects|Primitive Registry|
|Events and lifecycle definitions|Event Registry|
|||



If information cannot be found within the authoritative specifications, implementation must pause until the required specification is created or updated.



5. Development Principles



Specification-First Development

Development always begins with approved specifications rather than implementation ideas.

No functionality should be introduced without a corresponding specification.

Deterministic Engineering

Development sessions should produce repeatable outcomes from the same specification inputs.

Implementation must rely on documented specifications rather than conversational context or inferred assumptions.

Incremental Delivery

Development progresses through clearly defined capabilities.

Each implementation focuses only on the requested scope, reducing complexity and limiting unintended changes.

Validation Before Integration

Every completed capability is validated against its governing specifications before being integrated into the platform.

Implementation is considered complete only after validation has been successfully performed.

Architecture Preservation

Approved architectural decisions are preserved throughout development.

Implementation should evolve the platform without introducing unauthorised structural changes.



6. Development Lifecycle



Development progresses through a sequence of controlled phases.



Phase 1 — Specification Preparation



The required specifications are reviewed, validated and approved.



Deliverable:

Approved specification baseline.



Phase 2 — Foundation Architecture



Generate the platform foundation, including project structure, authentication, design system, database configuration, CI/CD pipelines and development infrastructure.

Business functionality is intentionally excluded from this phase.



Deliverable:

Technical foundation ready for capability implementation.



Phase 3 — Capability Implementation



Platform capabilities are implemented according to dependency order rather than document numbering.

Each capability follows a consistent workflow:



Resolve

↓

Implement

↓

Validate

↓

Review

↓

Merge

↓

Freeze



Phase 4 — Platform Integration



Individual capabilities are integrated through shared APIs, events, external services and platform infrastructure.



Deliverable:

Integrated platform.



Phase 5 — Platform Verification



The complete platform is validated for specification compliance, security, performance and operational integrity.



Deliverable:

Release candidate.



Phase 6 — Web Platform Release



The web platform progresses through:



Development

↓

Testing

↓

Staging

↓

Production



Phase 7 — Mobile Platform Preparation



Once the web platform reaches operational maturity, mobile architecture is established using the existing backend, APIs and shared business logic.



Deliverable:

Mobile foundation.



Phase 8 — Mobile Application Development



Mobile applications reuse the platform's shared services while providing native device experiences.

Only presentation and device-specific functionality differ from the web implementation.



Phase 9 — Continuous Evolution



Future enhancements follow the same specification-driven process established by this manifest.



7. Specification Resolution Strategy



Every development session begins by establishing the authoritative specification context required for the requested capability.



The process follows this sequence:



Requested Capability

↓

Load BOOT

↓

Load INDEX

↓

Resolve Product Capability

↓

Resolve Governing Specifications

↓

Consult Arbitration Layer (if required)

↓

Resolve Dependencies

↓

Load Required Specifications

↓

Validate Completeness

↓

Begin Implementation



Only the specifications necessary for the requested capability are loaded.

Unrelated specifications remain outside the active development context.



8. Context Resolution Principles



To maximise consistency and minimise context loss:



Keep BOOT immutable during development.
Use INDEX as the single entry point for document discovery.
Load specifications only when required.
Remove completed context before moving to unrelated work.
Never rely on conversational memory as a substitute for specifications.



9. Dependency Resolution



Before implementation begins, dependencies are resolved in the following order:



Capability

↓

MOD Specification

↓

ESS Dependencies

↓

Primitive Definitions

↓

Event Definitions

↓

API Contracts

↓

Implementation



This ensures that each capability is implemented with a complete understanding of its functional and technical context.



10. Engineering Validation Gates



Every implementation must successfully satisfy the following validation criteria before integration:



Compliance with BOOT
Compliance with AI-EPRS
Compliance with applicable ESS specifications
Compliance with relevant MOD specifications
Compliance with the Event Registry
Compliance with the Primitive Registry
Security validation
Database policy validation (including RLS)
API contract validation
Type safety
Automated testing
Documentation updates



11. Source Control Workflow



All development activities follow a controlled source management process:



Feature Branch

↓

Implementation

↓

Engineering Validation

↓

Human Review

↓

Merge

↓

Version Tag

↓

Release



12. Mobile Development Strategy



Mobile applications extend the existing NexCargo platform rather than creating an independent system.



They reuse the shared:

Authentication
APIs
Database
Business rules
AI services
Event system
Security model



Only presentation, user interaction and device capabilities are implemented separately.



13. Completion Criteria



A capability is considered complete when:

Approved specifications have been fully implemented.
All engineering validation gates have been satisfied.
Tests have passed successfully.
Documentation has been updated where required.
Source code has been reviewed and committed.

Completion represents readiness for integration rather than the end of future evolution.



14. Continuous Evolution



NexCargo is designed as an evolving platform.

New capabilities, architectural improvements and platform enhancements follow the same specification-driven methodology established by this document.

Every evolution begins with:



Specification

↓

Review

↓

Approval

↓

Implementation

↓

Validation

↓

Release



This ensures that product vision, engineering architecture and implementation remain aligned throughout the platform's lifecycle.

