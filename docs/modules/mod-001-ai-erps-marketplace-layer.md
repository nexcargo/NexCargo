MOD-001 — AI ERPS Marketplace Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)





1\. MODULE IDENTITY



Module ID: MOD-001

Module Name: AI ERPS Marketplace Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the marketplace layer of NexCargo.



It is responsible for:



connecting shippers and transporters



representing freight demand (listings) and supply capacity (offers)



structuring listing, bidding, and allocation rules



defining ranking heuristics and advisory pricing suggestions



NexCargo is a neutral matchmaking platform. It does not own trucks, employ drivers, or manage fleet operations. All operational execution and the provision of tracking data are the sole responsibility of the transporter, governed by contracts formed in MOD-002.



This module defines how the AI App Builder must design the marketplace system. It does not execute matching logic at runtime.



3\. DOMAIN SCOPE



MOD-001 defines the marketplace abstraction layer, including:



3.1 Core Concepts (Design-Time Entities)



Shipment Listing – demand side entity representing a shipper’s transport request.



Transport Offer – supply side entity representing a transporter’s response to a listing.



Match Proposal – logical pairing construct between a listing and an offer.



Carrier Profile – supply actor representation (transporter identity and credentials).



Shipper Profile – demand actor representation (shipper identity and credentials).



Advisory Quote – non‑binding AI‑generated price range suggestion for a listing.



3.2 Marketplace Lifecycle (Specification Model)



The marketplace lifecycle is defined as a state model to be implemented:



Listing States:

DRAFT → PUBLISHED → EXPIRED | CANCELLED | BOOKED → COMPLETED



Offer States:

SUBMITTED ↔ WITHDRAWN | ACCEPTED | REJECTED | EXPIRED



Match Proposal States:

PROPOSED → ACCEPTED | REJECTED



3.3 Ranking Heuristics (Advisory Criteria)



When multiple offers exist for a listing, the system supports a ranking order. Ranking is advisory and does not automatically select a winner.



Ranking criteria (design‑time conceptual weights):



Route proximity / corridor alignment between the offer and the listing.



Transporter performance score (historical reliability, on‑time delivery track record).



Price attractiveness relative to the advisory quote range.



Urgency of the shipment (tightness of the requested time window).



Final selection is always explicitly confirmed by the shipper.



4\. RESPONSIBILITIES



MOD-001 is responsible for defining:



4.1 Marketplace Structure



how freight demand is represented (listing attributes).



how supply capacity is represented (offer attributes).



how matching candidates are structurally defined.



how advisory quotes are generated and presented (non‑binding).



4.2 Marketplace Rules (Design Constraints)



A listing can receive multiple offers.



Offers must be comparable by structured attributes (price, capacity, route, time window).



Matching is not deterministic – no single “best match” is assumed by default.



Matching logic is delegated to AI‑EPRS + the design rules defined in this module.



Ranking and quote generation are advisory only – they do not auto‑book or auto‑accept.



4.3 Handoff Boundaries



MOD-001 MUST hand off to:



MOD-002 → Booking \& Contract Management (transfers the selected match for contract formation).



MOD-005 → Financial execution (indirectly, via the contract created in MOD-002).



5\. DOMAIN ENTITIES (SPECIFICATION STRUCTURE)



These are schema‑level definitions for future implementation.



5.1 Shipment Listing



Represents a freight demand request from a shipper.



Required attributes (conceptual):



listingId



shipperId



origin (geo‑coordinates and address)



destination (geo‑coordinates and address)



cargoType



weight (in kg)



volume (in cubic metres, optional)



timeWindow (earliest pickup / latest delivery)



pricingModel (fixed / auction / negotiated)



status – state machine: DRAFT → PUBLISHED → EXPIRED | CANCELLED | BOOKED → COMPLETED



createdAt, publishedAt



Validation constraints:



Listing cannot be published without: origin, destination, cargoType, and at least one of weight or volume.



timeWindow must have a valid start and end.



Duplicate listings (same shipper, same route, overlapping time window) are flagged for review.



AI Assistance behaviours (design‑time):



Suggest missing fields during draft creation.



Recommend optimal cargo classification based on free‑text description.



Flag suspicious or unrealistic cargo weight/volume values.



5.2 Transport Offer



Represents a transporter’s response to a published listing.



Required attributes:



offerId



transporterId



listingId



priceProposal



availabilityWindow (the transporter’s proposed pickup/delivery timeframe)



vehicleType



declaredCapacity (weight and/or volume the transporter commits to)



status – state machine: SUBMITTED ↔ WITHDRAWN | ACCEPTED | REJECTED | EXPIRED



Validation constraints:



An offer cannot be modified after submission (only withdrawn).



A listing can have exactly one accepted offer at any time.



Expired offers (past their availabilityWindow) are automatically invalidated.



5.3 Match Proposal



A structured pairing between a listing and an offer.



Attributes:



matchId



listingId



offerId



matchScore – conceptual score generated by AI‑EPRS (e.g., 0–100).



