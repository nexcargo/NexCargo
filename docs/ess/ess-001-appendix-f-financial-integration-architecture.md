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

freeze settlement flow

escalate to MOD-005 + moderator review

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

→ enter "Payment Hold Mode"

11.2 Mobile Money Failure

→ fallback to bank transfer

→ queue payout retry

11.3 Ledger Mismatch

→ freeze financial operations

→ trigger reconciliation engine

→ require admin review

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

The Admin (Platform Owner) has system-wide financial configuration authority, but does NOT bypass ESS financial execution rules.

All Admin financial actions MUST pass through ESS validation and remain audit-bound.

15.2 Allowed Admin Financial Actions

Admin MAY:

configure platform fee percentages

configure commission structures

configure settlement timing rules (within ESS limits)

trigger Escrow Intervention Requests

approve exceptional financial workflows

pause or resume financial flows (system-wide hold mode)

override business-level parameters (NOT ledger state)

15.3 Escrow Intervention Model

Admin CANNOT directly release or retain funds.

Instead, Admin MUST issue an Escrow Intervention Request which triggers:

ESS validation of override legitimacy

Arbitration Layer conflict resolution

Compliance verification

Financial module execution via bank API

Full audit logging

15.4 Forbidden Admin Actions

Admin MUST NOT:

directly modify ledger entries

directly mutate escrow state in bank system

bypass settlement engine

override bank confirmations

alter historical financial records

15.5 Financial Safety Principle

Even Admin actions are:

advisory triggers into governed execution pipelines, NOT direct execution authority

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
