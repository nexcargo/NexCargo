**ESS-001F — APPENDIX F - Financial Integration Architecture**

**Document ID:** ESS-001F
**Parent Spec:** ESS-001 — External Integrations Specification
**System:** NexCargo
**Version:** 1.0
**Status:** Authoritative Source of Truth
**Classification:** CRITICAL SYSTEM COMPONENT



1. PURPOSE

This appendix defines the **end-to-end financial architecture** for NexCargo, covering:

- escrow orchestration (via regulated banks)

- mobile money integration

- card payments (Visa/Mastercard)

- PayPal constraints

- settlement workflows

- reconciliation systems

- ledger synchronization

It ensures:

- NexCargo NEVER holds funds

- all financial flows are auditable

- all transactions are bank-validated

- AI cannot execute financial actions

2. CORE FINANCIAL PRINCIPLES

2.1 No Custody Principle (CRITICAL)

NexCargo:

- DOES NOT hold customer funds

- DOES NOT act as a financial institution

- DOES NOT store escrow balances directly

All funds are held by:

regulated banking partners only

2.2 Bank-of-Record Principle

All escrow funds MUST exist in:

- external regulated bank ledger

- mirrored internal ledger (read-only synchronization)

2.3 Event-Driven Money Movement

All financial actions MUST be triggered via:

- domain events

- not direct function calls

Example:

ShipmentDelivered

→ triggers SettlementRequested

→ bank API executes release

→ webhook confirms settlement

2.4 Dual-Ledger Principle

NexCargo maintains:

External Ledger (Source of Truth)

- Bank ledger (primary)

- Mobile money provider ledger

Internal Ledger (Replica)

- Read-only reconciliation model

- Used for analytics and audits

3. FINANCIAL ARCHITECTURE OVERVIEW

Shipper Wallet Funding

↓

Payment Gateway Layer

↓

Escrow Bank (REGULATED)

↓

Internal Ledger Sync

↓

Event System (MOD-005)

↓

Settlement Engine

↓

Transporter Payout


4. PAYMENT CHANNELS


4.1 Mobile Money (M-Pesa, mKesh, e-Mola)

|---------------|-------------------------------|
| Attribute 	| Specification 		|
|---------------|-------------------------------|
| Role 		| Funding + payout channel 	|
| Region 	| Mozambique + SADC 		|
| Ownership 	| External provider		|
| Criticality 	| CRITICAL 			|
|---------------|-------------------------------|

Rules:

- Used for deposits and payouts

- Must route through aggregator layer

- Must support callback confirmation

- Must reconcile with bank escrow system

4.2 Card Payments (Visa / Mastercard)

|---------------|-------------------------------|
| Role 		| Funding channel 		|
|---------------|-------------------------------|
| Criticality	| HIGH 				|
|---------------|-------------------------------|

Rules:

- Used for shipper deposits only

- Must route into escrow bank account

- No direct payout capability

4.3 PayPal

|---------------|-------------------------------|
| Role 		| Incoming deposits only 	|
|---------------|-------------------------------|
| Restriction 	| NO outbound payouts 		|
|---------------|-------------------------------|

Rules:

- Allowed only for funding escrow

- Must be converted into bank-held escrow immediately

4.4 Bank Transfers

|---------------|---------------------------------------|
| Role 		| Primary escrow settlement layer 	|
|---------------|---------------------------------------|
| Criticality 	| CRITICAL 				|
|---------------|---------------------------------------|

Rules:

- Direct integration with regulated banking partner

- All escrow funds originate or settle here

- Final source of truth for balances

5. ESCROW ARCHITECTURE

5.1 Escrow Lifecycle

1. ShipmentCreated

2. ShipperFundsEscrow

3. BankLocksFunds

4. ShipmentInTransit

5. DeliveryConfirmed

6. SettlementTriggered

7. BankReleasesFunds

8. TransporterPaid

5.2 Escrow Rules

- Funds are locked BEFORE shipment execution

- Partial releases allowed ONLY at milestones

- Final release occurs after POD confirmation

- Automatic release after timeout requires risk checks

5.3 Escrow Ownership

|-------------------------------|-------------------------------|
| Entity 			| Ownership			|
|-------------------------------|-------------------------------|
| Funds 			| Bank 				|
| State 			| NexCargo (logical only) 	|
| Escrow Initiation & Release 	| MOD-005 			|
| Settlement & Reconciliation 	| MOD-013 			|
|-------------------------------|-------------------------------|

6. SETTLEMENT ENGINE

6.1 Responsibilities

- Trigger payout requests

- Validate delivery completion

- Ensure compliance checks

- Coordinate bank release

**6.2 Settlement Types**

|-----------------------|-----------------------------------------------|
| Type 			| Description 					|
|-----------------------|-----------------------------------------------|
| Full Settlement 	| After delivery confirmation 			|
| Milestone Settlement 	| Partial release (pickup, border, delivery) 	|
| Refund Settlement 	| Failed shipment reversal 			|
|-----------------------|-----------------------------------------------|

6.3 Settlement Rules

- NEVER execute without bank confirmation

- NEVER bypass escrow state

- MUST be idempotent

- MUST be audit logged

- Refer to ESS-001C for retry policies

7. LEDGER SYSTEM

7.1 Internal Ledger (READ-ONLY MIRROR)

- Derived from bank transactions

- Used for:

 - analytics

 - reporting

 - fraud detection

 - reconciliation

7.2 Ledger Structure

