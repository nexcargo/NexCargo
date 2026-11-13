# NEXCARGO C4 — PAYMENT → FINANCIAL EXECUTION OPERATIONAL
## CORRECTED PRE-AUTHORIZATION RECONCILIATION REPORT

**Corrected after HAO continuity reconciliation (2026-09-08)**

---

## 1. CORRECTED POST-C3 BASELINE

C3 — BOOKING → CONTRACT → ESCROW is **CLOSED / COMPLETE — VERIFIED** by HAO decision.

### What C3 Delivered (Operational)

| Capability | Status | Evidence |
|---|---|---|
| `contracts` table (`logistics_schema`) | DEPLOYED | Migration `005_contracts_and_escrow_rls.sql` |
| Contracts RLS policies (3 total) | DEPLOYED | `contracts_shipper_read`, `contracts_transporter_read`, `contracts_admin` |
| Immutable field column grants | DEPLOYED | `REVOKE UPDATE` on base_amount, currency, terms_snapshot, etc. |
| `escrow_records` table (`financial_schema`) | DEPLOYED | Present since migration `001_initial.sql` |
| Escrow RLS policies (2 total) | DEPLOYED | `escrow_counterparty_read`, `escrow_admin` |
| `confirm_booking_with_contract` RPC | OPERATIONAL | Produces CONFIRMED booking + SIGNED contract |
| `activate_contract_with_escrow` RPC | OPERATIONAL | Transitions Contract → ACTIVE, creates `escrow_records` row at `PENDING_CREATION` |
| Shipper-first contract acceptance | IMPLEMENTED | Acceptance workflow verified in live Supabase |
| Transporter-first contract acceptance | IMPLEMENTED | Bidirectional acceptance flow verified |
| Active Contract transition | AUTOMATED | `activate_contract_with_escrow` RPC |
| Automatic escrow creation (PENDING_CREATION) | AUTOMATED | Triggered by contract activation RPC |
| Authorization controls on financial paths | ENFORCED | RBAC + RLS on all financial tables |
| Idempotency protections | ENFORCED | Verified in C3 RPC design |
| TD-C2-001 / TD-C2-002 hardening | COMPLETED | Triad coherence + transporter identity verified in RPC |
| Live functional verification | CONFIRMED | Full chain verified end-to-end on Supabase |

### C3 → C4 Handoff

```
Booking.CONFIRMED (C3)
    ↓ confirm_booking_with_contract()
Contract.SIGNED
    ↓ activate_contract_with_escrow()
Contract.ACTIVE
    └→ financial_schema.escrow_records INSERT (state = PENDING_CREATION)
        ↓
        ════════════════════════════════
        C4 STARTS HERE
        ════════════════════════════════
```

The escrow record for this contract exists in `financial_schema.escrow_records` with:
- `contract_id` → links to the ACTIVE contract
- `amount` → from contract base_amount
- `currency` → from contract currency (default MZN)
- `state` = `'PENDING_CREATION'`
- `payment_method` = NULL (not yet selected)
- `external_transaction_ref` = NULL (no provider payment yet)
- `bank_confirmation_status` = NULL (funds not yet locked)

### Corrective Statement

The previous C4 readiness report contained a **material accuracy error** stating that C3 was unauthorized/incomplete and that contracts/escrow were "database only." This has been corrected per HAO closure. C3 produced a fully operational pipeline from Marketplace through Contract activation to Escrow creation. C4's job begins exactly when an escrow record sits at `PENDING_CREATION` awaiting funding.

---

## 2. C4 OPERATIONAL OBJECTIVE

Make the financial lifecycle from `ESCROW.PENDING_CREATION` through complete settlement genuinely operational.

Specifically, after C3 produces an escrow record at `PENDING_CREATION`, C4 must operationalize:

1. **Payment initiation** — shipper selects a payment channel and initiates funding
2. **Payment execution orchestration** — NexCargo routes the payment request to a provider via MOD-011 adapters
3. **Webhook/callback ingestion** — provider confirms fund receipt or failure
4. **Escrow state advancement** — state progresses through INITIATED → LOCKED → (milestone releases) → SETTLEMENT → CLOSED
5. **Settlement orchestration** — upon delivery confirmation (MOD-003), NexCargo requests bank release
6. **Reconciliation** — internal ledger records align with external provider/bank confirmation
7. **Dispute hold** — disputed escrow transitions to DISPUTE_HOLD with fund freeze instructions

All within the strict No Custody boundary: NexCargo coordinates, never holds.

---

## 3. RECONSTRUCTED C4 LIFECYCLE

