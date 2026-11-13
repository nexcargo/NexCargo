\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-7.auth-rbac.v1

module: PROMPT-7

version: v1.0



loads:

&#x20; - BOOT@v1.0

&#x20; - INDEX@v1.0

&#x20; - ESS@v1.0

&#x20; - ARBITRATION@v1.0

&#x20; - PROMPT-0@v1.0

&#x20; - PROMPT-1@v1.0

&#x20; - PROMPT-2@v1.0

&#x20; - PROMPT-3@v1.0

&#x20; - PROMPT-4@v1.0

&#x20; - PROMPT-5@v1.0

&#x20; - PROMPT-6@v1.0



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

&#x20; - PROMPT-1 status=FROZEN

&#x20; - PROMPT-2 status=FROZEN

&#x20; - PROMPT-3 status=FROZEN

&#x20; - PROMPT-4 status=FROZEN

&#x20; - PROMPT-5 status=FROZEN

&#x20; - PROMPT-6 status=FROZEN

&#x20; - BOOT loaded

&#x20; - INDEX loaded

&#x20; - ESS loaded

&#x20; - ARBITRATION loaded



inputs:

&#x20; - /specs/nexcargo\_boot.md

&#x20; - /specs/nexcargo\_index.md

&#x20; - /specs/ess/

&#x20; - /specs/nexcargo\_arbitration\_layer.md

&#x20; - /specs/prompt-0-master-system.md

&#x20; - /specs/prompt-1-architecture-bootstrap.md

&#x20; - /specs/prompt-2-database-event-store.md

&#x20; - /specs/prompt-3-module-implementation.md

&#x20; - /specs/prompt-4-uiux-integration.md

&#x20; - /specs/prompt-5-design-system.md

&#x20; - /specs/prompt-6-api-integration.md



expected\_outputs:

&#x20; - Complete authentication, RBAC, and security core system

&#x20; - Fully compliant with Prompt 0-6 and ESS-006

&#x20; - No behaviour outside the scope of identity and security

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - PROMPT-1 architectural rules respected

&#x20; - PROMPT-2 data rules respected

&#x20; - PROMPT-3 module rules respected

&#x20; - PROMPT-4 UI rules respected

&#x20; - PROMPT-5 design system rules respected

&#x20; - PROMPT-6 API rules respected

&#x20; - ESS-006 (Security \& Compliance) constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity

&#x20; - Zero-trust security model enforced

&#x20; - AI System Agent role restricted to read + recommend only

&#x20; - Admin role includes escrow intervention authority (auditable)

&#x20; - No privilege escalation paths



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



PROMPT 7 — AUTHENTICATION + RBAC + SECURITY CORE



NexCargo Identity \& Security System Layer



\---



\## ROLE CONTINUATION



You are operating under:



\- PROMPT 0 — NEXCARGO MASTER SYSTEM_v1.3.md

\- PROMPT 1 — Architecture Bootstrap

\- PROMPT 2 — Database + Event Store Design

\- PROMPT 3 — Module Implementation Bootstrap

\- PROMPT 4 — UI/UX Integration Bootstrap

\- PROMPT 5 — Full Design System

\- PROMPT 6 — API + Server Actions Layer



All rules are inherited without modification.



Prompt 0 is the highest authority.



\---



\## PURPOSE OF THIS PROMPT



You are responsible for building:



The complete authentication, authorization, identity, and security core system for NexCargo.



This includes:



\- Authentication system (login/session/token)

\- Role-Based Access Control (RBAC)

\- Permission engine

\- Session management

\- Security middleware

\- Audit security layer

\- Identity linking across modules

\- Secure API enforcement layer



\---



\## CRITICAL SECURITY PRINCIPLES



You MUST:



\- Treat all requests as untrusted by default

\- Enforce server-side authentication only

\- Enforce RBAC on every request

\- Use least-privilege principle

\- Ensure full auditability of identity actions

\- Prevent privilege escalation

\- Bind identity to every event and transaction



You MUST NOT:



\- Trust client-side role checks

\- Allow anonymous access to protected APIs

\- Store sensitive auth logic in UI layer

\- Bypass RBAC in internal services

\- Mix authentication logic with business logic



\---



\## SECURITY ARCHITECTURE OVERVIEW



The system consists of:



\*\*1. Authentication Layer\*\*

\- User identity verification

\- Session management

\- Token issuance/validation



\*\*2. Authorization Layer (RBAC)\*\*

\- Role-based permissions

\- Resource-level access control



\*\*3. Security Middleware Layer\*\*

\- API protection

\- request validation

\- role enforcement



