NEXCARGO PRIMITIVE REGISTRY v1.0

1. Purpose

The NEXCARGO PRIMITIVE REGISTRY defines the canonical set of system-level primitives required to ensure deterministic consistency across all NexCargo MODs.

It establishes:

the authoritative system-wide semantic foundations
the dependency hierarchy between primitives
the governance rules for validation of MODs
the canonical meaning of domain-level concepts

This registry is used to validate MOD correctness.

It is NOT used to define runtime behavior.

2. Core Domain Definition (CRITICAL BOUNDARY)

NexCargo is a:

transport marketplace and matching system between shippers and transport providers

It enables:

listing freight demand
receiving transport offers
matching supply and demand
forming bookings and contracts
coordinating execution through external actors

3. Domain Boundaries (NON-NEGOTIABLE)

NexCargo IS:
a shipper ↔ transporter marketplace
a booking orchestration system
a contract formation system
a coordination and visibility platform
a trust and matching system

NexCargo IS NOT:
a carrier
a transporter
a logistics operator
a fleet manager
a shipment execution system
a physical delivery system
Important Principle:

NexCargo operates ONLY in the marketplace and coordination layer, not in physical logistics execution.

4. Nature of This Document

This registry is:

a system-level semantic foundation layer
a dependency map for all MODs
a validation authority for domain consistency

It is NOT:

a feature specification
an implementation guide
a runtime architecture definition
a messaging system design
an extension of ESS
5. Execution Principle

All MODs MUST be validated against this registry.

Rules:

primitives MUST exist before dependent MOD validation
MODs MUST NOT redefine primitive semantics
primitive violations override MOD correctness
all inconsistencies MUST trigger STOP → TODO
no MOD may bypass primitive constraints

6. PRIMITIVE HIERARCHY OVERVIEW

PRIORITY 0 → System Truth Layer
PRIORITY 1 → Economic Stability Layer
PRIORITY 2 → Execution Consistency Layer
PRIORITY 3 → Communication Layer
PRIORITY 4 → Observability Layer
PRIORITY 5 → Governance Layer
PRIORITY 6 → Dispute Resolution Layer

Lower number = higher system authority.

7. PRIORITY 0 — SYSTEM TRUTH LAYER (BLOCKERS)

These primitives define universal invariants.

0.1 Data Ownership Authority Model

Purpose

Defines a single authoritative owner for every system entity.

Guarantees
one owner per domain entity type
no duplicate ownership across MODs
eliminates entity definition conflicts
Scope

ALL MODs

0.2 Shared Domain Ontology Layer

Purpose

Defines canonical meaning of all domain concepts.

Standard Concepts
shipment (logical marketplace entity)
booking
contract
pricing
carrier (industry term for an external transport provider; not a canonical NexCargo platform role and not a synonym for Transporter — see PROMPT 0 v1.3 §USER ROLES, Non-role terminology)
transporter (external actor)
shipper (external actor)
listing

Guarantees
semantic consistency across MODs
prevents terminology drift
ensures unified interpretation of domain concepts
Scope

ALL MODs

Actor terminology: the canonical platform classifications are Shipper, Transporter, Driver, Dispatcher, Moderator, Admin, SUPER_ADMIN and System (PROMPT 0 v1.3 §USER ROLES). The ontology entries above describe marketplace counterparties in business terms and create no additional role.

0.3 Event System Primitive

Purpose

Defines canonical business event vocabulary and ownership rules.

Guarantees
consistent event naming
single producer per event
multiple observers allowed
events represent business state transitions only

Constraints
NOT a messaging system
NOT event sourcing
NOT infrastructure design
NOT runtime implementation

Scope

MOD-001, MOD-002, MOD-003, MOD-011, MOD-016

8. PRIORITY 1 — ECONOMIC STABILITY LAYER

Defines marketplace economic behavior consistency.

1.1 Canonical Pricing Model

Defines pricing structure and constraints for marketplace transactions.

Scope:

MOD-001
MOD-018

1.2 Marketplace Feedback Loop Model

Defines interaction between supply, demand, and pricing signals.

Scope:

MOD-001
MOD-018

1.3 Incentive & Reward Engine

Defines behavioral incentives within the marketplace system.

Scope:

MOD-001
MOD-018

1.4 Economic State Model

Defines marketplace condition states.

Examples:

supply-dominant
demand-surge
equilibrium
constrained-market
Clarification

These represent:

marketplace liquidity conditions, NOT physical logistics states

9. PRIORITY 2 — EXECUTION CONSISTENCY LAYER

Ensures deterministic behavior across system modules.

2.1 Event → State Propagation Model

Defines how marketplace events translate into system state changes.

2.2 System State Synchronization Model

Ensures consistency of marketplace state across MOD boundaries.

2.3 Matching Algorithm Contract

Defines constraints for marketplace matching logic.

2.4 Logical Shipment State Model (CORRECTED)
Purpose

Defines the lifecycle of a shipment as a marketplace representation only

IMPORTANT CLARIFICATION

This does NOT represent:

physical cargo movement
transport execution
fleet or asset operations

It represents:

a logical shipment object inside the marketplace system

10. PRIORITY 3 — COMMUNICATION LAYER

Defines system communication semantics.

3.1 Canonical Message Model

