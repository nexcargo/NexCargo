\# MOD-014 — AI ERPS Asset \& Logistics Operations Management



\*\*Module ID:\*\* MOD-014  

\*\*Module Name:\*\* AI ERPS Asset \& Logistics Operations Management Module  

\*\*Version:\*\* 1.1  

\*\*Last Updated:\*\* 2026-08-07  

\*\*System:\*\* NexCargo  

\*\*Type:\*\* Domain Specification Module  



\---



\## 1. Module Identity



| Attribute | Value |

|-----------|-------|

| Module ID | MOD-014 |

| Module Name | AI ERPS Asset \& Logistics Operations Management Module |

| Version | 1.1 |

| System | NexCargo |

| Type | Domain Specification Module |



\---



\## 2. Purpose



This module defines the \*\*transporter asset representation layer\*\* of NexCargo.



It governs how:



\- fleets, vehicles, and drivers are \*\*registered\*\* by transporters for marketplace participation

\- capacity and availability data is \*\*structured\*\* for matching (MOD-001)

\- compliance status (licences, insurance, permits) is \*\*declared and validated\*\*

\- cross-border documentation is \*\*declared\*\* for corridor-based matching



\*\*Critical constraint:\*\* NexCargo does \*\*NOT\*\* own, operate, dispatch, or manage fleets. All operational decisions (maintenance, driver assignment, vehicle utilisation) remain the \*\*sole responsibility\*\* of the transporter.



This module only \*\*structures and stores\*\* the data that transporters provide for marketplace participation.



\---



\## 3. Domain Scope



MOD-014 governs the \*\*representation\*\* of transporter assets:



\### 3.1 Fleet Structure Representation

\- fleet registration and grouping

\- ownership linking to transporter accounts



\### 3.2 Vehicle Asset Registry

\- vehicle identity and capacity attributes

\- registration and compliance declaration

\- availability declaration



\### 3.3 Driver Entity Representation

\- driver identity and licence declaration

\- assignment eligibility declaration



\### 3.4 Asset Availability Declaration

\- availability states declared by transporter

\- capacity exposure for marketplace matching



\### 3.5 Cross-Border Compliance Declaration

\- declaration of permits and insurance

\- support for temporary permits obtainable at border



\### 3.6 Assignment Tracking

\- linkage between assets and shipment assignments (MOD-003)

\- historical assignment record



\---



\## 4. Core Domain Entities



These are asset representations only.



\### 4.1 Fleet Object



Represents a logistics fleet owned by a transporter.



| Attribute | Type | Description |

|-----------|------|-------------|

| fleetId | string | Unique identifier |

| ownerId | string | Transporter account ID |

| fleetName | string | Display name |

| region | string | Primary operating region |

| assetCount | number | Number of assets in fleet |

| operationalStatus | enum | ACTIVE / INACTIVE / SUSPENDED |

| complianceStatus | string | Linked to MOD-010 / ESS-006 |

| createdAt | datetime | Creation timestamp |

| updatedAt | datetime | Last update timestamp |



\*\*Business rules:\*\*

\- Fleets must be linked to verified transporter accounts (MOD-010).

\- Each asset must be uniquely registered and linked to a fleet.



\### 4.2 Vehicle Asset Object



Represents a physical logistics vehicle.



| Attribute | Type | Description |

|-----------|------|-------------|

| vehicleId | string | Unique identifier |

| fleetId | string | Fleet reference |

| vehicleType | enum | HEAVY\_TRUCK / LIGHT\_DELIVERY / TRAILER / REFRIGERATED / SPECIALISED |

| registrationNumber | string | Vehicle registration |

| capacityWeight | number | Weight capacity in kg |

| capacityVolume | number | Volume capacity in cubic metres |

| registrationStatus | enum | REGISTERED / PENDING / EXPIRED |

| availabilityState | enum | AVAILABLE / ASSIGNED / INACTIVE / SUSPENDED |

| complianceStatus | string | Linked to MOD-010 / ESS-006 |

| insuranceValidity | datetime | Optional insurance expiry date |

| licenceJurisdiction | string | Licensing jurisdiction (e.g., "Mozambique") |

| licenceValidityNationwide | boolean | Whether licence is valid nationwide (always true for Mozambique) |

| crossBorderPermitStatus | enum | NONE / TEMPORARY\_OBTAINABLE / PRE\_EXISTING |

| insuranceStatus | JSON | Structured insurance status |

| createdAt | datetime | Creation timestamp |

| updatedAt | datetime | Last update timestamp |



\*\*Business rules:\*\*

\- Each asset must be uniquely registered.

\- Asset statuses are declared by the transporter.

\- In Mozambique, licences are valid nationwide.



\### 4.3 Driver Object