\*\*4. Audit Security Layer\*\*

\- identity tracking

\- action logging

\- security event tracking



\---



\## AUTHENTICATION SYSTEM DESIGN



\*\*Supported Authentication Methods:\*\*



\- Email + password (primary)

\- OTP (SMS / Email fallback)

\- OAuth (future-ready extension)

\- Magic link (optional enhancement)



\*\*SESSION MODEL (MANDATORY)\*\*



Sessions MUST include:



```json

{

&#x20; "sessionId": "string",

&#x20; "userId": "string",

&#x20; "role": "UserRole",

&#x20; "permissions": "string\[]",

&#x20; "issuedAt": "string",

&#x20; "expiresAt": "string",

&#x20; "ipAddress": "string",

&#x20; "userAgent": "string",

&#x20; "isActive": "boolean"

}

TOKEN RULE



Use secure signed tokens (JWT or equivalent)



Tokens MUST be short-lived



Refresh tokens MUST be stored securely



Tokens MUST include:



userId



role



sessionId



correlationId



languagePreference (for localization)



RBAC SYSTEM (CRITICAL CORE)

USER ROLES (CANONICAL — PROMPT 0 v1.3 §USER ROLES)



Shipper



Transporter



Driver



Dispatcher



Moderator



Admin



SUPER_ADMIN



System (non-human actor; AI System Agent is its AI designation and is restricted)



PERMISSION MODEL



Permissions MUST be:



json

{

&#x20; "resource": "string",

&#x20; "action": "string",

&#x20; "scope": "string"

}



Example:



shipment:create



shipment:view



payment:execute



trip:update



fleet:assign



RBAC ENFORCEMENT RULE



Every request MUST:



Identify user



Resolve role



Load permissions



Validate access



Deny if unauthorized



ROLE PERMISSION PRINCIPLES



Drivers → only assigned trips. DRIVER is never selectable through public registration: it is onboarded and assigned exclusively by an authorised Transporter (PROMPT 0 v1.3 §ROLE PROVISIONING AND DELEGATION)



Dispatchers → delegated operational control only, bounded by the explicit delegation granted by a specific Transporter



Moderators → compliance + disputes only



Admin → system configuration + escrow intervention authority (via governed Escrow Intervention Request). All interventions auditable and traceable.



AI → read-only + recommendation only (No Execution). The AI actor is designated AI System Agent inside the System classification and is not a human-accessible role.



SUPER_ADMIN → explicit superset of the approved Moderator and Admin permissions plus the SUPER_ADMIN-exclusive actions recorded in PROMPT 0 v1.3 §PERMISSION RULES; no permission accrues from hierarchy position alone and no role gains financial authority from the hierarchy. Under HD-RT-8 the set is further supplemented by the five SUPER_ADMIN executive authority domains recorded in PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS; they are documented at authority level only, and no session claim, token scope, RLS policy, middleware rule or permission-matrix entry for them is specified or authorised by this document.



SECURITY MIDDLEWARE LAYER

All API routes MUST pass through:



authMiddleware()



rbacMiddleware()



auditMiddleware()



Middleware responsibilities:



validate token



verify session



enforce RBAC



attach user context



log security event



📡 SECURITY EVENT SYSTEM

Every authentication event MUST emit:



UserLoggedIn



UserLoggedOut



PermissionDenied



RoleEscalationAttempted



SessionExpired



All events MUST:



include correlationId



be stored in event store (Prompt 2)



be immutable



API SECURITY ENFORCEMENT RULE

All API routes MUST:



require authentication



enforce RBAC



validate session status



reject unauthorized access



Example:



typescript

if (!auth.user) throw new UnauthorizedError();



if (!hasPermission(auth.user, "shipment:create")) {

&#x20; throw new ForbiddenError();

}



IDENTITY BINDING RULE (CRITICAL)

Every system action MUST be bound to:



userId



role



sessionId



correlationId



This applies to:



shipments



payments



trips



bids



compliance actions



PASSWORD + CREDENTIAL SECURITY RULES

You MUST:



hash passwords securely (argon2 or bcrypt)



never store plaintext credentials



never expose auth secrets to client



rotate tokens securely



🧾 AUDIT SECURITY LAYER

Every security-relevant action MUST log:



json

{

&#x20; "userId": "string",

&#x20; "action": "string",

&#x20; "resource": "string",

&#x20; "timestamp": "string",

&#x20; "ipAddress": "string",

&#x20; "role": "string",

&#x20; "correlationId": "string",

&#x20; "result": "string"

}



PRIVILEGE ESCALATION PREVENTION

System MUST prevent:



role spoofing



client-side role injection



unauthorized admin access



cross-module privilege abuse



AI SECURITY CONSTRAINT

AI SYSTEM ROLE:



MUST:



read-only access to identity metadata



respect RBAC boundaries



MUST NOT:



modify roles



escalate permissions



bypass authentication



access restricted financial operations



SESSION SECURITY RULE

Sessions MUST:



expire automatically



be revocable



be device-aware



support logout invalidation



FAILURE HANDLING RULE

If security behavior is unclear:



STOP and output: TODO: requires specification from AI-EPRS



Never assume security behavior.



FINAL SECURITY PRINCIPLE

NexCargo security system is:



a zero-trust, fully auditable, role-isolated enterprise identity system



NOT:



a simple login system



a frontend auth helper



a token wrapper


---

DOCUMENTATION CHANGE HISTORY (role taxonomy reconciliation — NXC-GOV-ROLE-RECON-001 / NXC-HOA-AUTH-ROLE-001)

| Date | Assignment | Change | Authority basis | Version / status effect |
|-|-|-|-|-|
| 2026-10-30 | NXC-GOV-ROLE-RECON-001 | USER ROLES: removed the stale "Fleet Owner" entry. The list now reads Shipper, Transporter, Driver, Dispatcher, Moderator, Admin, AI System Agent (restricted). | HAO-R-001 and HAO-RRL-001 (Development State Registry): FLEET_OWNER is not an application role; fleet ownership is a Transporter-domain concept. PROMPT 0 v1.1 USER ROLES likewise contains no Fleet Owner role. | Version remains v1.0. Status, authority and approval state unchanged — documentation-consistency correction, not an architectural revision. |
| 2026-10-30 | NXC-HOA-AUTH-ROLE-001 | USER ROLES heading re-based on PROMPT 0 v1.2 §USER ROLES; SUPER_ADMIN added and System added as the non-human classification with AI System Agent as its designation. Role permission principles updated for Driver provisioning, Dispatcher delegation bounds, SUPER_ADMIN superset, and the AI/System classification. Loader reference now resolves to PROMPT 0 v1.2. | PROMPT 0 v1.2 §USER ROLES, §PERMISSION RULES, §ROLE PROVISIONING AND DELEGATION; HAO decisions HD-RT-1, HD-RT-2, HD-RT-3, HD-RT-4 | Version remains v1.0; status and authority unchanged. |
| 2026-10-30 | NXC-HOA-DECISION-HD-RT-8 | Loader pointer raised to the PROMPT 0 v1.3 file. USER ROLES heading, Driver provisioning rule and SUPER_ADMIN permission line rebased on v1.3, which additionally documents the five HD-RT-8 executive authority domains. Authority-level documentation only: no session claim, token scope, RLS policy, middleware rule or permission-matrix entry is specified or authorised by this pass. | HAO decision HD-RT-8 | PROMPT 7 version unchanged; no runtime authentication or RBAC change authorised |

RESOLUTION NOTE — SUPER_ADMIN

The blocking condition recorded below under NXC-GOV-ROLE-RECON-001 has been resolved by HAO authorization NXC-HOA-AUTH-ROLE-001, decision HD-RT-1: PROMPT 0 v1.2 has been promulgated as the current authoritative version and carries SUPER_ADMIN in §USER ROLES and §PERMISSION RULES. PROMPT 0 v1.1 is retained unchanged as superseded historical authority, recorded in INDEX §7.2. Second pass, 2026-10-30: PROMPT 0 v1.3 has since been promulgated under HAO decision HD-RT-8 and supersedes v1.2, which is likewise retained unchanged as historical authority; the resolution recorded above stands.

PRIOR NOTE (retained for traceability): SUPER_ADMIN was absent from this document and from PROMPT 0 v1.1 (USER ROLES), while the Development State Registry records it as an authoritative platform role under HAO-RRL-001 and HAO-R-003. Correcting the governing role list required an explicit HAO revision of PROMPT 0 v1.1, which carries status=FROZEN; it was therefore not amended in that pass, and no subordinate document was changed in a way that contradicted it.



RECONCILIATION NOTE — SUPER_ADMIN

SUPER_ADMIN is absent from this document and from PROMPT 0 v1.1 (USER ROLES), while the Development State Registry records it as an authoritative platform role under HAO-RRL-001 and HAO-R-003. Correcting the governing role list requires an explicit HAO revision of PROMPT 0 v1.1, which carries status=FROZEN. It has therefore not been amended in this pass, and no subordinate document has been changed in a way that contradicts it.
