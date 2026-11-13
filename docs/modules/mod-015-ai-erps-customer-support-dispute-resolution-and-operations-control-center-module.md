MOD-015 — AI ERPS Customer Support, Dispute Resolution \& Operations Control Center Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY

Module ID: MOD-015

Module Name: AI ERPS Customer Support, Dispute Resolution \& Operations Control Center Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE

This module defines the support, dispute handling, and operational control structure of NexCargo.



It governs how:



user support requests, operational incidents, disputes, and escalation workflows are created, tracked, and resolved through structured, auditable processes



multi-channel customer support (in-app chat, email, SMS, call center, API) is structured



disputes are resolved through defined workflows (payment, delivery, damage, delay, contract)



shipment incidents (vehicle breakdown, border delays, cargo damage, route deviation, theft/loss) are tracked



escalation and SLA management is enforced



AI support assistance is integrated (human-in-the-loop)



refund and compensation coordination is structured with financial modules



internal admin investigation tools are defined



resolution analytics and reporting are structured



Critical constraint: This module does NOT decide dispute outcomes, override financial or operational systems, execute corrective actions automatically, or modify shipment or escrow states directly.



This module defines the lifecycle and governance structure of all human intervention workflows.



3\. DOMAIN SCOPE

MOD-015 governs:



3.1 Customer Support Case Management

ticket creation and classification across multiple channels



support lifecycle states (Open → Investigating → Pending → Resolved → Closed)



assignment to support agents, supervisors, or moderators — Support Agent and Supervisor are functional assignments inside an existing canonical platform role with explicitly bounded least-privilege access, not independent RBAC roles (PROMPT 0 v1.3 §USER ROLES — Non-role terminology)



role-aware support (shipper, transporter, driver, enterprise)



3.2 Dispute Resolution Structure

dispute registration model and categorisation (financial / operational / compliance)



dispute types: payment disputes, delivery disputes, damage claims, delay claims, contract disagreements



evidence attachment structure (MOD-004 dependency)



dispute lifecycle: Filed → Evidence Collection → Initial Review → Escalation → Decision Recommendation → Final Resolution → Closure



3.3 Shipment Incident Management

incident monitoring structure and classification



incident types: vehicle breakdown, border delays, cargo damage, route deviation, theft or loss



incident severity classification



linkage to live tracking data (MOD-003)



AI auto-detection of incidents (MOD-006)



3.4 Escalation Framework

escalation triggers and levels (L1 Support Agent → L2 Supervisor → L3 Admin/Moderator) — escalation levels are workflow capacities of canonical roles, not separate roles



SLA timers and breach alerts



handoff rules between roles



3.5 Operational Control Center

operational exception tracking (minor delays, route changes, weather disruptions, border congestion)



exception escalation into disputes



system intervention request framework



3.6 Refund \& Compensation Coordination

financial adjustments with MOD-013 escrow system



refund and compensation policy enforcement



partial refund support



ledger reconciliation



3.7 Internal Admin Investigation Tools

full shipment timeline view



GPS replay (MOD-003 integration)



financial flow inspection (MOD-013)



document verification access (MOD-004)



user behavior analysis (MOD-006 + MOD-012)



3.8 Resolution Analytics \& Reporting

average resolution time, dispute frequency by corridor, SLA compliance rate



compensation volume, incident classification trends



integration with MOD-012 analytics layer



4\. CORE DOMAIN ENTITIES

These are case and resolution structures only.



4.1 Support Ticket Object

Represents a user or system support request.



Required attributes:



ticketId



requesterId



category – SHIPMENT / PAYMENT / ACCOUNT / TECHNICAL / OPERATIONAL



priorityLevel – LOW / MEDIUM / HIGH / CRITICAL



status – OPEN / IN\_PROGRESS / PENDING / RESOLVED / CLOSED



assignedAgentId



channel – IN\_APP / EMAIL / SMS / CALL / API



createdAt



updatedAt



resolvedAt – optional



slaBreach – boolean



Business rules:



All support interactions must be linked to a case ID.



Support must be role-aware (shipper, transporter, driver).



