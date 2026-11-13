MOD-007 — AI ERPS User Dashboards \& Experience Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY



Module ID: MOD-007

Module Name: AI ERPS User Dashboards \& Experience Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the user interface, dashboard structure, and experience layer of NexCargo.



It governs how:



system data from all modules (MOD-001 → MOD-018) is presented, interacted with, and operationalized by users



role-based dashboards are structured for Shippers, Transporters, Drivers, Dispatchers, Moderators, Admins and SUPER_ADMINs



real-time notifications are delivered across multiple channels



AI insights are visualized and presented as advisory information



This module defines the structural interaction model between users and system intelligence.



It does not define visual design implementation or frontend frameworks.



3\. DOMAIN SCOPE



MOD-007 governs:



3.1 Dashboard Architecture



role-based dashboards (Shipper, Transporter, Driver, Dispatcher, Moderator, Admin, Super Admin)



module-specific dashboards (operational vs analytical views)



hybrid views combining operational + analytical data



3.2 User Interaction Model



data filtering structures



state-driven UI behavior



event-based UI updates



offline-first mobile experiences for drivers



3.3 Experience Layer Structuring



navigation logic (conceptual only)



user flow definitions



contextual information rendering rules



3.4 AI-Augmented Interfaces



embedding insights from MOD-006



displaying predictions, anomalies, and recommendations



non-executable AI guidance rendering



clear labeling of AI suggestions as advisory



3.5 Notification System



real-time notifications across channels (push, email, SMS, in-app)



priority-based delivery system



role-specific notification routing



3.6 Role-Based Access Control UI



UI reflection of RBAC constraints (ESS-006)



visibility of available actions only



no UI-level security enforcement alone



User Dashboards \& Experience Layer



3.7 Internationalization \& Localization



\- automatic language detection based on user location/region



\- manual language switching by user preference



\- locale-aware content rendering (dates, times, currency, numbers)



\- region-to-language mapping



\- user language preference storage



\- translation management for UI content



4\. CORE DOMAIN ENTITIES



These are UI state structures (not visual components).



4.1 Dashboard View Object



Represents a structured dashboard configuration.



Required attributes:



dashboardId



roleContext – SHIPPER / TRANSPORTER / DRIVER / DISPATCHER / MODERATOR / ADMIN / SUPER_ADMIN



moduleScope – array of module references (MOD-001 → MOD-018)



layoutType – OPERATIONAL / ANALYTICAL / HYBRID



widgetCollection – array of widget references



refreshPolicy – polling interval or event-driven refresh rules



visibilityRules – RBAC-based visibility constraints



4.2 Widget Object



Represents a functional UI data block.



Attributes:



widgetId



widgetType – TABLE / CHART / TIMELINE / KPI / AI\_INSIGHT / MAP / FORM / LIST



dataSourceModule – reference to source module



refreshTriggerEvent – event that triggers widget refresh



accessLevel – PUBLIC / RESTRICTED / ADMIN\_ONLY



configurationSchema – JSON schema for widget configuration



4.3 User Interaction Event



Represents user actions within the system.



Attributes:



eventId



userId



actionType – VIEW / CREATE / UPDATE / SUBMIT / APPROVE / REJECT



targetModule



payload – structured action data



timestamp



4.4 UI State Snapshot



Represents a system-renderable UI state at a given moment.



Attributes:



snapshotId



dashboardId



activeFilters



loadedModules



dataPayload



timestamp



4.5 Notification Object



Represents a structured notification for delivery to a user.



Attributes:



notificationId



userId



userRole



notificationType – INFO / ALERT / WARNING / CRITICAL



channel – PUSH / EMAIL / SMS / IN\_APP



priority – LOW / MEDIUM / HIGH / CRITICAL



title



body



actionLink – optional deep link to system state



sourceModule



sourceEventId



readAt – optional timestamp



deliveredAt



Business rules:



Notifications are triggered by events from all modules.



Priority-based delivery system ensures critical alerts override user preferences.



Notification channels are configurable per user.



4.6 AI Insight Widget



Represents an AI-generated insight displayed in the UI.



Attributes:



insightWidgetId



insightId – reference to MOD-006 insight



insightType – RECOMMENDATION / PREDICTION / ANOMALY / RISK\_SCORE



