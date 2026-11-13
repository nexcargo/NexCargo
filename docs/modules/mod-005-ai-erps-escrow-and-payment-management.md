MOD-005 — AI ERPS Escrow \& Payment Management Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY



Module ID: MOD-005

Module Name: AI ERPS Escrow \& Payment Management Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the financial orchestration layer of NexCargo.



It governs how:



payments, escrow states, and settlement workflows are structured and coordinated



multi-payment methods are supported and routed to regulated escrow accounts



milestone-based release instructions are generated and sent to the escrow bank



disputes are managed via bank-enforced holds and resolution instructions



financial reconciliation is maintained across payment providers, platform ledger, and bank records



Critical constraint: NexCargo does not store, hold, or control funds. All funds are held in regulated external banking systems (ESS-001F). NexCargo issues instructions to the bank; the bank executes all financial movements. NexCargo maintains a mirrored, non-authoritative ledger for reconciliation and visibility only.



This module defines how financial state transitions must be modeled and delegated to regulated banking systems (ESS-001F).



3\. DOMAIN SCOPE



MOD-005 governs:



3.1 Escrow State Modeling



how escrow states are represented (logical escrow accounts)



how escrow lifecycle progresses from creation to closure



how state transitions are triggered by system events (contract signing, delivery confirmation)



how escrow states are mirrored from the bank's authoritative records



3.2 Payment Orchestration Structure



how payments are initiated via multiple payment methods (mobile money, cards, bank transfer)



how payment intents are structured and tracked



how payment outcomes are recorded and validated



how funds are routed into bank-managed escrow accounts



3.3 Settlement Coordination Layer



how settlement is requested (milestone-based release instructions)



how settlement confirmations are processed from the bank



how reconciliation states are represented and monitored



how disputes trigger holds and resolution instructions



3.4 Digital Wallet (Non-Custodial Ledger)



how internal wallet balances are represented (reflecting escrow state, payouts, pending transactions)



how the wallet is synchronised with bank escrow and payout status



no standalone fund custody exists in NexCargo



3.5 Financial Reconciliation



ensuring consistency between NexCargo ledger, payment providers, and bank escrow records



automated continuous reconciliation



discrepancy flagging (not auto-correction)



3.6 Cargo Insurance and Trade Credit



insurance binding to escrow contracts



credit issuance controlled by licensed financial partners (not platform)



4\. CORE DOMAIN ENTITIES



These are design-time financial structures only.



4.1 Escrow Account (Logical Representation)



Represents a non-custodial escrow abstraction linked to a specific contract.



Required attributes:



escrowId



contractId – from MOD-002



payerId – shipper



payeeId – transporter



amount



currency – MZN, USD, ZAR



escrowStatus – PENDING\_CREATION / FUNDS\_INITIATED / FUNDS\_LOCKED / PARTIAL\_RELEASE / FINAL\_RELEASE / DISPUTE\_HOLD / ESCROW\_CLOSED



bankReferenceId – external system reference only (authoritative)



createdAt



updatedAt



Business rules:



Each shipment maps to a unique escrow account reference in the bank.



Funds are legally held by the bank, not NexCargo.



NexCargo can only: request holds, request releases, request refunds.



Bank is the final executor of all financial movements.



Escrow state is mirrored in NexCargo ledger (read-only financial truth sync).



4.2 Payment Intent



Represents a structured intent to initiate payment.



Attributes:



paymentIntentId



escrowId



amount



currency



paymentMethodType – M\_PESA / MKESH / E\_MOLA / CARD\_VISA / CARD\_MASTERCARD / PAYPAL / BANK\_TRANSFER



status – INITIATED / PENDING / CONFIRMED / FAILED / REFUNDED



providerReferenceId



idempotencyKey – ensures duplicate payment events are rejected



Business rules:



Payments are always pre-escrow funding deposits.



Funds are not held by NexCargo.



Payment confirmation triggers escrow funding request to bank.



Idempotency is required for all payment requests.



4.3 Settlement Record



Represents finalisation of escrow release.



Attributes:



settlementId



escrowId



settlementStatus – REQUESTED / APPROVED / EXECUTED / FAILED



releaseAmount



releaseMilestone – PICKUP\_CONFIRMED / BORDER\_CROSSING / DELIVERY\_CONFIRMED / POD\_APPROVED



bankTransactionId



timestamp



Business rules:



NexCargo sends release instructions; bank executes payments.



Partial releases are supported per contract.



Release requires valid milestone verification from MOD-003.



Bank confirms execution status.



Settlement approval (settlementStatus = APPROVED) is recorded by Admin within delegated authority, or by SUPER_ADMIN where the settlement sits inside an Escrow Intervention Request classified Tier 2 under ESS-001F §15.9. No AI actor may approve a settlement (ESS-001F §10). Approval is an internal decision and is not execution; only the bank or authorised payment provider executes (ESS-001F §2.2, §15.3; HAO decision D-01 Item 3, direction 3-A).