```
START: escrow_records.state = PENDING_CREATION (C3 output)
│
├─ [SHIPPER] Selects payment method: M-Pesa / Card / Bank Transfer
│
├─ C4: Creates PaymentIntent record
│       status = 'INITIATED'
│       idempotency_key = <hash of escrowId + paymentMethod + amount>
│       state machine: EscrowState.PENDING_CREATION → FUNDS_INITIATED
│       Event: PaymentInitiated emitted
│
├─ C4: Routes payment request through MOD-011 adapter layer
│       POST /api/integrations/{provider}/payments
│       Includes: amount, currency, phone/card ref, correlation_id
│
├─ [EXTERNAL PROVIDER] Processes payment via real channel
│       (M-Pesa STK push, card token charge, bank transfer instruction)
│
├─ [EXTERNAL PROVIDER] Sends webhook/callback
│       POST /api/webhooks/[provider]/confirmation
│
├─ C4: Webhook processor verifies signature (ESS-001D)
│       Checks idempotency key against existing records
│       Validates provider reference matches expected
│
├─ C4: Applies payment confirmation
│       PaymentIntent.status → 'CONFIRMED'
│       State machine: FUNDS_INITIATED → FUNDS_LOCKED
│       escrow_records.bank_confirmation_status = 'CONFIRMED'
│       External transaction reference captured
│       Event: FundsLocked emitted
│
├─ C4: Records double-entry ledger entry
│       Debit: escrow_fund_held
│       Credit: shipper_payout_pending
│
│   ═══════════════════════════════════════════════════════════
│   Shipment executes (tracking via MOD-003 / MOD-008)
│   Milestones pass: Pickup → In Transit → Delivery Confirmed
│   ═══════════════════════════════════════════════════════════
│
├─ [MOD-003] Emits DeliveryConfirmed signal
│
├─ C4: Settlement Request created
│       trigger_event = DELIVERY_CONFIRMED
│       settlement_type = FULL
│       approval_status = PENDING
│       State machine: FUNDS_LOCKED → PARTIAL_RELEASE or FINAL_RELEASE
│       Event: SettlementRequested emitted
│
├─ C4: Routes settlement instruction through MOD-011 to bank
│       ESS-001F §6: Settlement Engine coordinates bank release
│
├─ [EXTERNAL BANK] Processes release
│       Sends webhook confirming fund transfer
│
├─ C4: Applies settlement confirmation
│       SettlementRequest.approval_status → EXECUTED
│       ledger_mirror reconciliation_status → ALIGNED
│       Event: SettlementExecuted emitted
│
├─ C4: Reconciliation check
│       Internal ledger vs. external confirmation
│       If mismatch: flag_reconciliation_mismatch()
│       If aligned: continue
│
│   ═══════════════════════════════════════════════════════════
│   [ALTERNATE PATH — DISPUTE]
│
│   ├─ [MOD-015] Dispute raised for this shipment
│   │
│   ├─ C4: Creates RefundInstruction record
│   │       dispute_hold_instructions sent to provider/bank
│   │       State machine: FUNDS_LOCKED → DISPUTE_HOLD
│   │
│   ├─ [MOD-015/MOD-010] Moderator investigates resolution
│   │       Outcome: RELEASE_TO_TRANSPORTER / REFUND_TO_SHIPPER / SPLIT
│   │
│   ├─ C4: Executes refund/split per resolution
│   │       State machine: DISPUTE_HOLD → PARTIAL_RELEASE or FINAL_RELEASE
│   │       Mod013DisputeResolutionCallback returned to MOD-005
│   │
│   ═══════════════════════════════════════════════════════════
│
├─ C4: Sets escrow to ESCROW_CLOSED
│       Event: EscrowClosed emitted
│
END
```

---

## 4. C4-REQUIRED CAPABILITIES

The following capabilities are classified by examining each against authoritative specifications:

### REQUIRED FOR C4

| # | Capability | Spec Source | Rationale |
|---|---|---|---|
| R1 | **Payment initiation API** — `POST /api/payments` | MOD-005 §4.2, §4.7 (Payment Intent) | Without this, no payment can be initiated from PENDING_CREATION. Shipper cannot select payment method. Core C4 gap. |
| R2 | **Payment confirmation/closure API** — `POST /api/payments/{id}/confirm` | MOD-005 §4.2, §4.7 | Captures result of provider interaction. Drives state machine transition FUNDS_INITIATED → FUNDS_LOCKED. |
| R3 | **Webhook ingestion endpoint** — `POST /api/webhooks/[provider]` | ESS-001D §3 (architecture flow), §2 (principles) | Provider callbacks are the only mechanism forFUNDS_INITIATED → FUNDS_LOCKED. No webhook = no way to advance from initiated to locked. |
| R4 | **Payment provider adapter abstraction** | ESS-001F §4 (channels), MOD-013 §3.2 | Required routing layer. Each provider gets an adapter implementing the same interface. Adapter factory already scaffolded (Wave 5). |
| R5 | **PaymentIntent database table** | MOD-005 §4.2 entity spec | Entity defined (PaymentIntent interface) but no backing table. Required for idempotency enforcement (MOD-005 §7.5) and audit trail. |
| R6 | **settlement_requests database table** | MOD-013 §4.3 entity spec | Settlement orchestration requires persistent state. Entity defined but no table. Required for settlement lifecycle tracking. |
| R7 | **Financial ledger entries table** | ESS-001F §7 (ledger), MOD-013 §4.4 (mirror) | Double-entry recording mandatory (MOD-013 §7.4 dual-entry rule). Ledger mirror required for reconciliation. |
| R8 | **Idempotency enforcement at application + database level** | MOD-005 §7.5 ("All payment requests MUST be idempotent"), MOD-013 §7.4 ("Duplicate payment events MUST be rejected") | Financial integrity requirement. Duplicate detection prevents double-charging shipper. |
| R9 | **Settlement request API** — `POST /api/settlements` | MOD-013 §3.3, §4.3 | Without this, settlement cannot be requested after milestone event. Settlement orchestration is explicitly part of C4 lifecycle (§5.5). |
| R10 | **Settlement execution confirmation** — handling bank/provider webhook response | ESS-001F §6.3 ("NEVER execute without bank confirmation"), MOD-013 §5.4 | Settlement finality depends on external confirmation. Must capture and process this. |
| R11 | **Reconciliation check capability** | MOD-005 §3.5, §7.6, MOD-013 §6.3 | Continuous reconciliation mandated. At minimum: compare internal state with provider confirmation. |

### SUPPORTING C4