AI may assist but cannot finalize critical decisions.



4.2 Dispute Case Object

Represents a formal dispute record.



Attributes:



disputeId



relatedShipmentId – MOD-003 reference



relatedContractId – MOD-002 reference



relatedEscrowId – MOD-013 reference



disputeType – PAYMENT / DELIVERY / DAMAGE / DELAY / CONTRACT



initiatorId



respondentId



status – SUBMITTED / UNDER\_REVIEW / ESCALATED / RESOLVED / CLOSED



evidenceReferences – array of MOD-004 document references



resolutionOutcome – optional final state



decisionMakerId – reference to the deciding Admin (within delegated authority) or SUPER_ADMIN (where ESS-001F §15.9 Tier 2 applies). Moderator-assigned investigators and reviewers are recorded in the case history and are not the decision maker for a financial outcome (PROMPT 0 v1.3 §PERMISSION RULES; §7.3).



decisionTimestamp – optional



createdAt



updatedAt



resolutionSummary – optional



Business rules:



All disputes must be tied to a shipment or transaction.



Escrow funds (MOD-013) may be frozen during disputes. The freeze is an instruction requested through the governed pathway (MOD-005 §4.4; ESS-001F §15.3, §15.9), not an action performed inside MOD-015, and a freeze requested by a SUPER_ADMIN under PROMPT 0 v1.3 Domain 1 may not be lifted by Admin (ESS-001F §15.2 suspension boundary; §15.4).



Resolution requires audit trail and justification.



A decision with financial impact is approved by Admin within delegated authority, or by SUPER_ADMIN where ESS-001F §15.9 Tier 2 applies (MOD-010 §4.2 enforces the APPROVE action type and names no approver). A Moderator may investigate, examine evidence, record findings, recommend and continue ordinary case handling, and may not approve a financial intervention or exercise authority reserved to Admin or SUPER_ADMIN (PROMPT 0 v1.3 §PERMISSION RULES; ESS-001F §15.6; §7.3; HAO decision D-01 Item 3, direction 3-A).



4.3 Shipment Incident Object

Represents operational incidents affecting shipments.



Attributes:



incidentId



shipmentId – MOD-003 reference



incidentType – VEHICLE\_BREAKDOWN / BORDER\_DELAY / CARGO\_DAMAGE / ROUTE\_DEVIATION / THEFT\_LOSS / WEATHER / CONGESTION



severityLevel – MINOR / MODERATE / MAJOR / CRITICAL



detectionSource – MOD\_017 / MOD\_006 / USER\_REPORT / MANUAL



status – DETECTED / UNDER\_INVESTIGATION / CONTAINED / RESOLVED



affectedModules – array of module references



resolutionTrackingId – optional



disputeId – optional (if escalated to dispute)



detectedAt



resolvedAt – optional



description



Business rules:



Incidents must be linked to live tracking data (MOD-003).



AI may detect incidents automatically (MOD-006).



Incident severity classification is required.



4.4 Escalation Object

Represents structured escalation flow.



Attributes:



escalationId



sourceCaseId – ticket, dispute, or incident reference



escalationLevel – L1\_SUPPORT / L2\_SUPERVISOR / L3\_ADMIN\_MODERATOR



assignedRole



assignedUserId



reason



timestamp



status – ACTIVE / COMPLETED / OVERRIDDEN



slaTimerStartedAt



slaTimerExpiredAt – optional



Business rules:



SLA timers start upon case creation.



Escalation levels: Level 1 (Support Agent) → Level 2 (Supervisor) → Level 3 (Admin/Moderator). Each level is exercised by a user holding a canonical role; the level label does not grant permissions by itself, and the acting user's RBAC role is recorded for audit.



SLA breaches must trigger alerts.



4.5 Operational Exception Object

Represents operational disruptions that are not formal disputes.



Attributes:



exceptionId



shipmentId – MOD-003 reference



exceptionType – MINOR\_DELAY / ROUTE\_CHANGE / WEATHER / CONGESTION



detectedAt



detectionSource – MOD\_006 / MOD\_017 / USER



