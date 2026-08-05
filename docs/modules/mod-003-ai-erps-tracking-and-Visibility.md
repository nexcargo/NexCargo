MOD-003 — AI ERPS Tracking \& Visibility Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY



Module ID: MOD-003

Module Name: AI ERPS Tracking \& Visibility Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the shipment tracking and visibility layer of NexCargo.



It is responsible for specifying how:



logistics execution states are represented, updated, and exposed as structured visibility data



GPS telemetry is optimised for mobile data consumption and battery life



offline tracking data is synchronised upon reconnection



predictive milestone ETAs are generated and presented



Proof of Delivery (POD) is captured and stored



driver identity is verified before cargo handover (Strategic Enhancement)



This module defines the data structures, state models, event interpretations, and visibility controls required to build the tracking system.



It does not execute physical tracking logic or ingest real‑time GPS data directly.



3\. DOMAIN SCOPE



MOD-003 governs:



3.1 Shipment Lifecycle Visibility Model



how shipment states are represented and transitioned



how progress is structured through milestones



how state changes are recorded as immutable events



3.2 Tracking Data Model



shipment position abstractions (not GPS implementation logic)



status transitions and their triggers



event‑to‑state mapping rules



offline data capture and synchronisation patterns



3.3 Visibility Layer Definition



how users observe shipment progress (role‑based views)



how updates are structured and refreshed



how history is stored and exposed for auditing



3.4 Driver Identity Verification



verification methods (QR Code, OTP, Secure PIN, optional biometrics)



risk‑based verification policy configuration



verification event audit trail



3.5 Proof of Delivery (POD)



required evidence (digital signature, delivery photographs, GPS coordinates, timestamp)



offline POD capture and deferred upload



mandatory POD before shipment completion



4\. CORE DOMAIN ENTITIES



These are design‑time structures only.



4.1 Shipment Tracking Record



Represents the visibility object for a shipment.



Required attributes:





trackingId



bookingId



contractId



trackingActivatedAt



currentStatus – reference to the state machine state



lastKnownState – full state snapshot



visibilityLevel – public / restricted / internal



lastUpdatedTimestamp



completedAt



Linking rule:



A tracking record is initialised only after a contract is signed in MOD‑002 (i.e., ContractSigned event received).



The tracking record is immutable except for status updates (which are event‑driven).



4.2 Shipment Status State



Represents the lifecycle state of a shipment.



Defined states:



Created – initial state after booking confirmation (tracking initialised but not yet active)



Booked – shipment is booked, awaiting pickup



AwaitingPickup – transporter is en route to pickup location



PickupAcknowledged – cargo has been collected (driver verified)



InTransit – shipment is en route



AtBorder – shipment has reached a border crossing (optional milestone)



Delayed – exception state triggered by AI anomaly detection or manual override



Delivered – cargo has reached destination



Completed – POD submitted and verified



Cancelled – shipment cancelled before completion



State transition constraints:



A shipment MUST have exactly one current state.



State transitions MUST originate from a recorded event.



Historical states MUST be preserved as immutable events.



4.3 Tracking Event



Represents a structured change in shipment state or a significant operational occurrence.



Attributes:



eventId



trackingId



eventType – e.g., TrackingInitialized, PickupConfirmed, InTransit, BorderCrossing, Delayed, DeliveryConfirmed, PODSubmitted, DriverVerified



eventTimestamp



eventSourceModule – DRIVER\_APP / TELEMATICS / MANUAL / SYSTEM



stateTransition – from → to (where applicable)



metadataPayload – structured JSON (GPS coordinates, timestamps, verification details, POD references)



Integrity rules:



Tracking events are immutable once recorded.



Events are append‑only – no updates or deletions are permitted.



All state changes MUST be derived from an event.



4.4 Visibility Snapshot



Represents a point‑in‑time view of shipment status.



Attributes:



snapshotId



trackingId



status



locationDescriptor – abstracted location (e.g., "Lusaka", "Border Post", "En route")



gpsCoordinates – optional, if available



timestamp



derivedFromEventId