Standardizes system notifications and alerts.

3.2 Delivery Guarantee Model

Defines message reliability semantics.

3.3 Channel Abstraction Model

Defines communication routing abstraction.

3.4 Notification Lifecycle Model

Defines lifecycle of user-facing notifications.

11. PRIORITY 4 — OBSERVABILITY LAYER

Defines system visibility and diagnostics.

4.1 Observability Data Model

Standardizes logs, metrics, and traces.

4.2 System Traceability Model

Enables cross-module debugging and lineage tracking.

4.3 Incident Lifecycle Model

Defines failure detection and resolution flow.

4.4 Alerting & Threshold Model

Defines monitoring rules.

12. PRIORITY 5 — GOVERNANCE LAYER

Defines system-wide control and policy enforcement.

5.1 Policy Constraint Engine

Central rule enforcement system across MODs.

5.2 Global Policy Hierarchy Model

Defines precedence:

PROMPT 0 v1.3 → BOOT → INDEX → ARBITRATION → ESS → MODS

PROMPT 0 v1.3 §DOCUMENT PRECEDENCE is the governing order and PROMPT 1 records that Prompt 0 always overrides; BOOT states that it does not override another specification layer. The leading position of PROMPT 0 above is a subordinate-reference correction to align this ladder with the governing authority (HAO decision D-01 Item 3, direction 3-D); the remaining ordering is unchanged and any structural re-ordering of this ladder requires a separate architecture decision.

5.3 Dependency Graph Enforcement Model

Prevents circular or invalid MOD dependencies.

13. PRIORITY 6 — DISPUTE RESOLUTION LAYER

Defines structured conflict handling system.

6.1 Dispute Object Model

Formal representation of system conflicts.

6.2 Case Lifecycle State Machine

Defines deterministic dispute progression lifecycle.

6.3 Resolution Authority Hierarchy Model

Defines arbitration authority rules.

TODO: requires specification from BOOT / ESS / MOD — the model's tiers and rules are not defined anywhere in the current corpus. ESS-001F §15.9 decision tiers are EIR decision routing recorded by HAO decision D-01 Item 2 and are not a definition of this primitive. This entry records the void only; it defines no tier, authority or rule, and filling it requires a separate HAO authorisation (HAO decision D-01 Item 3, §5 of the execution instruction).

6.4 Evidence Model

Defines required proof structures for dispute resolution.

14. MOD REFERENCE RULE

MODs SHALL NOT redefine primitives.

Instead:

MODs reference this registry
MODs inherit primitive constraints implicitly
MODs define only local domain behavior

Example:

“This MOD conforms to NEXCARGO PRIMITIVE REGISTRY v1.0”

15. VALIDATION RULE

During MOD validation:

Verify primitive dependency compliance
Verify semantic alignment with ontology layer
Verify event consistency with Event System Primitive
Reject MOD on any primitive violation
Emit STOP → TODO for missing primitives
16. ARCHITECTURAL CONSEQUENCE

This registry establishes a strict hierarchy:

BOOT / INDEX / ARBITRATION
        ↓
PRIMITIVE REGISTRY
        ↓
MOD SPECIFICATIONS

This is the primitive-definition authority chain only. It is not a document-precedence statement: precedence across all layers is defined by PROMPT 0 v1.3 §DOCUMENT PRECEDENCE — SOURCE OF TRUTH and recorded at §5.2 of this registry (HAO decision D-01 Item 3, direction 3-D).

Meaning:

BOOT defines execution rules
INDEX defines structural registry
ARBITRATION resolves conflicts
PRIMITIVES define semantic truth
MODs define marketplace behavior

17. OVERALL PRINCIPLE

NexCargo is a marketplace system.
It does not execute logistics.
It coordinates logistics actors.


---

DOCUMENTATION CHANGE HISTORY (role taxonomy reconciliation — NXC-HOA-AUTH-ROLE-001)

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | §0.2 Shared Domain Ontology: "carrier" restated as an industry term for an external transport provider rather than a platform role, with an explicit note that the ontology entries create no additional classifications. Canonical taxonomy cited to PROMPT 0 v1.2. | HAO decision HD-RT-4; PROMPT 0 v1.2 §USER ROLES — Non-role terminology |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | §0.2 carrier entry and the actor-terminology note now cite PROMPT 0 v1.3. No primitive, ontology entry or actor classification was added, renamed or removed. | HAO decision HD-RT-8 |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | §5.2 global policy hierarchy now leads with PROMPT 0 v1.3, so that the recorded precedence agrees with the governing specification instead of placing BOOT above it; the note states that any structural re-ordering of the ladder requires a separate architecture decision. §6.3 Resolution Authority Hierarchy Model carries a specification-gap marker recording that its tiers and rules are defined nowhere in the current corpus; the entry records the void and defines no tier, authority or rule. No primitive, actor classification or ontology entry was added, renamed or removed. | HAO decision D-01 Item 3, direction 3-D (NXC-HOA-AUTH-D01-ITEM-03-001); PROMPT 0 v1.3 §PERMISSION RULES; Arbitration Layer §5.1; gap-marker convention per Arbitration Layer §6.3 TYPE C |

Document version metadata is unchanged: this is a documentation-consistency reconciliation of the role taxonomy, not an architectural revision of this layer.