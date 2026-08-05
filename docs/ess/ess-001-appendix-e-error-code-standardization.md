**ESS-001 — APPENDIX E - Error Code Standardization**

**Error Code Standardization**

**Document ID:** ESS-001E
**Parent Spec:** ESS-001 — External Integrations Specification
**System:** NexCargo
**Version:** 1.0
**Status:** Authoritative Source of Truth



1\. PURPOSE



This appendix defines a \*\*unified error taxonomy and standardized error code system\*\* for all NexCargo components.



It ensures:



\- consistent error handling across modules

\- predictable API behavior

\- improved observability and debugging

\- elimination of ambiguous failure messages

\- structured mapping between external and internal errors



2\. CORE ERROR DESIGN PRINCIPLES



All errors MUST follow:



2.1 Deterministic Errors Principle



Every error must have a clearly defined code.



2.2 Domain Isolation Principle



Errors must be categorized by domain (Financial, Logistics, AI, etc.).



2.3 Machine Readability Principle



Errors must be structured, not free-text.



2.4 Correlation Principle



Every error must include traceability metadata.



2.5 External Normalization Principle



External provider errors MUST be mapped to internal codes.



3\. GLOBAL ERROR FORMAT



All NexCargo errors MUST follow this structure:



```json

{

&#x20; "errorCode": "string",

&#x20; "domain": "string",

&#x20; "message": "string",

&#x20; "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",

&#x20; "timestamp": "string",

&#x20; "correlationId": "string",

&#x20; "module": "string",

&#x20; "entityId": "string",

&#x20; "provider": "string",

&#x20; "httpStatus": "number",

&#x20; "retryable": "boolean"

}



4\. ERROR CODE NAMING STANDARD



Error codes MUST follow:



DOMAIN\_MODULE\_ERROR\_TYPE



Examples:



FIN\_PAYMENTS\_INSUFFICIENT\_FUNDS



LOG\_TRACKING\_GPS\_SIGNAL\_LOST



AI\_PRICING\_MODEL\_UNAVAILABLE



COM\_KYC\_VERIFICATION\_FAILED



SEC\_AUTH\_TOKEN\_EXPIRED



5\. DOMAIN ERROR TAXONOMY



5.1 Financial Domain (FIN)



Categories:



Payments



Escrow



Settlement



Wallet



Reconciliation



Example Errors:



FIN\_ESCROW\_LOCK\_FAILED



FIN\_PAYMENT\_DECLINED



FIN\_SETTLEMENT\_TIMEOUT



FIN\_LEDGER\_INCONSISTENCY



Financial Safety Rules:



FIN errors MUST NOT auto-retry settlement without reconciliation



FIN errors MUST be reconciled with bank ledger



Refer to ESS-001F for financial integration error handling



5.2 Logistics Domain (LOG)



Categories:



Tracking



Routing



Fleet



Shipment execution



Example Errors:



LOG\_TRACKING\_NO\_GPS\_SIGNAL



LOG\_ROUTE\_OPTIMIZATION\_FAILED



LOG\_SHIPMENT\_STATE\_INVALID



5.3 AI Domain (AI)



Categories:



Prediction failure



Model unavailable



Low confidence output



Example Errors:



AI\_ETA\_PREDICTION\_FAILED



AI\_MODEL\_UNAVAILABLE



AI\_LOW\_CONFIDENCE\_RESULT



AI Behavior Rules:



AI errors MUST NOT trigger autonomous execution



All AI outputs remain advisory-only



Refer to ESS-003 for AI behavior constraints



5.4 Compliance Domain (COM)



Categories:



KYC/KYB



Licensing



Customs



Example Errors:



COM\_KYC\_DOCUMENT\_INVALID



COM\_LICENSE\_VERIFICATION\_FAILED



COM\_CUSTOMS\_DECLARATION\_REJECTED



5.5 Communication Domain (COMMS)



Categories:



SMS



Email



Push notifications



Example Errors:



COMMS\_SMS\_DELIVERY\_FAILED



COMMS\_EMAIL\_BOUNCED



COMMS\_PUSH\_TOKEN\_INVALID



5.6 Security Domain (SEC)



Categories:



Authentication



Authorization



Session management



Example Errors:



SEC\_AUTH\_UNAUTHORIZED



SEC\_AUTH\_TOKEN\_EXPIRED



SEC\_RBAC\_PERMISSION\_DENIED



Security errors are governed by ESS-006 (Security \& Compliance).



5.7 Integration Domain (INT)



Categories:



External APIs



Webhooks



Provider failures



Example Errors:



INT\_PROVIDER\_TIMEOUT



INT\_WEBHOOK\_SIGNATURE\_INVALID



INT\_API\_RATE\_LIMIT\_EXCEEDED



Integration errors are governed by ESS-004 (Integration Contracts).



6\. HTTP STATUS MAPPING RULES



|Error Type|HTTP Status|
|-|-|
|Validation Error|400|
|Authentication Error|401|
|Authorization Error|403|
|Not Found|404|
|Conflict|409|
|Rate Limit|429|
|External Failure|502|
|Timeout|504|
|Internal Error|500|





7\. RETRY CLASSIFICATION



Each error MUST specify:



Retryable Errors:



INT\_PROVIDER\_TIMEOUT



LOG\_TRACKING\_NO\_GPS\_SIGNAL



AI\_MODEL\_UNAVAILABLE



Non-Retryable Errors:



SEC\_AUTH\_UNAUTHORIZED



FIN\_PAYMENT\_DECLINED



COM\_KYC\_DOCUMENT\_INVALID



Retry policies are governed by ESS-001C (Retry \& Timeout Policy Matrix).



8\. ERROR CONTEXT ENRICHMENT



Every error MUST include:



correlationId



userId (if applicable)



moduleId



entityId (shipment/payment/etc.)



provider (if external)



request payload hash (optional)



Error context is governed by ESS-009 (Data Governance).



9\. EXTERNAL ERROR NORMALIZATION



All external errors MUST be transformed into internal codes:



Example:



External:



"Visa transaction declined (code 05)"



Internal:



FIN\_PAYMENT\_DECLINED



10\. LOGGING REQUIREMENTS



Every error MUST generate:



structured log entry



event store record



monitoring metric increment



Logging requirements are governed by ESS-005 (Operational Runbook).



11\. ERROR SEVERITY MODEL



|Severity|Meaning|
|-|-|
|LOW|UI validation issue|
|MEDIUM|Recoverable failure|
|HIGH|Feature disruption|
|CRITICAL|System or financial risk|



12\. AI GOVERNANCE RULE



AI MUST:



NEVER invent error codes



NEVER generate undocumented errors



NEVER suppress error information



ALWAYS map unknown errors to: INT\_UNKNOWN\_ERROR



Refer to ESS-003 for AI behavior constraints



If unclear:



MUST output TODO: error classification required



13\. DEBUGGING STANDARD



All errors MUST be:



traceable via correlationId



reproducible via request metadata



linkable to event logs



14\. VERSIONING RULE

Error taxonomy MUST:



remain backward compatible



never rename existing codes



only extend with new codes



15\. MODULE MAPPING



|Error Domain|Primary Module|Related Modules|
|-|-|-|
|FIN|MOD-005, MOD-013|MOD-011, MOD-017|
|LOG|MOD-003, MOD-014|MOD-008, MOD-009|
|AI|MOD-006|MOD-018, MOD-012|
|COM|MOD-010|MOD-015|
|COMMS|MOD-016|MOD-011|
|SEC|MOD-010|MOD-011, MOD-017|
|INT|MOD-011|All modules|





FINAL PRINCIPLE

ESS-001E ensures:



Every failure in NexCargo becomes a structured, diagnosable, and actionable event rather than an ambiguous system crash.