4.4 Dispute Record



Represents a dispute event that triggers escrow hold.



Attributes:



disputeId



escrowId



raisedBy – shipper / transporter



disputeReason



disputeStatus – RAISED / HOLD\_INSTRUCTED / UNDER\_INVESTIGATION / RESOLVED



bankHoldReferenceId



resolutionOutcome – RELEASE\_TO\_TRANSPORTER / REFUND\_TO\_SHIPPER / SPLIT\_SETTLEMENT



resolvedBy – the deciding actor for a dispute outcome: Admin within delegated authority, or SUPER_ADMIN where ESS-001F §15.9 classifies the matter Tier 2. Moderator investigation, findings and recommendations remain recorded in the case history (MOD-015 §4.2, §5.2), but a Moderator is not the resolving actor for a financial outcome (ESS-001F §15.6; PROMPT 0 v1.3 §PERMISSION RULES; HAO decision D-01 Item 3, direction 3-A).



resolvedAt



comments



Business rules:



Dispute triggers escrow HOLD instruction to bank.



Funds are frozen in bank escrow account.



Only Admin (within delegated authority) or SUPER_ADMIN (where ESS-001F §15.9 Tier 2 applies) may resolve a dispute to a financial outcome. A Moderator investigates, records findings and recommends, and may continue ordinary case handling; a Moderator may not decide a financial outcome, initiate or decide an Escrow Intervention Request, or approve a financial intervention (PROMPT 0 v1.3 §PERMISSION RULES; ESS-001F §15.6; HAO decision D-01 Item 3, direction 3-A).



Bank confirms hold status.



4.5 Reconciliation Record



Represents financial consistency validation.



Attributes:



reconciliationId



escrowId



internalLedgerState



externalBankState



paymentProviderState



mismatchStatus – ALIGNED / MISMATCH\_DETECTED



resolutionStatus – PENDING / INVESTIGATING / RESOLVED



mismatchDetails – structured description of discrepancies



lastReconciledAt



Business rules:



Bank is the primary source of escrow truth.



Reconciliation is continuous and automated.



Discrepancies are flagged, not auto-corrected.



4.6 Digital Wallet (Non-Custodial Ledger)

Represents an internal ledger-only balance representation.



Attributes:



walletId



userId – shipper / transporter



walletType – SHIPPER / TRANSPORTER



balance – derived from ledger + bank state (read-only)



pendingTransactions – array of transaction references



lastSyncTimestamp



Business rules:



Wallet does NOT store real funds.



Wallet reflects: escrow state, payouts, pending transactions.



Wallet is synchronised with bank escrow + payout status.



No standalone fund custody exists in NexCargo.



Wallet balance is always derivable from ledger + bank state.



4.7 API Contract Specifications (Conceptual Endpoints)

For each core action, the implementation must expose (at minimum) these conceptual endpoints:



Action	Endpoint (conceptual)

Initiate payment		POST /payments

Get payment status		GET /payments/{id}

Confirm payment			POST /payments/{id}/confirm

Get escrow status		GET /escrow/{escrowId}

Request release instruction	POST /escrow/{escrowId}/release

Hold escrow (dispute)		POST /escrow/{escrowId}/hold

Resolve dispute			POST /escrow/{escrowId}/resolve

Get wallet balance		GET /wallet/{userId}

Get reconciliation status	GET /reconciliation/{escrowId}

Trigger reconciliation		POST /reconciliation/{escrowId}/sync



All endpoints must adhere to ESS-004 (integration contract rules).



5\. ESCROW LIFECYCLE MODEL



EscrowCreated (contract signed in MOD-002)

&#x20;      ↓

FundsInitiated (payment initiated by shipper)

&#x20;      ↓

FundsLocked (bank confirms deposit)

&#x20;      ↓

ShipmentInProgress (from MOD-003 tracking)

&#x20;      ↓

\[ Optional: DisputeHold (bank freeze) → Resolution → Release/Refund/Split ]

&#x20;      ↓

DeliveryConfirmed (from MOD-003)

&#x20;      ↓

SettlementRequested (release instruction sent to bank)

&#x20;      ↓

SettlementExecuted (bank confirms transfer)

&#x20;      ↓

EscrowClosed



6\. RESPONSIBILITIES



MOD-005 is responsible for:



6.1 Financial State Modeling



defining escrow lifecycle states



structuring payment intent flows



maintaining financial state consistency (mirrored from bank)



6.2 Settlement Coordination



triggering settlement requests (via ESS-001F architecture rules)



tracking settlement status updates from bank



ensuring milestone-based release instructions are valid



6.3 Reconciliation Structuring



