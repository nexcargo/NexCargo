**ESS-003 - AI Intelligence Specification**

**Document ID:** ESS-003
**System:** NexCargo
**Version:** 1.0
**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the \*\*scope, boundaries, and constraints of all AI systems inside NexCargo.



It ensures AI is used for:



\- optimization

\- prediction

\- assistance



and never for:



\- financial execution

\- system control

\- autonomous decision enforcement



2\. CORE AI PRINCIPLES



2.1 No Execution Principle (CRITICAL)



AI assists. It does not decide critical outcomes.



AI outputs are \*\*advisory-only\*\*. All AI-generated suggestions require human confirmation before any action is taken.



2.2 Human Accountability Principle



Every critical decision must have a human owner. AI recommendations are non-binding.



2.3 Traceable Intelligence Principle\*



Every AI suggestion must be traceable to its inputs and model version.



3\. AI ALLOWED CAPABILITIES



All AI outputs remain advisory-only and require human confirmation.



3.1 Predictive Intelligence



\- ETA prediction

\- delivery delay forecasting

\- demand forecasting by corridor

\- fuel cost estimation



3.2 Optimization Intelligence



\- route suggestions

\- load matching recommendations (MOD-001 advisory only — No Auto-Booking)

\- fleet utilization optimization (MOD-014 advisory only — No Dispatch)

\- empty backhaul suggestions



3.3 Risk Intelligence



\- fraud pattern detection (MOD-006 advisory)

\- anomaly detection in payments

\- suspicious behavior scoring

\- carrier reliability scoring



3.4 Assistive Intelligence



\- chatbot support for users

\- document summarization (non-legal final authority)

\- shipment status explanations

\- pricing suggestions (MOD-018 advisory only)



4\. AI STRICTLY FORBIDDEN ACTIONS (CRITICAL)



4.1 Financial Execution



AI MUST NEVER:



\- move money

\- approve payments

\- release escrow

\- modify ledger entries



Violates No Custody (MOD-005, MOD-013). Refer to ESS-001F.



4.2 Compliance Authority



\- approve KYC/KYB

\- override regulatory decisions

\- validate licenses as final authority



Violates No Decision Authority. Refer to MOD-010.



4.3 System Mutation



\- change database schema

\- modify modules

\- alter architecture

\- create new undocumented APIs



Refer to Architecture Immutability Rule (Prompt 0).



4.4 Autonomous Execution



\- dispatch shipments automatically without human confirmation

\- override dispatcher decisions

\- finalize disputes

\- auto-book shipments



Violates No Dispatch (MOD-014), No Auto-Booking (MOD-001), No Decision Authority (MOD-015).



5\. HUMAN-IN-THE-LOOP RULE



All critical decisions MUST require:



\- Shipper confirmation OR

\- Dispatcher confirmation OR

\- Admin approval



AI can only:



recommend, not execute



6\. AI DECISION TIERS



Tier 1 — Advisory (SAFE)



\- recommendations

\- insights

\- predictions



No system impact.



Tier 2 — Assisted Execution (CONTROLLED)



\- pre-filled forms

\- suggested routes

\- suggested pricing



Requires human approval.



Tier 3 — Restricted (BLOCKED WITHOUT AUTHORIZATION)



\- anything affecting:

&#x20; - money

&#x20; - compliance

&#x20; - shipment finalization



Must pass RBAC + module validation.



7\. MODEL INPUT RULES



AI MUST ONLY use:



\- validated system data

\- event store data (ESS-001D)

\- ledger-reconciled data (ESS-001F)



AI MUST NOT:



\- invent missing shipment data

\- assume financial states

\- fabricate tracking updates

\- simulate external API responses



8\. FRAUD DETECTION BEHAVIOR



AI MAY:



\- assign fraud risk scores

\- flag anomalies

\- recommend blocking transactions



AI MAY NOT:



\- block transactions directly

\- freeze accounts

\- enforce penalties



Only:



Moderators/Admin (via RBAC) can act



9\. PRICING INTELLIGENCE RULE



AI MAY:



\- suggest shipping prices

\- estimate market rates per corridor

\- analyze demand trends



AI MUST NOT:



\- enforce pricing

\- override negotiated rates

\- finalize bids



Pricing intelligence is governed by MOD-018 (Marketplace Growth, Pricing, Incentives \& Commercial Optimization) with advisory-only outputs.