status – ACTIVE / RESOLVED / ESCALATED



description



escalatedToDisputeId – optional



Business rules:



Exceptions may escalate into disputes.



AI may auto-detect exceptions from tracking data.



Exceptions do not automatically trigger financial holds.



4.6 Refund Coordination Object

Represents financial adjustment coordination with MOD-013.



Attributes:



refundCoordinationId



disputeId – reference



shipmentId – reference



refundType – FULL / PARTIAL / COMPENSATION



amount



currency



recipientId



approvalStatus – PENDING / APPROVED / REJECTED / EXECUTED



approvedBy – reference to the approving Admin (within delegated authority) or SUPER_ADMIN (where ESS-001F §15.9 Tier 2 applies). A Moderator is not an approver of a refund or compensation (PROMPT 0 v1.3 §PERMISSION RULES; ESS-001F §15.6; §7.3).



escrowReleaseReference – MOD-013 reference



executedAt – optional



notes



Business rules:



Refunds require dispute resolution approval.



Compensation must follow predefined policy rules. The policy is financial and commercial configuration, not a MOD-015 setting: routine compensation parameters are maintained under Admin routine configuration (ESS-001F §15.1, §15.2), and any concession outside approved policy is SUPER_ADMIN commercial authorisation (PROMPT 0 v1.3 Domain 5). MOD-015 defines no policy setter of its own and creates no compensation instrument (HAO decision D-01 Item 3, direction 3-C).



Partial refunds are supported.



All transactions must be reconciled with ledger.



4.7 AI Support Interaction Object

Represents AI-assisted support interactions.



Attributes:



interactionId



caseId – reference to ticket or dispute



aiSuggestion – structured recommendation



confidenceScore



suggestionType – CLASSIFICATION / RESOLUTION\_PROPOSAL / ESCALATION\_RECOMMENDATION / EVIDENCE\_SUGGESTION



humanApprovalStatus – PENDING / APPROVED / REJECTED



approvedBy – optional



timestamp



Business rules:



AI provides recommendations only.



No final resolution without human approval for financial or legal cases.



AI must use only verified platform data.



AI hallucination prevention is enforced (MOD-010).



4.8 Investigation Record

Represents internal admin investigation structure.



Attributes:



investigationId



caseId – reference



investigatorId



shipmentTimelineView – structured timeline snapshot



gpsReplayReference – MOD-003 reference



financialFlowInspection – structured MOD-013 data



documentVerificationAccess – MOD-004 references



userBehaviorAnalysis – MOD-006 + MOD-012 references



notes



startedAt



completedAt – optional



findings



Business rules:



Access is restricted to authorized roles only.



All investigations are logged.



No modification of historical records is permitted.



4.9 Resolution Analytics Record

Represents support and dispute operational metrics.



Attributes:



analyticsId



periodStart



periodEnd



averageResolutionTime – hours



disputeFrequencyByCorridor – structured JSON



slaComplianceRate – percentage



compensationVolume – total amount



incidentClassificationTrends – structured JSON



generatedAt



Business rules:



Data is sourced from MOD-012 analytics layer.



Used to improve platform reliability and AI models.



5\. SUPPORT \& DISPUTE LIFECYCLE MODEL

5.1 Support Lifecycle

text

Ticket Created (via any channel)

&#x20;      ↓

Categorization (category, priority, role)

&#x20;      ↓

Assignment (support agent)

&#x20;      ↓

Investigation (evidence collection, analysis)

&#x20;      ↓

Resolution Proposed

&#x20;      ↓

User Confirmation

&#x20;      ↓

Closure

5.2 Dispute Lifecycle

text

Dispute Filed

&#x20;      ↓

Evidence Collection (MOD-004)

&#x20;      ↓

Initial Review (moderator)

&#x20;      ↓

Escalation (if required) → L1 → L2 → L3

&#x20;      ↓

Decision Recommendation

&#x20;      ↓

Formal Escrow Intervention (exception step — only where a governed Escrow Intervention Request applies under ESS-001F §15.6; otherwise this step does not occur)

&#x20;      ↓

External Validation (if financial, MOD-013)