Represents a logistics operator (human resource).



| Attribute | Type | Description |

|-----------|------|-------------|

| driverId | string | Unique identifier |

| fleetId | string | Fleet reference |

| firstName | string | Driver's first name |

| lastName | string | Driver's last name |

| licenseType | string | Type of licence held |

| licenseNumber | string | Licence number |

| licenseExpiryDate | datetime | Licence expiry date |

| certificationStatus | enum | VERIFIED / PENDING / EXPIRED / SUSPENDED |

| availabilityState | enum | AVAILABLE / ASSIGNED / OFF\_DUTY / UNAVAILABLE |

| complianceStatus | string | Linked to MOD-010 / ESS-006 |

| contactNumber | string | Driver's contact number |

| createdAt | datetime | Creation timestamp |

| updatedAt | datetime | Last update timestamp |



\*\*Business rules:\*\*

\- Drivers must be linked to a verified fleet.

\- Driver eligibility depends on licence and compliance status.



\### 4.4 Asset Assignment Object



Represents linkage between assets and shipment assignments.



| Attribute | Type | Description |

|-----------|------|-------------|

| assignmentId | string | Unique identifier |

| vehicleId | string | Vehicle reference |

| driverId | string | Driver reference |

| shipmentId | string | MOD-003 reference |

| assignmentStatus | enum | PLANNED / ACTIVE / COMPLETED / CANCELLED |

| startTime | datetime | Scheduled start time |

| endTime | datetime | Scheduled end time |

| actualStartTime | datetime | Optional actual start time |

| actualEndTime | datetime | Optional actual end time |

| assignedBy | string | Transporter or system reference |



\*\*Business rules:\*\*

\- Drivers and vehicles are linked to shipments.

\- No double-booking of vehicles or drivers is permitted.



\### 4.5 CrossBorder Compliance Record



Represents declared compliance for cross-border corridors.



| Attribute | Type | Description |

|-----------|------|-------------|

| complianceId | string | Unique identifier |

| vehicleId | string | Vehicle reference |

| corridorId | string | MOD-009 reference |

| countryCode | string | Country code |

| permitType | enum | INSURANCE / TRANSPORT\_PERMIT / CUSTOMS\_BOND / OPERATING\_LICENSE |

| permitNumber | string | Permit identifier |

| issueDate | datetime | Issue date |

| expiryDate | datetime | Expiry date |

| status | enum | VALID / EXPIRING / EXPIRED / PENDING\_RENEWAL |

| temporaryPermit | boolean | Whether permit is temporary (obtained for specific shipment) |



\*\*Business rules:\*\*

\- Vehicles must meet country-specific regulatory requirements (MOD-009).

\- Temporary permits may be obtained at the border for specific shipments.



\### 4.6 BackhaulOpportunity Object



Represents empty backhaul optimisation structure.



| Attribute | Type | Description |

|-----------|------|-------------|

| backhaulId | string | Unique identifier |

| shipmentId | string | Primary shipment reference |

| vehicleId | string | Vehicle reference |

| currentLocation | string | Current location |

| destination | string | Destination |

| returnRoute | string | Return route description |

| suggestedLoadId | string | Optional AI-suggested load (MOD-006) |

| estimatedCostRecovery | number | Estimated cost recovery |

| status | enum | IDENTIFIED / MATCHED / DECLINED / BOOKED |



\*\*Business rules:\*\*

\- AI suggests return loads based on route matching (MOD-006).

\- Integrated with Marketplace (MOD-001).



\---



\## 5. Asset Model



\### 5.1 Capacity Representation



All logistics capacity is represented through:

\- vehicle attributes (weight, volume)

\- availability state model



\### 5.2 Asset State Model



Each asset maintains a declared state:



| State | Description |

|-------|-------------|

| AVAILABLE | Declared available for matching |

| ASSIGNED | Linked to a shipment assignment |

| INACTIVE | Not currently operational |

| SUSPENDED | Compliance-related suspension |



State transitions are event-driven.



\### 5.3 Asset Lifecycle

ASSET REGISTERED (fleet/vehicle/driver created by transporter)

↓

AVAILABLE (declared for marketplace matching)

↓

ASSIGNED TO SHIPMENT (linked to MOD-003)

↓

IN TRANSIT (tracking active via MOD-003)

↓

COMPLETED (shipment delivered)

↓

AVAILABLE (return to available state)



text



\---



\## 6. Responsibilities



MOD-014 is responsible for \*\*receiving and storing\*\* data from transporters:



\- asset registration and schema enforcement

\- compliance metadata storage (MOD-010/ESS-006 alignment)

\- availability state management for matching



\*\*MOD-014 does NOT:\*\*

\- dispatch vehicles

\- schedule maintenance