estimatedArrival – AI‑generated ETA (advisory)



Visibility rules:



Snapshots are generated after each state transition or significant GPS update.



Snapshots are stored for historical audit.



Snapshots are filtered by visibilityLevel and user role (shipper, transporter, admin).



4.5 GPS Location Update



Represents a periodic location update from the driver's mobile device or telematics source.



Attributes:







Required attributes (enhanced):

\- latitude

\- longitude

\- timestamp

\- speed (km/h, optional)

\- heading (degrees, optional)

\- accuracy (metres, optional)

\- source (GPS / NETWORK / OFFLINE\_SYNC)

\- isOffline (boolean)



updateId



trackingId



latitude



longitude



timestamp



speed (km/h, optional)



heading (degrees, optional)



accuracy (metres, optional)



source – GPS / NETWORK / OFFLINE\_SYNC



isOffline – boolean indicating whether the update was captured offline



batteryLevel (optional, for battery monitoring)



networkType (optional, for diagnostics)





Optimisation rules:



GPS reporting interval must adapt to movement (15 min moving, 60 min stationary)



GPS tracking starts only after trip activation (i.e., AwaitingPickup or PickupAcknowledged



Tracking ends automatically upon Completed or Cancelled



Offline coordinates are stored locally and synced when connectivity returns



Battery optimization: background processing minimized



Network awareness: data compression based on network quality



Validation rules:



GPS permission must be granted on the device.



Device clock must be synchronised.



Coordinates must include a valid timestamp.



Invalid coordinates (e.g., out of range) are rejected.



4.6 Proof of Delivery (POD)



Represents legally admissible evidence confirming successful cargo delivery.



Attributes:



podId



trackingId



bookingId



recipientName



recipientSignature – digital signature image or hash



deliveryPhotographs – array of image references



gpsCoordinates



timestamp



submissionMethod – ONLINE / OFFLINE



verificationStatus – PENDING / VERIFIED / REJECTED



adminOverride – optional authorisation for manual completion



Business rules:



POD is required before shipment can transition to Completed.



POD may be captured offline and uploaded automatically when connectivity returns.



Shipment cannot be completed without valid POD unless an administrator authorises an exception.



POD records are immutable once submitted.



4.7 Driver Identity Verification Event



Represents the verification of the driver's identity before cargo handover.



Attributes:



verificationId



trackingId



bookingId



assignedDriverId – reference to the transporter's nominated driver



verificationMethod – QR\_CODE | OTP | SECURE\_PIN | BIOMETRIC | DRIVER\_LICENSE



verificationStatus – PENDING | SUCCESS | FAILED



attemptCount



failureReason – optional



timestamp



riskScore – AI‑assigned risk level for this shipment (determines required verification factors)



Business rules:



Verification occurs before cargo handover at pickup.



Verification methods are configurable according to shipment risk level.



High‑risk shipments may require multiple verification factors.



Failed verification attempts are logged and may generate security alerts.



Verification events become part of the permanent shipment audit trail.



4.8 Border Crossing Event



Represents a shipment's arrival at or passage through a border post.



Attributes:



borderEventId



trackingId



borderPostId



entryTimestamp



exitTimestamp – optional (when departure is detected)



geofenceRadius – configurable (default 5 km)



notificationSent – boolean



Business rules:



Border detection is triggered by geofencing.



Border detection immediately forces a GPS location update (overriding the standard interval).



Duplicate border events for the same crossing are prevented.



Border crossing becomes a shipment milestone visible on the dashboard.



5\. LIFECYCLE MODEL (STATE VISIBILITY FLOW)



The tracking lifecycle is defined as a state evolution model:



BookingConfirmed (received from MOD-002)

&#x20;      ↓

TrackingInitialized (record created)

&#x20;      ↓

AwaitingPickup (driver en route)

&#x20;      ↓

\[ Driver Identity Verification ]

&#x20;      ↓

PickupAcknowledged (cargo collected)

&#x20;      ↓

InTransit (shipment en route)

&#x20;      ↓

\[ BorderCrossing (optional, repeated) ]

&#x20;      ↓

\[ Delayed (exception state) ]

&#x20;      ↓

Delivered (cargo at destination)

&#x20;      ↓

PODSubmitted (required)

&#x20;      ↓

Completed (final state)

State transition triggers:



TrackingInitialized → triggered by ContractSigned event from MOD‑002.



AwaitingPickup → triggered by driver app trip activation.



PickupAcknowledged → triggered by successful driver identity verification and cargo collection confirmation.



InTransit → triggered by first GPS update after pickup.



BorderCrossing → triggered by geofence entry.



Delivered → triggered by driver arrival at destination (GPS + manual confirmation).



PODSubmitted → triggered by POD upload.



Completed → triggered by POD verification.



Exception handling:



Delayed may be triggered by AI anomaly detection (e.g., prolonged stationary, route deviation, missed ETA) or manual override.



Cancelled may be triggered by MOD‑002 if the contract is terminated before delivery.



6\. RESPONSIBILITIES



MOD-003 is responsible for:



6.1 State Representation



defining shipment status taxonomy and lifecycle progression.



ensuring status transitions are valid and traceable.



6.2 Visibility Modeling



defining what users can see at each stage.



structuring tracking snapshots for role‑based consumption.



ensuring visibility rules respect data governance and privacy (ESS‑009).



6.3 Event Interpretation Layer



mapping external and internal events into structured states.



ensuring consistency of state transitions.



maintaining immutability of event history.



6.4 Tracking Data Ingestion Rules



defining GPS update frequency and optimisation rules.



specifying offline data capture and synchronisation behaviour.



defining geofencing triggers for border crossings.



6.5 Driver Identity Verification Framework



defining verification methods and risk‑based policies.



ensuring verification events are auditable and immutable.



6.6 Proof of Delivery Framework



defining required evidence and validation rules.



supporting offline POD capture and deferred upload.



enforcing mandatory POD before shipment completion.



7\. RULES OF OPERATION (DESIGN CONSTRAINTS)



7.1 State Consistency Rule



A shipment MUST have exactly one current state.



Historical states MUST be preserved as immutable events.



State transitions MUST follow the defined lifecycle model.



7.2 Event Integrity Rule



Tracking state changes MUST originate from events.



Events MUST be immutable once recorded.



Events are append‑only – no updates or deletions.



7.3 Visibility Rule



Visibility MUST be role‑dependent (shipper, transporter, driver, admin).



Visibility levels MUST NOT expose sensitive operational metadata (e.g., other customer's data).



Visibility MUST respect ESS‑006 security and ESS‑008 UI/UX constraints.



7.4 GPS Optimisation Rule



Default tracking interval: 15 minutes while in motion.



Stationary vehicles: 60 minutes reporting interval.



Offline coordinates MUST be stored securely and synchronised in chronological order upon reconnection.



GPS tracking MUST respect device battery and data consumption constraints.



7.5 Proof of Delivery Rule



POD is mandatory before shipment can reach Completed state.



Offline POD capture MUST be supported.



An administrator may authorise a completion exception in exceptional circumstances.



POD records are immutable once submitted.



7.6 Driver Identity Verification Rule

Verification MUST occur before cargo handover.



Verification requirements are configurable based on shipment risk level.



All verification attempts (successful and failed) MUST be recorded.



Multiple failed attempts MUST generate security alerts.



7.7 Neutrality Rule



MOD-003 does NOT:



calculate routes or optimise logistics flow.



trigger financial settlement actions directly (handled via MOD‑005 via event).



execute physical tracking logic or assume GPS/telematics implementation.



modify contract states – that is MOD‑002's responsibility.



auto‑confirm delivery without valid POD (except admin override).



8\. EVENT MODEL (SPECIFICATION ONLY)



Declared system events:



TrackingInitialized



TripStarted



AwaitingPickup



PickupConfirmed



ShipmentInTransit



BorderCheckpointReached



BorderCheckpointExited



ShipmentDelayed



DeliveryConfirmed



PODSubmitted



PODVerified



TrackingCompleted



DriverVerified



DriverVerificationFailed



TrackingCancelled



Emitted to MOD‑002:



DeliveryConfirmed → triggers contract completion.



TrackingCancelled → triggers contract termination flow.



Consumed by:



MOD‑005 → financial settlement trigger chain (via ESS‑001F).



MOD‑006 → AI anomaly detection and prediction.



MOD‑012 → analytics and reporting.



MOD‑016 → notifications and alerts.



MOD‑008 → mobile application sync triggers.



9\. INTEGRATION BOUNDARIES



MOD-003 interacts conceptually with:



MOD-002 → receives booking and contract reference (ContractSigned event triggers TrackingInitialized); emits DeliveryConfirmed to close the contract.



MOD-005 → informs settlement readiness via DeliveryConfirmed (indirect via event).



MOD-006 → AI visibility analytics and anomaly detection.



MOD-008 → mobile applications for GPS telemetry ingestion, offline sync, POD capture, and driver verification.



MOD-010 → driver identity verification integration and security audit logging.



MOD-011 → API exposure layer (tracking endpoints).



MOD-016 → notification triggers.



MOD-003 does NOT integrate directly with external systems.



All external tracking integrations (GPS providers, telematics, external tracking APIs) are handled via:



ESS-001 + MOD-011



10\. ESS DEPENDENCY REFERENCES (CANONICAL)



MOD-003 is constrained by:



ESS-003 → AI interpretation constraints (no hallucinated state inference, anomaly detection is advisory).



ESS-004 → event contract definitions.



ESS-006 → security and visibility constraints (role‑based access, encryption).



ESS-007 → coding standards.



ESS-008 → UI/UX visibility rules.



ESS-009 → data governance rules (immutable history, data retention).



And indirectly:



ESS-001A → external tracking integrations (future mapping layer).



ESS-001D → webhook‑driven tracking updates.



11\. ARCHITECTURE BOUNDARY RULE



MOD-003 MUST NOT:



execute physical tracking logic or assume specific GPS hardware.



trigger financial settlement actions directly – this is delegated to MOD‑005 via events.



modify contract states – that is MOD‑002's responsibility.



bypass event‑based state modeling.



auto‑confirm delivery without POD (except explicit admin override).



determine route optimisation or logistics planning.



MOD-003 IS:



a structured visibility and tracking state definition system for logistics execution representation.



a framework for ingesting telemetry, generating structured events, and exposing role‑based visibility.



an immutable audit trail of shipment progress from pickup to delivery.



12\. OUTPUT EXPECTATION FOR AI BUILDER



When generating system implementation from MOD-003, the AI App Builder MUST:



implement shipment state machine structures with all defined states and transitions.



define tracking event schemas with immutability guarantees.



enforce immutability of tracking history – events are append‑only.



map tracking to MOD-002 booking/contracts (initialisation via ContractSigned, closure via DeliveryConfirmed).



ensure role‑based visibility controls (ESS-006 + ESS-008).



implement GPS optimisation rules (15‑minute intervals, 60‑minute stationary, offline sync).



implement geofencing for border crossing detection.



implement POD capture (signature, photographs, GPS, timestamp) with offline support.



implement driver identity verification (QR Code, OTP, Secure PIN, optional biometrics) with risk‑based configuration.



include edge‑case handling (GPS unavailable, battery low, no connectivity, signature refused, verification failure).



ensure offline tracking data is preserved and synchronised chronologically upon reconnection.



provide conceptual API endpoints for tracking status, location updates, offline sync, POD submission, and driver verification.



If incomplete:



Output: TODO: requires specification from MOD-003



13\. DESIGN PRINCIPLE



MOD-003 ensures:



every shipment in NexCargo can be represented as a fully traceable, state‑driven visibility model derived from immutable events.



tracking is optimised for the operational realities of Southern Africa (low connectivity, battery constraints, mobile data usage).



cargo handover is secured through configurable driver identity verification.



delivery is legally validated through mandatory Proof of Delivery.



the platform remains a neutral visibility provider – it does not execute logistics, but it faithfully represents the execution state in a transparent, auditable, and role‑appropriate manner.