displayFormat – CARD / LIST / CHART / BANNER



isAdvisory – always TRUE (enforced)



actionButton – optional non-executable action reference (e.g., "View Details")



Business rules:



AI insights are clearly marked as recommendations.



No automatic execution from UI.



Users must approve all AI-driven actions.



4.7 Localization Preference Object



Represents a user's language and localization settings.



Required attributes:



preferenceId



userId



preferredLanguage (pt / en)



detectedRegion



autoDetectEnabled (boolean)



lastUpdated



fallbackLanguage



5\. DASHBOARD ARCHITECTURE MODEL



5.1 Shipper Dashboard



Features:



Create and manage shipment requests



View active shipments and status



Compare transporter bids



Track shipments in real-time



Access invoices and documents



Manage escrow payments



View AI recommendations (pricing, carrier matching, ETA)



Analyze shipping performance metrics



Business rules:



Only authorized shipper accounts can access shipment data.



Data visibility limited to owned shipments.



AI suggestions are advisory only.



5.2 Transporter Dashboard



Features:



Browse available loads (filtered by route, capacity)



Submit and manage bids



Accept and manage shipments



Manage fleet and drivers



Track active trips



View earnings and payouts



Access performance analytics



View AI load recommendations



Business rules:



Transporters only see assigned or bid-eligible loads.



Earnings reflect escrow release status.



Fleet visibility limited to owned vehicles.



5.3 Driver Mobile App Interface



Features:



View assigned trips



Navigation and route guidance



Check-in at pickup and delivery points



Capture Proof of Delivery (POD)



Upload documents offline



Receive SOS alerts and notifications



Sync GPS tracking data



Chat with dispatcher or shipper



Business rules:



Offline mode must store data locally and sync later.



GPS tracking controlled by MOD-003.



POD required before trip completion.



5.4 Dispatcher Dashboard



Features:



Live operations overview for the shipments of the delegating Transporter



Assignment allocation to Drivers within the delegated scope



Trip and fleet visibility within the delegated scope (MOD-003, MOD-014 read surfaces)



Exception review and escalation into MOD-015



Delegation visibility: which Transporter granted which bounded authority, and its status



Business rules:



Access exists only while an explicit delegation from a specific Transporter is active; revocation removes access.



Delegation is bounded and must not automatically include Driver onboarding, personnel management, financial authority or administrative privileges.



A Dispatcher is not a marketplace participant and has no global platform authority.



Every Dispatcher action is attributable to the Dispatcher and to the authorising Transporter context.



5.5 Moderator Dashboard



Features:



Review disputes, record findings and recommend a resolution. A resolution that produces a financial outcome is decided by Admin within delegated authority, or by SUPER_ADMIN where ESS-001F §15.9 Tier 2 applies; ordinary non-financial case handling remains a Moderator responsibility (PROMPT 0 v1.3 §PERMISSION RULES; ESS-001F §15.6; HAO decision D-01 Item 3, direction 3-A)



Approve or reject identity verifications



Monitor suspicious activity (fraud scoring)



Manage user reports



Monitor transaction holds and their status. Requesting a hold or lifting one follows the governed pathway (MOD-005 §4.4; ESS-001F §15.3, §15.9) and is not Moderator authority; monitoring confers no decision or resume authority (ESS-001F §15.2 suspension boundary).



Access audit logs



Handle rating disputes



Business rules:



Moderators cannot alter financial ledger directly, cannot approve a financial intervention, and cannot decide a financial outcome (PROMPT 0 v1.3 §PERMISSION RULES; ESS-001F §15.6).



Actions must be logged and auditable.



Fraud alerts are AI-generated (MOD-006).



5.6 Admin Dashboard



Features:



User and organisation administration within platform scope



System configuration (corridors, service settings, feature toggles that are not HD-RT-8 executive controls, and routine financial configuration inside already-approved policy — fee and commission parameter maintenance under ESS-001F §15.2)



Payment integration monitoring



Escrow bank integration monitoring and governed Escrow Intervention Request handling



Audit logs access



AI system oversight surfaces (advisory display only)



Business rules:



Reflects the approved Admin permission set defined in PROMPT 0 v1.3 §PERMISSION RULES. The five HD-RT-8 executive authority domains are SUPER_ADMIN-exclusive (PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS) and MUST NOT be exposed on this surface.



