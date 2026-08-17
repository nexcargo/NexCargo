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





6\. Matching Engine



6.1 Purpose



The matching engine is a \*\*user-initiated, advisory-only\*\* system that identifies and ranks compatible transporters for a given shipment listing. It provides recommendations but \*\*never executes\*\* the final selection.



The engine operates within the \*\*SADC logistics context\*\*, respecting Mozambique's nationwide licensing framework and the region's cross-border permit flexibility.



6.2 Matching Engine Objectives



| Objective | Description |

|-----------|-------------|

| \*\*Return all compatible transporters\*\* | Every transporter passing hard filters is returned, sorted by score |

| \*\*Highlight Top 5\*\* | The highest-scoring 5 transporters are marked as "Recommended" |

| \*\*Never auto-select\*\* | The final choice always belongs to the shipper |

| \*\*User override always allowed\*\* | Users may select any transporter regardless of rank |

| \*\*Price-balanced ranking\*\* | Price is one factor among many — not the dominant one |



6\.3 Trigger Model



Matching is \*\*user-initiated\*\*:



| Flow | Description |

|------|-------------|

| \*\*Shipper-initiated (Primary)\*\* | Shipper publishes a listing → clicks "Find Transporters" → engine returns ranked matches |

| \*\*Transporter-initiated (Secondary)\*\* | Transporter searches loads → system highlights best-fit loads based on transporter's profile and route |



\*\*Caching \& Invalidation:\*\*

\- Results are cached for the listing's active duration.

\- Results are invalidated if the listing changes (route, price, cargo, pickup date, etc.).

\- Transporters may request a re-match if their availability changes.



6.4 Compatibility Factors



6\.4.1 Mandatory (Hard Filters — Block)



If any of these fail, the transporter is \*\*never considered\*\*:



| Hard Filter | Rationale |

|-------------|-----------|

| Vehicle type matches cargo type | A flatbed cannot carry refrigerated cargo |

| Vehicle capacity ≥ shipment weight | Cannot exceed physical weight limits |

| Vehicle volume ≥ shipment volume | Cannot exceed physical volume limits |

| Pickup date falls within transporter availability | Transporter must be available on that date |

| Delivery deadline is achievable | Transporter must be able to meet the deadline |

| Account is active (not suspended) | Platform-level ban |

| Licences are valid and unexpired | Legal operation required |

| For cross-border: required documentation is valid | Includes COMESA Yellow Card or equivalent insurance, and any temporary permits required for the journey (obtainable at the border if not already held) |



\*\*Important Notes on Licensing:\*\*

\- In Mozambique, a transport licence is \*\*valid nationwide\*\*. There are no regional restrictions within the country.

\- For cross-border SADC trips, temporary permits can be obtained at the border for specific shipments.

\- "Operating region" is \*\*not\*\* a hard filter.



6\.4.2 Important (Scoring Factors)



These influence the match score:



| Factor | Weight | Rationale |

|--------|--------|-----------|

| Corridor match (Maputo, Beira, Nacala) | High | Transporters with corridor experience are more efficient |

| Route alignment | High | Origin and destination alignment reduces deadheading |

| Route overlap percentage | High | Higher overlap = lower empty mileage |

| Origin distance | Medium-High | Closer transporters reduce cost and time |

| Transporter availability (capacity) | Medium-High | Spare capacity is valuable |

| Cross-border experience | Medium | Experience with customs and border procedures |

| Hazardous cargo capability | Medium | Special permits and equipment required |

| Refrigeration capability | Medium | Required for cold chain cargo |

| Verified documents | Medium | Trust signal for both parties |

| Transporter rating | Medium | Quality signal |

| Completed trips | Medium | Experience signal |

| Cancellation rate (lower = better) | Medium | Reliability signal |

| Acceptance rate (higher = better) | Medium | Reliability signal |

| Response time (faster = better) | Medium | Responsiveness signal |

| Price competitiveness | Medium | Commercial factor — balanced, not dominant |

| Relationship score (existing partners) | Low-Medium | Relationship-based market requires this |



6\.4.3 Optional (Bonus Factors)



These provide small score boosts:



| Factor | Rationale |

|--------|-----------|