| # | Capability | Spec Source | Rationale |
|---|---|---|---|
| S1 | **Refund instruction table + API** | MOD-013 §4.6 (RefundInstructionObject) | Needed for dispute resolution path. Supports full C4 lifecycle but not on critical path for happy-path settlement. |
| S2 | **Fee/commission calculation at settlement** | MOD-013 §4.7 (TransactionFeeRecord) | Platform revenue mechanism. Structurally present in spec. Can be simple percentage-based for MVP. |
| S3 | **Multi-currency basic conversion** | MOD-013 §3.5, §4.5 | Currency specified at contract stage. Simple exchange rate capture needed if multi-currency. Could defer full FX engine to later. |
| S4 | **Payout instruction generation** | MOD-013 §4.8 (PayoutInstructionObject) | Structure for transporter payout routing. Execution delegated to bank/provider. Table+structure supports C4 completeness. |
| S5 | **Basic auto-reconciliation on-demand** | ESS-001F §8.2 | Real-time critical matching for payments; daily batch deferred. On-demand reconciliation (`GET /reconciliation/{escrowId}`) supports C4 verification. |

### LATER MILESTONE

| # | Capability | Spec Source | Rationale |
|---|---|---|---|
| L1 | **Automated daily batch reconciliation** | ESS-001F §8.2 ("daily batch reconciliation") | Scheduled batch processing infrastructure. Requires cron/scheduler not currently established. Deferred to compliance/operational wave. |
| L2 | **AI fraud detection advisory** | ESS-001F §9, MOD-006 | AI-driven anomaly detection is MOD-006 responsibility (C5/C8 scope). Advisory-only. |
| L3 | **Regulatory audit report generation** | MOD-013 §4.9, §6.7 | Monthly/regulatory submissions require scheduled processes and admin UI. Later milestone. |
| L4 | **User-facing wallet balance UI** | MOD-005 §3.4 (Digital Wallet), MOD-007 dashboards | Presentation layer belongs to Wave 3 dashboard module. Data model may exist in C4 but display is C6. |
| L5 | **Mobile payment flows** | MOD-008 | Mobile-app-specific payment UX. Belongs to C9 mobile wave. |
| L6 | **Bank-of-Record mTLS production integration** | ESS-001B, ESS-001F | Production banking partner direct integration. Credential onboarding required externally. Separate authorization gate. |

---

## 5. PROPOSED C4 BOUNDARY (REFINED)

### C4 MUST DELIVER

1. **Payment initiation API** — `POST /api/payments`: validates escrow exists at PENDING_CREATION, creates PaymentIntent, validates idempotency key, advances state machine (PENDING_CREATION → FUNDS_INITIATED), persists PaymentIntent record
2. **Provider routing** — `POST /api/providers/payment`: routes PaymentIntent through MOD-011 adapter interface to selected payment method; returns provider session/reference
3. **Webhook ingestion** — `POST /api/webhooks/[mpesa|card|paypal]`: receives provider callback, verifies signature per ESS-001D, checks idempotency, updates PaymentIntent status, triggers state machine (FUNDS_INITIATED → FUNDS_LOCKED), updates escrow bank_confirmation_status, records double-entry ledger, emits FundsLocked event
4. **Settlement request API** — `POST /api/settlements`: accepts milestone reference (from MOD-003), creates SettlementRequest, validates escrow is in appropriate state for release, routes settlement instruction through MOD-011 to bank/provider
5. **Settlement confirmation webhook handler** — similar pattern to payment webhook: verifies, applies idempotency, advances settlement state, reconciles ledger, emits settlement executed event
6. **Reconciliation endpoint** — `GET /api/reconciliation/{escrowId}`: compares internal payment/ledger state against provider confirmation records, returns alignment status
7. **New database tables with RLS**: `payment_intents`, `settlement_requests`, `financial_ledger_entries` (+ optionally `refund_instructions`)
8. **Adherence to all mandatory financial controls** (Section 9)

### C4 SHOULD INCLUDE (as minimal supporting structures)

9. **Refund instruction table + structure** — for dispute resolution path completeness
10. **Fee record table + calculation** — platform commission applied at settlement
11. **Mock/stub provider adapters** — M-Pesa and one card adapter returning controlled test responses (to enable full lifecycle testing without real credentials)

### C4 MUST NOT IMPLEMENT

12. **Production provider credential usage** — no real money moves; mock/stub only until separate sandbox authorization
13. **Scheduled batch reconciliation jobs** — on-demand only
14. **Any direct customer fund holding or custody** — absolute No Custody principle
15. **UI/dashboard components for financial views** — presentation layer outside C4
16. **Autonomous settlement execution** — NexCargo only sends instructions; bank/provider executes
17. **Cross-border customs/tax calculations** — MOD-009 domain
18. **AI-advised fraud detection rules** — MOD-006 domain

---

## 6. RELEVANT MODULES AND EXISTING IMPLEMENTATION

### Directly Responsible

| Module | What Exists | What C4 Uses From It |
|---|---|---|
| **MOD-005** (Escrow & Payment Management) | Entity interfaces (6 entities incl. PaymentIntent, SettlementRecord, DisputeRecord, ReconciliationRecord, DigitalWallet); BC contracts (4); state machine (27 tests + 17 validation service tests); enums (7); barrel exports | **Use case:** Payment initiation service; settlement coordination; dispute-to-hold mapping. State machine is authoritative for escrow transitions. BC interfaces drive MOD-013 settlement triggering. |
| **MOD-013** (Financial Infrastructure) | Entity interfaces (10 incl. PaymentTransactionObject, SettlementRequestObject, FinancialLedgerMirrorObject, RefundInstructionObject, TransactionFeeRecord, PayoutInstructionObject, FinancialAuditRecord); BC contracts (4 consuming MOD-005 surfaces); state machine (22 tests + 31 validation service tests); enums (9 including AuditVerificationStatus, RecipientChannel); barrel exports | **Use case:** Settlement request API; ledger mirror double-entry recording; fee calculation; reconciliation data structures; payout instruction generation. BC interfaces define MOD-005→MOD-013 settlement data flow. |

### Supporting

