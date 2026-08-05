**ESS-001C — APPENDIX C - Retry \& Timeout Policy Matrix**



**Document ID:** ESS-001C
**Parent Spec:** ESS-001 — External Integrations Specification
**System:** NexCargo
**Version:** 1.0
**Status:** Authoritative Source of Truth



**1. PURPOSE**



**This appendix defines the standard retry, timeout, failure handling, and resilience behavior for all external and internal integrations in NexCargo.**



**It ensures:**



**predictable system behavior under failure**



**prevention of cascading outages**



**elimination of duplicate transactions**



**consistent recovery strategies across all providers**



**2. CORE RESILIENCE PRINCIPLES**



**All integrations MUST follow:**



**2.1 Fail Fast Principle**



**Do not block system execution indefinitely.**



**2.2 Idempotent Recovery Principle**



**Retries must never create duplicate side effects.**



**2.3 Circuit Protection Principle**



**Failing systems must be isolated automatically.**



**2.4 Controlled Degradation Principle**



**System must degrade gracefully, not collapse.**



**2.5 Observability Principle**



**Every failure must be traceable and measurable.**



**3. TIMEOUT CLASSIFICATION MATRIX**



**All external calls MUST be classified into timeout tiers:**

&#x09;									



|**Tier**|**Type**|**Timeout**|**Example**|**Module**|
|-|-|-|-|-|
|**T1**|**Critical Financial**|**2–5 seconds**|**Escrow bank settlement**|**MOD-013**|
|**T2**|**High Priority API**|**5–10 seconds**|**Mobile money, Visa**|**MOD-005, MOD-013**|
|**T3**|**Standard API**|**10–20 seconds**|**Maps, logistics APIs**|**MOD-003, MOD-014**|
|**T4**|**Background Services**|**30–120 seconds**|**OCR, AI processing**|**MOD-004, MOD-006**|
|**T5**|**Async Batch Jobs**|**No blocking timeout**|**Analytics, reporting**|**MOD-012**|





**4. RETRY STRATEGY MATRIX**



**4.1 Retry Policies by Operation Type**



|**Operation Type**|**Retry Strategy**|**Max Attempts**|**Backoff**|
|-|-|-|-|
|**Financial Transactions**|**Strict Retry**|**3**|**Exponential (2^n seconds)**|
|**Payment Confirmation**|**Conditional Retry**|**5**|**Exponential + jitter**|
|**Logistics Tracking**|**Soft Retry**|**10**|**Linear backoff**|
|**Notifications**|**Aggressive Retry**|**5–10**|**Fast exponential**|
|**AI / OCR Calls**|**Adaptive Retry**|**3–5**|**Increasing backoff**|
|**Read-only APIs**|**Lightweight Retry**|**2–3**|**Fixed delay**|





**4.2 Retry Rules**



**Retries MUST:**



**NEVER repeat non-idempotent operations without idempotency key**



**NEVER exceed max retry threshold**



**ALWAYS include jitter to avoid thundering herd**



**ALWAYS log retry attempts**



**Retries MUST NOT:**



**block main transaction flow indefinitely**



**bypass circuit breakers**



**retry permanently failing operations**



**5. CIRCUIT BREAKER MATRIX**



**5.1 Circuit States**



|**State**|**Description**|
|-|-|
|**CLOSED**|**Normal operation**|
|**OPEN**|**Calls blocked due to failure**|
|**HALF-OPEN**|**Testing recovery**|



**5.2 Circuit Breaker Thresholds**





|**Integration Type**|**Failure Rate Threshold**|**Reset Time**|
|-|-|-|
|**Banking APIs**|**5%**|**60 seconds**|
|**Mobile Money**|**10%**|**45 seconds**|
|**GPS / Maps**|**20%**|**30 seconds**|
|**AI Services**|**30%**|**20 seconds**|
|**Notifications**|**25%**|**15 seconds**|