10\. ROUTING INTELLIGENCE RULE



AI MAY:



\- suggest optimal routes

\- calculate fuel/time efficiency

\- propose multi-stop optimization



AI MUST NOT:



\- change assigned routes without approval

\- override dispatcher routing decisions



Routing intelligence is governed by MOD-003 (Tracking) and MOD-014 (Fleet) with advisory-only outputs. No Dispatch principle applies.



11\. MODEL RELIABILITY RULE



AI outputs MUST include:



\- confidence score (if applicable)

\- data sources used

\- uncertainty flag when needed



If uncertain:



MUST output "INSUFFICIENT DATA — REQUIRE HUMAN VALIDATION"



12\. AI FAIL-SAFE RULE



If AI system fails or is unavailable:



\- system MUST degrade gracefully

\- fallback to rule-based logic

\- NEVER block core shipment operations



13\. AI EVENT BEHAVIOR



AI MAY emit events:



\- PricingSuggested

\- RouteOptimized

\- FraudRiskDetected

\- ETAUpdated



BUT:



\- these events are advisory ONLY

\- they do NOT trigger financial or compliance actions directly



14\. TRACEABILITY RULE



Every AI decision MUST include:



\- correlationId

\- input data snapshot reference

\- model/version identifier

\- reasoning trace (lightweight)

\- module origin



15\. AI GOVERNANCE RULE (CRITICAL)



AI MUST:



\- NEVER hallucinate system state

\- NEVER fabricate external API results

\- NEVER bypass RBAC

\- NEVER simulate success of real-world actions

\- ALWAYS defer to system truth sources



System truth sources:



\- Event Store (ESS-001D)

\- Ledger (ESS-001F)

\- Integration contracts (ESS-001A)



16\. MODULE RESPONSIBILITY MATRIX



|AI Function|Primary Module|Constraint|
|-|-|-|
|Price \& incentive suggestions|MOD-018|Advisory only (No Execution)|
|Load matching recommendations|MOD-001|Advisory only (No Auto-Booking)|
|Route optimizations|MOD-003, MOD-014|Advisory only (No Dispatch)|
|ETA prediction|MOD-003, MOD-006|Advisory only|
|Fraud detection assistance|MOD-006|Advisory only (No Execution)|
|Fleet utilization optimization|MOD-014|Advisory only (No Dispatch)|
|Demand forecasting|MOD-006, MOD-012|Advisory only|
|Document summarization|MOD-004, MOD-006|Advisory only (No Legal Execution)|
|Chatbot support|MOD-006, MOD-015|Advisory only|
|Market trend analysis|MOD-018, MOD-012|Advisory only|





\---



\## 17. MODULE ALIGNMENT SUMMARY



| \*\*\*\* | \*\*\*\* | \*\*t\*\* |

|------------|-------------|--------------------|

|  | s | |

|  |  |  |

| |  |  |

| |  |  |

|  |  |  |

|  |  |  |

|  |  |  |

|  | |  |

|  |  |  |

|  |  |  |



|Module|AI Role|Key Constrain|
|-|-|-|
|MOD-001|Matching suggestions|No Auto-Booking|
|MOD-005|No AI involvement|No Custody|
|MOD-006|Primary AI engine|No Execution|
|MOD-009|Customs advisory|No Legal Execution|
|MOD-012|Analytics (no computation)|No Computation|
|MOD-013|No AI involvement|No Custody|
|MOD-014|Fleet optimization advice|No Dispatch|
|MOD-015|Support assistance|No Decision Authority|
|MOD-017|Observability (no intervention)|No Intervention|
|MOD-018|Pricing incentives|No Execution|





18\. EXTERNAL INTEGRATION REFERENCES



\- ESS-001A — External Systems Catalogue (AI providers)

\- ESS-001D — Webhook Governance Standard (AI events)

\- ESS-001F — Financial Integration Architecture (financial restrictions)

\- ESS-001E — Error Code Standardization (AI error codes)

\- MOD-001 — Marketplace (No Auto-Booking)

\- MOD-006 — AI Intelligence Platform (primary)

\- MOD-014 — Fleet (No Dispatch)

\- MOD-018 — Marketplace Growth (No Execution)



FINAL PRINCIPLE



ESS-003 ensures:



AI is a decision-support layer — not a control layer.



It increases efficiency without reducing human accountability.

