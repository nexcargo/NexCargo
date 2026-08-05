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

alert Admin + Moderator

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



\- isolate failing service

\- disable affected integration

\- prevent cascading failures



4.5 Recover



Actions:



\- retry operations (ESS-001C rules)

\- switch to fallback provider

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



\---



6\. ESCALATION MATRIX





|Role|Responsibility|Constraint|
|-|-|-|
|System|Auto-detection + logging|No autonomous recovery|
|AI Agent|Suggest diagnosis only|No Execution (ESS-003)|
|Moderator|Investigate operational issues|No Decision Authority (MOD-015)|
|Admin|Resolve system configuration issues|No ledger override|
|Bank (external)|Resolve financial failures|No Custody (MOD-005, MOD-013)|





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

\- switch to fallback provider if available

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