Excludes SUPER_ADMIN-exclusive controls: granting, changing or revoking Moderator or Admin platform authority, issuing SUPER_ADMIN accounts, and enacting an LA-approved role-taxonomy or permission-boundary change.



Escrow intervention remains governed by the Escrow Intervention Request process; no direct ledger modification. This surface may carry Tier 1 decisions under ESS-001F §15.9 and MUST NOT expose a Tier 2 decision, an exceptional commercial authorisation (PROMPT 0 v1.3 Domain 1 or Domain 5), or any platform-wide restriction, lockdown or kill-switch control (Domain 4). Admin may not use this surface to impose, reverse or bypass a restriction entered by SUPER_ADMIN, and pause and resume remain separate permissions (ESS-001F §15.2 suspension boundary; HAO decision D-01 Item 3, directions 3-A and 3-B).



No financial execution authority: the bank remains the financial execution authority.



All actions are fully logged.



5.7 Super Admin Dashboard



Features:



Global analytics (GMV, shipments, revenue)



User management (all roles)



System configuration (corridors, pricing rules, fees) — this is the commercial-authorisation surface for pricing and fee policy, negotiated platform-fee arrangements, corridor-specific commercial terms, promotional credits, exceptional discounts and fee waivers under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 5. Routine maintenance of an already-approved fee or commission parameter remains Admin routine configuration (ESS-001F §15.1, §15.2; MOD-013 §4.7); the two activities are distinct and neither confers the other (HAO decision D-01 Item 3, direction 3-C).



Payment integration monitoring



Escrow bank integration monitoring



AI system oversight



Audit logs access



Feature toggles and system settings



Business rules:



Highest privilege level with strict authentication.



Actions are fully logged.



Financial changes require dual approval. The requirement is stated here; the mechanism — the second authoriser, the applicable threshold and how independence is enforced — is not established by this document, is governed by PROMPT 0 v1.3 §Accountability and separation of duties, and remains subject to a separate specification decision (ESS-001F §15.9 and §15.10 TODO markers; HAO decision D-01 Item 3 depends on that decision). The deferral does not waive the requirement: a financial change within its scope is not effective on a single approval, and SUPER_ADMIN does not acquire unlimited financial authority by role position (PROMPT 0 v1.3 §Financial boundary; HAO decision D-01 Item 3, direction 3-A).



Holds the explicit superset of the approved Moderator and Admin permissions plus the SUPER_ADMIN-exclusive actions listed in PROMPT 0 v1.3 §PERMISSION RULES, together with the five executive authority domains approved under HD-RT-8 and documented in PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS. The dashboard controls, screens and permission matrix for those domains are not specified by this document and require a separate authorised increment.



SUPER_ADMIN-exclusive controls must not be duplicated in the Admin Dashboard (§5.6).



Authority derives from explicit definition, never from undefined inheritance.




5.8 Module-Based Views



Each module MAY expose its own UI layer:



MOD-001 → Marketplace UI (listings, offers, matching)



MOD-002 → Booking \& Contract UI



MOD-003 → Tracking UI



MOD-004 → Document Management UI



MOD-005 → Financial UI (restricted)



MOD-006 → Intelligence UI



5.9 Internationalization Model



All user interfaces MUST support:



Portuguese (pt) as the default language for Mozambique operations



English (en) as the default language for regional expansion



Automatic language detection via IP geolocation → country → language mapping



Manual language override stored in user profile



Locale-aware formatting (dates, times, currency, numbers)



Language-specific content for all UI elements, notifications, and system messages



6\. RESPONSIBILITIES



MOD-007 is responsible for:



6.1 Experience Structuring



defining how users interact with system data



organizing workflows into structured dashboards



ensuring offline-first mobile experiences for drivers



6.2 Data Presentation Logic

mapping module outputs to UI structures



defining widget behavior contracts



ensuring real-time data updates



6.3 Role-Based Access Presentation



ensuring UI reflects RBAC constraints (ESS-006)



enforcing visibility restrictions at UI layer (non-security primary layer)



hiding unauthorized actions from view



6.4 AI Insight Rendering



displaying outputs from MOD-006



ensuring AI outputs remain non-executable and clearly labeled as advisory



providing contextual guidance without system overrides