&#x20;      ↓

Final Resolution (decided by Admin within delegated authority, or by SUPER_ADMIN where ESS-001F §15.9 Tier 2 applies — §4.2, §7.3)

&#x20;      ↓

Closure

Escrow intervention step (HAO decision D-01 Item 5, authorisation NXC-HOA-AUTH-D01-ITEM-05-001):

A formal Escrow Intervention Request enters the flow above only where one of the six closed eligibility triggers recorded in ESS-001F §15.6 applies, and only when initiated by an authenticated human Admin acting within delegated authority or by a human SUPER_ADMIN. The initiating actor records the applicable trigger, the supporting evidence, the reasons, the scope and the intended action as ESS-001F §15.6 requires. Dissatisfaction with an outcome is not a trigger and does not open this step.

The request is a separate governed record defined in ESS-001F §15.7 whose status follows the lifecycle in ESS-001F §15.8. Review and decision proceed as follows: the assigned reviewer and the decision-maker are each an actor other than the initiator (ESS-001F §15.9 independence rule); a Tier 1 request is decided inside the governed escrow intervention authority by an authorised Admin or SUPER_ADMIN; a Tier 2 request is decided only by an authenticated human SUPER_ADMIN and is not available to Admin (ESS-001F §15.2, §15.9; PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 1).

Separations remain intact at this step. A Moderator investigates, examines evidence and recommends, and may not initiate, review for decision or decide an intervention (ESS-001F §15.6; §7.3). A decision on a request is not approval of the underlying financial instrument: instrument approval remains with its own authority (MOD-005 §4.3, §4.4; MOD-013 §4.3). Execution remains outside NexCargo entirely — only the bank or authorised payment provider executes, and only a bank confirmation changes a financial state (ESS-001F §2.1, §2.2, §15.3, §15.5; MOD-013 §7.1, §7.2).

Events: escrowInterventionRequested is emitted when the request is raised, and escrowInterventionDecided when the ESS-001F §15.9 decision is recorded (Event Registry §13, owner MOD-005; Event Registry §17 Escrow Intervention Request Events). Neither event authorises, executes or confirms a bank or payment-provider transaction, and neither is an ordinary dispute-status transition.

Evidence references, reviewer assignment, decision attribution and the implementation outcome remain appended to the case history (§4.2) and to the audit trail (MOD-010 §4.5; ESS-006; ESS-001F §15.10). The ordinary lifecycle above is unchanged: this step is an exception pathway reached only through a governed request, it is never automatic approval of a financial action, and no request state alters escrow, dispute, settlement or ledger state outside the bank-confirmed pathway (ESS-001F §15.8; §7.9 records that the intervention exercises no authority inside this module).

5.3 Incident Lifecycle

text

Detection (MOD-006 / MOD-017 / user)

&#x20;      ↓

Classification (type, severity)

&#x20;      ↓

Impact Assessment

&#x20;      ↓

Containment

&#x20;      ↓

Resolution

&#x20;      ↓

Post-Incident Review

5.4 Support State Machine

text

ISSUE DETECTED

&#x20;      ↓

CASE CREATED

&#x20;      ↓

TRIAGE (category, priority, assignment)

&#x20;      ↓

INVESTIGATION

&#x20;      ↓

RESOLUTION PROPOSED

&#x20;      ↓

APPROVAL (if required)

&#x20;      ↓

CLOSED

&#x20;      ↓

ANALYTICS UPDATE

6\. RESPONSIBILITIES

MOD-015 is responsible for:



6.1 Case Structuring

defining all support and dispute data structures



ensuring lifecycle consistency



supporting multi-channel case creation



6.2 Workflow Governance

defining case progression rules



ensuring traceability of actions



enforcing SLA management



6.3 Escalation Modelling

defining escalation hierarchy structure (L1 → L2 → L3)



ensuring proper role transitions



defining SLA breach alerts



6.4 Incident Structuring

defining shipment incident types and severity levels



enabling AI auto-detection integration



structuring incident-to-dispute escalation



6.5 Refund \& Compensation Structuring

defining refund coordination structures



