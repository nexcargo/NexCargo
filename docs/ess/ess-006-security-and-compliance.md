**ESS-006 - Security \& Compliance Specification**

**Document ID:** ESS-006
**System:** NexCargo
**Backend:** Supabase (PostgreSQL + Auth + RLS)
**Version:** 1.0
**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the \*\*security, authentication, authorization, and compliance rules\*\* for NexCargo.



It ensures:



\- zero unauthorized data access

\- strict role enforcement (RBAC)

\- database-level security via Supabase RLS

\- compliance readiness for financial + cross-border logistics operations



2\. CORE SECURITY PRINCIPLES



2.1 Defense in Depth Principle



Security is enforced at the database level, not just the application level.



2.2 Least Privilege Principle



Every user and system has minimal necessary access.



2.3 No Custody Principle



NexCargo NEVER holds funds. Refer to MOD-005, MOD-013, and ESS-001F.



2.4 No Execution Principle



AI NEVER executes actions. All outputs are advisory-only. Refer to MOD-006, MOD-018, and ESS-003.



2.5 No Intervention Principle



Observability observes only. Does NOT fix errors or restart services. Refer to MOD-017.



3\. AUTHENTICATION MODEL (SUPABASE AUTH)



3.1 Identity Source



All users MUST authenticate via:



\- Supabase Auth only



Supported methods:



\- email/password

\- OAuth (if enabled later)

\- OTP (optional for mobile money regions)



3.2 Session Rules



\- sessions MUST be short-lived and refreshable

\- tokens MUST be validated on every request

\- no custom auth bypass allowed



3.3 JWT Claims (MANDATORY)



Each JWT MUST include:



\- userId

\- role

\- tenantId (if multi-tenant extension used later)

\- languagePreference (for localization)



4\. AUTHORIZATION MODEL (RBAC + RLS HYBRID)



4.1 RBAC RULE (APPLICATION LAYER)



Roles (from Prompt 0):



\- Shipper

\- Transporter

\- Driver

\- Dispatcher

\- Moderator

\- Admin

\- AI System Agent (restricted)



Rules:



\- roles define intent

\- roles do NOT enforce security alone

\- AI System Agent has read + recommend only permissions



4.2 RLS RULE (DATABASE LAYER — CRITICAL)



ALL tables MUST enforce Supabase Row Level Security.



Mandatory Rule:



No table is accessible unless explicitly allowed by RLS policy.



4.3 RLS POLICY STRUCTURE



Example pattern:



```sql

\-- Shipments access rule

CREATE POLICY "shipper\_can\_view\_own\_shipments"

ON shipments

FOR SELECT

USING (auth.uid() = shipper\_id);

4.4 RLS GOLDEN RULE



If RLS is missing, the table is considered NON-EXISTENT in production.



4.5 RLS MODULE MAPPING



Module	RLS Policy Focus

MOD-001	- Marketplace listings, matching data

MOD-002	- Contracts, bookings

MOD-003	- Tracking data, shipment visibility

MOD-004	- Documents, PODs

MOD-005	- Escrow state (read-only for most roles)

MOD-007	- User-specific dashboard data

MOD-009	- Cross-border shipment data

MOD-010	- Security policies, audit logs (admin-only)

MOD-012	- Analytics datasets (aggregated)

MOD-013	- Settlement data (restricted)

MOD-014	- Fleet, asset data

MOD-015	- Support tickets, disputes

MOD-016	- Notification preferences



5\. API SECURITY RULES



5.1 No Direct DB Exposure Without RLS



Supabase client access MUST always assume hostile environment



never trust frontend filters



5.2 Server Actions Rule



sensitive operations MUST go through server actions or edge functions



financial operations MUST never run client-side



5.3 CSRF PROTECTION (NEXT.JS CONTEXT)



If using Next.js App Router:



all state-changing requests MUST validate origin



cookies MUST be HttpOnly



same-site cookies MUST be enforced



CSRF tokens required for non-Supabase-auth flows



6\. DATA SECURITY RULES

6.1 Encryption



data in transit → TLS 1.2+



data at rest → Supabase encryption (default) + sensitive field encryption where needed



6.2 Sensitive Data Handling



Sensitive fields include:



payment references



identity documents



driver license data



bank/escrow metadata



user language preference (PII)



Rules:



MUST NOT be exposed to frontend unless explicitly allowed by RLS



MUST be logged in masked form only



Language preference is stored in user profile with RLS protection



7\. FINANCIAL SECURITY RULES (CRITICAL)



From ESS-001F:



No Custody: NexCargo NEVER holds funds. Bank is the ONLY execution authority.



escrow is controlled by regulated bank



MOD-005 handles escrow initiation and release



MOD-013 handles settlement and reconciliation



Additional rules:



no client-side financial computation



no exposed payout endpoints without authentication



all financial tables MUST have RLS + audit triggers



8\. AUDIT LOGGING REQUIREMENTS

Every sensitive action MUST be logged:



userId



role



action type



timestamp



affected entity



correlationId



Audit logs MUST be:



immutable



append-only



RLS-protected (admin-only access)



governed by ESS-009 (Data Governance)



9\. API KEY \& SECRET MANAGEMENT



NEVER hardcode secrets



use Supabase environment variables



rotate keys regularly



restrict keys by environment (dev/staging/prod)



10\. CROSS-SITE \& WEB SECURITY



10.1 CSRF Rules



cookies: SameSite=Lax or Strict



no unauthorized cross-origin POST requests



validate origin header for sensitive operations



10.2 Cross‑Site Scripting (XSS) Prevention



All user‑generated content must be treated as untrusted. NexCargo enforces a multi‑layer defense against XSS, beginning at the network level and extending through rendering.



Content Security Policy (CSP)



A strict Content Security Policy is enforced via HTTP headers. The policy restricts script sources to the application origin and allows inline scripts only when accompanied by a cryptographic nonce, which is generated per request. Images and connections are limited to trusted domains, and framing is prohibited to prevent clickjacking. Additional security headers—such as X‑Content‑Type‑Options: nosniff, X‑Frame‑Options: DENY, and a strict Referrer‑Policy—are set globally.



Output Encoding



All data rendered in the browser must be contextually encoded. The framework (React/Next.js) automatically escapes content in JSX, which eliminates the majority of DOM‑based XSS vectors. For any manual DOM manipulation or injection, developers must use safe APIs (textContent instead of innerHTML) and never insert raw HTML unless the content has been sanitised by a trusted library and reviewed. For JSON responses, all data is serialised using JSON.stringify, which automatically escapes dangerous characters.



Input Sanitisation



Validation and sanitisation are enforced at the server side for every input field. Schema‑based validation (using Zod or equivalent) defines allowed types, lengths, and character sets. For rich‑text content, a dedicated sanitisation library removes all unsafe HTML tags and attributes, leaving only a whitelist of safe formatting. File uploads are subject to strict MIME‑type validation, metadata stripping, and malware scanning, and uploaded files are renamed with a server‑generated identifier to avoid trusting user‑supplied filenames.



DOM‑Based XSS Prevention



When handling URL parameters, fragment identifiers, or other client‑side data, the application validates and normalises the data before use. Redirects are restricted to relative paths, and any dynamic evaluation of code (such as eval or Function constructors) is prohibited.



Third‑Party Scripts



Any external script loaded (analytics, monitoring, etc.) is fetched over HTTPS, includes a Subresource Integrity hash, and is whitelisted in the CSP policy. Scripts are loaded asynchronously to avoid blocking page rendering.



Testing and Incident Response



Each pull request that introduces a new user input field must include a test case that attempts common XSS payloads. Automated CI checks prevent the use of unsafe methods like dangerouslySetInnerHTML without explicit review. If an XSS vulnerability is discovered, the affected feature is immediately disabled, all active sessions are revoked, logs are audited for exploitation attempts, and a patch is deployed within 24 hours.



11\. FILE UPLOAD SECURITY



all uploads must be scanned (if available)



file type whitelist enforced



no direct public bucket writes



signed URLs for access only



File upload security is governed by MOD-004 (Document Management).



12\. SUPABASE STORAGE RULES



private buckets by default



public access only for explicitly defined assets



RLS-equivalent policies enforced via storage policies



13\. AI SECURITY RULES



AI MUST:



NEVER access sensitive raw data unless RLS permits it



NEVER bypass authentication context



NEVER infer restricted data



NEVER simulate user identity



Never execute actions (No Execution principle)



Refer to ESS-003 for AI constraints



AI CAN ONLY:



operate on filtered, authorized datasets



provide summaries of permitted data



flag potential security risks (advisory only)



14\. COMPLIANCE BOUNDARIES



NexCargo must align with:



basic data protection principles (GDPR-like structure)



financial auditability requirements



cross-border logistics traceability



BUT:



compliance enforcement is system-driven, not AI-driven



MOD-010 (Security, Compliance \& Governance) is the primary compliance module



15\. BREACH HANDLING RULE



If a security violation is detected:



immediately revoke session



trigger incident flow (ESS-005)



log event immutably



freeze affected data access



16\. MODULE SECURITY RESPONSIBILITY MATRIX



&#x09;| 			| 

\--------------------------------------------------------------------------------

| 			| 

MOD-002	| 			| 

MOD-003	| 			| 

MOD-004	| 			| 

MOD-005	|			| 

MOD-006	| 		| 

MOD-007	| 		| 

MOD-008	| 			| 

MOD-009	| 		| 

MOD-010	| 			| 

MOD-011	| 			| 

MOD-012	| 			| 

MOD-013	|			| 

MOD-014	| 				| 

MOD-015	| 			| No Decision Authority

MOD-016	| Communication security			| Localization

MOD-017	| Observability security			| No Intervention

MOD-018	| Pricing data protection			| No Execution



|Module|Security Responsibility|Key Constraint|
|-|-|-|
|MOD-001|Marketplace data protection|No Auto-Booking|
|MOD-002|Contract integrity|Contract Immutability|
|MOD-003|Tracking data confidentiality|No Dispatch|
|MOD-004|Document access control|No Legal Execution|
|MOD-005| Escrow data protection|No Custody|
|MOD-006|AI data access restrictions|No Execution|
|MOD-007|User dashboard data segregation|Localization support|
|MOD-008|Mobile device security|Offline data protection|
|MOD-009|Cross-border data compliance|No Legal Execution|
|MOP-010|Primary security module|RBAC, RLS, compliance|
|MOD-011|API security, rate limiting|Integration contract|
|MOD-012|Analytics data anonymizations|No Computation|
|MOD-013| Settlement data protection|No Custody|
|MOD-014|Fleet data integrity|No Dispatch|
|MOD-015|Support data confidentiality|No Decision Authority|
|MOD-016|Communication security|Localization|
|MOD-017|Observability security|No Intervention|
|MOD-018|Pricing data protection|No Execution|





17\. EXTERNAL INTEGRATION REFERENCES



ESS-001A — External Systems Catalogue (provider security)



ESS-001B — Authentication Standards Matrix



ESS-001C — Retry \& Timeout Policy Matrix



ESS-001D — Webhook Governance Standard



ESS-001E — Error Code Standardization



ESS-001F — Financial Integration Architecture



ESS-003 — AI Behavior Constraints



ESS-005 — Operational Runbook (incident handling)



ESS-009 — Data Governance



MOD-010 — Security, Compliance \& Governance Layer



FINAL PRINCIPLE

ESS-006 ensures:



Supabase is not just a database — it is the security enforcement layer of NexCargo.