| Module | Role in C4 | Existing Implementation |
|---|---|---|
| **MOD-011** (Platform Integration) | Provider adapter routing, gateway infrastructure | Adapter factory scaffolded (Wave 5 Inc 1). Contract framework present. Actual payment provider adapters NOT implemented. |
| **MOD-002** (Booking & Contracts) | Contract state source (ACTIVE), provides contract_id reference | Design-time state machines, BC contracts with MOD-005/013 |
| **MOD-003** (Tracking) | Milestone signals (DeliveryConfirmed) trigger settlement | Design-time state machines, BC contracts, event types defined |
| **MOD-015** (Support & Disputes) | Dispute raising/resolution triggers escrow DISPUTE_HOLD | Design-time entity interfaces, dispute categorization |
| **MOD-016** (Notifications) | Payment/settlement/dispute notifications | Design-time notification routing |
| **MOD-010** (Security & Compliance) | RBAC enforcement, compliance rules on financial endpoints | RBAC permission evaluator, security event classifier |
| **MOD-017** (Observability) | Metrics/tracing for financial operations, health monitoring | Logging/alerting foundation (Inc 1), metrics/tracing/health (Inc 2) |

---

## 7. PROPOSED FINANCIAL DATA MODEL

### Assessment of Existing Schema

The existing `financial_schema.escrow_records` (migration `001_initial.sql`) has these columns:

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `id` | UUID PK | NO | Record identifier |
| `contract_id` | UUID FK | YES | Links to ACTIVE contract |
| `amount` | NUMERIC | NO | Total escrow amount |
| `currency` | VARCHAR(3) | YES | Currency code (default MZN) |
| `state` | VARCHAR(50) | YES | EscrowState enum values |
| `payment_method` | VARCHAR(50) | YES | Selected payment channel |
| `external_transaction_ref` | VARCHAR(255) | YES | Provider transaction reference |
| `bank_confirmation_status` | VARCHAR(50) | YES | Confirmation tracking |
| `created_by`, `updated_by` | UUID | YES | Audit trail |
| `correlation_id` | UUID | YES | Transaction tracing |
| `is_deleted` | BOOLEAN | YES | Soft delete |
| `version` | INTEGER | YES | Optimistic locking |
| `created_at`, `updated_at` | TIMESTAMPTZ | YES | Timestamps |

This schema supports the escrow core well. However, it lacks support for multiple payment attempts (a shipper may retry with different method), does not track partial settlements explicitly, and has no place for double-entry ledger records.

### Proposed New Tables

#### Table: `payment_intents`

```
Schema:         financial_schema
Owning Module:  MOD-005
Purpose:        Track individual payment attempt per escrow with idempotency guarantees
Immutability:   Core financial fields (amount, currency, escrow_id) immutable after creation. Status only mutable forward through state machine.
RLS:            counterparty_read (shipper/transporter SELECT), admin_all
Idempotency:    UNIQUE CONSTRAINT on (escrow_id, idempotency_key) — prevents duplicate payment submission
Audit:          created_by, updated_by, correlation_id inherited
```

| Column | Type | Constraint | Source |
|---|---|---|---|
| `id` | UUID PK | DEFAULT gen_random_uuid() | Standard |
| `escrow_id` | UUID FK | REFERENCES financial_schema.escrow_records(id), NOT NULL | MOD-005 §4.2 |
| `amount` | DECIMAL(12,2) | NOT NULL | MOD-005 §4.2 |
| `currency` | VARCHAR(3) | NOT NULL, CHECK IN (MZN,USD,ZAR) | MOD-013 §3.5 |
| `payment_method` | VARCHAR(20) | NOT NULL, CHECK IN (MPESA,MKESH,EMOLA,CARD,PAYPAL,BANK_TRANSFER) | MOD-005 §4.2 |
| `status` | VARCHAR(20) | DEFAULT 'INITIATED', CHECK IN (INITIATED,PENDING,CONFIRMED,FAILED,REFUNDED) | MOD-005 §4.2 |
| `idempotency_key` | VARCHAR(100) | NOT NULL, UNIQUE | MOD-005 §7.5 |
| `provider_reference_id` | VARCHAR(255) | NULLABLE — populated on confirmation | MOD-005 §4.2 |
| `external_transaction_ref` | VARCHAR(255) | NULLABLE | MOD-005 §4.2 |
| `fee_amount` | DECIMAL(12,2) | DEFAULT 0 | MOD-013 §4.7 |
| `failure_reason` | TEXT | NULLABLE | Implementation |
| `created_by`, `updated_by` | UUID | | Standard audit |
| `correlation_id` | UUID | | Standard trace |
| `is_deleted` | BOOLEAN | DEFAULT FALSE | Standard soft-delete |
| `version` | INTEGER | DEFAULT 1 | Standard concurrency |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Standard |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Standard |

**Justification**: PaymentIntent entity is defined in MOD-005 §4.2 as a core domain entity. Without persistence, idempotency enforcement (unique constraint on idempotency_key) and audit trail are impossible. Two payment methods are commonly used in SADC (M-Pesa + Bank Transfer); having a dedicated table allows retries with different methods while preventing accidental double-payment of the same method.

#### Table: `settlement_requests`

```
Schema:         financial_schema
Owning Module:  MOD-013
Purpose:        Track settlement payout requests from milestone events
Immutability:   Financial fields (escrow_id, amount) immutable after creation. Status mutable through approval lifecycle.
RLS:            counterparty_read (shipper/transporter SELECT), admin_all
Idempotency:    UNIQUE on (escrow_id, trigger_event) per escrow — prevents duplicate settlement requests for same milestone
Audit:          Standard audit fields
```