ensuring integration with MOD-013 escrow system



enforcing policy-based compensation



6.6 Investigation Structuring

defining admin investigation tools



enabling full shipment timeline and GPS replay



supporting financial flow inspection



6.7 Operational Visibility

structuring incident tracking model



enabling system-wide observability inputs (MOD-017)



structuring exception tracking



6.8 Analytics Structuring

defining resolution analytics structures



integrating with MOD-012 analytics layer



enabling continuous improvement



7\. RULES OF OPERATION

7.1 No Decision Authority Rule (CRITICAL)

MOD-015 MUST NOT:



decide dispute outcomes



override financial results (MOD-013 / ESS-001F)



modify shipment states directly



alter escrow or ledger data



execute compensations automatically



It only structures the process.



7.2 Evidence-Based Structure Rule

All disputes MUST reference evidence (MOD-004 dependency).



No dispute can exist without linked data references.



Evidence must be attached before resolution.



7.3 Separation of Authority Rule

Moderators investigate and recommend.



Admins oversee system configuration and ordinary financial workflow approvals within delegated authority (ESS-001F §15.1, §15.2); exceptional, high-impact and expressly reserved matters are decided by SUPER_ADMIN (PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS; ESS-001F §15.9 Tier 2).



Financial outcomes are resolved via MOD-013 + ESS-001F by the Admin or SUPER_ADMIN decision maker, never by a Moderator decision (§4.2, §4.6).



AI only assists, never decides.



7.4 Auditability Rule

Every action MUST be logged.



Every escalation MUST preserve history.



No case state can be overwritten without trace.



Full history must be retained.



7.5 Non-Automation Rule

MOD-015 does NOT auto-resolve disputes.



MOD-015 does NOT execute compensations.



MOD-015 does NOT modify system state directly.



7.6 SLA Rule

SLA timers start upon case creation.



SLA breaches must trigger alerts.



Escalation levels are defined (L1 → L2 → L3).



7.7 AI Assistance Rule

AI provides recommendations only.



No final resolution without human approval for financial or legal cases.



AI must use only verified platform data.



7.8 Neutrality Rule

MOD-015 MUST NOT:



determine dispute outcomes



override financial settlement decisions



modify shipment or escrow state directly



bypass escalation hierarchy



execute system corrections



7.9 Escrow Intervention Eligibility Reference

The closed list of circumstances in which a human Admin or SUPER_ADMIN may initiate an escrow-related intervention is defined once, authoritatively, in ESS-001F §15.6 (HAO decisions D-01 and D-01 Item 1). MOD-015 adds no trigger, and the support layer gains no authority from this rule.



Eligibility to initiate an intervention is distinct from the dispute lifecycle in §5.2, from the escalation framework in §3.4, and from financial execution authority. A dispute being filed, escalated or recorded is not itself a trigger, and dissatisfaction with a resolution outcome is not a trigger.



Intervention exercises no authority inside MOD-015. It cannot reverse, bypass or rewrite a dispute state, the decision vocabulary, or the case history required by §7.4, and it does not change the rule that MOD-015 structures the process without deciding outcomes (§7.1).



The Escrow Intervention Request logical object, its lifecycle and its decision tiers are defined once, authoritatively, in ESS-001F §15.7 to §15.10 (HAO decision D-01 Item 2). An EIR is not a MOD-015 case type and adds no case, status, escalation level or outcome vocabulary to this module. Where an EIR references a dispute, that reference is optional and the EIR neither replaces nor re-opens the case. The §3.4 escalation framework, the §4.4 escalation object and the §5.2 dispute lifecycle are unchanged, and §7.1 No Decision Authority continues to apply to everything in this module. The EIR’s use of the §4.2 status names is vocabulary reuse only: an EIR status is not a case status, and a request recorded as RESOLVED does not resolve, re-open or imply approval of the linked dispute (NXC-HOA-AUTH-D01-ITEM-02-R1).



8\. EVENT MODEL (SPECIFICATION ONLY)

Declared support and dispute events:



SupportTicketCreated



TicketAssigned



TicketUpdated



