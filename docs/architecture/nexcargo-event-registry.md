# NexCargo Event Registry v1.0

---

# 1. Purpose

The NexCargo Event Registry defines the canonical business event vocabulary for the NexCargo specification ecosystem.

Its purpose is to establish a single authoritative source for:

- event names
- event ownership
- event producers
- event consumers
- event classification
- event criticality
- event lifecycle governance
- event naming conventions
- event constraints

The Event Registry defines business event vocabulary only.

It does not define:

- runtime messaging
- event brokers
- event transport
- event persistence
- event schemas
- database structures
- API contracts
- implementation patterns
- infrastructure behaviour
- execution workflows

The Event Registry exists to provide deterministic business language shared across all NexCargo modules.

---

# 2. Scope

The Event Registry governs the naming and ownership of all canonical business events used throughout the NexCargo specification ecosystem.

Each registered event represents:

- a business fact
- a completed business state transition
- an observable business occurrence

Events are shared vocabulary between modules.

The Event Registry defines:

- what an event means
- which module owns its definition
- which module produces it
- which modules may consume it

The Event Registry does not define:

- what consumers execute
- how consumers react
- implementation behaviour

---

# 3. Compatibility

This document is compatible with:

- NEXCARGO_BOOT.md v1.0
- NEXCARGO_INDEX.md v1.0
- ESS specifications v1.0
- MOD specifications v1.0

The Event Registry SHALL remain aligned with the NexCargo specification governance hierarchy.

---

# 4. Event Registry Structure

Each registered event SHALL define the following metadata:

| Field | Description |
|---|---|
| Event | Canonical event name |
| Owner | MOD responsible for defining the event meaning |
| Produced By | MOD responsible for originating the event |
| Consumers | MODs permitted to consume the event |
| Classification | Primary business category |
| Criticality | Business importance level |
| Immutable | Whether the event record represents an immutable business fact |
| Description | Business meaning of the event |

---

## Example

| Event | Owner | Produced By | Consumers | Classification | Criticality | Immutable | Description |
|-|-|-|-|-|-|-|-|
| listingCreated | MOD-001 | MOD-001 | MOD-002, MOD-012 | Business | High | Yes | A shipment listing has been created. |
| bookingConfirmed | MOD-002 | MOD-002 | MOD-003, MOD-005, MOD-016 | Business | Critical | Yes | A booking has been confirmed. |
| contractSigned | MOD-002 | MOD-002 | MOD-003, MOD-005, MOD-016 | Business | Critical | Yes | A contract has been signed by both parties. |
| escrowLockConfirmed | MOD-005 | MOD-005 | MOD-013, MOD-016 | Financial | Critical | Yes | Funds have been locked in escrow per external confirmation. |
| paymentConfirmed | MOD-005 | MOD-005 | MOD-013, MOD-016 | Financial | Critical | Yes | Payment has been confirmed by the provider. |
| paymentFailed | MOD-005 | MOD-005 | MOD-013, MOD-016 | Financial | Critical | Yes | Payment has failed per provider callback. |
| settlementCompleted | MOD-013 | MOD-013 | MOD-005, MOD-016 | Financial | Critical | Yes | Settlement has been completed and funds distributed. |
| disputeHoldPlaced | MOD-015 | MOD-015 | MOD-005, MOD-016 | Compliance | High | Yes | A hold has been placed on funds due to a dispute. |
| trackingStatusChanged | MOD-003 | MOD-003 | MOD-001, MOD-016 | Business | High | Yes | Shipment tracking status has been updated. |
| supportTicketCreated | MOD-015 | MOD-015 | MOD-016 | Business | Medium | Yes | A support ticket has been created. |
| documentUploaded | MOD-004 | MOD-004 | MOD-016 | Business | Medium | Yes | A document has been uploaded to the system. |

NOTE: The example rows above illustrate the registry structure. They are not exhaustive. The full event catalogue is maintained in the Module Event Ownership sections (§13).

The registry defines ownership and meaning only.

It does not define implementation behaviour.

---

# 5. Event Classification

Each event SHALL belong to exactly one primary classification.

Allowed classifications:

- Business
- Financial
- Compliance
- AI Advisory
- Analytics
- Notification
- Integration
- Observability
- Security

Classification represents business purpose only.

Classification SHALL NOT represent:

- technical implementation
- infrastructure mechanism
- transport method
- processing behaviour

---

# 6. Event Criticality