```json

{
 "ledgerId": "string",
 "transactionId": "string",
 "type": "DEBIT" | "CREDIT",
 "amount": "number",
 "currency": "string",
 "source": "string",
 "destination": "string",
 "timestamp": "string",
 "correlationId": "string"
}

7.3 Immutability Rule

Ledger entries are NEVER modified

Only appended or corrected via adjustment entry

Ledger immutability is governed by ESS-009 (Data Governance).

8. RECONCILIATION ENGINE

8.1 Purpose

Ensures internal ledger matches:

bank records

mobile money records

card processor records

8.2 Reconciliation Process

daily batch reconciliation

real-time critical transaction matching

discrepancy detection alerts

8.3 Discrepancy Handling

If mismatch occurs:

flag anomaly

freeze settlement flow (automated protective reaction; resumption is a separate permission under the §15.2 suspension boundary, and the freeze confers no authority on any actor)

escalate to MOD-005 and to the governed financial review pathway — Admin within delegated authority, or SUPER_ADMIN where §15.9 classifies the matter Tier 2. A Moderator may investigate and recommend only (§15.6)

9. FRAUD PREVENTION RULES

System MUST detect:

duplicate payments

replayed settlement requests

abnormal payout patterns

mismatched escrow states

Fraud detection assistance is provided by MOD-006 (AI Intelligence Platform) with advisory outputs only.

10. AI FINANCIAL RESTRICTIONS (CRITICAL)

AI MUST:

NEVER execute payments

NEVER approve settlements

NEVER modify ledger entries

NEVER simulate financial success

NEVER override bank responses

AI CAN:

detect fraud patterns (advisory)

suggest pricing optimization (advisory)

predict cash flow issues (advisory)

Refer to ESS-003 (AI Behavior Constraints) for additional restrictions.

11. FAILURE MODES

11.1 Bank API Failure

→ pause settlements

→ retry via ESS-001C rules

→ enter "Payment Hold Mode" (a financial-flow control under ESS-001C §9.2; distinct from Safe Mode under ESS-005 §5 and from platform lockdown under PROMPT 0 v1.3 Domain 4. An automated failure-mode reaction is not a grant of human authority to resume — §15.2 suspension boundary)

11.2 Mobile Money Failure

→ fallback to bank transfer

→ queue payout retry

11.3 Ledger Mismatch

→ freeze financial operations

→ trigger reconciliation engine

→ require Admin review (review and configuration remediation only; review confers no authority to lift the freeze, to alter bank or provider state (§15.4), or to decide a matter reserved to SUPER_ADMIN under §15.9 Tier 2)

12. SECURITY REQUIREMENTS

mTLS required for bank communication

encryption for all financial payloads

strict RBAC for financial endpoints

full audit logging mandatory

no client-side financial logic allowed

Security requirements are governed by ESS-006 (Security & Compliance).

13. AUDIT REQUIREMENTS

Every financial event MUST include:

correlationId

ledger reference

bank transaction ID

escrow state

user role

timestamp

module origin

Audit requirements are governed by ESS-009 (Data Governance).

14. EVENT INTEGRATION

Financial system MUST emit:

EscrowCreated

FundsLocked

SettlementInitiated

SettlementCompleted

PaymentFailed

ReconciliationMismatchDetected

Events are managed by the event-driven foundation defined in Prompt 2.

15. ADMIN FINANCIAL OVERSIGHT & CONTROL LAYER

15.1 Principle

The Admin (Platform Owner) holds delegated platform financial authority as defined in PROMPT 0 v1.3 §PERMISSION RULES. Admin authority is ordinary and conditional: it is exercised inside the approvals, limits and instruments the LA has already approved, and it never becomes execution authority. The hierarchy confers nothing (PROMPT 0 v1.3 §Administrative hierarchy).

Three activities are distinct and MUST NOT be conflated (HAO decision D-01 Item 3, direction 3-C):

routine configuration — maintaining financial and commercial parameters already inside approved policy and existing limits. This is Admin's ordinary remit (§15.2).

commercial authorisation — approving exceptional commercial arrangements and financial concessions outside already-approved policy: exceptional negotiated platform-fee arrangements, fee changes outside approved policy, exceptional waivers, credits or concessions, and other exceptional commercial financial arrangements not already covered by delegated Admin authority. This is SUPER_ADMIN authority under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 5, and Domain 1 where the concession is an exceptional financial adjustment.

financial execution — movement of money. Neither Admin nor SUPER_ADMIN may execute a bank or payment-provider transaction or take custody of customer funds; the bank or authorised payment provider remains the sole external funds execution authority (§2.1, §2.2; MOD-013 §7.1, §7.2).

All Admin financial actions MUST pass through ESS validation and remain audit-bound. No Admin action creates a financial instrument, a financial outcome, an exception, a threshold or a funding mechanism.

15.2 Allowed Admin Financial Actions

Admin MAY, within delegated authority and only where the action stays inside already-approved policy, existing limits and expressly authorised instruments (HAO decision D-01 Item 3, directions 3-A and 3-C):

configure platform fee percentages — routine configuration of an already-approved fee model. A change of fee policy itself is commercial authorisation and is SUPER_ADMIN authority (§15.1; PROMPT 0 v1.3 Domain 5)

configure commission structures — routine configuration of an already-approved commission model, on the same boundary

configure settlement timing rules within the limits set by approved policy. No numeric settlement limit or permitted range is specified in the current specifications, and none may be inferred from this line

approve ordinary financial workflow steps — approvals inside the existing governed pathway and the existing instrument vocabulary, such as ordinary settlement and refund approval recorded in MOD-013 §4.3 and §4.6 and MOD-015 §4.6, subject to the approver rules stated there

trigger Escrow Intervention Requests (eligibility governed by §15.6)

decide a Tier 1 Escrow Intervention Request under §15.9, with the independence requirements of §15.9 unchanged

pause or resume a transaction-specific workflow only where a specification expressly authorises that action, subject to the suspension boundary below

maintain operational parameters that are neither ledger state nor approved commercial policy (NOT ledger state)

Exceptional matters are not Admin authority. Where a proposed action requires a power reserved under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS — that is, where §15.9 classifies the request as Tier 2 — the decision is made by an authenticated human SUPER_ADMIN. Admin may investigate, record findings, recommend and, within §15.6, initiate; Admin MUST NOT decide it. The Admin surface MUST NOT expose that decision (MOD-007 §5.6).

Suspension boundary (HAO decision D-01 Item 3, direction 3-B). The following constructs are distinct and are not interchangeable: transaction-specific financial or escrow intervention (§15.9; MOD-005 §4.1, §4.4); Payment Hold Mode and other financial-flow controls (§11.1; ESS-001C §9.2); Safe Mode (ESS-005 §5); and platform-wide lockdown, emergency maintenance and executive kill-switches (PROMPT 0 v1.3 Domain 4). No "system-wide hold mode" state model, identifier, event or audit structure is defined by this document, and this line confers none. Pause and resume are separate permissions: authority to pause does not imply authority to resume. Admin may not independently impose or reverse a platform-wide executive restriction, and may not resume, disable or bypass a restriction imposed by SUPER_ADMIN. Automated protective reactions (§8.3, §11.1, §11.3; MOD-013 §4.3) confer no human authority to resume. A platform-side pause must not silently cancel, alter or reverse an instruction already received by a bank or payment provider (§15.4; MOD-013 §5.4).

Configuration changes have no silent retroactive effect (direction 3-C). A configuration change must not alter signed contracts (MOD-002 §4.2 business rules; PROMPT 0 v1.3 §MODULE-SPECIFIC CONSTRAINTS — IMMUTABLE, Contract Immutability row), existing bookings, in-flight settlements, queued or submitted bank or payment-provider instructions, or historical ledger entries and transaction records (§7.3; §15.4). Where a legally or contractually necessary correction is required, it follows the correction procedure already authorised — adjustment entry through the reconciliation pathway (§7.3, §8) — preserves the original history and records the adjustment transparently. This section creates no new correction or adjustment instrument.

15.3 Escrow Intervention Model

Admin CANNOT directly release or retain funds.

Instead, Admin MUST issue an Escrow Intervention Request which triggers:

ESS validation of the request's legitimacy under §15.6 and §15.9

Arbitration Layer conflict resolution

Compliance verification

Transmission of the approved instruction to the bank or authorised payment provider through the approved integration pathway (MOD-011; §16 matrix), the bank or payment provider performing the funds movement (MOD-013 §7.1, §7.2)

Full audit logging

Approval is not execution, and the two distinctions in 3-A hold: approval of an Escrow Intervention Request is not automatically approval of the underlying financial instrument — the instrument is produced afterwards under the existing MOD-005 and MOD-013 rules and carries its own approval record (§15.7); and approval of an internal action is never execution of a bank transaction (§2.2, §15.5).

Eligibility to initiate an escrow-related intervention is governed by §15.6 (HAO decision D-01). This section defines the request pathway, not the circumstances in which a request may be initiated.

The request itself is the logical object defined in §15.7, with its lifecycle in §15.8, its decision authority in §15.9 and its history in §15.10 (HAO decision D-01 Item 2). Those sections define architecture and authority boundaries only; they add no step to the pathway above and create no implementation structure.

15.4 Forbidden Admin Actions

Admin MUST NOT:

directly modify ledger entries

directly mutate escrow state in bank system

bypass settlement engine

override bank confirmations

alter historical financial records

impose or reverse a platform-wide executive restriction, or resume, disable or bypass a restriction imposed by SUPER_ADMIN (§15.2 suspension boundary; PROMPT 0 v1.3 Domain 4)

decide a Tier 2 matter reserved to SUPER_ADMIN under §15.9, or approve an exceptional commercial arrangement outside approved policy (§15.1; PROMPT 0 v1.3 Domain 1 and Domain 5)

use a configuration change to alter a signed contract, an existing booking, an in-flight settlement, or a queued or submitted bank or payment-provider instruction (§15.2 retroactivity rule)

cancel, alter or reverse an instruction already received by a bank or payment provider by means of a pause (§15.2; MOD-013 §5.4)

15.5 Financial Safety Principle

Even Admin actions are:

advisory triggers into governed execution pipelines, NOT direct execution authority

15.6 Escrow Intervention Eligibility — Closed Trigger List (HAO decision D-01)

Authoritative under HAO authorization NXC-HOA-AUTH-D01-001, decision D-01 (approved 2026-11-02), extended to both governance roles by decision D-01 Item 1 (NXC-HOA-AUTH-D01-ITEM-01, approved 2026-11-02). This section is the single definition of escrow intervention eligibility triggers. ESS-001F §15.2 and §15.3, MOD-005, MOD-013 and MOD-015 refer here and add no trigger of their own. The triggers apply equally to an Escrow Intervention Request initiated by an Admin and one initiated by a SUPER_ADMIN.

Eligibility is distinct from intervention powers, and both are distinct from financial execution authority. A permitted trigger establishes only that an escrow-related intervention may be initiated through the governed Escrow Intervention Request process. Initiating an intervention does not by itself authorise reversal of a dispute outcome, release of funds, freezing of a bank account, or payment execution; each remains subject to its own separate authority and to execution by the bank or authorised payment provider. Custody and execution remain exclusively with the bank or authorised payment provider (§2.1, §2.2), and ledger immutability (§7.3) together with the audit requirements (§13) continue to apply unchanged.

The six approved triggers:

Procedural failure — a required dispute or escrow workflow has stalled, failed, or been materially misapplied.

Material factual error — credible evidence indicates that a material fact, document, verification, or recorded decision is incorrect.

Fraud or security concern — credible evidence indicates fraud, payment manipulation, identity misuse, collusion, or compromise affecting the transaction.

Legal or regulatory requirement — a binding legal, regulatory, or competent-authority requirement necessitates intervention.

Conflict of interest — the person responsible for handling the dispute has an actual or reasonably apparent conflict that compromises impartiality.

Material system failure — a platform malfunction or data-integrity failure has materially affected the dispute or its escrow workflow.

The list is closed. No additional trigger may be inferred or introduced without a separate LA decision.

Non-triggers: convenience, commercial pressure, customer status, and dissatisfaction with an outcome are not valid triggers by themselves.

Recording requirement: the initiating Admin or SUPER_ADMIN must record, with the Escrow Intervention Request, the applicable trigger, the supporting evidence, the reasons, the scope, and the intended action. This is a content requirement only. It creates no data structure, workflow state, approval threshold, second-authoriser rule, or separation-of-duties mechanism, and it does not alter the dispute lifecycle or its decision vocabulary. The logical object through which this content is recorded is defined in §15.7 under HAO decision D-01 Item 2; that definition does not alter the content requirement stated here, and the boundary on what a recorded request may authorise is unchanged.

Intervention preserves the existing dispute process and its audit trail. It cannot silently rewrite transaction history.

Authority distinction (HAO decision D-01 Item 1, NXC-HOA-AUTH-D01-ITEM-01, approved 2026-11-02). The six triggers above apply equally to Admin-initiated and SUPER_ADMIN-initiated Escrow Intervention Requests, and neither role may initiate an intervention outside them. Moderator, Admin and SUPER_ADMIN remain distinct as recorded in PROMPT 0 §PERMISSION RULES:

Moderator — may investigate and recommend. May not initiate or decide a financial intervention.

Admin — may initiate an Escrow Intervention Request within delegated authority, subject to the six triggers recorded above.

SUPER_ADMIN — may initiate an intervention and may additionally exercise the executive authority expressly granted under HD-RT-8, subject to applicable safeguards and subsequent LA decisions.

This distinction separates eligibility to initiate an intervention from decision authority over a dispute outcome and from financial execution authority. Nothing in this section grants either role authority to execute a bank transaction, hold customer funds, or bypass the No Custody principle (§2.1, §2.2). The list remains closed and the recording requirement above is unchanged.

PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 1 remains the source of the authority itself; this section elaborates eligibility only. The Escrow Intervention Request logical object, lifecycle and decision-authority pathway are defined in §15.7 to §15.10 under HAO decision D-01 Item 2. Quantitative approval thresholds, the independent-approval mechanism for a request initiated by a SUPER_ADMIN, and every physical or runtime structure remain unspecified and are recorded as dependencies there.

15.7 Escrow Intervention Request — Logical Data Object (HAO decision D-01 Item 2)

Established under HAO authorization NXC-HOA-AUTH-D01-ITEM-02, decision D-01 Item 2 (approved 2026-11-02), on the eligibility boundary recorded in §15.6. This section defines a logical architecture only. It creates no database table, no migration, no schema, no column, no API, no RLS or RPC structure, no runtime workflow and no user interface; all of those remain outside this decision. Where an existing structure already carries the same meaning, this section references that structure instead of replacing it.

An Escrow Intervention Request (EIR) is the single governed record through which an eligible escrow-related intervention (§15.6) is initiated, reviewed, decided and tracked to implementation. One EIR exists per initiated intervention. The EIR is not a dispute, not an escrow state and not an execution instruction: it records a request and its decision. Financial action continues to occur only through the pathway in §15.3. The fields below describe the current state of one EIR; the material events that produced that state are preserved in the append-only history required by §15.10, not in the fields themselves (NXC-HOA-AUTH-D01-ITEM-02-R1).

Fields (HAO-approved baseline):

| Field | Purpose | Existing structure reused or referenced |
|-|-|-|
| intervention_request_id | Unique EIR identifier | No equivalent field existed in any specification. The object is already named at storage level in PROMPT 2 ("escrow_intervention_requests table stores Admin override requests"). |
| booking_id | Associated booking | MOD-002 bookingId |
| contract_id | Associated contract | MOD-002 contractId |
| escrow_record_id | Relevant escrow record | MOD-005 §4.1 escrowId and MOD-013 §4.1 escrowId |
| dispute_id | Related dispute; nullable when no formal dispute exists | MOD-005 §4.4 disputeId, MOD-013 §4.6 disputeId, MOD-015 §4.2 disputeId |
| initiated_by | Authenticated initiating user | Authenticated actor identity (PROMPT 7); attribution required by PROMPT 0 v1.3 §Accountability and separation of duties |
| initiator_role | Admin or SUPER_ADMIN | Canonical roles in PROMPT 0 v1.3 §USER ROLES; §15.6 authority distinction |
| trigger_type | One of the six approved D-01 triggers | §15.6 closed list |
| reason | Detailed justification | §15.6 recording requirement |
| evidence_references | Supporting records and documents | MOD-015 §4.2 evidenceReferences (MOD-004 document references); Primitive Registry §6.4 Evidence Model |
| proposed_action | Requested intervention | Restricted to the closed instrument list in §15.9 |
| risk_classification | Ordinary or exceptional/high-impact | Decision tier gate in §15.9 |
| assigned_reviewer | Authorised independent reviewer | §15.9; drawn only from roles already holding the relevant authority |
| decision | Approved or rejected | Existing approval vocabulary in MOD-005 §4.3, MOD-013 §4.3 and §4.6, MOD-015 §4.6 |
| decision_reason | Recorded justification | MOD-015 §4.2 business rule requiring justification and audit trail |
| decision_by | Authorised decision-maker | §15.9 tiers |
| execution_status | Separate implementation/external execution tracking | The status vocabulary already carried by the downstream instrument (MOD-005 §4.3 settlementStatus, MOD-013 §4.3 approvalStatus, MOD-013 §4.6 status) with bankExecutionReference and MOD-005 §4.4 bankHoldReferenceId |
| created_at | Submission timestamp | createdAt used by the MOD-005, MOD-013 and MOD-015 objects |
| updated_at | Last update | updatedAt used by the same objects |
| closed_at | Final closure timestamp | completedAt pattern in MOD-015 §4.8 |

Naming reconciliation: the names above are the authoritative EIR field names. Existing design-time module objects use lowerCamelCase identifiers (escrowId, contractId, disputeId) and the storage-layer documents use snake_case (booking_id, contract_id, escrow_id, dispute_id). No existing structure is renamed by this decision; the third column is the mapping. escrow_record_id maps to the escrow record that MOD-005 §4.1 and MOD-013 §4.1 identify as escrowId; no field named escrow_record_id previously existed in any specification. The same object already appears in PROMPT 2 under the name escrow_intervention_requests, and this decision does not alter that document.

Field rules:

- Every reference field MUST resolve to records that already exist. An EIR MUST NOT introduce a parallel booking, contract, escrow or dispute record.

- dispute_id is optional. An EIR may concern a material escrow or financial workflow failure with no formal dispute, which is what the Procedural failure and Material system failure triggers in §15.6 describe. Where a dispute does exist, the EIR references it and neither replaces it nor re-opens it.

- evidence_references MUST be non-empty before an EIR may enter review. The minimum content is the §15.6 recording requirement: trigger, supporting evidence, reasons, scope and intended action.

- decision holds only Approved or Rejected. It is not a lifecycle state; the lifecycle is defined in §15.8. The decision value is recorded before the EIR enters RESOLVED, and RESOLVED never expresses the decision by itself: approval is never inferred from the status alone (NXC-HOA-AUTH-D01-ITEM-02-R1).

- execution_status is separate from decision. An approved EIR records a decision; implementation and bank confirmation are tracked only through execution_status and only through §15.3.

- execution_status is not a new enumeration. It mirrors the status already carried by the downstream instrument that the approved action produces, and is not populated where the approved action raises no external instruction.

- risk_classification takes one of the two approved values and gates decision authority under §15.9. It introduces no financial threshold, because no threshold has been approved.

- created_at, updated_at and closed_at are timestamps only. They do not express state.

- The EIR carries no amount, currency, fee or funding field of its own. Where an approved action moves money, the amount lives in the existing settlement, refund or ledger instrument that the action produces, under the MOD-005 and MOD-013 rules already recorded there.

15.8 Escrow Intervention Request Lifecycle, Permitted Transitions, Withdrawal and Closure

The lifecycle reuses the existing MOD-015 §4.2 case status vocabulary (SUBMITTED / UNDER_REVIEW / ESCALATED / RESOLVED / CLOSED). Two terminal exits are added, because this decision requires withdrawal and cancellation rules and no existing vocabulary expresses them: WITHDRAWN and CANCELLED. No other state is created, and no dispute, escrow, settlement or ledger state is changed by this section. These names are statuses of the EIR record only. They are not the linked case’s own §4.2 status, and RESOLVED here neither resolves nor re-opens a dispute (NXC-HOA-AUTH-D01-ITEM-02-R1, clarification 1).

States:

- SUBMITTED — the EIR exists and carries the minimum content required by §15.6.

- UNDER_REVIEW — an authorised reviewer independent of the initiator has been assigned.

- ESCALATED — routed to the decision tier required by §15.9, or escalated because the linked case was escalated. Escalation routes; it decides nothing.

- RESOLVED — decision already holds Approved or Rejected, recorded together with decision_reason and decision_by. The status carries no approval of its own: it means only that a decision has been taken.

- CLOSED — implementation has been tracked to a bank- or provider-confirmed outcome, or the approved action required no external instruction, and the history required by §15.10 is complete. An EIR decided Approved reaches CLOSED through implementation tracking; an EIR decided Rejected reaches CLOSED directly, with no instruction raised and nothing to implement.

- WITHDRAWN — terminated by the initiator before any decision was recorded.

- CANCELLED — terminated on the record by an authorised actor other than the initiator where the evidence does not substantiate the trigger, the request duplicates an existing EIR, or the referenced records do not support it.

Permitted transitions:

- SUBMITTED to UNDER_REVIEW

- SUBMITTED to ESCALATED

- UNDER_REVIEW to ESCALATED

- UNDER_REVIEW to RESOLVED

- ESCALATED to UNDER_REVIEW

- ESCALATED to RESOLVED

- RESOLVED to CLOSED

- SUBMITTED, UNDER_REVIEW or ESCALATED to WITHDRAWN

- SUBMITTED, UNDER_REVIEW or ESCALATED to CANCELLED

No other transition is permitted. Any movement not listed here is a specification gap and MUST be referred, not assumed.

Transition rules:

- No transition may be asserted directly to a chosen end state. Each transition is a recorded history event under §15.10, consistent with the event-driven rules in MOD-005 §7.3 and MOD-013 §7.3.

- CLOSED, WITHDRAWN and CANCELLED are terminal. A terminal EIR is never reopened, edited or reused; a further intervention requires a new EIR with a new identifier that references the earlier one.

- WITHDRAWN is available only to the initiating Admin or SUPER_ADMIN and only while no decision has been recorded.

- CANCELLED records the reason and the cancelling actor, and the cancelling actor MUST NOT be the initiator.

- An EIR in any state, including RESOLVED, changes nothing by itself: no escrow state transition, no settlement, no refund, no ledger entry and no dispute state change. Escrow state continues to move only through events confirmed by the bank (MOD-005 §7.2, §7.3, §7.4; MOD-013 §7.1, §7.2, §7.3).

- Implementation tracking never advances ahead of confirmation by the bank or authorised payment provider. execution_status is derived from existing confirmation records, not from an operator statement.

- A transition to RESOLVED is permitted only when decision holds Approved or Rejected and decision_reason and decision_by are recorded. A RESOLVED record without a decision value is not a permitted state.

- An Approved EIR may proceed to implementation tracking and may reach CLOSED only on the terms of the CLOSED state above. A Rejected EIR proceeds to CLOSED without implementation, and no instruction may be raised for it.

- Approval is never inferred from the RESOLVED status alone, in the current-state record, in any view of it, or in any history entry (NXC-HOA-AUTH-D01-ITEM-02-R1, clarification 1).

- Nothing in this section creates an SLA, an approval threshold, a timeout or an automatic action. Existing SLA rules remain where they are already recorded (MOD-015 §7.6).

Escalation: where an EIR is linked to a support, dispute or incident case, escalation reuses the existing MOD-015 §4.4 escalation record and the L1 to L2 to L3 framework already recorded there and in ESS-005 §6. The EIR creates no parallel escalation ladder, no new escalation level and no new escalation status.

15.9 Escrow Intervention Request Decision Authority, Permitted Actions and Independent Review

Decision authority is tiered using authorities that already exist. This section grants no new authority to any role, and no tier may be read as inheriting a permission that is not explicitly documented for it (PROMPT 0 v1.3 §Administrative hierarchy).

Tier 1 — Ordinary risk. The EIR is decided inside the governed escrow intervention authority already recorded in PROMPT 0 v1.3 §PERMISSION RULES: an Admin acting within delegated authority, or a SUPER_ADMIN. The decision-maker MUST hold that authority and MUST NOT be the initiator.

Tier 2 — Exceptional or high-impact risk. Where the proposed action requires a power listed in PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 1 — a freeze or release instruction to the bank escrow provider, an override of an automated dispute recommendation or resolution, or a platform-funded refund, credit, fee waiver or exceptional financial adjustment — the EIR MUST be decided by an authenticated human SUPER_ADMIN, because Domain 1 is SUPER_ADMIN-exclusive. The Admin surface MUST NOT expose that decision; the surface boundary already recorded in MOD-007 §5.6 and in PROMPT 0 v1.3 is unchanged and is not restated here as a new rule. Tier 2 is a routing rule, not a grant: the classification reserves the decision to the authority a SUPER_ADMIN already holds and creates no permission, power, financial outcome, financial instrument or quantitative threshold of its own. A request so classified must still satisfy one of the six triggers recorded in §15.6, must still fall inside the closed list of permitted actions below, must still stay within the HD-RT-8 Domain 1 boundaries, and remains subject to No Custody (§2.1, §2.2) (NXC-HOA-AUTH-D01-ITEM-02-R1, clarification 2).

Tier 3 — a request initiated by a SUPER_ADMIN. The requirement is recorded; the mechanism is not established here. An EIR initiated by a SUPER_ADMIN still requires an authorised reviewer independent of the initiator, but no authority above SUPER_ADMIN exists inside the platform, and PROMPT 0 v1.3 §Accountability and separation of duties states that where dual authorisation, independent confirmation or another prescribed safeguard applies, the mechanism is not established by that document and requires a separate specification decision. This section records the requirement and defers the mechanism.

TODO: requires specification from BOOT / ESS / MOD — unresolved dependency on the dual-authorisation decision (open under HD-RT-8; D-02 onwards remains with the LA). No reviewer, second authoriser, threshold or separation-of-duties mechanism may be inferred for a request initiated by a SUPER_ADMIN until that decision is made.

Independence required now: the assigned_reviewer MUST NOT be the initiated_by actor, for requests of any role, and the decision-maker MUST NOT be the initiator. Whether an additional, separate authoriser must also approve, and how independence is achieved where the initiator is the highest human authority, are the deferred questions above. MOD-005 §4.4 and MOD-015 §4.2 continue to record the existing moderator and admin roles inside the dispute process itself; initiating or deciding an intervention is governed by §15.6 and this section, which reserve it to Admin and SUPER_ADMIN.

Moderators and AI: a Moderator may investigate and produce evidence and a recommendation for an EIR, consistent with PROMPT 0 v1.3 §PERMISSION RULES and §15.6, and may not initiate, review for decision, or decide one. The AI System Agent remains read and recommend only (PROMPT 0 v1.3; ESS-003; MOD-013 §7.7; MOD-015 §7.1, §7.3, §7.5). No AI actor holds EIR approval, review or execution authority, and no EIR may be raised, advanced or decided by automation.

Permitted proposed_action values (closed list). Only instruments and outcomes already authorised may be requested:

- an escrow hold instruction to the bank (MOD-005 §4.4 business rule; DISPUTE_HOLD in MOD-005 §4.1; disputeHoldPlaced in the Event Registry);

- a release instruction, or its deferral, through the existing settlement pathway (MOD-005 §4.3; MOD-013 §4.3);

- a refund instruction using an existing refund type (MOD-013 §4.6 refundType FULL / PARTIAL / SPLIT_SETTLEMENT; MOD-015 §4.6 refundType FULL / PARTIAL / COMPENSATION);

- a resolution outcome already inside the approved vocabulary (MOD-005 §4.4 resolutionOutcome RELEASE_TO_TRANSPORTER / REFUND_TO_SHIPPER / SPLIT_SETTLEMENT);

- an adjustment entry through the reconciliation pathway (§7.3, §8), never an edit of a historical ledger entry (§15.4);

- a non-financial procedural correction, such as re-driving a stalled workflow or restoring a correct recorded fact, where no movement of funds is requested;

- for Tier 2 only, the Domain 1 actions listed above within their stated boundaries.

Anything outside this list is not an available instrument. This decision creates no financial outcome, no financial instrument, no threshold, no funding mechanism and no new approval authority. No platform funds are committed by an EIR: NexCargo never holds money (§2.1), and the bank or authorised payment provider remains the sole execution authority (§2.2, §15.5).

Approval versus execution: internal approval and external execution stay separate. An approved EIR authorises NexCargo to raise an instruction through §15.3 only. Custody and execution remain with the bank or authorised payment provider (MOD-005 §7.1, §7.2, §7.4; MOD-013 §7.1, §7.2). The bank confirmation, not the EIR decision, is what changes a financial state, and the mirrored ledger continues to follow the bank (§7.2, §7.3).

15.10 Escrow Intervention Request Audit History, Ownership and Registry Implications

Append-only history. Every status transition, evidence submission, reviewer assignment, escalation, decision, withdrawal, cancellation and implementation outcome MUST produce an immutable history record. The current-state fields in §15.7 never substitute for that history, and no later update may erase a prior entry. The logical object in §15.7 states what an EIR is now; the history states what happened, and MUST preserve every material transition, evidence submission, reviewer assignment, escalation, decision, withdrawal, cancellation and implementation outcome. A history record is never silently overwritten, edited or deleted: correction happens by appending a later record, and for the mirrored ledger only by adjustment entry under §7.3. Retention follows ESS-009 (NXC-HOA-AUTH-D01-ITEM-02-R1, clarification 3).

The history reuses structures that already exist rather than inventing one: the append-only event store and audit log defined in PROMPT 2, the audit event object defined in MOD-010 §4.5 (auditEventId, eventType, beforeState, afterState), the required audit content in §13 (correlationId, ledger reference, bank transaction ID, escrow state, user role, timestamp, module origin), and the immutability and retention rules of §7.3 and ESS-009. ESS-006 requires audit logs to be immutable and append-only; nothing here relaxes that, and §15.4 continues to forbid altering historical financial records.

Ownership. Under Primitive Registry §0.1, which requires one authoritative owner per entity type, the EIR is defined by this appendix and belongs to the Admin financial oversight layer recorded in §15. Defining it transfers no ownership of any financial entity: escrow orchestration remains MOD-005 and settlement and reconciliation remain MOD-013, as recorded in the Arbitration Layer §6.2, dispute and case records remain MOD-015, and the handling surface remains the Admin and SUPER_ADMIN dashboards in MOD-007 §5.6.

Registry implications. Event Registry §12 bars new business events from being introduced without architecture approval, and the Primitive Registry bars dependent layers from redefining primitive semantics. This Item 2 pass wrote no registry entry of its own and recorded the requirement as a gap. The architecture approval that §12 requires was given later by HAO decision D-01 Item 5 (authorisation NXC-HOA-AUTH-D01-ITEM-05-001), and the two events named below are now registered in the Event Registry §13 module catalogue with their constraints recorded in Event Registry §17. Registration changes nothing about the authority model: an event records an auditable fact, and no event authorises, executes or confirms a bank or payment-provider transaction (§15.3, §15.5; §2.1, §2.2; MOD-013 §7.1, §7.2).

EVENT REGISTRY GAP:

Two of the transitions implied by the §15.8 lifecycle are now registered and carry these canonical names: escrowInterventionRequested (a request raised) and escrowInterventionDecided (a decision recorded). Each is owned and produced by MOD-005, classified Compliance and immutable, and each identifies the Escrow Intervention Request, its related booking, contract, escrow and dispute references where present, the acting actor, the applicable §15.6 trigger or §15.9 decision tier, and the lifecycle context, using the references already defined in §15.7.

The remaining four transitions are still not in the canonical catalogue and still require architecture approval before any event name may be introduced for them: a request routed for decision, an implementation confirmed, a request withdrawn, and a request cancelled. Until that approval exists, those four are recorded only through the append-only history in this section, and §15.8 names no event for them.

No event name confers eligibility or authority. Eligibility remains the closed trigger list in §15.6 and decision authority remains the tiers in §15.9, and an intervention exercises no authority inside MOD-015 (MOD-015 §7.9).

Primitive Registry: the EIR composes existing primitives — §6.1 Dispute Object Model, §6.2 Case Lifecycle State Machine, §6.3 Resolution Authority Hierarchy Model and §6.4 Evidence Model — together with §5.2 Global Policy Hierarchy Model. Whether a separate Escrow Intervention Request object primitive is required is a Primitive Registry decision and is not made here.

TODO: requires specification from BOOT / ESS / MOD — quantitative approval thresholds, the independent-approval mechanism for a request initiated by a SUPER_ADMIN, and every physical or runtime structure remain unspecified.

16. MODULE RESPONSIBILITY MATRIX

|---------------------------------------|---------------------------------------------|
| Function				| Primary Module	| Secondary Module    |
|---------------------------------------|-----------------------|---------------------|
| Escrow initiation			| MOD-005		| MOD-011	      |
| Escrow release			| MOD-005		| MOD-011	      |
| Settlement execution			| MOD-013		| MOD-011	      |
| Reconciliation			| MOD-013		| MOD-012	      |
| Ledger synchronization		| MOD-013		| MOD-012	      |
| Payment channel integration		| MOD-005, MOD-013	| MOD-011	      |
| Fraud detection assistance		| MOD-006		| MOD-013	      |
| Financial observability		| MOD-017		| MOD-013	      |
|---------------------------------------|-----------------------|---------------------|

17. EXTERNAL INTEGRATION REFERENCES

ESS-001A — External Systems Catalogue (provider inventory)

ESS-001B — Authentication Standards Matrix (mTLS, OAuth)

ESS-001C — Retry & Timeout Policy Matrix (financial retry rules)

ESS-001D — Webhook Governance Standard (financial webhooks)

ESS-001E — Error Code Standardization (financial error codes)

ESS-003 — AI Behavior Constraints (AI financial restrictions)

ESS-004 — Integration Contracts (API schemas)

ESS-006 — Security & Compliance (security requirements)

ESS-009 — Data Governance (ledger immutability, audit)

FINAL PRINCIPLE

ESS-001F guarantees:

NexCargo can coordinate global financial flows without ever holding or controlling money directly.

This is the foundation of regulatory safety and scalability.

---

DOCUMENTATION CHANGE HISTORY

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-1 | Change-history block established under the INDEX §7.4 Document Change-History Standard. History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register. The rows below record the evidenced changes that the register and this document's own inline citations support, each dated when the change was actually made. No §15 rule, trigger, tier, lifecycle state, field or authority boundary was altered by creating this block. | HAO decision D-01 Item 6 Stage 1 (NXC-HOA-AUTH-D01-ITEM-06-STAGE-1); INDEX §7.4 |
| 2026-11-02 | NXC-HOA-AUTH-D01-001 | §15.6 added: the six HAO-approved escrow-intervention eligibility circumstances recorded once and authoritatively (procedural failure; material factual error; fraud or security concern; legal or regulatory requirement; conflict of interest; material system failure), with the non-triggers, the recording requirement and the rule that eligibility is distinct from intervention powers and from financial execution authority. Cross-references added at §15.2 and §15.3. The trigger list is closed; no further trigger may be inferred or introduced without a separate HAO decision. No Custody and No Execution, the bank or authorised payment provider as sole execution authority, ledger immutability, the dispute lifecycle and decision vocabulary and every existing role authority boundary are unchanged. | HAO decision D-01 Item 1 (NXC-HOA-AUTH-D01-001); Development State register, D-01 row |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-01 | §15.6 extended so that the six triggers apply equally to Admin-initiated and SUPER_ADMIN-initiated Escrow Intervention Requests, with neither role able to initiate outside them; the open question previously recorded in §15.6 was removed and §15.6 now states the Moderator / Admin / SUPER_ADMIN authority distinction. Authority is unchanged: PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 1 remains the source of the authority and its procedure-level deferral clause stands; no new power was granted. | HAO decision D-01 Item 1 extension (NXC-HOA-AUTH-D01-ITEM-01); Development State register, D-01 row annotation |
| 2026-11-02 | NXC-HOA-DECISION-D01-ITEM-02 | §15.7 added: the Escrow Intervention Request logical object with its twenty baseline fields carried unchanged and each reference field mapped to an identifier that already exists (bookingId and contractId in MOD-002, escrowId in MOD-005 §4.1 and MOD-013 §4.1, disputeId in MOD-005 §4.4, MOD-013 §4.6 and MOD-015 §4.2), with escrow_record_id recorded as the one baseline name having no prior field of its own. §15.8 added: the lifecycle reusing the MOD-015 §4.2 status vocabulary plus the WITHDRAWN and CANCELLED terminal exits, the permitted transitions, the terminal rule, and the rule that no request state changes escrow, dispute, settlement or ledger state outside the bank-confirmed pathway. §15.9 added: tiered decision authority derived only from existing authorities, with a closed permitted-action list drawn from instruments already authorised in §15.3, MOD-005, MOD-013 and MOD-015, reviewer and decision-maker independent of the initiator. §15.10 added: append-only history through the existing event store and audit log, MOD-010 §4.5 audit event object, §13 audit content and ESS-009 immutability, oversight ownership under Primitive Registry §0.1 without moving ownership of any financial entity, and Event Registry and Primitive Registry gaps emitted rather than written. §15.3, §15.6 and the §15.6 recording-requirement boundary reconciled. No threshold, funding mechanism, financial instrument, new approval authority or standalone specification was created, and the dual-authorisation and independent-approval mechanism for a SUPER_ADMIN-initiated request remains deferred to D-02 onwards. | HAO decision D-01 Item 2 (NXC-HOA-DECISION-D01-ITEM-02); Development State register, D-01 Item 2 row |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | Directions 3-A to 3-C applied: §15.1 states that Admin financial authority is ordinary and conditional and separates routine configuration, commercial authorisation and financial execution; §15.2 replaces the pre-D-01 permission ladder with bounded ordinary approvals plus Tier 1 Escrow Intervention Request decisions under §15.9, with Tier 2 and exceptional commercial matters reserved to SUPER_ADMIN; §15.3 states that approval is not execution and that approving a request is not approval of its underlying financial instrument; §15.4 gains the prohibitions matching those directions, including that Admin may not impose or reverse a platform-wide executive restriction or resume, disable or bypass one imposed by SUPER_ADMIN, may not decide a Tier 2 or exceptional commercial matter, may not use a configuration change to alter a signed contract, existing booking, in-flight settlement or submitted provider instruction, and may not cancel, alter or reverse an instruction already received by a bank or provider by means of a pause; §15.5 keeps even Admin actions as advisory triggers into governed execution pipelines rather than execution authority, and the Moderator boundary remains as recorded at §15.6 and §15.9, preserving investigation, findings, recommendation and ordinary dispute handling while no Moderator becomes a financial approver; boundary notes added at §8.3, §11.1 and §11.3 holding Payment Hold Mode, Safe Mode and the Domain 4 platform-wide emergency restriction distinct from a transaction-specific intervention. Pause and resume are recorded as separate permissions; no numeric threshold or permitted range was invented, no lockdown mechanism created and Safe Mode not redefined. | HAO decision D-01 Item 3 (NXC-HOA-AUTH-D01-ITEM-03-001); Development State register, D-01 Item 3 row |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-05-R1 | §15.10 registry implications rewritten to reflect the two canonical business events now registered in Event Registry §13 MOD-005 Owned Events with their constraints in Event Registry §17; the EVENT REGISTRY GAP is narrowed to the four remaining §15.8 lifecycle transitions, which stay unregistered. The §15.6 triggers, the §15.7 references, the §15.8 lifecycle, the §15.9 tiers, No Custody and No Execution and every existing role boundary are unchanged; no schema, payload, transport, storage or runtime definition was added. | HAO decision D-01 Item 5 correction pass (NXC-HOA-AUTH-D01-ITEM-05-001; NXC-HOA-AUTH-D01-ITEM-05-R1); Development State register, D-01 Item 5 row |
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-2 | Operative HAO references transitioned to Lead Architect (LA): §15.1 now conditions Admin authority on the approvals, limits and instruments the LA has already approved; §15.6 now requires a separate LA decision before any additional trigger and refers subsequent decisions affecting the SUPER_ADMIN executive authority to the LA; the §15.9 TODO note now records that D-02 onwards remains with the LA. Not changed: the §15.6, §15.7 and §15.9 heading citations and every dated authority citation in this document, the §15.7 "HAO-approved baseline" field label, the closed six-trigger eligibility list, the Tier 1 and Tier 2 decision boundaries and the Admin, Moderator and SUPER_ADMIN authority distinctions; no authority was created, extended, transferred or weakened. | LA authorisation NXC-HOA-AUTH-D01-ITEM-06-STAGE-2 (2026-11-03); PROMPT 0 v1.3 §11 Designation Successor |

Version effect: ESS-001F remains v1.0 — no version increase, no loader change and no INDEX §7.1 change. This block records changes that had already been made and registered under the authorisations cited in it; creating the block changed no rule, trigger, authority tier, lifecycle state, field, permission or financial instrument in this appendix.

Version effect (2026-11-03 Stage 2 row above): ESS-001F remains v1.0 — no version increase, no loader change and no INDEX §7.1 change. The Version effect statement above continues to govern only its own rows.