TicketResolved



TicketClosed



DisputeFiled



EvidenceSubmitted



DisputeEscalated



DisputeResolved



DisputeClosed



IncidentDetected



IncidentClassified



IncidentResolved



ExceptionDetected



ExceptionEscalated



SlaBreachDetected



RefundCoordinationInitiated



RefundCoordinationExecuted



AISupportSuggestionGenerated



AISupportSuggestionApproved



AISupportSuggestionRejected



InvestigationInitiated



InvestigationCompleted



CaseClosed



ResolutionAnalyticsUpdated



Consumed by:



MOD-003 → shipment context resolution



MOD-004 → evidence/document attachment



MOD-005 → payment abstraction



MOD-006 → anomaly detection + insights



MOD-010 → compliance enforcement



MOD-012 → operational analytics



MOD-013 → financial dispute correlation and refund execution



MOD-017 → monitoring and alerts



9\. INTEGRATION BOUNDARIES

MOD-015 interacts conceptually with:



MOD-001 → marketplace context for disputes



MOD-002 → contract-level disputes



MOD-003 → shipment lifecycle disputes and incident tracking



MOD-004 → document/evidence storage



MOD-005 → payment abstraction



MOD-006 → anomaly detection support and AI assistance



MOD-007 → support dashboard UI



MOD-008 → mobile incident reporting



MOD-009 → border incident handling



MOD-010 → compliance escalation rules and audit



MOD-011 → enterprise support API access



MOD-012 → support analytics and reporting



MOD-013 → financial dispute structure linkage and refund coordination



MOD-014 → vehicle incident context



MOD-017 → incident detection and observability



MOD-015 does NOT:



resolve disputes autonomously



execute financial refunds



override operational modules



bypass ESS governance rules



modify shipment or escrow states directly



10\. ESS DEPENDENCY REFERENCES (CANONICAL)

MOD-015 is constrained by:



ESS-006 → Compliance \& Audit Specification (primary authority)



ESS-004 → Integration Contracts Specification



ESS-003 → AI Behaviour Constraints (no decision-making authority)



ESS-001E → Error Code Standardisation



ESS-001C → Retry \& workflow resilience rules



ESS-007 → Coding Standards Specification



ESS-009 → Data Governance Specification



11\. ARCHITECTURE BOUNDARY RULE

MOD-015 MUST NOT:



determine dispute outcomes



override financial settlement decisions



modify shipment or escrow state directly



bypass escalation hierarchy



execute system corrections



auto-resolve disputes or execute compensations



MOD-015 IS:



a deterministic workflow and case management system that structures how disputes, support tickets, and operational incidents are tracked, escalated, and resolved through governed human and system processes



a framework for multi-channel customer support, incident management, and SLA enforcement



a coordination layer for refunds and compensation with financial modules



an investigation and analytics foundation for operational improvement



12\. OUTPUT EXPECTATION FOR AI BUILDER

When generating implementation from MOD-015, the AI App Builder MUST:



implement ticketing + dispute lifecycle systems with all defined states and transitions



enforce strict escalation hierarchy rules (L1 → L2 → L3) with SLA timers



ensure full audit trail for all case transitions (immutable history)



integrate evidence management (MOD-004) for all disputes



link financial disputes to MOD-013 without execution authority



implement incident management system with severity classification



implement exception tracking with escalation to disputes



implement AI support assistance (human-in-the-loop) – recommendations only, no final decisions



implement refund and compensation coordination with MOD-013



implement internal admin investigation tools (shipment timeline, GPS replay, financial inspection)



implement resolution analytics and reporting (integration with MOD-012)



ensure no automatic resolution logic exists



include edge-case handling (SLA breach, evidence missing, escalation timeout, refund failure)



ensure all actions are logged and auditable



ensure no modification of historical records



If incomplete:



Output: TODO: requires specification from MOD-015



13\. DESIGN PRINCIPLE

MOD-015 ensures:



NexCargo has a fully traceable, auditable, and structured human intervention system without granting decision-making authority to the support layer itself



disputes are resolved through defined, evidence-based workflows



