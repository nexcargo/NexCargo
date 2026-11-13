**ESS-005 - Operational Runbook Specification**

**Document ID:** ESS-005
**System:** NexCargo
**Version:** 1.0
**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the minimum operational rules for running NexCargo in production, including:



\- incident handling

\- system failure response

\- escalation paths

\- operational roles behavior

\- recovery procedures



It ensures:



The system remains functional, recoverable, and controllable under real-world failures.



2\. CORE PRINCIPLES



2.1 Controlled Failure Principle



Every failure must produce a controlled response, not chaos.



2.2 No Intervention Principle (CRITICAL)



Observability observes only. It does NOT fix errors or restart services.



Refer to MOD-017 (System Observability, Monitoring \& DevOps Operations Layer).



2.3 Human Accountability Principle



Recovery actions require human approval. AI assists only.



3\. INCIDENT SEVERITY LEVELS



SEV-1 (CRITICAL SYSTEM FAILURE)



System-wide impact:



\- escrow failure

\- payment breakdown

\- tracking system offline

\- authentication failure



Response:



immediate system freeze on affected module

alert Admin + Moderator, and alert SUPER_ADMIN where the incident affects escrow or payment integrity or may require a platform-wide emergency restriction (PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 1 and Domain 4)

enable safe-mode fallback

Refer to ESS-001F for financial recovery

\*SEV-2 (MAJOR DISRUPTURE)



Partial system failure:



\- GPS delays

\- webhook failures

\- integration downtime



Response:



\- retry logic activated (ESS-001C)

\- fallback providers used if available

\- monitor escalation



SEV-3 (MINOR ISSUE)



Non-critical issues:



\- UI bugs

\- slow responses

\- notification delays



Response:



\- log only

\- no system interruption

\- fix in next deployment cycle



4\. INCIDENT RESPONSE FLOW



Every incident MUST follow:



Detect → Classify → Log → Contain → Recover → Verify → Close



4.1 Detect



Triggered via:



\- monitoring system

\- error logs (ESS-001E)

\- user reports

\- AI anomaly detection (advisory only)



4.2 Classify



Assign:



\- severity level (SEV-1 to SEV-3)

\- impacted module

\- affected users



4.3 Log



Every incident MUST include:



\- correlationId

\- timestamp

\- moduleId

\- errorCode (ESS-001E)

\- external provider (if any)



4.4 Contain



Actions:



\- isolate failing service — module-scoped isolation performed by Admin within delegated authority

\- disable affected integration — suspending a compromised or malfunctioning integration is exercised by SUPER_ADMIN under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 2; Admin identifies, isolates within module scope and escalates

\- prevent cascading failures



4.5 Recover



Actions:



\- retry operations (ESS-001C rules)

\- switch to fallback provider — emergency provider switching and emergency integration restoration are exercised by SUPER_ADMIN under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 2

\- restore last known valid state



Recovery Constraints:



|\*\*Module\*\*|\*\*Recovery Constraint\*\*|
|-|-|
|MOD-005, MOD-013|No manual ledger modification. Use reconciliation engine|
|MOD-006, MOD-018|AI does not execute recovery. Advisory only.|
|MOD-014|No dispatch recovery actions without human approval.|
|MOD-015|No decision authority. Support does not resolve incidents.|
|MOD-017| Observability observes only. Does NOT fix or restart.|





4.6 Verify



Ensure:



\- system stability restored

\- no data inconsistency

\- financial integrity intact (ESS-001F)



4.7 Close



\- mark incident resolved

\- attach root cause

\- update logs

\- notify stakeholders



5\. SYSTEM SAFE MODE



Trigger Conditions:



\- escrow failure detected

\- ledger mismatch

\- authentication breach

\- critical integration outage



Safe Mode Behavior:



\- suspend financial settlements (MOD-013)

\- disable new bookings (MOD-002) — optional per severity

\- allow tracking + read-only access (MOD-003, MOD-007)

\- block AI execution actions (MOD-006, MOD-018)

\- maintain observability (MOD-017) — no intervention