rankingPosition – relative rank among all offers for that listing.



status – PROPOSED → ACCEPTED | REJECTED



Acceptance rule:



A match proposal is generated only for PUBLISHED listings.



The shipper explicitly accepts a proposal, which transitions the listing to BOOKED and triggers handoff to MOD-002.



5.4 Advisory Quote (Pricing Suggestion)



Represents an AI‑generated, non‑binding price recommendation for a listing.



Attributes:



quoteId



listingId



suggestedPriceMin



suggestedPriceMax



confidenceScore (0–100)



basis – reference to corridor data, historical pricing, or market trends.



Business rules:



The quote is advisory only – it does not auto‑confirm a booking.



The quote respects defined corridor pricing boundaries (if provided by external reference data).



The quote is visible to the shipper alongside the listing.



6\. MARKETPLACE RULES (DESIGN CONSTRAINTS)



6.1 Matching Principle



Matching is a multi‑candidate evaluation process.



No single “best match” is assumed by default.



Final selection is always explicitly confirmed by the shipper.



Ranking logic (route, performance, price, urgency) is advisory and explainable.



6.2 Pricing Principle



Pricing models are pluggable strategies.



The marketplace does not enforce final pricing logic.



Pricing resolution is delegated to AI‑EPRS + MOD‑018 (future optimisation layer).



Advisory quotes are non‑binding aids.



6.3 Neutrality Principle



The marketplace MUST remain:



neutral between shippers and transporters.



non‑biased in offer visibility (all valid offers are shown).



transparent in offer evaluation criteria (ranking logic is documented).



6.4 State Isolation Rule



MOD-001 does not persist financial state.



MOD-001 does not handle escrow.



MOD-001 does not trigger payments.

All financial flow is handled by MOD-005 + ESS-001F.



7\. EVENT MODEL (SPECIFICATION ONLY)



These are declared system events (not runtime execution rules):



ListingCreated



ListingPublished



ListingExpired / ListingCancelled / ListingBooked



OfferSubmitted



OfferWithdrawn



OfferAccepted / OfferRejected / OfferExpired



MatchProposed



MatchAccepted / MatchRejected



QuoteGenerated



Events are consumed by:



MOD-002 (Booking \& Contract Management)



MOD-003 (Tracking – indirectly via MOD‑002)



MOD-005 (Financial layer)



MOD-012 (Analytics)



8\. INTEGRATION BOUNDARIES



MOD-001 interacts conceptually with:



MOD-002 → transfers the accepted match for contract formation.



MOD-003 → tracking initiation is triggered via the contract (MOD-002), not directly by MOD-001.



MOD-005 → financial escrow is triggered via the contract (MOD-002).



MOD-011 → API exposure layer (listings, offers, matching endpoints).



MOD-001 does not directly integrate with external systems. All external integrations are handled via ESS-001 + MOD-011.



9\. ESS DEPENDENCY REFERENCES (CANONICAL ONLY)



MOD-001 is constrained by:



ESS-003 → AI behaviour constraints (non‑deterministic matching, advisory ranking).



ESS-004 → integration contract rules (listing and offer API structures).



ESS-006 → security and compliance (access control, data privacy).



ESS-007 → coding standards.



ESS-008 → UI/UX constraints.



ESS-009 → data governance (listing retention, audit logs).



And indirectly by:



ESS-001F → financial boundary rules (via MOD-005 handoff only).



10\. ARCHITECTURE BOUNDARY RULE



MOD-001 MUST NOT:



execute matching algorithms in isolation (matching is advisory and requires explicit confirmation).



implement financial logic.



define system‑wide workflow orchestration.



override MOD-002 or MOD-005 responsibilities.



assume real‑time system execution behaviour.



auto‑confirm any booking or financial transaction.



query real‑time fleet availability, vehicle maintenance, or driver assignments (these are external to the marketplace).



MOD-001 IS:



a structural definition of marketplace domain logic for AI‑generated system design.



a container for advisory behaviours (ranking, quoting) that never cross into enforcement.



11\. OUTPUT EXPECTATION FOR AI BUILDER



When this module is used by the AI App Builder, outputs MUST:



generate marketplace schema structures (listings, offers, matches, quotes).



define API contracts for listings, offers, matching, and quoting.



enforce separation of concerns with MOD-002 (contract formation).



remain compatible with ESS constraints.



avoid runtime assumptions.



include edge‑case handling (duplicate listings, concurrent offers, expired offers).



specify that ranking and quoting are advisory and require explicit shipper confirmation.



If unclear:



Output: TODO: requires specification from MOD-001



12\. DESIGN PRINCIPLE



MOD-001 ensures:



a neutral, structured marketplace abstraction that can be transformed into implementation without ambiguity or hidden logic.



that the marketplace remains focused on commercial matching – it defines demand, supply, and advisory pairing, while explicitly delegating operational execution (fleet, tracking) to the transporter and contract layer (MOD-002).

