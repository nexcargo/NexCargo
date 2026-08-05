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



\- PROMPT 0 — Master System Prompt (v1.0)

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

USER ROLES (FROM AI-EPRS)



Shipper



Transporter



Driver



Fleet Owner



Dispatcher



Moderator



Admin



AI System Agent (restricted)



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



Drivers → only assigned trips



Dispatchers → operational control only



Moderators → compliance + disputes only



Admin → system configuration + escrow intervention authority (via governed Escrow Intervention Request). All interventions auditable and traceable.



AI → read-only + recommendation only (No Execution)



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

