**ESS-001B — APPENDIX B - Authentication Standards Matrix**



**Authentication Standards Matrix**

**Document ID:** ESS-001B
**Parent Spec:** ESS-001 — External Integrations Specification
**System:** NexCargo
**Version:** 1.0
**Status:** Authoritative Source of Truth



1\. PURPOSE



This appendix defines the standardized authentication mechanisms used across all NexCargo integrations.



It ensures:



consistent identity verification across services



secure communication with external providers



elimination of ad-hoc authentication implementations



enforceable security boundaries across modules and APIs



2\. AUTHENTICATION PRINCIPLES



All authentication systems in NexCargo MUST follow:



Zero Trust Principle → no system is trusted by default



Least Privilege Principle → minimal access per credential



Scoped Access Principle → every credential has a limited domain



Rotation Principle → credentials expire and rotate



Auditability Principle → every authentication event is logged



3\. AUTHENTICATION METHODS MATRIX



3.1 OAuth 2.0 (Primary Standard for External APIs)



|-----------------------|-----------------------------------------------|

| Attribute		| Specification					|

|-----------------------|-----------------------------------------------|

| Type			| Delegated Authorization			|	

| Usage			| External APIs (Maps, AI, ERP, etc.)		|

| Flow Types		| Authorization Code + Client Credentials	|

| Token Type		| Bearer JWT					|

| Refresh Support	| Yes						|

| Risk Level		| Medium					|

|-----------------------|-----------------------------------------------|



Rules:



MUST use Authorization Code Flow for user-delegated access



MUST use Client Credentials for system-to-system calls



Tokens MUST be short-lived



Refresh tokens MUST be stored securely



3.2 API Key Authentication (Legacy + Simple Integrations)



|-----------------------|-----------------------------------------------|

| Attribute		| Specification					|

| Type			| Static credential				|

| Usage			| SMS gateways, simple APIs			|

| Risk Level		| High (if not scoped)				|

|-----------------------|-----------------------------------------------|



Rules:



MUST be scoped per environment



MUST be rotated periodically



MUST never be exposed in frontend code



MUST be stored in Secrets Manager only (as defined in Prompt 8)



3.3 JWT (Internal System Authentication)



|-----------------------|-----------------------------------------------|

| Attribute		| Specification					|

|-----------------------|-----------------------------------------------|

| Type			| Stateless token				|

| Usage			| Internal APIs, session validation		|

| Issuer		| Supabase Auth					|

| Expiry		| Short-lived (≤ 15 minutes access token)	|

|-----------------------|-----------------------------------------------|



Token Structure:



json

{

&#x20; "sub": "userId",

&#x20; "role": "UserRole",

&#x20; "sessionId": "string",

&#x20; "permissions": \["string"],

&#x20; "scope": \["string"],

&#x20; "iat": 1234567890,

&#x20; "exp": 1234567890,

&#x20; "aud": "nexcargo-api"

}



Rules:



MUST be signed using asymmetric encryption (RS256 or equivalent)



MUST include role + session context



MUST NOT store sensitive data



Supabase Auth provides native JWT issuance and validation



3.4 Mutual TLS (mTLS) — HIGH SECURITY INTEGRATIONS



|-----------------------|-----------------------------------------------|

| Attribute		| Specification					|

|-----------------------|-----------------------------------------------|

| Type			| Certificate-based authentication		|

| Usage			| Banking APIs, escrow banks			|

| Risk Level		| CRITICAL					|

|-----------------------|-----------------------------------------------|



Rules:



Both client and server MUST present certificates



Certificates MUST be issued by trusted CA



Rotation MUST be enforced



Connections without valid cert MUST be rejected



Refer to ESS-001F for financial integration requirements



3.5 HMAC-Signed Requests (Webhook Security Standard)



|---------------|---------------------------------------|

| Attribute	| Specification				|

|---------------|---------------------------------------|

| Type		| Signature-based validation		|

| Usage		| Webhooks (payments, logistics updates)|

|---------------|---------------------------------------|



Rules:



Every webhook MUST include signature header



Signature MUST be validated server-side



Payload MUST NOT be trusted without verification



Replay attacks MUST be prevented via timestamp validation



Refer to ESS-001D for webhook governance



3.6 Session-Based Authentication (User Sessions)



|-----------------------|-----------------------|

| Attribute		| Specification		|

|-----------------------|-----------------------|

| Type			| Stateful session	|

| Usage			| Web + Mobile users	|

|-----------------------|-----------------------|



Rules:



Sessions MUST be stored server-side via Supabase Auth



Sessions MUST be revocable



Sessions MUST expire automatically



Sessions MUST be bound to:



userId



deviceId



IP address (optional)



4\. AUTHENTICATION USE CASE MAPPING



|-------------------------------|---------------------------------------|

| System Type			| Method			   	|

| User Login			| Supabase Auth (JWT + Session)		|

| Mobile App			| Supabase Auth (JWT + Refresh Token)	|

| Internal Services		| JWT (service-to-service)		|

| Banks / Escrow		| mTLS					|

| SMS / Email			| API Key				|

| Maps / AI APIs		| OAuth 2.0				|

| Webhooks			| HMAC Signature			|

|-------------------------------|---------------------------------------|



5\. TOKEN LIFECYCLE RULES



Access Token



Lifetime: ≤ 15 minutes



Non-revocable (stateless)



Must be refreshed via Supabase Auth



Refresh Token



Lifetime: Long-lived (days/weeks)



Stored securely (HttpOnly cookie or secure storage)



Revocable via session invalidation in Supabase Auth



6\. SECRET MANAGEMENT RULES



All credentials MUST:



be stored in centralized secrets manager (Supabase Secrets or equivalent)



NEVER be hardcoded



NEVER be stored in frontend



NEVER be logged



be environment-specific



Examples:



DEV ≠ STAGING ≠ PROD credentials



Secrets management is governed by Prompt 8 (DevOps, Deployment, Infrastructure \& Observability).



7\. AUTHENTICATION EVENT LOGGING



Every authentication event MUST be logged:



Event Type

LoginSuccess

LoginFailure

TokenIssued

TokenExpired

TokenRefreshed

SessionCreated

SessionRevoked

UnauthorizedAccessAttempt



Each log MUST include:



userId (if available)



timestamp



IP address



device info



correlationId



Authentication logs are subject to ESS-009 (Data Governance) requirements.



8\. AUTHORIZATION BOUNDARY RULE



Authentication ≠ Authorization



Even if authenticated:



Access MUST still pass RBAC (MOD-010, Prompt 7)



Access MUST still pass module-level checks



Access MUST still pass API middleware validation



9\. SECURITY FAILURE MODES



If authentication fails:



DO NOT retry silently



DO NOT fallback to weaker auth



DO NOT bypass system



MUST return standardized error response (ESS-001E)



10\. AI GOVERNANCE RULE (CRITICAL)



AI SYSTEMS MUST:



NEVER generate fake tokens



NEVER simulate authentication success



NEVER bypass authentication layer



NEVER assume credentials exist



ALWAYS request missing auth via TODO marker



Refer to ESS-003 for AI behavior constraints



11\. IDENTITY TRUST MODEL



Trust hierarchy:



mTLS (highest trust — banks)



OAuth 2.0 (external APIs)



JWT (internal services)



Session auth (users)



API keys (lowest trust)



12\. VERSIONING RULE



Authentication standards:



MUST be versioned



MUST be backward compatible



MUST not change token structure without migration plan



FINAL PRINCIPLE



Authentication in NexCargo is:



a multi-layered, zero-trust identity verification system spanning users, services, and external providers



NOT:



a login system



a token generator



a frontend utility