Each event SHALL define business criticality.

Allowed values:

- Critical
- High
- Medium
- Low

Criticality represents business importance only.

Criticality SHALL NOT define:

- execution priority
- processing order
- infrastructure priority
- system performance requirements

---

# 7. Event Naming Convention

Canonical events SHALL:

- use camelCase
- begin with a business entity
- end with a completed business state transition
- describe a business fact
- remain technology independent

Canonical events SHALL NOT:

- represent commands
- represent CRUD operations
- represent internal processes
- represent implementation actions
- use technical terminology

---

## Preferred Examples

- listingCreated
- listingPublished
- offerSubmitted
- offerWithdrawn
- bookingValidated
- bookingConfirmed
- contractDrafted
- contractSigned
- contractAmended
- contractCompleted
- escrowLockConfirmed
- paymentConfirmed
- paymentFailed
- settlementCompleted
- disputeHoldPlaced
- trackingStatusChanged
- supportTicketCreated
- documentUploaded

---

## Invalid Examples

- createListing
- processBooking
- executeContract
- bookingValidatedEvent
- ProcessStarted
- ExecutePayment

---

# 8. Event Ownership Rules

Each event SHALL have:

- exactly one owner
- exactly one producer
- zero or more consumers

Duplicate ownership is prohibited.

The owning MOD is responsible for:

- maintaining event meaning
- preventing semantic duplication
- approving lifecycle changes

Ownership represents authority over business meaning.

Ownership does not represent:

- runtime control
- technical implementation ownership
- infrastructure ownership

---

# 9. Event State Transition Rule

Every registered event SHALL represent a legitimate business state transition.

Events SHALL represent:

- completed business facts
- confirmed business occurrences
- meaningful state changes

Events SHALL NOT represent:

- calculations
- internal processing
- temporary states
- technical operations
- system activities

---

# 10. Event Lifecycle Governance

Events SHALL follow a controlled lifecycle.

Allowed lifecycle states:

- Draft
- Approved
- Deprecated
- Retired

Events SHALL NOT be silently replaced.

When an event becomes obsolete:

- the original event remains historically valid
- replacement events require architecture approval
- affected modules must explicitly migrate

AI Builders SHALL NOT create replacement events without approval.

---

# 11. Event Versioning

Events are versioned through their owning MOD.

The Event Registry maintains canonical vocabulary.

The Event Registry does not independently define:

- API versions
- transport versions
- implementation versions

Any event semantic change requires review by the owning MOD and alignment with the specification governance hierarchy.

---

# 12. AI Event Creation Restriction

AI Builders SHALL NOT create new business events.

If an implementation requirement requires an event that does not exist in this registry:

The AI Builder SHALL:

1. Stop implementation of that requirement.
2. Identify the missing event.
3. Emit:

EVENT REGISTRY GAP:

[description of required event]

Architecture approval required.

No module SHALL introduce undocumented events.

---

# 13. Referencing the Event Registry

Modules SHALL reference this Event Registry instead of redefining event vocabulary.

Each MOD SHALL list only the events it owns.

Example:

## MOD-001 Owned Events

- listingCreated
- listingPublished
- listingExpired
- listingCancelled
- listingBooked
- offerSubmitted
- offerWithdrawn
- offerAccepted
- offerRejected
- offerExpired
- matchProposed
- matchAccepted
- matchRejected
- quoteGenerated

Constraint:

matchProposed is advisory only.

It SHALL NOT trigger automatic booking.

---
## MOD-002 Owned Events

- bookingRequested
- bookingValidated
- bookingConfirmed
- contractDrafted
- contractSigned
- contractAmended
- contractTerminated
- contractCompleted

## MOD-003 Owned Events

- trackingRequested
- pickupConfirmed
- transitStarted
- deliveryConfirmed
- podSubmitted
- trackingStatusChanged

## MOD-004 Owned Events

- documentsUploaded
- documentVerified
- documentRejected
- documentUploaded

## MOD-015 Owned Events

- supportTicketCreated
- disputeFiled
- disputeHoldPlaced
- disputeEvidenceSubmitted

## MOD-003 Owned Events

- trackingRequested
- pickupConfirmed
- transitStarted
- deliveryConfirmed
- podSubmitted
- trackingStatusChanged

## MOD-004 Owned Events

- documentsUploaded
- documentVerified
- documentRejected
- documentUploaded

## MOD-015 Owned Events