| Insurance coverage | Nice-to-have |

| GPS availability | Enables real-time tracking |

| Language compatibility | Portuguese for domestic, English for regional |

| Preferred partner status | Existing relationship |

| AI confidence score | Internal only — never exposed |



6\.5. Ranking Algorithm



\### Step 1: Hard Filter Pass

Apply all Mandatory filters. Transporters failing any are \*\*excluded entirely\*\*.



Step 2: Priority Tiers

Within the remaining set, apply tiered ranking:



| Tier | Factor | Weight |

|------|--------|--------|

| 1 | Corridor match | \*\*High\*\* |

| 2 | Route compatibility (origin/destination alignment) | \*\*High\*\* |

| 3 | Capacity \& cargo fit (weight/volume margin) | Medium-High |

| 4 | Reliability score (rating × completed trips × acceptance rate / cancellation rate) | Medium |

| 5 | Price competitiveness | Medium |

| 6 | Relationship score (preferred partners, past trips, existing contracts) | Low-Medium |



Step 3: Weighted Score Calculation

Each transporter receives a composite score (0–100) based on the weighted factors above.



Step 4: Highlight Top 5

The Top 5 scoring transporters are highlighted as \*\*"Recommended"\*\* in the UI.



Step 5: User Override

Users may:

\- Sort by price, rating, or ETA.

\- Select any transporter regardless of rank.

\- Select unranked transporters.

\- Ignore all AI recommendations.



6\.6. AI Role



| AI May | AI May Not |

|--------|------------|

| Suggest weight adjustments based on market conditions | Auto-select a transporter |

| Highlight "Recommended" transporters in the UI | Override user choice |

| Flag anomalies (e.g., sudden rating drops) | Modify rankings without human visibility |

| Generate confidence scores (internal only) | Execute any action autonomously |

| Learn from historical match-to-contract conversion data | |



\*\*AI Governance:\*\* All AI behavior is governed by \*\*ESS-003\*\* and \*\*MOD-006\*\*.



6\.7. Price Handling



| Approach | Status |

|----------|--------|

| Cheapest first | ❌ Rejected — race to the bottom |

| Price only | ❌ Rejected — ignores quality and reliability |

| Quality first | ⚠️ Partial — suitable for high-value cargo only |

| \*\*Balanced score\*\* | ✅ \*\*Default\*\* — price + quality + reliability combined |

| User-configurable sorting | ✅ \*\*Supported\*\* — users may sort by price, rating, or ETA |



\*\*Default:\*\* Balanced score. Never default to cheapest-first.



6\.8. No Match Handling



If no transporter passes hard filters:



| Step | Action |

|------|--------|

| 1 | Return empty list with a clear explanation (e.g., "No transporters meet your requirements") |

| 2 | Suggest relaxation of optional criteria (e.g., expand radius, allow similar vehicle types) |

| 3 | Optionally expand search radius beyond the immediate corridor |

| 4 | Notify eligible transporters in the broader region |

| 5 | For cross-border shipments: notify transporters who can obtain temporary permits at the border |

| 6 | Escalate to manual search for urgent/high-value shipments |



\*\*Relaxation order (least impactful to most impactful):\*\*

1\. Expand radius (50km → 100km → 200km)

2\. Relax vehicle type (allow "similar" types)

3\. Relax rating requirements

4\. Expand to adjacent corridors

5\. Include transporters without immediate availability (future availability window)



6\.9. Match Success Definition



| Milestone | Considered Success? |

|-----------|---------------------|

| Recommendation generated | ❌ No — just a suggestion |

| Transporter invited | ❌ No — invitation ≠ commitment |

| Transporter accepted | ❌ No — acceptance is provisional |

| \*\*Contract signed (MOD-002)\*\* | ✅ \*\*Yes\*\* — formal agreement binding both parties |

| \*\*Escrow initiated (MOD-005)\*\* | ✅ \*\*Yes\*\* — financial commitment |



\*\*Tracking:\*\*

\- Match is recorded when the shipper selects a transporter.

\- Match-to-contract conversion rate is tracked as a key performance metric.

\- Conversion rate informs AI learning and ranking adjustments.



6\.10. Event Model



