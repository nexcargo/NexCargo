MOD-013 — AI ERPS Payments Escrow Settlement \& Financial Infrastructure Layer Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY

Module ID: MOD-013

Module Name: AI ERPS Payments Escrow Settlement \& Financial Infrastructure Layer Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE

This module defines the financial orchestration and escrow coordination layer of NexCargo.



It governs how:



payments, escrow states, settlement workflows, and financial events are structurally represented and coordinated across the system via regulated external financial partners



escrow funds are held and managed exclusively by regulated banking partners



multi-channel payment collection is structured (mobile money, cards, bank transfers, PayPal for deposits)



settlement and payout orchestration is defined and triggered



multi-currency handling is structured across SADC corridors (MZN, USD, ZAR)



financial reconciliation and audit reporting are defined



Critical constraint: This module does NOT execute financial transactions, hold funds, or act as a financial intermediary. All funds exist in regulated external banking systems (ESS-001F authority).



This module defines the deterministic structure of financial flows, states, and event triggers in alignment with ESS-001F.



3\. DOMAIN SCOPE

MOD-013 governs:



3.1 Escrow Lifecycle Structuring

escrow state modeling (created → funded → locked → released → disputed → closed)



lifecycle transitions (funding → locking → release → settlement)



milestone-based escrow segmentation (pickup, border, delivery, POD)



bank-managed escrow accounts



3.2 Payment Flow Representation

inbound payments (funding) via multiple channels



outbound settlements (payout triggers)



payment channel abstraction (mobile money, cards, bank transfer, PayPal)



payment confirmation and validation



3.3 Settlement Orchestration Model

settlement request structure



approval triggers (system + external bank validation)



payout coordination flow



partial settlements based on milestones



batch payout support



3.4 Financial Event Structuring

financial event definitions



ledger synchronisation events (internal mirror only)



reconciliation event modelling



transaction fee and commission structure



3.5 Multi-Currency Operations

currency conversion structure (MZN, USD, ZAR)



exchange rate timestamping



settlement currency definition at booking stage



3.6 Refund \& Dispute Payment Handling

dispute hold structure



refund and split settlement instructions



dispute resolution financial outcomes



3.7 Financial Audit \& Reporting

regulatory-grade financial reporting



audit trail structures



reconciliation reporting



4\. CORE DOMAIN ENTITIES

These are financial state representations only.



4.1 Escrow Account Object

Represents logical escrow state (NOT actual funds).



Required attributes:



escrowId



shipmentId – MOD-003 reference



contractId – MOD-002 reference



payerId – Shipper



payeeId – Transporter



escrowStatus – CREATED / FUNDED / LOCKED / PARTIAL\_RELEASED / FULLY\_RELEASED / DISPUTED / CLOSED



totalAmount



currency – MZN / USD / ZAR



fundingSource – MOD-011 integration reference



bankReferenceId – external system only



createdAt



updatedAt



milestoneReleaseSchedule – structured JSON of milestone-based release amounts



Business rules:



Escrow funds are held and managed exclusively by regulated banking partners.



NexCargo does NOT directly hold regulated escrow funds.



Platform only issues instructions (hold, release, refund).



Milestone-based release rules are enforced via MOD-003 tracking.



4.2 Payment Transaction Object

Represents payment event abstraction.



Attributes:



transactionId



transactionType – FUNDING / PAYOUT / REFUND / FEE



amount



currency



paymentChannel – M\_PESA / MKESH / E\_MOLA / CARD\_VISA / CARD\_MASTERCARD / PAYPAL / BANK\_TRANSFER



status – PENDING / CONFIRMED / FAILED / REFUNDED



correlationId



externalProviderReference



idempotencyKey



timestamp



feeAmount – platform fee deducted



Business rules:



All payments must be mapped to a shipment or wallet.



Payment confirmation is required before escrow activation.



Payment providers are abstracted via unified gateway layer.



4.3 Settlement Request Object

Represents payout execution trigger structure.



Attributes:



settlementId



escrowId



triggerEvent – PICKUP\_CONFIRMED / BORDER\_CROSSING / DELIVERY\_CONFIRMED / POD\_APPROVED



requestedByModule – MOD-003



approvalStatus – PENDING / APPROVED / REJECTED / EXECUTED / FAILED



bankExecutionReference



