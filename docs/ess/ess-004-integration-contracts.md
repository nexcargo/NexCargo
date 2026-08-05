ESS-004 - Integration Contracts Specification



Do**cument ID**:\*\* ESS-004

**System:** NexCargo

**Version:** 1.0

**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the \*\*standard contract structure for all external integrations\*\* in NexCargo.



It ensures:



\- consistent API design across providers

\- no undocumented request/response formats

\- predictable integration behavior

\- strict alignment with ESS-001A (Integration Inventory)



2\. CORE PRINCIPLE



Every external system must behave like a typed contract — not a flexible dependency.



3\. CONTRACT STRUCTURE STANDARD



Every integration MUST define a contract with:



```json

{

&#x20; "integrationId": "string",

&#x20; "provider": "string",

&#x20; "domain": "FINANCIAL" | "LOGISTICS" | "COMMS" | "COMPLIANCE" | "AI",

&#x20; "version": "string",

&#x20; "endpoints": "Endpoint\[]",

&#x20; "authentication": "string",

&#x20; "requestSchema": "object",

&#x20; "responseSchema": "object",

&#x20; "errorMapping": "string\[]",

&#x20; "timeoutPolicy": "string",

&#x20; "retryPolicy": "string",

&#x20; "idempotencyRequired": "boolean"

}



4\. ENDPOINT CONTRACT RULE



Each endpoint MUST define:



json

{

&#x20; "name": "string",

&#x20; "method": "GET" | "POST" | "PUT" | "DELETE",

&#x20; "path": "string",

&#x20; "description": "string",

&#x20; "request": "object",

&#x20; "response": "object",

&#x20; "errors": "string\[]"

}

5\. DOMAIN-SPECIFIC CONTRACT RULES



5.1 Financial Integrations (CRITICAL)



Applies to:



banks (escrow)



mobile money



Visa/Mastercard



PayPal



Rules:



MUST support idempotency keys



MUST support reconciliation fields



MUST include transaction reference ID



MUST never expose internal ledger state



No Custody: NexCargo NEVER holds funds. Bank is the ONLY execution authority.



MOD-005 handles escrow initiation and release



MOD-013 handles settlement and reconciliation



Refer to ESS-001F for financial integration architecture



Required Fields:



json

{

&#x20; "transactionId": "string",

&#x20; "amount": "number",

&#x20; "currency": "string",

&#x20; "status": "string",

&#x20; "externalReference": "string",

&#x20; "timestamp": "string"

}



5.2 Logistics Integrations



Applies to:



GPS providers



mapping systems



telematics



Rules:



MUST support location payload standardization



MUST include timestamped coordinates



MUST allow partial updates (for streaming GPS)



5.3 Communication Integrations



Applies to:



SMS



email



push notifications



Rules:



MUST confirm delivery status



MAY support retry callbacks



MUST include messageId tracking



5.4 Compliance Integrations



Applies to:



KYC/KYB systems



customs APIs



government registries



Rules:



MUST return verification status enum



MUST include reason codes for failures



MUST be auditable



5.5 AI Integrations



Applies to:



OCR



external ML services



Rules:



MUST return confidence score



MUST NOT execute actions directly



MUST support async responses if required



All AI outputs remain advisory-only



Refer to ESS-003 for AI constraints



6\. VERSIONING RULE



Every contract MUST follow:



MAJOR.MINOR.PATCH



Rules:



MAJOR → breaking changes



MINOR → backward-compatible additions



PATCH → internal fixes only



7\. BACKWARD COMPATIBILITY RULE



Contracts MUST:



NEVER break existing consumers without version bump



support legacy endpoints during transition period



allow parallel version operation



8\. ERROR CONTRACT MAPPING

Every integration MUST map external errors to ESS-001E codes:



Example:



&#x09;		

|External Error|Internal Code|
|-|-|
|"INSUFFICIENT\_FUNDS"|FIN\_PAYMENT\_DECLINED|
|"TIMEOUT"|INT\_PROVIDER\_TIMEOUT|





9\. IDENTITY \& AUTH REQUIREMENTS



Each contract MUST declare:



authentication type (from ESS-001B)



required scopes



credential type (API key, OAuth, mTLS)



10\. TIMEOUT \& RETRY ALIGNMENT



Contracts MUST explicitly reference:



ESS-001C retry rules



ESS-001C timeout tiers



No integration can define its own retry logic independently.



11\. IDEMPOTENCY RULE



If idempotencyRequired = true:



request MUST include idempotency key



provider MUST guarantee safe retries



system MUST reject duplicate execution risk



12\. CONTRACT VALIDATION RULE



Before deployment:



schema MUST validate against contract



mock response MUST exist



sandbox test MUST pass



error mapping MUST be verified



13\. AI GOVERNANCE RULE



AI MUST:



NEVER invent API fields



NEVER assume missing endpoints



NEVER simulate provider responses



ALWAYS refer to ESS-001A + ESS-004



Refer to ESS-003 for AI behavior constraints



If missing:



MUST output TODO: contract not defined in ESS-004



14\. OBSERVABILITY REQUIREMENT



Each contract execution MUST emit:



integrationId



endpoint name



latency



success/failure



correlationId



retry count



Observability is governed by ESS-005 (Operational Runbook).



15\. MODULE CONTRACT OWNERSHIP MATRIX



|Domain|Primary Module|Contract Responsibility|
|-|-|-|
|Financial|MOD-005, MOD-013|Escrow, settlement, reconciliation|
|Logistics|MOD-003, MOD-014|Tracking, fleet, mapping|
|Communication|MOD-016|SMS, email, push notifications|
|Compliance|MOD-010|KYC/KYB, security, governance|
|AI|MOD-006|LLM, OCR, ML services|
|Cross-border|MOD-009|Customs, border systems|
|Document|MOD-004|Storage, OCR, document processing|
|Integration Gateway|MOD-011|API contracts, webhooks, adapters|





16\. EXTERNAL INTEGRATION REFERENCES



ESS-001A — External Systems Catalogue (provider inventory)



ESS-001B — Authentication Standards Matrix



ESS-001C — Retry \& Timeout Policy Matrix



ESS-001E — Error Code Standardization



ESS-001F — Financial Integration Architecture



ESS-003 — AI Behavior Constraints



ESS-005 — Operational Runbook (observability)



ESS-006 — Security \& Compliance



ESS-009 — Data Governance



FINAL PRINCIPLE

ESS-004 ensures:



No external system interacts with NexCargo without a strict, typed, and version-controlled contract.