defining mismatch detection structures



supporting audit alignment with external banking systems and payment providers



flagging discrepancies without auto-correction



6.4 Payment Method Orchestration



supporting multiple payment methods (mobile money, cards, bank transfer)



routing funds into bank-managed escrow accounts



ensuring idempotency for all payment requests



6.5 Dispute Management



triggering escrow holds at the bank level



tracking dispute status and resolution outcomes



ensuring bank confirms all hold and release instructions



6.6 Digital Wallet Representation



maintaining internal wallet balance as a read-only ledger



synchronising with bank escrow and payout status



ensuring wallet balance is always derivable from authoritative sources



7\. RULES OF OPERATION



7.1 No Custody Rule (CRITICAL)



NexCargo MUST NOT: hold funds, store real money balances, or act as a financial institution.



All funds exist in regulated external banking systems (ESS-001F authority).



NexCargo issues instructions only; the bank executes all financial movements.



7.2 Bank Authority Rule



All escrow states MUST be mirrored from external bank ledger.



Internal system states are non-authoritative mirrors.



Bank is the final authority on all fund movements.



No financial divergence between systems is permitted without flagging.



7.3 Event Dependency Rule



Escrow state transitions MUST be triggered by external or system events.



No manual or implicit state transitions are allowed.



Release requires valid milestone verification from MOD-003.



Payment confirmation triggers escrow funding request to bank.



7.4 Settlement Finality Rule



Settlement is only valid when confirmed by external banking system.



Internal system cannot override settlement outcomes.



No release occurs without bank confirmation.



7.5 Idempotency Rule



All payment requests MUST be idempotent.



Duplicate payment events MUST be rejected.



Duplicate release instructions MUST be rejected.



7.6 Reconciliation Rule



Bank is the primary source of escrow truth.



Reconciliation is continuous and automated.



Discrepancies are flagged, not auto-corrected.



100% traceability between systems is required.



7.7 Neutrality Rule



MOD-005 MUST NOT:



determine pricing strategies



decide financial approval logic



evaluate creditworthiness



simulate financial success



initiate financial movements without bank confirmation



override bank ledger states



7.8 Escrow Intervention Eligibility Reference



The closed list of circumstances in which a human Admin or SUPER_ADMIN may initiate an escrow-related intervention is defined once, authoritatively, in ESS-001F §15.6 (HAO decisions D-01 and D-01 Item 1). MOD-005 adds no trigger, references no trigger of its own, and grants no authority from this rule.



Eligibility to initiate an intervention is distinct from MOD-005’s escrow state model and from financial execution authority. A permitted trigger authorises an Escrow Intervention Request only.



It does not authorise a manual or implicit escrow state transition (§7.3), a release or refund instruction that the bank has not confirmed (§7.4), or any divergence from the bank mirror (§7.2). Escrow state continues to change only through events confirmed by the bank.



The Escrow Intervention Request logical object, its lifecycle and its decision tiers are defined once, authoritatively, in ESS-001F §15.7 to §15.10 (HAO decision D-01 Item 2). MOD-005 adds no field, no state, no transition, no threshold and no execution path to that definition. Where an approved request produces escrow-side movement, it does so through the structures already defined in §4 and remains subject to §7.2, §7.3 and §7.4.



8\. EVENT MODEL (SPECIFICATION ONLY)



Declared system events:



EscrowCreated



FundsInitiated



FundsLocked



PaymentConfirmed



PaymentFailed



SettlementRequested



SettlementExecuted



SettlementFailed



DisputeRaised



DisputeHoldInstructed



DisputeResolved



ReconciliationMismatchDetected



ReconciliationAligned



WalletSynced



Consumed by:



MOD-002 → contract activation and escrow creation



MOD-003 → delivery confirmation triggers settlement request



MOD-006 → fraud/anomaly detection



MOD-012 → financial analytics



MOD-010 → compliance auditing



MOD-016 → payment notifications



MOD-004 → financial document attachments (invoices, proof of delivery)



Emitted to:



Bank (via ESS-001F) → release instructions, hold instructions, resolution instructions



9\. INTEGRATION BOUNDARIES



MOD-005 interacts conceptually with:



MOD-002 → contract-based escrow creation (triggered by ContractSigned)



MOD-003 → delivery milestone triggers (receives DeliveryConfirmed to request settlement)



MOD-004 → financial document attachments (invoices, insurance documents)



MOD-011 → API exposure layer



MOD-016 → payment notifications



ESS-001F → authoritative financial execution layer (bank escrow system)



MOD-005 does not directly integrate with payment providers or banking systems.



All external financial operations are handled via:



ESS-001F + MOD-011



10\. ESS DEPENDENCY REFERENCES (CANONICAL)



MOD-005 is constrained by:



ESS-003 → AI constraints (no financial execution autonomy; AI recommendations are advisory only)



ESS-004 → integration contract rules



ESS-006 → compliance and audit rules (critical for finance)



ESS-007 → coding standards for financial integrity



ESS-008 → UI/UX financial transparency rules



ESS-009 → financial data governance rules



ESS-001F → PRIMARY financial architecture constraint layer



11\. ARCHITECTURE BOUNDARY RULE



MOD-005 MUST NOT:



hold or custody funds



override bank ledger states



execute payments independently



simulate financial completion



bypass escrow state validation



auto-correct reconciliation mismatches



initiate financial movements without bank confirmation



MOD-005 IS:



a structured escrow state orchestration and financial event modeling layer for regulated banking execution systems



a non-custodial financial orchestration platform that issues instructions to banks and mirrors their authoritative states



12\. OUTPUT EXPECTATION FOR AI BUILDER



When generating implementation from MOD-005, the AI App Builder MUST:



implement escrow state machines (non-custodial) with all defined states and transitions



define payment intent structures with idempotency enforcement



enforce bank-mirroring logic (internal states are non-authoritative)



ensure strict ESS-001F compliance (all financial execution delegated to bank)



integrate with MOD-002 and MOD-003 lifecycle events (escrow creation on contract, settlement on delivery)



maintain audit-grade reconciliation models



implement multi-payment method support (mobile money, cards, bank transfer)



implement milestone-based release instructions (pickup, border, delivery, POD)



implement dispute hold and resolution workflow



implement digital wallet as a ledger-only representation



include edge-case handling (payment failure, duplicate requests, dispute hold, reconciliation mismatch)



provide conceptual API endpoints per Section 4.7



If incomplete:



Output: TODO: requires specification from MOD-005



13\. DESIGN PRINCIPLE



MOD-005 ensures:



all financial activity in NexCargo is structured, auditable, and externally executed via regulated banking systems while remaining fully traceable within the platform



NexCargo never directly holds funds, maintaining regulatory compliance and institutional-grade trust



escrow states are always mirroring bank authority



settlements are milestone-verified and bank-executed



disputes are bank-enforced and auditable



reconciliation is continuous, transparent, and flags discrepancies without auto-correction



the platform serves as a secure financial orchestration layer, not a financial institution


---

DOCUMENTATION CHANGE HISTORY

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-1 | Change-history block established under the INDEX §7.4 Document Change-History Standard. History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register. The rows below record the evidenced changes that the register and this document's own inline citations support, each dated when the change was actually made. Creating this block altered no escrow rule, record field, workflow, permission or authority boundary in this module. | HAO decision D-01 Item 6 Stage 1 (NXC-HOA-AUTH-D01-ITEM-06-STAGE-1); INDEX §7.4 |
| 2026-11-02 | NXC-HOA-AUTH-D01-001 | §7.8 added as a cross-reference to the closed escrow-intervention eligibility trigger list, which is defined once, authoritatively, in ESS-001F §15.6; MOD-005 adds no trigger, references no trigger of its own and grants no authority from the rule. Escrow state, the No Custody invariant and every existing role boundary are unchanged. | HAO decision D-01 Item 1 (NXC-HOA-AUTH-D01-001); Development State register, D-01 row |
| 2026-11-02 | NXC-HOA-DECISION-D01-ITEM-02 | §7.8 extended to point at the Escrow Intervention Request logical object, lifecycle and decision tiers defined in ESS-001F §15.7 to §15.10, recording that MOD-005 adds no field, state, transition, threshold or execution path to that definition and that an approved request authorises NexCargo only to raise an instruction through the §15.3 pathway. No instrument, workflow state or execution capability was created. | HAO decision D-01 Item 2 (NXC-HOA-DECISION-D01-ITEM-02); Development State register, D-01 Item 2 row |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | §4.3 and §4.4 aligned to the approved authority model: settlement approval and a dispute resolved to a financial outcome are recorded by Admin within delegated authority, or by SUPER_ADMIN where the matter sits inside an Escrow Intervention Request classified Tier 2 under ESS-001F §15.9; a Moderator investigates, records findings and recommends, may continue ordinary case handling, and is not the resolving or approving actor. No AI actor may approve a settlement. Approval remains an internal decision and never external execution; execution remains with the bank or authorised payment provider. No field, state, queue, permission or financial instrument was added, renamed or removed. | HAO decision D-01 Item 3 (NXC-HOA-AUTH-D01-ITEM-03-001); Development State register, D-01 Item 3 row; ESS-001F §15.1 to §15.5 |

Version effect: MOD-005 remains v1.0 — no version increase, no loader change and no INDEX §7.1 change. This block records changes already made and registered under the authorisations cited in it; creating the block changed no rule, record, workflow or authority boundary in this module.
