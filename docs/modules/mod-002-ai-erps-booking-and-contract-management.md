MOD-002 — AI ERPS Booking \& Contract Management Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY



Module ID: MOD-002

Module Name: AI ERPS Booking \& Contract Management Module

Version: v1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the booking and contract lifecycle layer of NexCargo.



It is responsible for transforming:



marketplace match outcomes (MOD‑001)



into:



structured, enforceable logistics contracts between Shipper and Transporter, including the commercial obligation to provide tracking data (executed by MOD‑003).



Critical Constraint: NexCargo is a neutral matchmaking platform. It does not own trucks, employ drivers, or manage fleet operations. All operational execution (capacity, timing, vehicle condition, and provision of GPS tracking data) is the sole responsibility of the Transporter.



This module defines:



how bookings and contracts must be structured, validated, and transitioned



how commercial negotiations are structured and versioned



how recurring enterprise agreements generate child shipments



how offer-listing data alignment (weight, route, cargo) is verified before confirmation



the contractual handshake that enables MOD‑003 tracking (tracking obligation is embedded in the contract)



3\. DOMAIN SCOPE



MOD‑002 governs:



3.1 Booking Formation

conversion of match proposals into bookings



validation of data alignment between listing and selected offer



confirmation of transport allocation (commercial commitment)



3.2 Contract Structuring



formalisation of agreed terms



negotiation history (offers / counter‑offers)



contract versioning rules



contract lifecycle states



embedding of tracking \& visibility obligations (data sharing requirements)



3.3 Agreement Lifecycle Control



negotiation phase structure (offer ↔ counter‑offer)



acceptance/rejection flows



amendment handling rules



listening to MOD‑003 DeliveryConfirmed event to finalise the contract



3.4 Recurring Contract Formation



definition of fixed‑route, fixed‑cargo, recurring transport agreements



automatic generation of child listings per schedule



parent‑child contract audit linkage



3.5 Offer-Listing Alignment Verification



verification that the transporter’s offered weight/volume, vehicle type, and route match the listing’s requirements



No real‑time fleet tracking – the transporter's declaration of availability is taken as a binding commercial commitment



4\. CORE DOMAIN ENTITIES



Updated to explicitly reference the tracking data obligation.



4.1 Booking



Represents a confirmed commercial commitment between Shipper and Transporter.



Required attributes:



bookingId



listingId



selectedOfferId



shipperId



transporterId



bookingStatus – state machine:

REQUESTED → ALIGNMENT\_CHECKED → CONFIRMED | FAILED | CANCELLED



confirmationTimestamp



origin



destination



cargoSummary



alignedOfferSnapshot – full copy of the accepted offer terms at booking time



Validation Rules:



A shipment may have only one confirmed booking



Transporter account must be active and verified (per MOD‑010)



The selected offer’s declared capacity (weight/volume) must be ≥ the listing’s requirements



The offer’s vehicle type must be compatible with the cargo type (as defined in MOD‑001)



Edge Cases:



Transporter becomes suspended during booking – booking fails



Shipment is cancelled concurrently – request invalidated



Duplicate requests – only first valid request succeeds



Escrow initialisation fails – booking remains in REQUESTED



Acceptance Criteria:



Double booking is prevented



Every booking creates an immutable audit record



Booking automatically triggers contract generation and handoff to MOD‑003 readiness



4.2 Contract (enhanced with tracking obligation)

Represents the formal commercial agreement binding the Shipper and Transporter.



Required attributes:



contractId



bookingId



termsSnapshot (full terms at signing)



pricingAgreement



serviceLevelDefinition (SLA – pickup/delivery windows)



cancellationRules



liabilityRules



trackingDataObligation – (new) defines the expected tracking data format, frequency (e.g., GPS pings every 5 minutes), and the integration channel (e.g., transporter’s telematics API or driver app). This is the contractual basis for MOD‑003 execution.



contractStatus – state machine:

DRAFT → PENDING\_APPROVAL → ACTIVE → AMENDED | SUSPENDED | TERMINATED → COMPLETED



version



digitalSignatureStatus – PENDING | PARTIAL | EXECUTED



negotiationThreadId



Business Rules:



Contracts are immutable once signed



All changes generate a new version



Both parties must sign before the contract becomes ACTIVE



The contract cannot reach COMPLETED until MOD‑003 emits a DeliveryConfirmed event for the associated booking



Edge Cases:



Signature timeout / rejection – handled via versioned draft



Revision requested – new version drafted



Tracking data not received as per obligation – flagged as a performance exception (handled by MOD‑003 and MOD‑006 dispute)



Acceptance Criteria:



Signed contracts are immutable



Every revision is versioned with full diff history



The tracking obligation is clearly defined and auditable



Contract completion is explicitly tied to delivery confirmation from MOD‑003



4.3 Contract Amendment



amendmentId, contractId, changeType, changePayload, approvalStatus, versionLink



4.4 Booking Request



requestId, matchId, proposedTerms, validationStatus (PENDING | ALIGNMENT\_OK | ACCOUNT\_ACTIVE | READY | REJECTED)



4.5 Negotiation Thread



negotiationId, listingId, shipperId, transporterId, status, offers (versioned list), expiryTimestamp



Negotiable items: price, windows, special handling, waiting time, additional services.



4.6 Recurring Contract



Parent contract generates child listings per schedule.



Each child is independent but auditable back to the parent.



Tracking obligation is inherited from the parent.



4.7 API Contract Specifications (Conceptual Endpoints)



Action	Endpoint

Request booking			POST /bookings

Confirm booking			POST /bookings/{id}/confirm

Generate contract draft		POST /contracts

Sign contract			POST /contracts/{id}/sign

Amend contract			POST /contracts/{id}/amend

Open/accept negotiation		POST /negotiations, POST /negotiations/{id}/offer

Manage recurring		POST /recurring-contracts, POST /recurring-contracts/{id}/generate



5\. LIFECYCLE MODEL (DESIGN‑TIME STATE MACHINE)



5.1 Booking \& Contract Lifecycle (enhanced with MOD‑003 feedback)



MatchAccepted (from MOD‑001)

&#x20;      ↓

BookingRequested

&#x20;      ↓

Alignment Checked (data parity)

&#x20;      ↓

\[Optional: Negotiation]

&#x20;      ↓

BookingConfirmed

&#x20;      ↓

ContractGenerated

&#x20;      ↓

ContractSigned → ContractStatus = ACTIVE

&#x20;      ↓

Handoff to MOD‑003 (Tracking \& Execution) ← \*\*Tracking obligation is activated\*\*

&#x20;      ↓

\[Operational execution by Transporter, GPS data flows via MOD‑003]

&#x20;      ↓

MOD‑003 emits DeliveryConfirmed event

&#x20;      ↓

MOD‑002 receives event → ContractStatus = COMPLETED

&#x20;      ↓

Handoff to MOD‑005 (Final financial settlement)



5.2 Contract Lifecycle States



Draft → PendingApproval → Active → Amended → Suspended / Terminated → Completed