settlementType – FULL / MILESTONE / REFUND



settlementAmount



requestedAt



executedAt – optional



retryCount



Business rules:



Settlement is triggered by MOD-003 POD confirmation.



Partial settlements are allowed based on milestones.



Settlement must respect currency rules (MOD-009).



Fraud flags (MOD-010) can pause settlement.



4.4 Financial Ledger Mirror Object

Represents internal read-only financial state mirror.



Attributes:



ledgerEntryId



transactionReference



debitCreditType – DEBIT / CREDIT



amount



currency



source



destination



timestamp



reconciliationStatus – PENDING / ALIGNED / MISMATCH\_DETECTED



externalLedgerReference



entryType – ESCROW / PAYMENT / SETTLEMENT / FEE / REFUND



Business rules:



Wallet is a ledger representation, not custodial escrow.



Every transaction must be double-entry recorded.



Ledger is immutable (MOD-010 governance).



Wallet balances reflect escrow states and payouts.



4.5 Currency Conversion Record

Represents multi-currency conversion structure.



Attributes:



conversionId



fromCurrency



toCurrency



amount



convertedAmount



exchangeRate



rateTimestamp



rateSource



transactionId – reference to associated transaction



Business rules:



Exchange rates must be time-stamped.



Conversion must be transparent in transactions.



Settlement currency is defined at booking or contract stage.



4.6 Refund Instruction Object

Represents financial resolution for disputes.



Attributes:



refundId



escrowId



disputeId – reference to MOD-010 dispute



refundType – FULL / PARTIAL / SPLIT\_SETTLEMENT



amount



currency



recipientId



resolutionOutcome



approvedBy – moderator/admin reference



bankExecutionReference



status – PENDING / APPROVED / EXECUTED / FAILED



executedAt – optional



Business rules:



Funds remain locked during disputes.



Moderator decisions (MOD-010) determine release direction.



All dispute actions are auditable.



4.7 Transaction Fee Record

Represents platform fee calculation structure.



Attributes:



feeId



transactionId – reference to associated transaction



feeType – PLATFORM\_COMMISSION / PAYMENT\_PROCESSING / CURRENCY\_CONVERSION



feeAmount



feeCurrency



feePercentage – if percentage-based



calculationBasis



corridorId – optional corridor-based pricing



timestamp



Business rules:



Fee structure is configurable by admin (MOD-007 \& MOD-010).



Fees are applied at booking or settlement stage.



Transparent breakdown is required per transaction.



Corridor-based pricing variations are supported (MOD-009).



4.8 Payout Instruction Object

Represents payout execution to transporters.



Attributes:



payoutId



settlementId – reference



recipientId



recipientChannel – MOBILE\_MONEY / BANK\_TRANSFER



amount



currency



status – PENDING / IN\_PROGRESS / COMPLETED / FAILED



bankExecutionReference



retryCount



requestedAt



executedAt – optional



failureReason – optional



Business rules:



Payout is triggered only after confirmed delivery.



Batch payouts are supported.



Banking cut-off times are respected.



Retry mechanism is required for failed payouts.



4.9 Financial Audit Record

Represents regulatory-grade financial reporting structure.



Attributes:



auditId



auditType – DAILY\_RECONCILIATION / MONTHLY\_REPORT / REGULATORY\_SUBMISSION



periodStart



periodEnd



reportData – structured JSON



generatedAt



generatedBy



verificationStatus – PENDING / VERIFIED / SUBMITTED



externalReference – optional



Business rules:



Reports must include all transaction history.



Must support external audits.



Data aligned with MOD-012 BI system.



Immutable audit logs are required.



5\. FINANCIAL ARCHITECTURE MODEL

5.1 No Custody Principle (ABSOLUTE)

NexCargo MUST NEVER:



hold customer funds



store real escrow balances



act as financial intermediary



All funds exist in:



regulated external banking systems (ESS-001F authority)



5.2 Event-Driven Financial Flow

Financial actions MUST follow:



text

Business event occurs (MOD-003 / MOD-002 / MOD-008)

&#x20;      ↓

Financial trigger emitted

&#x20;      ↓

MOD-013 structures settlement request

&#x20;      ↓

MOD-011 routes to external financial provider

&#x20;      ↓

Bank executes transaction (external authority)

&#x20;      ↓