| Column | Type | Constraint | Source |
|---|---|---|---|
| `id` | UUID PK | DEFAULT gen_random_uuid() | Standard |
| `escrow_id` | UUID FK | REFERENCES financial_schema.escrow_records(id), NOT NULL | MOD-013 §4.3 |
| `trigger_event` | VARCHAR(30) | NOT NULL, CHECK IN (PICKUP_CONFIRMED,BORDER_CROSSING,DELIVERY_CONFIRMED,POD_APPROVED) | MOD-013 §4.3 |
| `requested_by_module` | VARCHAR(10) | DEFAULT 'MOD-003' | MOD-013 §4.3 |
| `approval_status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN (PENDING,APPROVED,REJECTED,EXECUTED,FAILED) | MOD-013 §4.3 |
| `settlement_type` | VARCHAR(20) | DEFAULT 'FULL', CHECK IN (FULL,MILESTONE,REFUND) | MOD-013 §4.3 |
| `settlement_amount` | DECIMAL(12,2) | NOT NULL | MOD-013 §4.3 |
| `bank_execution_ref` | VARCHAR(255) | NULLABLE — populated on execution | MOD-013 §4.3 |
| `retry_count` | INTEGER | DEFAULT 0 | MOD-013 §4.3 |
| `failure_reason` | TEXT | NULLABLE | Implementation |
| `created_by`, `updated_by` | UUID | | Standard audit |
| `correlation_id` | UUID | | Standard trace |
| `is_deleted` | BOOLEAN | DEFAULT FALSE | Standard soft-delete |
| `version` | INTEGER | DEFAULT 1 | Standard concurrency |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Standard |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() | Standard |

**Justification**: SettlementRequestObject is defined in MOD-013 §4.3 as a core entity. Settlement orchestration requires persistent state tracking across the approval lifecycle (pending → approved → executed/failed). Without this table, there is no mechanism to track which milestones triggered settlement or whether the bank confirmed execution.

#### Table: `financial_ledger_entries`

```
Schema:         financial_schema
Owning Module:  MOD-013
Purpose:        Double-entry immutable audit ledger mirroring external financial movements
Immutability:   ABSOLUTE IMMUTABILITY — rows are NEVER updated or deleted. Only appended. Corrections use separate adjustment entries.
RLS:            admin_only (no counterparty read — financial details are sensitive)
Idempotency:    UNIQUE on (transaction_reference, entry_sequence) — ensures double-entry pairs are unique
Audit:          Every entry tagged with originating module, user, and correlation_id
```

| Column | Type | Constraint | Source |
|---|---|---|---|
| `id` | UUID PK | DEFAULT gen_random_uuid() | Standard |
| `transaction_reference` | VARCHAR(100) | NOT NULL — ties to PaymentIntent.id or SettlementRequest.id | MOD-013 §4.4 |
| `entry_sequence` | SMALLINT | NOT NULL — 1=debit, 2=credit for each transaction pair | MOD-013 §7.4 (double-entry) |
| `debit_credit_type` | VARCHAR(7) | CHECK IN ('DEBIT','CREDIT') | MOD-013 §4.4 |
| `amount` | DECIMAL(12,2) | NOT NULL | MOD-013 §4.4 |
| `currency` | VARCHAR(3) | NOT NULL | MOD-013 §4.4 |
| `source` | VARCHAR(50) | NOT NULL — account/source identifier | MOD-013 §4.4 |
| `destination` | VARCHAR(50) | NOT NULL — account/destination identifier | MOD-013 §4.4 |
| `entry_type` | VARCHAR(20) | CHECK IN (ESCROW,PAYMENT,SETTLEMENT,FEE,REFUND) | MOD-013 §4.4 |
| `reconciliation_status` | VARCHAR(20) | DEFAULT 'PENDING', CHECK IN (PENDING,ALIGNED,MISMATCH_DETECTED) | MOD-013 §4.4 |
| `external_ledger_ref` | VARCHAR(255) | NULLABLE | MOD-013 §4.4 |
| `created_by`, `updated_by` | UUID | | Standard audit |
| `correlation_id` | UUID | | Standard trace |
| `is_deleted` | BOOLEAN | DEFAULT FALSE — soft delete allowed, HARD DELETE prohibited | ESS-009 immutability |
| `version` | INTEGER | DEFAULT 1 | Standard concurrency |
| `created_at` | TIMESTAMPTZ | DEFAULT now() | Standard |
| `updated_at` | TIMESTAMPTZ | DEFAULT now() — only metadata changes, NOT financial data | ESS-009 |

**Index**: UNIQUE INDEX on `(transaction_reference, entry_sequence)`
**Constraint**: COLUMN PRIVILEGES — REVOKE UPDATE on amount, source, destination, debit_credit_type from PUBLIC

**Justification**: Dual-ledger principle per ESS-001F §7 requires internal ledger mirror. Double-entry recording is mandatory per MOD-013 §7.4. Immutability is explicit in ESS-009 and MOD-013 §7.4. This table is the single source of truth for internal financial state tracking and reconciliation against external provider/bank records.

#### Table: `refund_instructions` (supporting)

```
Schema:         financial_schema
Owning Module:  MOD-013
Purpose:        Track dispute-driven refund/split-settlement instructions
Immutability:   Financial fields immutable after creation. Status follows approval lifecycle.
RLS:            admin_only (financial resolution details are sensitive)
```

| Column | Key Attributes |
|---|---|
| `id` | UUID PK |
| `escrow_id` | FK to escrow_records |
| `dispute_id` | FK to MOD-015 disputes (future) |
| `refund_type` | FULL / PARTIAL / SPLIT_SETTLEMENT |
| `amount` | DECIMAL(12,2) |
| `currency` | VARCHAR(3) |
| `recipient_id` | UUID — shipper or transporter |
| `resolution_outcome` | RELEASE_TO_TRANSPORTER / REFUND_TO_SHIPPER / SPLIT_SETTLEMENT |
| `approved_by` | UUID — moderator/admin who decided |
| `bank_execution_ref` | VARCHAR(255) |
| `status` | PENDING / APPROVED / EXECUTED / FAILED |
| `failure_reason` | TEXT |

**Justification**: RefundInstructionObject defined in MOD-013 §4.6. Necessary for dispute resolution path. Not on happy-path critical mass but required for complete C4 lifecycle verification.

### Relationship Between Tables

```
escrow_records (C3 created, C4 manages lifecycle)
    ├── payment_intents (1:N) — payment attempts leading to escrow funding
    ├── settlement_requests (1:N) — settlement requests for this escrow
    └── refund_instructions (1:N) — dispute refund instructions for this escrow