\- optimise fleet utilisation

\- assign drivers to trips

\- track vehicle health

\- calculate fuel efficiency

\- manage fleet operations

\- operate any physical asset



\---



\## 7. Rules of Operation



\### 7.1 No Dispatch Rule (CRITICAL)



MOD-014 MUST NOT:

\- assign shipments to drivers

\- optimise routing

\- make operational decisions

\- execute logistics planning



\### 7.2 Asset Truth Rule



MOD-014 is the \*\*single source of truth\*\* for declared asset structure.

No other module may redefine asset schema.



\### 7.3 State Integrity Rule



Asset states MUST be event-driven.

No double-booking of vehicles or drivers is permitted.



\### 7.4 Separation of Concerns Rule



\- Vehicles ≠ shipments

\- Drivers ≠ dispatch logic

\- Fleets ≠ pricing logic



\### 7.5 Compliance Rule



\- Vehicles must meet country-specific regulatory requirements (MOD-009).

\- Non-compliant vehicles are restricted from cross-border assignments.

\- Temporary permits may be obtained at the border for specific shipments.



\### 7.6 Licensing Scope Rule



\- A transport licence issued in Mozambique is valid nationwide.

\- No vehicle may be blocked from a domestic shipment based on "operating region".



\### 7.7 Neutrality Rule



MOD-014 MUST NOT:

\- perform dispatch decisions

\- simulate operational planning

\- override shipment assignment logic

\- modify tracking states directly (MOD-003 authority)



\---



\## 8. Event Model (Specification Only)



Declared asset events:



| Event | Trigger |

|-------|---------|

| `FleetRegistered` | New fleet registered |

| `VehicleAddedToFleet` | New vehicle registered |

| `DriverRegistered` | New driver registered |

| `AssetAssigned` | Asset linked to shipment |

| `AssetReleased` | Asset released from shipment |

| `ComplianceStatusUpdated` | Compliance status changed |

| `CrossBorderComplianceValidated` | Cross-border compliance validated |

| `TemporaryPermitAcquired` | Temporary permit declared |

| `BackhaulOpportunityIdentified` | Backhaul opportunity found |



\*\*Consumed by:\*\*

\- MOD-001 → marketplace capacity visibility

\- MOD-002 → assignment validation

\- MOD-003 → tracking association

\- MOD-006 → anomaly detection

\- MOD-010 → compliance enforcement

\- MOD-012 → fleet analytics



\---



\## 9. Integration Boundaries



| Module | Interaction |

|--------|-------------|

| MOD-001 | Marketplace listing of transport capacity |

| MOD-002 | Contract-to-asset matching |

| MOD-003 | Shipment execution tracking |

| MOD-005 | Settlement dependency validation |

| MOD-006 | AI recommendations |

| MOD-009 | Cross-border compliance |

| MOD-010 | Compliance and governance |

| MOD-012 | Fleet analytics |

| INT-005 | Fleet Telematics \& GPS integration |



MOD-014 does \*\*NOT\*\*:

\- dispatch vehicles

\- assign loads

\- execute operational logistics decisions



\---



\## 10. ESS Dependency References



| ESS | Application |

|-----|-------------|

| ESS-006 | Compliance \& Audit (primary compliance authority) |

| ESS-004 | Integration Contracts |

| ESS-003 | AI Behaviour Constraints |

| ESS-009 | Data Governance |



\---



\## 11. Architecture Boundary Rule



MOD-014 \*\*MUST NOT\*\*:

\- perform dispatch decisions

\- simulate operational planning

\- override shipment assignment logic

\- modify tracking states directly (MOD-003 authority)



MOD-014 \*\*IS\*\*:

\- a deterministic structural registry of transporter assets (fleets, vehicles, drivers)

\- a framework for compliance declaration and backhaul optimisation



\---



\## 12. Output Expectation for AI Builder



When generating implementation from MOD-014, the AI App Builder \*\*MUST\*\*:



\- implement fleet/vehicle/driver schema strictly (single source of truth)

\- enforce event-driven asset state transitions

\- integrate compliance metadata from MOD-010

\- link assets to shipment execution via MOD-003

\- implement cross-border compliance declaration with temporary permit support

\- implement nationwide licensing rule for Mozambique

\- ensure vehicles are not blocked based on "operating region" alone

\- prevent double-booking

\- ensure all assignments are auditable



If incomplete:

\- \*\*Output:\*\* `TODO: requires specification from MOD-014`



\---



\## 13. Design Principle



MOD-014 ensures:



\- NexCargo maintains a clean, deterministic representation of transporter assets

\- asset data is structured, compliant, and integrated into marketplace matching

\- Mozambique's nationwide licensing framework is correctly represented

\- cross-border compliance is declared and validated