Boundary note (HAO decision D-01 Item 3, direction 3-B): Safe Mode is a distinct construct from a transaction-specific hold or escrow intervention (MOD-005 §4.1, §4.4; ESS-001F §15.9), from Payment Hold Mode (§11; ESS-001C §9.2), and from platform-wide lockdown, emergency maintenance or an executive kill-switch under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 4. This runbook does not define the entry or exit mechanism for Safe Mode, and none may be inferred from the trigger list above; the mechanism remains subject to a separate specification decision (PROMPT 0 v1.3 Domain 4; the HD-RT-8 row of the NexCargo Development State decision register records the same deferral and is not itself authority). Automated entry is a protective reaction and confers no human authority to resume: pause and resume are separate permissions, and Admin may not resume, disable or bypass a restriction imposed by SUPER_ADMIN (ESS-001F §15.2 suspension boundary, §15.4). A suspension must not cancel, alter or reverse an instruction already received by a bank or payment provider (MOD-013 §5.4).



\---



6\. ESCALATION MATRIX





|Role|Responsibility|Constraint|
|-|-|-|
|System|Auto-detection + logging|No autonomous recovery|
|AI Agent|Suggest diagnosis only|No Execution (ESS-003)|
|Moderator|Investigate operational issues|No Decision Authority (MOD-015 §7.3; ESS-001F §15.6)|
|Admin|Resolve system configuration issues; ordinary financial workflow approvals within delegated authority; module-scoped service isolation during incident containment; escalates to SUPER_ADMIN any matter exceeding that delegated authority|No ledger override; no platform-wide executive restriction; no integration suspension, no emergency provider switching, no integration restoration (PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 2); cannot resume, disable or bypass a restriction imposed by SUPER_ADMIN (ESS-001F §15.2, §15.4)|
|SUPER_ADMIN|Exercise the executive authority domains documented in PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS, including platform-wide emergency restriction and the Domain 2 emergency integration suspension, provider switching and integration restoration; receives matters escalated by Admin that exceed delegated authority and decides the exceptional, high-impact and expressly reserved ones|No Custody (ESS-001F §2.1); no funds execution — the bank or authorised payment provider executes (§2.2; MOD-013 §7.2); each domain limited by its own mandatory boundaries; exercises only the executive authority expressly granted by PROMPT 0 v1.3 and HD-RT-8 and acquires no automatic unlimited authority over every operational matter, and no unlimited financial authority (PROMPT 0 v1.3 §Financial boundary, §Administrative hierarchy)|
|Bank (external)|Resolve financial failures|No Custody (MOD-005, MOD-013)|

Escrow intervention is initiated and decided only through the governed Escrow Intervention Request pathway recorded in ESS-001F §15.6 to §15.10. This matrix records operational escalation and creates no intervention eligibility, no decision authority and no execution authority; nothing in an incident response may alter an escrow state outside the bank-confirmed pathway (MOD-005 §7.2, §7.3). Pause and resume are separate permissions, and an automated protective reaction in this runbook is not a grant of human resume authority (HAO decision D-01 Item 3, direction 3-B; ESS-001F §15.2 suspension boundary). Where this runbook attributes an action to Admin or to SUPER_ADMIN, it points to an authority already granted elsewhere by PROMPT 0 v1.3 or ESS-001F: the runbook grants no authority of its own and creates no escalation level, permission, procedure or state of its own.





7\. RECOVERY RULES



7.1 Financial Recovery (CRITICAL)



\- MUST NOT modify ledger manually

\- MUST use reconciliation engine (ESS-001F)

\- MUST validate against bank source of truth

\- MOD-005 handles escrow initiation and release

\- MOD-013 handles settlement and reconciliation

\- No Custody principle enforced



7.2 Integration Recovery



\- retry using ESS-001C policy

\- switch to fallback provider if available — under SUPER_ADMIN approval per PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 2 (emergency provider switching and integration restoration)

\- isolate failing endpoint



7.3 Data Recovery



\- restore from last valid event state

\- NEVER overwrite event history

\- preserve audit logs

\- Refer to ESS-009 for data governance



8\. COMMUNICATION RULES



During incidents:



\- system MUST emit alerts

\- users MUST receive status updates (if impacted)

\- no silent failures allowed

\- Notification templates support pt and en (MOD-016)



9\. AI ROLE DURING INCIDENTS



AI MAY:



\- suggest probable root cause

\- recommend recovery actions

\- detect anomaly patterns



AI MUST NOT:



\- execute recovery actions

\- modify system state

\- override escalation decisions



AI Constraint: All AI outputs remain advisory-only. Refer to ESS-003.



10\. POST-INCIDENT REQUIREMENTS



After resolution:



\- root cause analysis required

\- affected modules identified

\- fix tracked as TODO or issue

\- incident report stored



11\. MONITORING REQUIREMENTS



System MUST monitor:



\- API latency

\- integration failure rates

\- escrow transaction health

\- authentication success rate

\- GPS tracking continuity

\- localization coverage (pt/en)



Observability Constraint:MOD-017 observes only. Does NOT fix errors or restart services (No Intervention).



12\. FAIL-FAST RULE



If system cannot guarantee consistency:



It MUST stop affected operation rather than continue incorrectly.



13\. MODULE INCIDENT RESPONSIBILITY MATRIX





| \*\*Module\*\*|\*\*Incident Role\*\*|\*\*Key Constraint\*\*|
|-|-|-|
| MOD-001|Marketplace matching|No Auto-Booking|
|MOD-002|Contract integrity|Contract Immutability|
|MOD-003|Tracking continuity|Observe, do not dispatch|
|MOD-004|Document availability|No legal enforcement|
|MOD-005|Escrow health|No Custody|
|MOD-006| AI diagnostics|No Execution|
|MOD-007|UI availability|Localization support|
|MOD-008|Mobile operations|Offline capability|
|MOD-009|Cross-border advisory|No Legal Execution|
|MOD-010|Security incidents|RBAC enforcement|
|MOD-011|Integration gateway|Adapter isolation|
|MOD-012|Analytics|No Computation|
|MOD-013|Settlement reconciliation|No Custody|
|MOD-014|Fleet asset truth|No Dispatch|
|MOD-015|Support escalation|No Decision Authority|
|MOD-016|Notification delivery|Localization (pt/en)|
|MOD-017|Observability|No Intervention|
|MOD-018|Pricing advisory|No Execution|





\## 14. EXTERNAL INTEGRATION REFERENCES



\- ESS-001C — Retry \& Timeout Policy Matrix

\- ESS-001E — Error Code Standardization

\- ESS-001F — Financial Integration Architecture

\- ESS-003 — AI Behavior Constraints

\- ESS-006 — Security \& Compliance

\- ESS-009 — Data Governance

\- MOD-017 — System Observability, Monitoring \& DevOps



FINAL PRINCIPLE



ESS-005 ensures:



NexCargo is not just built to function — it is built to survive failure.


---

DOCUMENTATION CHANGE HISTORY

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-1 | Change-history block established under the INDEX §7.4 Document Change-History Standard. History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register. The rows below record the evidenced changes that the register and this document's own inline citations support, each dated when the change was actually made. Creating this block altered no runbook procedure, escalation path, recovery step or authority boundary in this standard. | HAO decision D-01 Item 6 Stage 1 (NXC-HOA-AUTH-D01-ITEM-06-STAGE-1); INDEX §7.4 |
| 2026-11-02 | NXC-HOA-DECISION-D01-ITEM-02 | §6 carries a cross-reference recording that escrow intervention is initiated and decided only through the governed Escrow Intervention Request pathway defined in ESS-001F §15.6 to §15.10, that the operational escalation matrix creates no intervention eligibility, no decision authority and no execution authority, and that nothing in an incident response may alter an escrow state outside the bank-confirmed pathway. No escalation route, recovery procedure or module responsibility was changed. | HAO decision D-01 Item 2 (NXC-HOA-DECISION-D01-ITEM-02); Development State register, D-01 Item 2 row |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | §5 gained a boundary note holding Safe Mode distinct from a transaction-specific hold or escrow intervention, from Payment Hold Mode (§11; ESS-001C §9.2) and from platform-wide lockdown, emergency maintenance or an executive kill-switch under PROMPT 0 v1.3 §SUPER_ADMIN EXECUTIVE AUTHORITY DOMAINS Domain 4; §6's actor matrix gained a SUPER_ADMIN row for the executive authority domains, including the Domain 2 emergency integration suspension, provider switching and integration restoration, and the Moderator and Admin rows now state that Admin acts within delegated authority while a Moderator investigates and records No Decision Authority. Pauses raised by automated protective reactions confer no human authority to resume. No lockdown mechanism was created and Safe Mode was not redefined; runbook steps, alert routing and module boundaries are otherwise unchanged. | HAO decision D-01 Item 3, directions 3-A and 3-B (NXC-HOA-AUTH-D01-ITEM-03-001); Development State register, D-01 Item 3 row; ESS-001F §15.2, §15.4 |

Version effect: ESS-005 remains v1.0 — no version increase, no loader change and no INDEX §7.1 change. This block records changes already made and registered under the authorisations cited in it; creating the block changed no procedure or boundary in this standard.