(Transition to Completed is triggered by MOD‑003's DeliveryConfirmed.)



6\. RESPONSIBILITIES



MOD‑002 is responsible for:



6.1 Structural Booking Validation



ensuring match → booking transition is valid



enforcing required fields before contract creation



verifying that the selected offer’s declared capacity/vehicle type matches the listing (data parity)



6.2 Contract Integrity



maintaining contract immutability after signing



enforcing versioning rules for amendments



preserving full negotiation history



defining the tracking data obligation as a contractual clause



6.3 Agreement Consistency



ensuring booking aligns with contract terms



validating consistency across lifecycle states



listening for MOD‑003 DeliveryConfirmed to finalise the contract



ensuring child shipments inherit the parent’s tracking obligation



6.4 Commercial Neutrality



MOD‑002 does not execute tracking logic or ingest GPS data – that belongs to MOD‑003.



MOD‑002 only defines the commercial requirement for tracking data provision.



7\. RULES OF OPERATION



7.4 Alignment Rule



Offer declared weight/volume must meet listing requirements. Vehicle type must match cargo type.



No external fleet queries – transporter declaration is binding.



7.7 Neutrality Rule

MOD‑002 does NOT:



decide pricing strategy, evaluate transport quality, optimise routes, or execute payments



track real‑time GPS, ingest telematics, or validate pickup/delivery physical events – these are the sole domain of MOD‑003.



override MOD‑003 execution data – it only reacts to the final DeliveryConfirmed event.



8\. EVENT MODEL



Declared system events:



BookingRequested, AlignmentChecked, BookingConfirmed



ContractDrafted, ContractSigned, ContractAmended, ContractTerminated



NegotiationStarted, OfferCountered, OfferAccepted, NegotiationExpired



RecurringContractActivated, ChildShipmentGenerated, RecurringContractSuspended



Consumed from MOD‑003:



DeliveryConfirmed – triggers ContractStatus → COMPLETED



ExceptionReported (e.g., no GPS signal, major delay) – may trigger contract suspension/dispute flow (handled jointly with MOD‑006)



Emitted to MOD‑003:



ContractSigned (activates the tracking obligation for that shipment)



9\. INTEGRATION BOUNDARIES



MOD‑002 interacts conceptually with:



MOD‑001 → receives match proposals



MOD‑003 → triggers tracking initiation upon contract signing; receives DeliveryConfirmed to close the contract



MOD‑005 → final financial settlement trigger after DeliveryConfirmed



MOD‑010 → transporter account status (read‑only)



MOD‑011 → API exposure layer



MOD‑002 does not directly ingest GPS pings, map data, or driver updates – those go to MOD‑003.



10\. ESS DEPENDENCY REFERENCES



Constrained by ESS‑003, ESS‑004, ESS‑006, ESS‑007, ESS‑008, ESS‑009, and indirect ESS‑001F.



11\. ARCHITECTURE BOUNDARY RULE



MOD‑002 MUST NOT:



execute logistics tracking logic



implement financial execution logic



perform shipment optimisation



override MOD‑001 matching decisions



bypass contract state validation



query/ingest real‑time GPS or telematics data



MOD‑002 IS:



the commercial and contractual backbone that enables MOD‑003 tracking by embedding the obligation in the signed contract, and reacts to the final operational outcome (DeliveryConfirmed) to close the lifecycle.



12\. OUTPUT EXPECTATION FOR AI BUILDER



When generating system implementation from MOD‑002, the AI App Builder MUST:



produce booking and contract schemas with all states and transitions



enforce state machine transitions



ensure linkage to MOD‑001 matches



implement the contract handshake with MOD‑003 (i.e., upon ContractSigned, notify MOD‑003 that tracking should begin for that bookingId)



implement the listener for MOD‑003's DeliveryConfirmed event to transition the contract to COMPLETED



enforce ESS‑004 contract structures



include the trackingDataObligation clause in the contract entity (conceptual format)



implement data‑parity validation (offer weight/volume/vehicle vs listing)



generate negotiation versioning logic and recurring contract scheduling



include edge‑case handling (duplicate booking, signature timeout, account suspension, missing delivery confirmation timeout)



provide conceptual API endpoints per Section 4.7



If incomplete:



Output: TODO: requires specification from MOD‑002



13\. DESIGN PRINCIPLE



MOD‑002 ensures:



every marketplace match becomes a structured, auditable, and version‑controlled commercial agreement



tracking is not an afterthought – it is a contractual obligation embedded in the agreement



commercial feasibility (data parity) is verified, while operational feasibility and GPS visibility are explicitly delegated to the Transporter (via MOD‑003)



the platform remains a neutral, lightweight orchestrator, bridging commercial intent (MOD‑002) with operational reality (MOD‑003)

