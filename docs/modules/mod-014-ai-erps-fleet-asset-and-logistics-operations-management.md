MOD-014 — AI ERPS Asset \& Logistics Operations Management Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY



Module ID: MOD-014

Module Name: AI ERPS Asset \& Logistics Operations Management Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the physical asset representation layer of NexCargo.



It governs how:



\- vehicles, drivers, and logistics assets are structured and registered within the system

\- fleet hierarchy and grouping are represented

\- vehicle health and maintenance status are tracked

\- driver profiles and qualifications are managed

\- asset availability and capacity are structured for marketplace matching

\- cross-border fleet compliance is tracked across SADC corridors



Critical constraint:



This module is a read-only asset registry. It does NOT:



\- dispatch vehicles

\- assign shipments to drivers

\- manage fleets operationally

\- perform routing or optimisation

\- execute operational logistics decisions



This module defines the canonical model of physical logistics assets used by operational modules (MOD-001, MOD-002, MOD-003) for matching and visibility purposes only.



3\. DOMAIN SCOPE



MOD-014 governs:



3.1 Asset Registry



\- fleet ownership representation and grouping

\- vehicle identity structure and types

\- driver identity model and qualifications

\- asset registration as single source of truth



3.2 Asset Structure



\- vehicle types (heavy trucks, light delivery, trailers, refrigerated, specialised)

\- capacity attributes (weight, volume, type)

\- driver licensing and certification metadata



3.3 Asset State Representation



\- availability states (available / assigned / inactive / maintenance / suspended)

\- structural scheduling constraints (not operational)

\- capacity exposure rules for marketplace matching



3.4 Maintenance Tracking



\- maintenance schedules and vehicle health status

\- configurable maintenance intervals

\- immutable maintenance logs



3.5 Fleet Performance Scoring (Advisory)



\- on-time delivery rate, fuel efficiency, load acceptance rate, incident frequency

\- score influences AI matching (MOD-006) — advisory only

\- periodic recalculation



3.6 Cross-Border Compliance Tracking



\- country-specific regulatory requirements (MOD-009)

\- insurance and permit validity per corridor

\- compliance-based assignment restrictions



4\. CORE DOMAIN ENTITIES



These are asset registry representations only.



4.1 Fleet Object



Represents a logistics fleet owned by an operator.



Required attributes:



\- fleetId

\- ownerId – transporter ID

\- fleetName

\- region – primary operating region

\- assetCount

\- operationalStatus – ACTIVE / INACTIVE / SUSPENDED

\- complianceStatus – linked to MOD-010 / ESS-006

\- createdAt

\- updatedAt



Business rules:



\- Fleets must be linked to verified transporter accounts (MOD-010).

\- Each asset must be uniquely registered and linked to a fleet.



4.2 Vehicle Asset Object



Represents a physical logistics vehicle.



Attributes:



\- vehicleId

\- fleetId

\- vehicleType – HEAVY\_TRUCK / LIGHT\_DELIVERY / TRAILER / REFRIGERATED / SPECIALISED

\- registrationNumber

\- capacityWeight – in kg

\- capacityVolume – in cubic metres

\- registrationStatus – REGISTERED / PENDING / EXPIRED

\- maintenanceStatus – OPERATIONAL / MAINTENANCE\_DUE / UNDER\_MAINTENANCE / OUT\_OF\_SERVICE

\- availabilityState – AVAILABLE / ASSIGNED / INACTIVE / MAINTENANCE / SUSPENDED

\- lastMaintenanceDate

\- nextMaintenanceDate – optional

\- currentOdometer – optional

\- complianceStatus – linked to MOD-010 / ESS-006

\- insuranceValidity – optional



Business rules:



\- Each asset must be uniquely registered.

\- Asset status must be one of: ACTIVE / INACTIVE / ASSIGNED / MAINTENANCE / SUSPENDED.

\- Vehicles under maintenance cannot be assigned.

\- Maintenance logs are immutable.



4.3 Driver Object



Represents a logistics operator (human resource).