**6. DEAD LETTER QUEUE (DLQ) POLICY**



**All asynchronous systems MUST support DLQs.**



**DLQ Triggers:**



**Max retries exceeded**



**Timeout exceeded repeatedly**



**Invalid payload response**



**Persistent provider failure**



**DLQ Requirements:**



**Must store full event payload**



**Must include correlationId**



**Must include failure reason**



**Must be replayable manually or automatically**



**Must be observable in monitoring dashboard**



**DLQ management is governed by MOD-017 (Observability) and MOD-011 (Platform Integration)**



**7. IDEMPOTENCY ENFORCEMENT RULE**



**All retryable operations MUST include:**



**idempotencyKey**



**requestHash**



**correlationId**



**If missing:**



**system MUST reject request OR mark as unsafe**



**8. FAILURE HANDLING MATRIX**



**8.1 Financial Systems (CRITICAL)**



**NO automatic retries beyond threshold**



**MUST escalate to reconciliation engine**



**MUST NOT duplicate settlement attempts**



**MUST require audit confirmation for recovery**



**Refer to ESS-001F for financial integration requirements**



**8.2 Logistics Systems**



**Continue operation with cached last-known state**



**Retry tracking asynchronously**



**Mark shipment status as "degraded tracking"**



**8.3 Communication Systems**



**Retry aggressively**



**Allow fallback provider (if configured)**



**Queue messages until delivery succeeds**



**8.4 AI Systems**



**Return partial results if possible**



**Retry with reduced payload**



**If failure persists → fallback to rule-based logic**



**Refer to ESS-003 for AI behavior constraints**



**8.5 Document Processing**



**Retry with backoff**



**If persistent failure → move to manual review queue**



**9. SYSTEM DEGRADATION MODES**



**When external systems fail, NexCargo MUST enter controlled modes:**



**9.1 Degraded Tracking Mode**



**GPS updates delayed**



**last-known position used**



**9.2 Payment Hold Mode**



**escrow operations paused**



**no new financial transactions initiated**



**9.3 AI Fallback Mode**



**disable ML predictions**



**enable deterministic rules engine**



**9.4 Communication Delay Mode**



**queue notifications**



**batch delivery when restored**



**10. ASYNC RETRY ARCHITECTURE**



**All retryable operations MUST be handled via:**



**Event Queue**



**Worker System**



**Retry Scheduler**



**NOT synchronous API calls.**



**11. OBSERVABILITY REQUIREMENTS**



**Every retry MUST emit:**



**RetryAttempted**



**RetrySucceeded**



**RetryFailed**



**CircuitOpened**



**CircuitClosed**



**DLQEventCreated**



**Each event MUST include:**



**correlationId**



**provider**



**module**



**error code (per ESS-001E)**



**latency**



**retry count**



**Observability requirements are governed by ESS-005 (Operational Runbook).**



**12. FINANCIAL SAFETY RULE (CRITICAL)**



**For financial operations:**



**No Custody: NexCargo NEVER holds funds. Bank is the ONLY execution authority.**



**NEVER auto-repeat final settlement**



**NEVER double-release escrow**



**NEVER assume success without confirmation**



**ALWAYS reconcile with bank ledger**



**MOD-005 handles escrow initiation and release; MOD-013 handles settlement and reconciliation**



**13. AI GOVERNANCE RULE**



**AI MUST:**



**respect retry limits**



**never override circuit breakers**



**never simulate successful retries**



**always surface failure state if uncertain**



**refer to ESS-003 for AI behavior constraints**



**14. VERSIONING RULE**



**Any changes to retry or timeout logic MUST:**



**be versioned**



**be backward compatible**



**be documented in ESS changelog**



**FINAL PRINCIPLE**



**ESS-001C ensures:**



**NexCargo remains stable even when external systems fail.**



**It transforms failure from:**



**system-breaking event**



**into:**



**controlled, observable, recoverable state**

