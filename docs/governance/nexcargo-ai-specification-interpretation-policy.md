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
If required information is missing, output SPECIFICATION GAP rather than making assumptions.
Implementation Authority

Runtime behaviour, business logic, database operations, frontend interactions, API implementation, workflows, and execution order are defined exclusively by:

Implementation Specifications
Feature Implementation Prompts
Source Code

Architectural specifications do not, by themselves, authorize implementation.