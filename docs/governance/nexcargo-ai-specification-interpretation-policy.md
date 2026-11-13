AI Specification Interpretation Policy v1.0

Purpose

This document defines how AI Builders and developers must interpret all NexCargo specification documents (ESSs, MODs, PRSs, registries, and related architectural artifacts).

Unless explicitly stated otherwise, all specification documents are declarative. They describe the architecture of the system, not its runtime implementation.

Interpretation Rules

When consuming NexCargo specifications:

Treat all specifications as declarative architectural references.
Interpret definitions as canonical system vocabulary, not executable instructions.
Do not infer implementation logic unless explicitly specified.
Do not infer runtime execution order.
Do not invent business rules.
Do not invent events, permissions, states, APIs, database fields, workflows, or system components.
Do not modify or extend the defined architecture.
Do not assume frontend behaviour.
Do not assume backend behaviour.
Do not assume database behaviour.
Do not generate functionality that is not explicitly supported by the referenced specifications.
Do not infer role authority from ambiguous wording, implied permission, or inheritance from a nearby role; financial authority is stated only by the governing specification (PROMPT 0 v1.3 and ESS-001F §15.1 to §15.5).
If required information is missing, output SPECIFICATION GAP rather than making assumptions.
Implementation Authority

Runtime behaviour, business logic, database operations, frontend interactions, API implementation, workflows, and execution order are defined exclusively by:

Implementation Specifications
Feature Implementation Prompts
Source Code

Architectural specifications do not, by themselves, authorize implementation.

---

DOCUMENTATION CHANGE HISTORY

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-1 | Change-history block established under the INDEX §7.4 Document Change-History Standard. History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register. The row below records the evidenced change that the register supports, dated when the change was actually made. Creating this block altered no interpretation rule in this policy. | HAO decision D-01 Item 6 Stage 1 (NXC-HOA-AUTH-D01-ITEM-06-STAGE-1); INDEX §7.4 |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | An Interpretation Rule was added stating that role authority must not be inferred from ambiguous wording, implied permission or inheritance from a nearby role, and that financial authority is stated only by the governing specification (PROMPT 0 v1.3 and ESS-001F §15.1 to §15.5). The declarative reading of specifications, the prohibition on inventing events, permissions, states, APIs, fields or workflows, the SPECIFICATION GAP behaviour and the implementation-authority section are unchanged; no role gained or lost any permission. | HAO decision D-01 Item 3 (NXC-HOA-AUTH-D01-ITEM-03-001); Development State register, D-01 Item 3 row; ESS-001F §15.1 to §15.5 |

Version effect: the AI Specification Interpretation Policy remains v1.0 — no version increase, no loader change and no INDEX §7.1 change. This block records a change already made and registered under the authorisation cited in it; creating the block changed no interpretation rule.