- supportTicketCreated
- disputeFiled
- disputeHoldPlaced
- disputeEvidenceSubmitted

## MOD-005 Owned Events

- escrowInterventionRequested
- escrowInterventionDecided

Metadata, in the §4 structure:

| Event | Owner | Produced By | Consumers | Classification | Criticality | Immutable | Description |
|-|-|-|-|-|-|-|-|
| escrowInterventionRequested | MOD-005 | MOD-005 | MOD-013, MOD-015, MOD-010 | Compliance | High | Yes | A governed Escrow Intervention Request has been initiated within an ESS-001F §15.6 trigger by a named Admin or SUPER_ADMIN. |
| escrowInterventionDecided | MOD-005 | MOD-005 | MOD-013, MOD-015, MOD-010 | Compliance | Critical | Yes | A decision has been recorded on an Escrow Intervention Request by the authority tier applicable under ESS-001F §15.9. |

Classification is Compliance rather than Financial because each event records an internal governed human act, not an externally confirmed financial state; the No Custody Principle below requires Financial events to reference external financial confirmation, which these events do not and MUST NOT imply.

Constraint:

Both events record the governed Escrow Intervention Request defined in ESS-001F §15.7 and its lifecycle in ESS-001F §15.8. They are registered under the architecture approval recorded in ESS-001F §15.10 and are the events that section's registry gap awaited.

Ownership follows ESS-001F §15.10: the Escrow Intervention Request belongs to the Admin financial oversight layer and escrow orchestration remains MOD-005. Registering these events transfers no ownership of any dispute or case record, which remains MOD-015, or of any settlement or reconciliation record, which remains MOD-013.

escrowInterventionRequested identifies, using the business references already defined in ESS-001F §15.7 and stating no schema: the Escrow Intervention Request reference, the related booking and contract references, the related escrow and dispute references where present, the initiating actor, the applicable eligibility trigger from the closed list in ESS-001F §15.6, and the request's lifecycle context at initiation.

escrowInterventionDecided identifies, from the same existing references: the Escrow Intervention Request reference, the deciding actor, the decision authority tier applied under ESS-001F §15.9, and the resulting lifecycle context. The deciding actor and the assigned reviewer are recorded separately from the initiating actor; neither may be the initiator (ESS-001F §15.9 independence rule).

Neither event authorises, executes, confirms or reverses any bank or payment-provider transaction. Custody and financial execution remain exclusively with the bank or authorised payment provider (ESS-001F §2.1, §2.2, §15.5; MOD-013 §7.1, §7.2), and the bank confirmation — not either event — remains the only thing that changes a financial state.

Neither event is an eligibility trigger and neither grants authority. Eligibility remains the closed trigger list in ESS-001F §15.6 and decision authority remains the tiers in ESS-001F §15.9; an event name confers neither.

No further transition in the ESS-001F §15.8 lifecycle is registered as canonical business vocabulary by this entry. Routing, evidence submission, withdrawal, cancellation and implementation outcome continue to be recorded through the append-only history defined in ESS-001F §15.10 rather than through additional event names.

This entry registers only the two Escrow Intervention Request events authorised by HAO decision D-01 Item 5. It is not a complete MOD-005 catalogue: the escrow orchestration events declared in MOD-005 §8 are not registered here, and their registration, their canonical camelCase naming under §7, and their reconciliation with the §4 illustrative rows and with the MOD-015 owned list remain a separate registry decision.

---

# 14. Implementation Independence

The Event Registry defines canonical business event names only.

Implementations may expose these events using technology-specific representations.

Examples:

| Canonical Event | Possible Implementation Representation |
|-|-|
| bookingValidated | onBookingValidated() |
| bookingValidated | BookingValidatedHandler |
| bookingValidated | booking.validated |

These representations are implementation details.

They SHALL NOT replace the canonical event name.

---

# 15. Naming Consistency

The NexCargo specification ecosystem adopts the following naming conventions:

| Artifact | Convention | Example |
|-|-|-|
| Repository filenames | lowercase | nexcargo_event_registry.md |
| Module identifiers | MOD-### | MOD-001 |
| Domain entities | PascalCase | ShipmentListing |
| Attributes | camelCase | bookingId |
| Business events | camelCase | bookingConfirmed |

This strategy provides deterministic vocabulary for AI Builders while maintaining separation between:

- specification concepts
- domain entities
- attributes
- business events

---

# 16. Module Event Ownership Summary

