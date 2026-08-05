**ESS-001D — APPENDIX D - Webhook Governance Standard**

**Webhook Governance Standard**

**Document ID:** ESS-001D
**Parent Spec:** ESS-001 — External Integrations Specification
**System:** NexCargo
**Version:** 1.0
**Status:** Authoritative Source of Truth



1\. PURPOSE



This appendix defines the \*\*standardized governance model for all inbound and outbound webhook interactions\*\* across NexCargo.



It ensures:



\- secure ingestion of external events

\- prevention of duplicate processing

\- correct event ordering

\- protection against spoofed or malicious callbacks

\- full auditability of external event flows



2\. CORE WEBHOOK PRINCIPLES



All webhooks MUST follow:



2.1 Trust-No-External-Event Principle



No webhook is trusted until verified.



2.2 Idempotent Processing Principle



Every webhook event must be safe to process multiple times.



2.3 Event Ordering Is Not Guaranteed Principle



System MUST assume out-of-order delivery.



2.4 Replay Safety Principle



Duplicate or replayed webhooks MUST NOT alter system state.



2.5 Traceability Principle



Every webhook MUST be traceable end-to-end.



3\. WEBHOOK ARCHITECTURE FLOW



All webhook events MUST follow this pipeline:



External Provider

↓

Webhook Gateway

↓

Signature Verification Layer

↓

Deduplication Layer

↓

Event Normalization Layer

↓

Event Store (Append-Only)

↓

Domain Event Dispatcher

↓

Business Modules



4\. WEBHOOK VERIFICATION RULES



4.1 Signature Verification (MANDATORY)



All inbound webhooks MUST include:



\- HMAC signature OR

\- Public key signature OR

\- mTLS verification (bank-grade systems)



Rules:



\- Signature MUST be verified BEFORE payload processing

\- Invalid signature → immediate rejection

\- No fallback bypass allowed



4.2 Timestamp Validation



Every webhook MUST include timestamp.



Rules:



\- Maximum allowed skew: ±5 minutes

\- Out-of-window events MUST be rejected

\- Prevents replay attacks



4.3 Source Validation



Webhook MUST be validated against:



\- known provider list (ESS-001A)

\- allowed IP ranges (if applicable)

\- registered endpoints



5\. IDEMPOTENCY \& DUPLICATION CONTROL



5.1 Required Fields



Every webhook MUST contain:



\- eventId (unique provider identifier)

\- correlationId (NexCargo-generated or mapped)

\- eventType

\- timestamp



5.2 Deduplication Strategy



System MUST maintain:



\- eventId index (primary deduplication key)

\- payload hash (secondary validation)

\- correlationId mapping



If duplicate detected:



EVENT MUST BE IGNORED (NOT REPROCESSED)



But still logged.



6\. EVENT ORDERING RULES



Webhooks are:



NEVER guaranteed to arrive in order



Therefore:



Rules:



\- System MUST NOT assume sequence correctness

\- State transitions MUST be validated before application

\- Late-arriving events MUST be reconciled



Example:



Correct order:



ShipmentCreated → ShipmentPickedUp → ShipmentDelivered



Possible real-world order:



ShipmentDelivered → ShipmentCreated → ShipmentPickedUp



System MUST:



\- reject invalid transitions

\- or re-evaluate state using event reconciliation engine



7\. EVENT NORMALIZATION LAYER



All incoming webhooks MUST be transformed into:



```json

{

&#x20; "eventId": "string",

&#x20; "source": "string",

&#x20; "eventType": "string",

&#x20; "entityType": "string",

&#x20; "entityId": "string",

&#x20; "payload": "object",

&#x20; "timestamp": "string",

&#x20; "correlationId": "string",

&#x20; "signatureVerified": "boolean"

}



8\. EVENT STORAGE RULE (CRITICAL)



All webhook events MUST be stored in:



append-only event store (Prompt 2)



immutable record format



never overwritten



Event storage is governed by ESS-009 (Data Governance).



9\. RETRY POLICY FOR WEBHOOKS



9.1 Outbound Webhooks (NexCargo → External)



MUST follow ESS-001C retry matrix



MUST include idempotency key



MUST support retry confirmation



9.2 Inbound Webhooks (External → NexCargo)



External provider retry behavior MUST be assumed unreliable.



Therefore:



system MUST tolerate duplicates



system MUST tolerate gaps



system MUST not depend on retry correctness



10\. FAILURE HANDLING



10.1 Invalid Signature



→ Reject immediately

→ Log SecurityEvent

→ Do NOT store payload



10.2 Duplicate Event



→ Ignore processing

→ Log DuplicateEventDetected

→ Maintain audit trail



10.3 Unknown Event Type



→ Store in quarantine queue

→ Mark as "UnclassifiedWebhookEvent"

→ Require manual or AI review



10.4 Processing Failure



→ Send to DLQ (from ESS-001C)

→ Retry via event worker

→ Preserve original payload



11\. SECURITY REQUIREMENTS



All webhook endpoints MUST:



enforce HTTPS only



validate content-type



reject oversized payloads



rate limit per provider



block unknown sources



Security requirements are governed by ESS-006 (Security \& Compliance).



12\. OBSERVABILITY REQUIREMENTS



Every webhook MUST emit:



WebhookReceived



WebhookRejected



WebhookVerified



WebhookDuplicated



WebhookProcessed



WebhookFailed



Each event MUST include:



provider



eventId



correlationId



latency



validation outcome



Observability is governed by ESS-005 (Operational Runbook).



13\. FINANCIAL EVENT RULE (CRITICAL)



For financial providers (banks, mobile money, Visa, PayPal):



No Custody: NexCargo NEVER holds funds. Bank is the ONLY execution authority.



webhook is ONLY a confirmation signal



NEVER initiate settlement based solely on webhook



ALWAYS reconcile with ledger



Escrow initiation and release governed by MOD-005



Settlement and reconciliation governed by MOD-013



Refer to ESS-001F for financial integration architecture



14\. AI GOVERNANCE RULE



AI MUST:



NEVER assume webhook validity without verification



NEVER fabricate missing webhook events



NEVER simulate provider callbacks



ALWAYS treat webhook data as untrusted input



Refer to ESS-003 for AI behavior constraints



15\. EVENT RECONCILIATION RULE



System MUST periodically:



compare webhook events vs provider state



resolve missing events



correct state drift



log discrepancies



16\. VERSIONING RULE



Webhook schemas MUST:



be versioned (v1, v2, etc.)



remain backward compatible



never break existing integrations without migration



FINAL PRINCIPLE



ESS-001D ensures:



NexCargo never trusts external systems blindly — it verifies, normalizes, and reconciles every external event before it affects system state.

