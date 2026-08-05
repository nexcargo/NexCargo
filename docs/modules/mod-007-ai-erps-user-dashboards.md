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



role-based dashboards are structured for shippers, transporters, drivers, moderators, and administrators



real-time notifications are delivered across multiple channels



AI insights are visualized and presented as advisory information



This module defines the structural interaction model between users and system intelligence.



It does not define visual design implementation or frontend frameworks.



3\. DOMAIN SCOPE



MOD-007 governs:



3.1 Dashboard Architecture



role-based dashboards (Shipper, Transporter, Driver, Moderator, Super Admin)



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



roleContext – SHIPPER / TRANSPORTER / DRIVER / MODERATOR / ADMIN



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



5.4 Moderator Dashboard



Features:



Review and resolve disputes



Approve or reject identity verifications



Monitor suspicious activity (fraud scoring)



Manage user reports



Oversee transaction holds



Access audit logs



Handle rating disputes



Business rules:



Moderators cannot alter financial ledger directly.



Actions must be logged and auditable.



Fraud alerts are AI-generated (MOD-006).



5.5 Super Admin Dashboard



Features:



Global analytics (GMV, shipments, revenue)



User management (all roles)



System configuration (corridors, pricing rules, fees)



Payment integration monitoring



Escrow bank integration monitoring



AI system oversight



Audit logs access



Feature toggles and system settings



Business rules:



Highest privilege level with strict authentication.



Actions are fully logged.



Financial changes require dual approval.



5.6 Module-Based Views



Each module MAY expose its own UI layer:



MOD-001 → Marketplace UI (listings, offers, matching)



MOD-002 → Booking \& Contract UI



MOD-003 → Tracking UI



MOD-004 → Document Management UI



MOD-005 → Financial UI (restricted)



MOD-006 → Intelligence UI



5.7 Internationalization Model



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



Moderator Dashboard



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