Attributes:



\- driverId

\- fleetId

\- firstName

\- lastName

\- licenseType

\- licenseNumber

\- licenseExpiryDate

\- certificationStatus – VERIFIED / PENDING / EXPIRED / SUSPENDED

\- availabilityState – AVAILABLE / ASSIGNED / OFF\_DUTY / UNAVAILABLE

\- assignedVehicleId – optional

\- complianceStatus – linked to MOD-010 / ESS-006

\- performanceScore – optional (from MOD-006)

\- contactNumber

\- createdAt

\- updatedAt



Business rules:



\- Drivers must be KYC-verified (MOD-010).

\- Drivers must be assigned to at least one fleet.

\- Driving eligibility depends on license and compliance status.



4.4 Asset Assignment Object



Represents advisory linkage between assets and operational tasks. This is a recommendation record, not an execution command.



Attributes:



\- assignmentId

\- vehicleId

\- driverId

\- shipmentId – MOD-003 reference

\- assignmentStatus – PROPOSED / RECOMMENDED / MATCHED / EXECUTED\_BY\_MOD003 / CANCELLED

\- startTime – proposed

\- endTime – proposed

\- actualStartTime – optional

\- actualEndTime – optional

\- recommendedBy – system or AI reference



Business rules:



\- This is an advisory assignment record.

\- Actual assignment execution is performed by MOD-002 / MOD-003.

\- No implicit pairing is allowed.

\- No operational execution occurs in this module.



4.5 Maintenance Record



Represents vehicle maintenance tracking.



Attributes:



\- maintenanceId

\- vehicleId

\- maintenanceType – SCHEDULED / UNSCHEDULED / EMERGENCY

\- scheduledDate

\- completedDate – optional

\- maintenanceDescription

\- cost – optional

\- status – SCHEDULED / IN\_PROGRESS / COMPLETED / CANCELLED

\- serviceProvider – optional

\- mileageAtMaintenance – optional

\- createdAt

\- updatedAt



Business rules:



\- Maintenance intervals must be configurable.

\- Vehicles under maintenance cannot be assigned.

\- Maintenance logs are immutable.



4.6 Fleet Performance Score Object



Represents fleet performance scoring structure (advisory only).



Attributes:



\- performanceId

\- fleetId

\- timePeriod – WEEKLY / MONTHLY / QUARTERLY

\- onTimeDeliveryRate – percentage

\- fuelEfficiency – litres per 100 km

\- loadAcceptanceRate – percentage

\- incidentFrequency – incidents per 100 trips

\- averageTurnaroundTime – hours

\- overallScore – 0–100

\- calculatedAt

\- validUntil



Business rules:



\- Scores influence AI matching (MOD-006) — advisory only.

\- Scores are recalculated periodically.

\- Scores are based on operational history from MOD-003 and MOD-012.



4.7 CrossBorder Compliance Record



Represents fleet compliance across SADC corridors.



Attributes:



\- complianceId

\- vehicleId

\- corridorId – MOD-009 reference

\- countryCode

\- permitType – INSURANCE / TRANSPORT\_PERMIT / CUSTOMS\_BOND / OPERATING\_LICENSE

\- permitNumber

\- issueDate

\- expiryDate

\- status – VALID / EXPIRING / EXPIRED / PENDING\_RENEWAL



Business rules:



\- Vehicles must meet country-specific regulatory requirements (MOD-009).

\- Insurance and permits must be valid per corridor.

\- Non-compliant vehicles are restricted from cross-border assignments.



4.8 Backhaul Opportunity Object



Represents empty backhaul optimisation structure (advisory only).



Attributes:



\- backhaulId

\- shipmentId – primary shipment

\- vehicleId

\- currentLocation

\- destination

\- returnRoute

\- suggestedLoadId – optional (from MOD-006 AI)

\- estimatedCostRecovery

\- status – IDENTIFIED / RECOMMENDED / MATCHED / DECLINED / BOOKED\_BY\_MOD001



Business rules:



\- AI suggests return loads based on route matching (MOD-006) — advisory only.

\- Prioritises cost recovery for empty trips.

\- Actual booking is executed by MOD-001.



5\. ASSET MODEL



5.1 Capacity Representation Model



All logistics capacity MUST be represented through:



\- vehicle attributes

\- fleet aggregation logic

\- availability state model



No inferred capacity calculations are allowed here.



5.2 Asset State Model



Each asset MUST maintain deterministic state:



\- ACTIVE – available for matching

\- INACTIVE – not currently operational

\- ASSIGNED – currently assigned to a shipment (reflected from MOD-003)

\- MAINTENANCE – under maintenance

\- SUSPENDED – compliance-related suspension



State transitions MUST be event-driven.



5.3 Asset Lifecycle Model



ASSET REGISTERED (vehicle/driver created)

↓

AVAILABLE (ready for marketplace matching)

↓

RECOMMENDED (AI suggests asset for shipment — MOD-006)

↓

MATCHED (MOD-001 suggests match — advisory)

↓

ASSIGNED (MOD-002/003 executes assignment)

↓

COMPLETED (shipment delivered)

↓

MAINTENANCE / IDLE (return to available state)



text



6\. RESPONSIBILITIES



MOD-014 is responsible for:



6.1 Asset Representation



\- defining vehicle and driver structures

\- ensuring consistency of physical asset modelling

\- maintaining asset registry as single source of truth



6.2 Availability Representation



\- defining asset availability states

\- ensuring correct representation of operational readiness

\- supporting capacity visibility for marketplace matching



6.3 Maintenance Tracking



\- defining maintenance tracking structures

\- ensuring maintenance status impacts availability

\- maintaining immutable maintenance logs



6.4 Compliance Attribute Structuring



\- linking asset compliance metadata to MOD-010 / ESS-006

\- tracking cross-border compliance requirements



6.5 Performance Structuring (Advisory)

\- defining fleet performance scoring structures

\- enabling AI matching influence (MOD-006 — advisory)



6.6 Backhaul Structuring (Advisory)



\- defining backhaul optimisation structures

\- enabling AI-driven load suggestions (MOD-006 — advisory)



7\. RULES OF OPERATION



7.1 No Dispatch Rule (CRITICAL)



MOD-014 MUST NOT:



\- assign shipments to drivers

\- dispatch vehicles

\- optimise routing

\- make operational decisions

\- execute logistics planning



That belongs to: MOD-002 + MOD-003.



7.2 No Fleet Management Rule (CRITICAL)



MOD-014 does NOT manage fleets operationally. It is a read-only asset registry used for marketplace matching and visibility.



7.3 Asset Truth Rule



MOD-014 is the SINGLE source of truth for asset structure.



No other module may redefine asset schema.



Each asset must be uniquely registered.



7.4 State Integrity Rule



Asset states MUST be event-driven.



Manual state overrides are prohibited.



All transitions MUST be auditable.



7.5 Separation of Concerns Rule



\- Vehicles ≠ shipments (MOD-003 owns shipments)

\- Drivers ≠ dispatch logic (MOD-002 owns assignment execution)

\- Fleets ≠ pricing logic (MOD-018 owns pricing)



Each belongs to separate modules.



7.6 Availability Neutrality Rule



Availability is structural, not predictive.



No forecasting is allowed in this module.



Capacity planning is structural only.



7.7 Maintenance Rule



\- Maintenance intervals must be configurable.

\- Vehicles under maintenance cannot be assigned.

\- Maintenance logs are immutable.



7.8 Compliance Rule



\- Vehicles must meet country-specific regulatory requirements (MOD-009).

\- Non-compliant vehicles are restricted from cross-border assignments.

\- Compliance status is visible per asset.



8\. EVENT MODEL (SPECIFICATION ONLY)



Declared asset events:



\- FleetRegistered

\- FleetUpdated

\- FleetSuspended

\- VehicleAddedToFleet

\- VehicleUpdated

\- VehicleMaintenanceScheduled