6.5 Notification Orchestration



defining notification structures and delivery channels



managing priority-based routing



ensuring notifications are triggered by system events



7\. RULES OF OPERATION



7.1 UI is NOT a Security Layer (CRITICAL)



Security MUST be enforced in backend (ESS + RBAC).



UI only reflects access constraints.



No UI-level security enforcement alone.



7.2 Data Binding Rule



All UI elements MUST bind to module-defined data structures.



No ad-hoc or undefined UI data sources are allowed.



UI must reflect backend truth in real time.



7.3 State Consistency Rule



UI must reflect current system state from MOD-001 → MOD-018.



Stale or conflicting UI states MUST be resolved via refresh rules.



Real-time updates must reflect tracking and event data.



7.4 Offline State Consistency Rule



Driver mobile interface MUST store data locally when offline.



Offline data MUST be synchronised in chronological order upon reconnection.



Offline data MUST NOT conflict with system state upon sync (conflict resolution required).



7.5 AI Rendering Rule



AI outputs MUST be displayed as advisory only.



AI insights MUST be clearly marked as recommendations.



No UI element may trigger financial or contractual execution directly.



7.6 Notification Rule



Notifications MUST be triggered by events from all modules.



Priority-based delivery system must respect user preferences.



Critical alerts MUST override user notification preferences.



7.7 Neutrality Rule



MOD-007 MUST NOT:



define business logic



alter system state



compute financial outcomes



override module rules



bypass RBAC constraints



execute backend operations directly



7.8 Localization Rule



All user-facing content MUST support Portuguese and English



Language detection MUST be automatic based on region



Users MUST be able to manually override the detected language



Date, time, and currency formats MUST be locale-aware



The system MUST respect the user's saved language preference across sessions



8\. EVENT MODEL (SPECIFICATION ONLY)



Declared UI-related events:



DashboardLoaded



WidgetRendered



UserInteractionCaptured



FilterApplied



InsightViewed



NavigationChanged



NotificationDelivered



NotificationRead



OfflineDataSynced



Consumed by:



MOD-006 → user behavior analytics



MOD-012 → BI and reporting



MOD-016 → notification triggers



MOD-017 → observability monitoring



MOD-018 → optimization feedback loops



9\. INTEGRATION BOUNDARIES



MOD-007 interacts conceptually with:



MOD-001 → marketplace UI (listings, offers, matching display)



MOD-002 → booking/contract interfaces (contract display, signing)



MOD-003 → tracking dashboards (real-time map, status updates)



MOD-004 → document management UI (upload, download, signature)



MOD-005 → financial dashboards (restricted views only)



MOD-006 → AI intelligence rendering



MOD-010 → RBAC enforcement (UI reflection only)



MOD-011 → API data delivery layer



MOD-016 → notification delivery



MOD-007 does NOT:



store business logic



execute backend operations



control system security rules



directly manipulate module states



enforce security policies (backend responsibility)



10\. ESS DEPENDENCY REFERENCES (CANONICAL)



MOD-007 is constrained by:



ESS-003 → AI behavior constraints (for AI UI outputs)



ESS-006 → compliance \& role visibility rules (CRITICAL)



ESS-007 → UI coding standards



ESS-008 → UI/UX structural rules (PRIMARY UI authority)



ESS-009 → data governance rules



ESS-004 → integration contracts for UI data binding



11\. ARCHITECTURE BOUNDARY RULE



MOD-007 MUST NOT:



implement business logic



enforce security policies



modify system state



interpret AI outputs as executable commands



bypass module boundaries



execute backend operations



MOD-007 IS:



a structured experience and dashboard orchestration layer that presents system state across all NexCargo modules in a role-aware manner



a framework for real-time data display, offline mobile experiences, and AI insight visualization



a notification delivery system for all platform events



12\. OUTPUT EXPECTATION FOR AI BUILDER



When generating implementation from MOD-007, the AI App Builder MUST:



build role-based dashboards strictly from module data contracts:



Shipper Dashboard



Transporter Dashboard



Driver Mobile App Interface (offline-first)



Dispatcher Dashboard



Moderator Dashboard



Admin Dashboard



Super Admin Dashboard



enforce widget-based architecture with defined refresh policies