The matching engine emits the following events:



| Event | Trigger |

|-------|---------|

| `MatchRequested` | User initiated matching |

| `MatchResultsGenerated` | Ranking complete |

| `MatchSelected` | Shipper selected a transporter |

| `MatchExpired` | Listing expired without selection |

| `NoMatchFound` | No compatible transporters |



\*\*Consumed by:\*\*

\- MOD-002 (Booking \& Contract Management) — for contract initiation

\- MOD-006 (AI Intelligence Platform) — for learning and improvement

\- MOD-012 (Data Platform Analytics) — for performance tracking

\- MOD-016 (Notifications) — for alerts



6\.11. Performance Metrics



| Metric | Description |

|--------|-------------|

| Match-to-contract conversion rate | % of matches that become contracts |

| Average time to select | Time between match generation and selection |

| User satisfaction | User feedback on recommendations |

| No-match rate | % of listings with no compatible transporters |

| AI recommendation acceptance rate | % of users selecting a "Recommended" transporter |



6\.12. Related Documents



| Document | Relationship |

|----------|--------------|

| MOD-002 | Contract initiation after match selection |

| MOD-003 | Tracking data for route/ETA validation |

| MOD-006 | AI learning and recommendation improvements |

| MOD-009 | Cross-border permit flexibility and corridor definitions |

| MOD-012 | Analytics and performance tracking |

| MOD-014 | Fleet and licence management |

| MOD-016 | Notifications for match alerts |

| ESS-003 | AI governance (advisory-only) |

| INT-004 | Mapping \& Geospatial Services |

| INT-007 | Government \& Regulatory Integration |



7\. MARKETPLACE RULES (DESIGN CONSTRAINTS)



7.1 Matching Principle



Matching is a multi‑candidate evaluation process.



No single “best match” is assumed by default.



Final selection is always explicitly confirmed by the shipper.



Ranking logic (route, performance, price, urgency) is advisory and explainable.



7.2 Pricing Principle



Pricing models are pluggable strategies.



The marketplace does not enforce final pricing logic.



Pricing resolution is delegated to AI‑EPRS + MOD‑018 (future optimisation layer).



Advisory quotes are non‑binding aids.



7.3 Neutrality Principle



The marketplace MUST remain:



neutral between shippers and transporters.



non‑biased in offer visibility (all valid offers are shown).



transparent in offer evaluation criteria (ranking logic is documented).



7.4 State Isolation Rule



MOD-001 does not persist financial state.



MOD-001 does not handle escrow.



MOD-001 does not trigger payments.

All financial flow is handled by MOD-005 + ESS-001F.



8\. EVENT MODEL (SPECIFICATION ONLY)



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



9\. INTEGRATION BOUNDARIES



MOD-001 interacts conceptually with:



MOD-002 → transfers the accepted match for contract formation.



MOD-003 → tracking initiation is triggered via the contract (MOD-002), not directly by MOD-001.



MOD-005 → financial escrow is triggered via the contract (MOD-002).



MOD-011 → API exposure layer (listings, offers, matching endpoints).



MOD-001 does not directly integrate with external systems. All external integrations are handled via ESS-001 + MOD-011.



10\. ESS DEPENDENCY REFERENCES (CANONICAL ONLY)



MOD-001 is constrained by:



ESS-003 → AI behaviour constraints (non‑deterministic matching, advisory ranking).



ESS-004 → integration contract rules (listing and offer API structures).



ESS-006 → security and compliance (access control, data privacy).



ESS-007 → coding standards.



ESS-008 → UI/UX constraints.



ESS-009 → data governance (listing retention, audit logs).



And indirectly by:



ESS-001F → financial boundary rules (via MOD-005 handoff only).



11\. ARCHITECTURE BOUNDARY RULE



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



12\. OUTPUT EXPECTATION FOR AI BUILDER



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



13\. DESIGN PRINCIPLE



MOD-001 ensures:



a neutral, structured marketplace abstraction that can be transformed into implementation without ambiguity or hidden logic.



that the marketplace remains focused on commercial matching – it defines demand, supply, and advisory pairing, while explicitly delegating operational execution (fleet, tracking) to the transporter and contract layer (MOD-002).