\- VehicleMaintenanceCompleted

\- VehicleDeactivated

\- DriverRegistered

\- DriverUpdated

\- DriverSuspended

\- AssetAssigned (reflected from MOD-003)

\- AssetReleased (reflected from MOD-003)

\- AssetMaintenanceScheduled

\- AssetDeactivated

\- ComplianceStatusUpdated

\- CrossBorderComplianceValidated

\- CrossBorderComplianceExpired

\- FleetPerformanceScoreCalculated

\- BackhaulOpportunityIdentified

\- BackhaulOpportunityMatched



Consumed by:



\- MOD-001 → marketplace capacity visibility

\- MOD-002 → contract-to-asset matching

\- MOD-003 → tracking association

\- MOD-005 → operational settlement validation

\- MOD-006 → anomaly detection and optimisation recommendations

\- MOD-010 → compliance enforcement

\- MOD-012 → fleet analytics and performance reporting

\- MOD-017 → observability



9\. INTEGRATION BOUNDARIES



MOD-014 interacts conceptually with:



\- MOD-001 → marketplace visibility of transport capacity

\- MOD-002 → contract-to-asset matching

\- MOD-003 → shipment execution tracking (asset linked to shipment)

\- MOD-005 → financial settlement dependency validation

\- MOD-006 → AI optimisation, backhaul suggestions, performance scoring

\- MOD-009 → cross-border compliance and corridor context

\- MOD-010 → compliance and governance rules

\- MOD-011 → external asset systems (future integrations)

\- MOD-012 → fleet analytics and performance reporting



MOD-014 does NOT:



\- dispatch vehicles

\- assign loads

\- calculate optimisation routes

\- execute operational logistics decisions

\- manage fleets operationally



10\. ESS DEPENDENCY REFERENCES (CANONICAL)



MOD-014 is constrained by:



\- ESS-006 → Compliance \& Audit Specification (primary compliance authority)

\- ESS-004 → Integration Contracts Specification

\- ESS-007 → Coding Standards Specification

\- ESS-009 → Data Governance Specification

\- ESS-003 → AI Behaviour Constraints (no operational inference)

\- ESS-001C → retry and reliability constraints

\- ESS-001E → error standardisation rules



11\. ARCHITECTURE BOUNDARY RULE



MOD-014 MUST NOT:



\- dispatch vehicles

\- assign shipments to drivers

\- manage fleets operationally

\- optimise fleet utilisation

\- simulate operational planning

\- override shipment assignment logic

\- modify tracking states directly (MOD-003 authority)



MOD-014 IS:



a read-only asset registry of logistics assets (vehicles, drivers) that defines the physical capacity layer of NexCargo for marketplace matching and visibility — without operational decision-making authority.



12\. OUTPUT EXPECTATION FOR AI BUILDER



When generating implementation from MOD-014, the AI App Builder MUST:



\- implement asset schema strictly (single source of truth)

\- enforce state-driven asset lifecycle rules (event-driven transitions)

\- ensure event-driven assignment tracking (no double-booking)

\- integrate compliance metadata from MOD-010 and ESS-006

\- link assets to shipment execution via MOD-003 only

\- implement maintenance tracking system with configurable intervals and immutable logs

\- implement fleet performance scoring structure (advisory only)

\- implement cross-border fleet compliance tracking

\- implement backhaul optimisation structure (AI-driven suggestions — advisory only)

\- include edge-case handling (maintenance override, compliance expiry, double-booking prevention, asset suspension)

\- ensure all assignments are auditable and traceable

\- ensure vehicles under maintenance cannot be assigned

\- never implement dispatch or fleet management logic



If incomplete:



Output: TODO: requires specification from MOD-014



13\. DESIGN PRINCIPLE



MOD-014 ensures:



NexCargo maintains a clean, deterministic representation of real-world logistics assets without mixing structural asset data with operational decision logic.



Assets are structured, compliant, and fully integrated into marketplace, AI, and financial systems — but never managed or dispatched by this module.