| Module | Owned Event Categories | Key Constraint |
|-|-|-|
| MOD-001 | listingCreated, listingPublished, listingExpired, listingCancelled, listingBooked, offerSubmitted, offerWithdrawn, offerAccepted, offerRejected, offerExpired, matchProposed, matchAccepted, matchRejected, quoteGenerated | No Auto-Booking |
| MOD-002 | Booking and contract events | Contract Immutability |
| MOD-003 | Tracking and trip events | No Dispatch Authority |
| MOD-004 | Document events | No Legal Execution |
| MOD-005 | Escrow orchestration events | No Custody |
| MOD-006 | AI prediction and recommendation events | No Execution |
| MOD-007 | UI preference and dashboard events | Localization |
| MOD-008 | Mobile synchronisation events | Offline Governance |
| MOD-009 | Cross-border and regional events | No Legal Execution |
| MOD-010 | Security and compliance events | Security Enforcement |
| MOD-011 | Integration events | Integration Governance |
| MOD-012 | Analytics events | Derived Data Only |
| MOD-013 | Settlement and reconciliation events | No Custody |
| MOD-014 | Asset registry events | Asset Truth, No Dispatch |
| MOD-015 | Support and dispute events | No Decision Authority |
| MOD-016 | Notification events | Localization |
| MOD-017 | Observability events | No Intervention |
| MOD-018 | Pricing, incentive and commercial events | No Execution |

---

# 17. Module-Specific Event Constraints

## No Custody Principle

Applies to:

- MOD-005
- MOD-013

Financial events SHALL:

- represent externally confirmed financial states
- reference external financial confirmation
- never imply NexCargo custody of funds

NexCargo SHALL NOT originate custody events.

Preferred examples:

- escrowLockConfirmed
- settlementCompleted
- paymentConfirmed
- paymentFailed

---

## No Execution Principle

Applies to:

- MOD-006
- MOD-018

AI and optimization events SHALL remain advisory.

Examples:

- pricingSuggested
- routeOptimized
- matchProposed
- fraudRiskDetected
- demandForecastUpdated

These events SHALL NOT:

- execute transactions
- modify contracts
- trigger payment
- trigger dispatch
- create bookings automatically

---

## No Dispatch Authority

Applies to:

- MOD-003
- MOD-014

Asset and tracking events SHALL represent information only.

NexCargo SHALL NOT create dispatch authority events.

Invalid examples:

- vehicleDispatched
- shipmentAssigned

## No Dispatch Authority — Interpretation

(HAO decision HD-RT-5, authorization NXC-HOA-AUTH-ROLE-001, 2026-10-30.)

The prohibition above is directed at the platform and its automated processes.

It prohibits autonomous dispatch decisions or dispatch execution performed by NexCargo, including AI-driven dispatch without an authorised human action. It does not prohibit, and must not be read as prohibiting, legitimate human operational activity performed by an authorised Dispatcher acting under explicit delegation from a specific Transporter (PROMPT 0 v1.3 §USER ROLES and §ROLE PROVISIONING AND DELEGATION).

Boundaries that remain in force:

- Dispatchers operate under a specific Transporter.
- Their authority is delegated and bounded.
- Human dispatch actions must remain attributable to the authorised actor and to the Transporter context.
- AI and automated platform processes must not independently exercise dispatch authority.

This interpretation changes no event name, no event ownership and no restriction recorded in this registry. The invalid examples above remain invalid: a human Dispatcher action is not represented by a platform dispatch-authority event, and any event needed to record such an action must enter the registry through its normal governance route rather than by reusing, renaming or removing an existing entry.

---

## No Intervention Principle

Applies to:

- MOD-017

Observability events SHALL represent observed states only.

Invalid examples:

- serviceRestarted
- errorFixed

---

## No Decision Authority

Applies to:

- MOD-015

Support events SHALL represent information only.

Invalid example:

- disputeResolved

---

## Contract Immutability

Applies to:

- MOD-002

Signed contracts are immutable business records.

Invalid example:

- contractOverridden

---

## Escrow Intervention Request Events

Applies to:

- MOD-005
- MOD-013
- MOD-015
- MOD-010

escrowInterventionRequested and escrowInterventionDecided (§13) record a governed human request and the decision taken on it, under ESS-001F §15.6 to §15.10.

They SHALL represent actor attribution, trigger reference and lifecycle facts only, and SHALL remain attributable to an identified human Admin or SUPER_ADMIN acting under the authority already recorded for that role.