ensure AI outputs (MOD-006) are non-executable UI elements, clearly labeled as advisory



integrate real-time state from MOD-001 → MOD-018 via event-driven updates



apply ESS-008 UI/UX constraints consistently



implement offline data storage and synchronization for driver mobile interface



implement notification delivery across all channels (push, email, SMS, in-app)



enforce RBAC at UI level (reflecting backend permissions)



include edge-case handling (offline data conflicts, notification delivery failure, stale UI state)



ensure all user actions are auditable and logged



If incomplete:



Output: TODO: requires specification from MOD-007



13\. DESIGN PRINCIPLE



MOD-007 ensures:



all system complexity is translated into structured, role-aware, and AI-augmented dashboards without ever exposing or bypassing system logic



drivers can operate effectively in low-connectivity environments through offline-first design



notifications keep users informed of critical events across all modules



AI insights are presented as advisory guidance, never as autonomous commands



the UI remains a faithful reflection of system state, with security and business logic enforced strictly at the backend level






---


DOCUMENTATION CHANGE HISTORY (role taxonomy reconciliation — NXC-HOA-AUTH-ROLE-001)

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | §5 dashboard taxonomy extended with 5.4 Dispatcher Dashboard and 5.6 Admin Dashboard. Renumbering map for prior citations: 5.4 Moderator → 5.5; 5.5 Super Admin → 5.7; 5.6 Module-Based Views → 5.8; 5.7 Internationalization Model → 5.9. §2, §3.1 and §4.1 role lists extended to the canonical taxonomy; §5.7 business rules state the SUPER_ADMIN permission superset and the Admin/SUPER_ADMIN non-duplication rule; §12 output expectation lists the new dashboards. | PROMPT 0 v1.2 §USER ROLES, §PERMISSION RULES (Admin and SUPER_ADMIN dashboard surfaces); HAO decisions HD-RT-1, HD-RT-2, HD-RT-3 |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | §5.6 and §5.7 citations rebased on PROMPT 0 v1.3 §PERMISSION RULES. §5.7 now records that SUPER_ADMIN additionally holds the five HD-RT-8 executive authority domains and that their dashboard controls are not specified here; §5.6 now records that those domains are SUPER_ADMIN-exclusive and must not be exposed on the Admin surface. No dashboard section was added, removed or renumbered. | HAO decision HD-RT-8 (PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS) |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | §5.5, §5.6 and §5.7 role-boundary wording aligned to the approved financial authority model: the Moderator surface keeps investigation, findings, recommendation and ordinary case handling but gains no financial-outcome resolution, hold-lifting or resume authority; the Admin surface is limited to routine configuration inside already-approved policy and to Tier 1 Escrow Intervention Requests, and MUST NOT expose Tier 2 decisions, exceptional commercial authorisation, or any platform-wide restriction, lockdown or kill-switch; §5.7 is declared the surface on which SUPER_ADMIN commercial authorisation is exercised, which resolves the earlier fee-configuration split between §5.6 and §5.7. No dashboard, route, component, permission or interaction pattern was added, removed or renumbered. | HAO decision D-01 Item 3 (NXC-HOA-AUTH-D01-ITEM-03-001); PROMPT 0 v1.3 §PERMISSION RULES and §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS (Domain 1, 4, 5); ESS-001F §15.2, §15.4, §15.9 |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-2 | §5.6 Admin Dashboard: the SUPER_ADMIN-exclusive control list now describes the excluded role-taxonomy and permission-boundary change as LA-approved, matching PROMPT 0 v1.3 §PERMISSION RULES as transitioned. Not changed: the D-01 Item 3 and HD-RT authority citations in this table and in §5.5 to §5.7, the dashboard section numbering, the Moderator, Admin and SUPER_ADMIN boundaries, and every other control in the list. No authority was created, extended, transferred or weakened. | LA authorisation NXC-HOA-AUTH-D01-ITEM-06-STAGE-2 (2026-11-03); PROMPT 0 v1.3 §11 Designation Successor |

Version metadata of this document is unchanged: this is a documentation-consistency reconciliation of the role taxonomy, not an architectural revision of this layer.

Version effect (2026-11-03 Stage 2 row above): MOD-007's recorded version is unchanged — the designation transition alters no surface, control, permission or boundary. The statement above continues to govern only its own rows.
