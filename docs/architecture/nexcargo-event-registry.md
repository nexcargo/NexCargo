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
| bookingConfirmed | MOD-002 | MOD-002 | MOD-003, MOD-005 | Business | Critical | Yes | A booking has been confirmed. |

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
- offerSubmitted
- offerWithdrawn
- matchProposed

Constraint:

`matchProposed` is advisory only.

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
| MOD-001 | Listing, offer, matching events | No Auto-Booking |
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
- escrowReleaseConfirmed
- settlementCompleted
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