payment_intents ← transaction_reference → financial_ledger_entries (1:2)
settlement_requests ← transaction_reference → financial_ledger_entries (1:2)

Each ledger entry references its source via transaction_reference
Each payment/settlement creates a paired debit+credit (entry_sequence 1 and 2)
```

---

## 8. PROVIDER/SANDBOX BOUNDARY

### C4 Provider Integration Strategy

Per the No Custody Principle and realistic resource constraints, C4 implements payment orchestration using **mock/stub providers**, with architecture prepared for eventual sandbox/production provider connections.

| Layer | Classification | Description |
|---|---|---|
| **Payment Initiation API** | C4 BUILD | `POST /api/payments` creates intent regardless of provider |
| **Adapter Interface** | C4 BUILD | Abstract `IPaymentProviderAdapter` interface defining `initiatePayment()`, `verifyConfirmation()` |
| **Mock M-Pesa Adapter** | C4 BUILD (TEST-ONLY) | Returns controlled responses: success after ~30s, failure on demand, duplicate rejection |
| **Mock Card Adapter** | C4 BUILD (TEST-ONLY) | Same controlled behavior as M-Pesa mock |
| **Real M-Pesa Sandbox** | NOT IN C4 SCOPE | Requires Vodacom sandbox credentials. Architecture-ready: adapter implementation would drop in when credentials available |
| **Real Card Processor** | NOT IN C4 SCOPE | Requires merchant account + PCI-DSS compliance. Architecture-ready |
| **Real Bank Escrow Integration** | NOT IN C4 SCOPE | Requires banking partner onboarding + mTLS setup. Architecture-ready |
| **PayPal Inbound (sandbox)** | OPTIONALLY IN C4 | PayPal sandbox is freely available. May include if time permits |

### Why Mock/Stubs for C4

1. **No Custody compliance** — No real money should move during development/testing. Mocks enforce this by construction.
2. **External dependency blocking** — M-Pesa sandbox requires Vodacom Mozambique developer registration. Bank escrow requires regulated banking partner onboarding. These are separate authorization gates.
3. **Architectural integrity** — The adapter interface (already partially scaffolded in Wave 5) works identically whether backed by mocks or real providers. The system under test is the *orchestration*, not the provider.
4. **Full lifecycle testability** — With mocks, every state transition (PENDING_CREATION → FUNDS_INITIATED → FUNDS_LOCKED → ... → ESCROW_CLOSED) can be tested end-to-end.
5. **Separation of concerns** — Provider integration is MOD-011 infrastructure work. C4 focuses on financial orchestration logic using that infrastructure.

### Transition Path to Production

```
C4 (mock adapters)
    ↓ HAO authorization for sandbox
Sandbox integration (real provider APIs with sandbox credentials)
    ↓ HAO authorization for production