Webhook confirms result (ESS-001D)

&#x20;      ↓

Internal ledger mirror updated (MOD-012)

5.3 Dual-Ledger Model

External Ledger (Source of Truth):



bank systems



mobile money providers



card processors



Internal Ledger (Read-Only Mirror):



reconciliation only



analytics support



audit trail verification



5.4 Settlement Authority Model

MOD-013 defines structure



ESS-001F defines execution rules



banks execute actual fund movement



No internal system component can override bank state.



5.5 Financial Flow State Machine

text

PAYMENT INITIATED (shipper funds payment)

&#x20;      ↓

PAYMENT CONFIRMED (provider confirmation)

&#x20;      ↓

ESCROW ACTIVATED (bank holds funds)

&#x20;      ↓

\[Partial Release Optional] (milestone reached)

&#x20;      ↓

DELIVERY CONFIRMED (POD from MOD-003)

&#x20;      ↓

SETTLEMENT EXECUTED (bank transfers funds)

&#x20;      ↓

LEDGER UPDATED (internal mirror)

&#x20;      ↓

RECONCILIATION (external vs internal alignment)

Dispute State:



text

ESCROW HELD (funds in bank)

&#x20;      ↓

DISPUTE RAISED (MOD-010)

&#x20;      ↓

BANK FREEZE (hold instruction)

&#x20;      ↓

RESOLUTION (moderator decision)

&#x20;      ↓

RELEASE / REFUND / SPLIT (bank executes)

6\. RESPONSIBILITIES

MOD-013 is responsible for:



6.1 Financial State Modeling

defining escrow and payment lifecycle structure



ensuring consistency of financial state transitions



defining milestone-based escrow segmentation



6.2 Settlement Structuring

defining payout request format



ensuring structured trigger conditions



defining partial and full settlement structures



6.3 Ledger Mirror Definition

maintaining internal financial state consistency model



supporting reconciliation structures



ensuring double-entry recording



6.4 Payment Flow Abstraction

defining how payments move through system layers



ensuring channel neutrality



defining multi-currency conversion structures



6.5 Fee \& Commission Structuring

defining fee calculation structures



supporting corridor-based pricing variations



ensuring transparent fee breakdowns



6.6 Dispute \& Refund Structuring

defining dispute hold structures



defining refund and split settlement instructions



ensuring auditability of dispute outcomes



6.7 Financial Audit \& Reporting Structuring

defining regulatory-grade reporting structures



ensuring alignment with MOD-012 BI system



maintaining immutable audit logs



7\. RULES OF OPERATION

7.1 No Execution Rule (CRITICAL)

MOD-013 MUST NOT:



execute payments



approve settlements



interact directly with banking APIs



modify external financial state



simulate payment success



7.2 Bank Authority Rule

External banks are the ONLY execution authority.



Internal system only requests and receives confirmations.



Bank is the final authority on all fund movements.



7.3 Escrow Immutability Rule

Escrow states MUST follow strict transitions.



State changes MUST be event-driven.



No direct state overrides are allowed.



No internal wallet can bypass escrow rules.



7.4 Reconciliation Rule

Internal ledger MUST always reconcile with external systems.



Mismatches MUST trigger anomaly events (MOD-006).



Daily reconciliation is required.



Zero tolerance mismatch between ledger and escrow records.



7.5 Financial Isolation Rule

Financial logic is isolated from operational modules.



Only event triggers are shared between systems.



No module can bypass financial governance layers.



7.6 Multi-Currency Rule

Exchange rates must be time-stamped.



Conversion must be transparent in transactions.



Settlement currency is defined at booking or contract stage.



All conversions must be traceable and reproducible.



7.7 AI Restriction Rule

AI cannot initiate financial transfers.



AI cannot execute or authorise financial actions.



AI outputs are used for risk scoring only (not enforcement).



7.8 Neutrality Rule

MOD-013 MUST NOT:



move money



authorise financial execution



override bank decisions



directly manage external ledger systems



bypass ESS-001F constraints



8\. EVENT MODEL (SPECIFICATION ONLY)

Declared financial events:



EscrowCreated



PaymentInitiated



PaymentConfirmed



PaymentFailed



FundsLockedInEscrow



MilestoneReleaseTriggered



SettlementRequested



SettlementApproved



SettlementExecuted – external confirmation