They SHALL NOT:

- freeze, release, refund, credit or move funds
- authorise, execute or confirm a bank or payment-provider transaction, or imply that one has been confirmed
- substitute for, or rename, an ordinary dispute lifecycle transition in MOD-015 §5.2
- grant any role an authority it does not already hold, or imply a decision by MOD-015, which remains subject to the No Decision Authority constraint above
- alter No Custody or No Execution, or make an approved request self-executing: an approved Escrow Intervention Request authorises NexCargo only to raise an instruction through the ESS-001F §15.3 pathway

Invalid examples:

- escrowFundsFrozen
- escrowInterventionExecuted
- settlementReleasedByIntervention

---

# 18. AI Advisory Event Rules

All events originating from:

- MOD-006
- MOD-018

MUST be identifiable as advisory.

AI advisory events SHALL never:

- authorize transactions
- alter contractual truth
- assign assets
- execute payments
- trigger dispatch
- override human decisions

AI recommendations remain subject to authorised business workflows.

---

# 19. Financial Event Rules

All events originating from:

- MOD-005
- MOD-013

MUST:

- represent externally confirmed financial state changes
- include external financial reference where applicable
- remain immutable
- preserve auditability

Financial events SHALL never imply:

- NexCargo ownership of funds
- NexCargo custody
- NexCargo settlement authority

---

# 20. Observability Event Rules

All events originating from:

- MOD-017

MUST:

- represent observed system states only
- never trigger autonomous remediation
- align with the No Intervention principle

Examples:

- serviceDegraded
- latencyThresholdExceeded
- errorRateSpikeDetected

---

# 21. Final Principle

The NexCargo Event Registry ensures that:

NexCargo maintains a single, deterministic, governance-controlled vocabulary for all business events.

The Event Registry enables consistent communication between modules while preserving:

- architectural integrity
- AI determinism
- business ownership boundaries
- security principles
- financial neutrality
- operational governance

The Event Registry defines what NexCargo events mean.

It does not define how NexCargo implements them.


---

DOCUMENTATION CHANGE HISTORY (role taxonomy reconciliation — NXC-HOA-AUTH-ROLE-001)

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | "No Dispatch Authority" supplemented by an Interpretation subsection distinguishing platform/AI autonomous dispatch from authorised human Dispatcher action under explicit Transporter delegation. Event names, ownership and existing restrictions unchanged. | HAO decision HD-RT-5; PROMPT 0 v1.2 §USER ROLES, §PERMISSION RULES, §ROLE PROVISIONING AND DELEGATION |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | The No Dispatch Authority interpretation now cites PROMPT 0 v1.3. The invariant is unchanged; no event name, payload or restriction was added, removed or altered. | HAO decision HD-RT-8 |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-05-001 | §13 gained a MOD-005 Owned Events subsection registering escrowInterventionRequested and escrowInterventionDecided as canonical business event names, each with its §4 metadata row (owner and producer MOD-005; consumers MOD-013, MOD-015, MOD-010; Compliance classification; High and Critical criticality; Immutable Yes) and the business references it identifies from ESS-001F §15.7, with no schema, payload, transport, storage or runtime definition. §17 gained an Escrow Intervention Request Events constraint subsection: neither event authorises, executes, confirms or reverses a bank or provider transaction, and neither alters the No Custody or No Execution principles. Existing event names, ownership rules and naming conventions are unchanged; §16 is unchanged; the four remaining ESS-001F §15.8 lifecycle transitions stay unregistered, and the new subsection states that it is not a complete MOD-005 catalogue. | HAO decision D-01 Item 5 (NXC-HOA-AUTH-D01-ITEM-05-001; NXC-HOA-AUTH-D01-ITEM-05-R1); ESS-001F §15.6 to §15.10; MOD-013 §7.1 and §7.2 |

Document version metadata is unchanged: this is a documentation-consistency reconciliation of the role taxonomy, not an architectural revision of this layer.

Version effect (2026-11-03 row above): Event Registry remains v1.0 — no version increase, no loader change, no INDEX §7.1 change. The two event names added under NXC-HOA-AUTH-D01-ITEM-05-001 are additive registrations of the events ESS-001F §15.6 to §15.10 already required; §4 metadata structure, §7 naming convention, §16 ownership summary and §14 implementation independence are unchanged. The statement immediately above remains the version record for the two 2026-10-30 role-taxonomy rows it was written for.