incidents are detected, classified, and resolved with appropriate severity



SLA enforcement ensures timely resolution



AI assists without replacing human judgment



refunds and compensation are coordinated with financial systems



operational exceptions are tracked and can escalate appropriately



the platform continuously improves through resolution analytics








---


DOCUMENTATION CHANGE HISTORY (role taxonomy reconciliation — NXC-HOA-AUTH-ROLE-001)

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | Support Agent and Supervisor documented as functional assignments inside canonical roles rather than platform roles; escalation level semantics clarified. L1/L2/L3 enumeration values unchanged. | PROMPT 0 v1.2 §USER ROLES — Non-role terminology; HAO decision HD-RT-4 |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | Version-pointer maintenance only: the Support Agent / Supervisor non-role statement now cites PROMPT 0 v1.3 §USER ROLES. The SUPER_ADMIN dispute-override authority approved under HD-RT-8 is recorded at master-specification level only; no escalation path, queue, permission or case-handling rule in this module was created or changed by it, and that elaboration remains subject to separate authorisation. | HAO decision HD-RT-8 (PROMPT 0 v1.3) |
| 2026-11-02 | NXC-HOA-AUTH-D01-001 | §7.9 added as a cross-reference to the closed escrow-intervention eligibility trigger list, which is defined once, authoritatively, in ESS-001F §15.6 under HAO decision D-01. No trigger, escalation level, lifecycle state, decision vocabulary, permission or authority boundary in this module was created, renamed or altered; the No Decision Authority rule (§7.1) is unchanged. | HAO decision D-01 (NXC-HOA-AUTH-D01-001); PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 1 |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | §4.2, §4.6, §5.2 and §7.3 financial-decision wording aligned to the approved authority model: a decision with financial impact is taken by Admin within delegated authority or by SUPER_ADMIN where ESS-001F §15.9 Tier 2 applies, a Moderator investigates, records findings and recommends, and an escrow freeze follows the governed pathway and may not be lifted by Admin where SUPER_ADMIN requested it. Compensation policy distinguishes Admin routine configuration from SUPER_ADMIN commercial authorisation. No field, escalation level, lifecycle state, queue or action type was added, renamed or removed. | HAO decision D-01 Item 3 (NXC-HOA-AUTH-D01-ITEM-03-001); PROMPT 0 v1.3 §USER ROLES — RBAC Model and §PERMISSION RULES; ESS-001F §15.1 to §15.5 |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-05-001 | §5.2 gained a formal Escrow Intervention Request exception step between Decision Recommendation and External Validation, together with the notes governing it: initiation only where one of the six closed ESS-001F §15.6 eligibility triggers applies, by an authenticated human Admin acting within delegated authority or by a human SUPER_ADMIN; reviewer and decision-maker each other than the initiator, Tier 1 decided inside the governed escrow intervention authority and Tier 2 reserved to SUPER_ADMIN; Moderator confined to investigation, evidence examination and recommendation, with instrument approval and external execution remaining separate; emission of escrowInterventionRequested and escrowInterventionDecided and their non-financial effect recorded; evidence, assignment, attribution and outcome kept appended to case history and audit trail. The ordinary dispute lifecycle sequence, escalation levels, queues, permissions, §4.2 case handling and the §7.9 No Decision Authority rule are unchanged, and no state, field, queue or authority was created. | HAO decision D-01 Item 5 (NXC-HOA-AUTH-D01-ITEM-05-001); ESS-001F §15.6 to §15.10; Event Registry §13 and §17 |

Version metadata of this document is unchanged: this is a documentation-consistency reconciliation of the role taxonomy, not an architectural revision of this layer.

Version effect (2026-11-03 row above): MOD-015 remains v1.0 — no version increase, no loader change, no INDEX §7.1 change. The step added under NXC-HOA-AUTH-D01-ITEM-05-001 documents an exception pathway whose eligibility triggers, authority tiers, record and lifecycle are defined in ESS-001F §15.6 to §15.10; this module's ownership of dispute and case records and its No Decision Authority rule are unchanged. The statement immediately above remains the version record for the rows it was written for.