SettlementFailed



RefundTriggered



RefundExecuted



DisputeHoldInstructed



DisputeResolutionExecuted



LedgerReconciled



ReconciliationMismatchDetected



FinancialAnomalyDetected



FeeCalculated



PayoutInitiated



PayoutCompleted



CurrencyConversionApplied



AuditReportGenerated



Consumed by:



MOD-003 → shipment lifecycle triggers (settlement on delivery)



MOD-005 → operational payment workflows



MOD-006 → anomaly detection



MOD-010 → compliance enforcement



MOD-012 → financial analytics and reconciliation



MOD-017 → observability tracking



MOD-016 → financial notifications



9\. INTEGRATION BOUNDARIES

MOD-013 interacts conceptually with:



ESS-001F → Financial Integration Architecture (PRIMARY EXECUTION AUTHORITY)



ESS-004 → Integration Contracts Specification



ESS-006 → Compliance \& Audit Rules



ESS-001C → Retry \& timeout rules



ESS-001D → Webhook Governance Standard



ESS-001E → Error Code Standardisation



MOD-011 → external payment system integration layer



MOD-003 → shipment completion triggers



MOD-002 → contract-based escrow creation



MOD-009 → multi-currency rules and corridor context



MOD-010 → compliance and fraud enforcement



MOD-012 → financial analytics and reconciliation



MOD-013 does NOT:



move money



authorise financial execution



override bank decisions



directly manage external ledger systems



bypass ESS-001F constraints



10\. ESS DEPENDENCY REFERENCES (CANONICAL)

MOD-013 is constrained by:



ESS-001F → Financial Integration Architecture (CRITICAL AUTHORITY)



ESS-001C → Retry \& Timeout Policy Matrix



ESS-001D → Webhook Governance Standard



ESS-001E → Error Code Standardisation



ESS-004 → Integration Contracts Specification



ESS-006 → Compliance \& Audit Specification



ESS-007 → Coding Standards



ESS-009 → Data Governance Rules



ESS-003 → AI constraints (no financial execution behaviour)



11\. ARCHITECTURE BOUNDARY RULE

MOD-013 MUST NOT:



execute financial transactions



bypass escrow rules



modify external ledger data



override ESS-001F constraints



simulate payment success



act as a financial custodian



MOD-013 IS:



a deterministic financial orchestration and escrow state modelling layer that defines how monetary flows are structured, triggered, and reconciled within NexCargo without ever controlling actual funds



a framework for multi-channel payment collection, bank-managed escrow, and automated settlement



a reconciliation and audit structure ensuring financial integrity



12\. OUTPUT EXPECTATION FOR AI BUILDER

When generating implementation from MOD-013, the AI App Builder MUST:



implement escrow state machine model with all defined states and transitions



enforce event-driven settlement triggers (delivery confirmation, milestone events)



integrate with ESS-001F bank execution rules (no direct financial execution)



maintain immutable ledger mirror structures (double-entry, read-only)



ensure reconciliation pipeline integrity (daily reconciliation, mismatch flagging)



prevent direct financial execution logic in application layer



implement multi-channel payment gateway abstraction (mobile money, cards, bank transfer, PayPal deposits)



implement multi-currency conversion engine (MZN, USD, ZAR)



implement settlement engine with partial and full settlement support



implement fee and commission engine with corridor-based pricing variations



implement refund and dispute payment handling



implement payout orchestration system with retry mechanism



implement financial audit and reporting layer



include edge-case handling (payment failure, settlement failure, reconciliation mismatch, dispute hold, currency conversion failure, payout retry exhaustion)



ensure compliance with PCI-DSS requirements for card payments



ensure end-to-end encryption for financial data



ensure no module can bypass escrow rules



ensure AI cannot initiate financial transfers



If incomplete:



Output: TODO: requires specification from MOD-013



13\. DESIGN PRINCIPLE

MOD-013 ensures:



financial operations in NexCargo are fully structured, auditable, and event-driven while external regulated banks remain the only execution authority for real-world monetary movement



escrow is always bank-managed and compliant



settlement flows operate automatically and accurately



ledger and escrow reconciliation is always balanced



multi-currency operations are stable and traceable



financial audits can be executed without discrepancies



the platform operates as a financially compliant logistics marketplace with bank-grade escrow infrastructure