Production deployment (production credentials, mTLS configured)
```

Each step requires **separate explicit HAO authorization**. C4 establishes the orchestration plumbing; provider wiring is an infrastructure configuration change, not a code change.

---

## 9. SECURITY AND NO-CUSTODY CONTROLS

These controls are non-negotiable requirements from authoritative specifications. Each maps to a specific governance rule.

| Control | Governance Source | Implementation Requirement |
|---|---|---|
| **RBAC Enforcement** | PROMPT 0 v1.1 (Permission Rules), ESS-006 §2.5 | All financial API endpoints enforce role-based access. SHIPPER can initiate own payments. TRANSPORTER can view own escrows. ADMIN/MODERATOR can approve refunds. No other roles permitted. |
| **Row-Level Security** | ESS-006 Golden Rule | All new financial tables require RLS policies. Counterparty_read policy grants SELECT to shipper/transporter whose booking links to the record. Admin policy grants ALL to admin/moderator roles. |
| **Immutable Ledger Entries** | ESS-009 (Data Governance), MOD-013 §7.4 | financial_ledger_entries rows are NEVER UPDATEd on financial columns (amount, source, destination, debit_credit_type enforced via column grants). Insert-only operation. |
| **Idempotency Keys** | MOD-005 §7.5, MOD-013 §7.4 | Database UNIQUE constraint on payment_intents.idempotency_key. Application-layer check before provider call. Webhook handler deduplicates via provider_reference_id lookup. |
| **Duplicate Payment Prevention** | MOD-005 §7.5 ("Duplicate payment events MUST be rejected"), ESS-001F §9 | Check: same escrow_id + same payment_method + status ≠ terminal → reject with ERR_DUPLICATE_PAYMENT. |
| **Webhook Signature Verification** | ESS-001D §2.1 ("Trust-No-External-Event"), §3 (webhook pipeline) | Each provider webhook handler verifies HMAC/signature using provider secret. Rejects unsigned/unverifiable payloads with 401. |
| **Webhook Replay Protection** | ESS-001D §2.2/§2.4 (Idempotent Processing, Replay Safety) | Store last_received timestamp per provider message ID. Process only once. Return 200 even on duplicates (do not leak internal state). |
| **Correlation ID Threading** | Shared kernel correlation-context-middleware.ts | correlation_id present on every financial API request, embedded in every database write, logged in every audit entry. |
| **Amount/Currency Validation** | MOD-013 §7.6 (Multi-Currency Rule) | Amount validated as positive number with 2 decimal places. Currency restricted to CHECK(IN ('MZN','USD','ZAR')). Mismatch between contract currency and payment currency flagged. |
| **State Machine Enforcement** | MOD-005 §7.3, MOD-013 §7.3 (Escrow Immutability Rule) | validateEscrowTransition() called BEFORE every state mutation. Invalid transitions throw ValidationError. No manual/direct state override possible. |
| **No Client-Side Financial Logic** | ESS-006 §2.5 | No client calculates fees, rates, or settlement amounts. All computation server-side. |
| **Secrets Isolation** | PROMPT 0 v1.1 (Security Governance), ESS-006 §2.3 | Provider API secrets stored in environment variables. Never exposed to NEXT_PUBLIC_* vars. Never logged. Never returned in API responses. |
| **Audit Logging** | ESS-001F §13 (Audit Requirements) | Every financial event includes: correlationId, ledger reference, provider transaction ID, escrow state, user role, timestamp, module origin. Logged via MOD-017 structured logging. |
| **Environment Separation** | General Best Practice | Development uses mock adapters. Sandbox requires separate credentials config. Production requires separate deployment with production credentials. No mixing. |

---

## 10. GENUINE BLOCKERS / HAO DECISIONS

### Genuine Blockers

| ID | Description | Type | Path Forward |
|---|---|---|---|
| **BLK-C4-001** | Database migrations for new financial tables (`payment_intents`, `settlement_requests`, `financial_ledger_entries`, `refund_instructions`) have not been created or deployed | **Infrastructure Gap** | Migration creation is the natural first implementation step of C4. Not a blocker to starting — it IS the start. |
| **BLK-C4-002** | No financial API routes exist beyond the stub GET `/api/financial`. All POST/PATCH routes for payments, webhooks, and settlements are zero-implemented | **Implementation Gap** | Entirely within C4 scope. Build required. |
| **BLK-C4-003** | No webhook endpoint infrastructure exists despite ESS-001D standard being specified | **Implementation Gap** | Build required. ESS-001D provides architectural blueprint. |

### Genuine HAO Decisions Required

| Decision | Options | Recommended | Consequences |
|---|---|---|---|
| **DEC-C4-001: Provider scope for C4** | A) Mock/stub adapters only<br>B) Include real sandbox (if credentials obtainable) | **A** | A: Safe, compliant with No Custody, fully testable. B: Provides higher-fidelity testing but adds external dependency risk and credential management complexity. Recommend C4 Phase A builds with mocks; Phase B (separate auth) wires sandbox. |
| **DEC-C4-002: Multi-currency in C4 MVP** | A) Single currency (MZN) only for initial deployment<br>B) Full MZN/USD/ZAR support | **A with extensibility** | A: Simpler C4 scope, reduces migration complexity. B: Requires exchange rate capture, currency conversion logic, validation at contract stage. Recommend MZN baseline with currency_code column pre-existing (it already is in escrow_records). |
| **DEC-C4-003: Fee engine simplicity** | A) Fixed percentage fee configurable via admin settings<br>B) Corridor-based dynamic fees (as specified in MOD-013 §4.7) | **A** | A: Implements Section 4.7 basic structure without corridor complexity. Corridor-based pricing deferred to MOD-018/growth wave. B: More faithful to specification but adds complexity. |
| **DEC-C4-004: Refund instruction priority** | A) Implement refund table/API for dispute completeness<br>B) Defer to later milestone | **A** | A: Minimal effort (table + CRUD), enables full C4 lifecycle testing including dispute path. B: Leaves dispute scenario untestable until separate authorization. |

---

## 11. C4 ACCEPTANCE CRITERIA

C4 is operationally complete when the following measurable criteria are demonstrated:

### Functional Criteria

| # | Criterion | Measurement |
|---|---|---|
| AC-001 | **Payment initiation succeeds** | Given active contract with PENDING_CREATION escrow, POST /api/payments creates PaymentIntent with INITIATED status, advances escrow to FUNDS_INITIATED, returns 201 with PaymentIntent details |
| AC-002 | **Duplicate payment prevention** | POST /api/payments with same idempotency_key twice → second call returns 409 CONFLICT without creating duplicate record or charging again |
| AC-003 | **Payment confirmation via webhook** | Provider webhook arrives with valid signature → PaymentIntent status becomes CONFIRMED, escrow advances to FUNDS_LOCKED, double-entry ledger entries recorded (debit+credit pair), 200 response |
| AC-004 | **Unverified webhook rejected** | Webhook without valid signature → 401 UNAUTHORIZED, no state change |
| AC-005 | **Replayed webhook handled safely** | Identical webhook delivered twice → second delivery returns 200 (idempotent) but no duplicate ledger entries or state changes |
| AC-006 | **Settlement request accepted** | POST /api/settlements with valid escrow_id and milestone → SettlementRequest created, approval_status = PENDING, state machine validated |
| AC-007 | **Settlement confirmation** | Provider bank webhook confirms settlement → SettlementRequest.status = EXECUTED, escrow state advances appropriately, ledger reconciliation_status = ALIGNED |
| AC-008 | **Dispute triggers hold** | Dispute escalated → escrow state machine prevents any release (transition from DISPUTE_HOLD only to PARTIAL_RELEASE/FINAL_RELEASE) |
| AC-009 | **Reconciliation check works** | GET /api/reconciliation/{escrowId} returns accurate alignment status comparing internal ledger to provider confirmation records |
| AC-010 | **End-to-end happy path** | Full lifecycle from PENDING_CREATION → ESCROW_CLOSED completes without manual intervention, all state transitions validated, all ledger entries balanced, all webhooks processed idempotently |

### Structural Criteria

| # | Criterion | Measurement |
|---|---|---|
| AC-011 | **No custodial fund holding** | Code review confirms no direct fund movement through NexCargo-controlled accounts. All monetary operations delegate to provider/bank |
| AC-012 | **RLS policies deployed** | All new financial tables have RLS enabled with counterparty_read and admin policies verified against live Supabase |
| AC-013 | **State machine enforced** | No database mutation path exists that bypasses validateEscrowTransition(). Attempts at invalid transitions produce ValidationError |
| AC-014 | **Test coverage** | ≥ 80 new tests covering: state transitions, idempotency, webhook verification, reconciliation, dispute hold, error cases. Full suite passes |
| AC-015 | **TypeScript clean** | Zero compilation errors |

### Security Criteria

| # | Criterion | Measurement |
|---|---|---|
| AC-016 | **Financial endpoints authenticated** | All financial API routes use Pattern A authentication (assertApiAuthorization). No x-user-role header fallback |
| AC-017 | **No secrets in client code** | grep confirms no provider API keys, secrets, or credentials in any file outside .env.local |
| AC-018 | **Audit trail complete** | Every state transition logged with correlationId, user role, timestamp, module origin verifiable in audit log |

---

## 12. ADVISORY IMPLEMENTATION PLAN

### Phase C4-I: Database Foundation

| Step | Action | Owner | Deliverable |
|---|---|---|---|
| 1 | Create migration: `payment_intents` table with all columns, constraints, indexes | MOD-005 | Migration file + RLS policies |
| 2 | Create migration: `settlement_requests` table | MOD-013 | Migration file + RLS policies |
| 3 | Create migration: `financial_ledger_entries` table with column immutability grants | MOD-013 | Migration file + column grants |
| 4 | Create migration: `refund_instructions` table | MOD-013 | Migration file + RLS policies |
| 5 | Verify migrations deploy cleanly on Supabase branch | infra | All 4 tables + RLS verified |

### Phase C4-II: Payment Orchestration

| Step | Action | Owner | Deliverable |
|---|---|---|---|
| 6 | Implement `POST /api/payments` — validates escrow at PENDING_CREATION, creates PaymentIntent, applies state transition | MOD-005 | API route + tests |
| 7 | Implement `POST /api/payments/{id}/confirm` — captures payment result, updates status | MOD-005 | API route + tests |
| 8 | Implement IPaymentProviderAdapter interface + MockMpesaAdapter + MockCardAdapter | MOD-011 | Adapter files + tests |
| 9 | Implement webhook ingestion `POST /api/webhooks/mpesa` — signature verification, idempotency, state advancement | MOD-013 | Webhook handler + tests |

### Phase C4-III: Settlement + Reconciliation

| Step | Action | Owner | Deliverable |
|---|---|---|---|
| 10 | Implement `POST /api/settlements` — validates milestone, creates SettlementRequest, routes to provider | MOD-013 | API route + tests |
| 11 | Implement webhook handler for settlement confirmation | MOD-013 | Webhook handler + tests |
| 12 | Implement `GET /api/reconciliation/{escrowId}` — compares internal vs. external state | MOD-013 | API route + tests |
| 13 | Wire MOD-003 DeliveryConfirmed signal to settlement creation (event-driven or API call) | MOD-013 → MOD-003 | Integration code |

### Phase C4-IV: Completeness + Testing

| Step | Action | Owner | Deliverable |
|---|---|---|---|
| 14 | Implement refund instruction flow (table write, status progression) | MOD-013 | REST endpoints + tests |
| 15 | Implement basic fee calculation at settlement | MOD-013 | Calculation function + tests |
| 16 | End-to-end integration tests (full happy path + dispute path) | All | Test suite completion |
| 17 | Final verification: TypeScript clean, all tests passing, RLS verified on live DB | infra | C4 verification sign-off |

---

## 13. RECOMMENDED FIRST IMPLEMENTATION STEP

After HAO authorization, the first concrete step is:

> **Create database migration for `payment_intents` table** in `financial_schema`, establishing the foundational entity that bridges C3's PENDING_CREATION escrow to C4's payment initiation.

This migration must include:

1. **Table definition** with all columns from Section 7 (id, escrow_id, amount, currency, payment_method, status, idempotency_key, provider_reference_id, external_transaction_ref, fee_amount, failure_reason, standard audit fields)
2. **Foreign key constraint**: `escrow_id` REFERENCES `financial_schema.escrow_records(id)` ON DELETE CASCADE
3. **Unique constraint**: UNIQUE `(idempotency_key)` — enforces idempotency at database level
4. **Check constraints**: `status` restricted to (INITIATED, PENDING, CONFIRMED, FAILED, REFUNDED); `payment_method` restricted to known methods; `currency` restricted to (MZN, USD, ZAR)
5. **Indexes**: `idx_payment_intents_escrow` on (escrow_id), `idx_payment_intents_status` on (status)
6. **RLS policies**: 
   - `payment_intent_counterparty_read` — SELECT for users who own the linked escrow (via bookings relationship)
   - `payment_intent_admin` — ALL for admin/moderator roles
7. **Column grant**: REVOKE UPDATE on (amount, currency, payment_method, escrow_id, idempotency_key) from PUBLIC — prevents post-creation tampering of financial values

**Why this is first**: PaymentIntent is the bridge entity between C3 (escrow_records at PENDING_CREATION) and C4 (payment initiation). It is the prerequisite for all subsequent steps: the payment initiation API writes to this table, the webhook handler reads from it, idempotency is enforced via its unique constraint, and it anchors the double-entry ledger relationships. Building this first establishes the structural foundation upon which all C4 financial operations depend.

After the table is deployed, the next immediate step is implementing the `POST /api/payments` API route that creates PaymentIntent records — connecting the table to the runtime payment flow.

---

**C4 IMPLEMENTATION STATUS: NOT AUTHORIZED — AWAITING HAO APPROVAL**

STOP.
