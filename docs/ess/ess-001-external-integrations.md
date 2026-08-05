**NexCargo**

**ESS-001 — External Integrations Specification (EIS)**

**Document ID:** ESS-001
**Document Name:** External Integrations Specification
**Version:** 1.0
**Status:** Approved for Development
**System:** NexCargo
**Classification:** Enterprise Engineering Specification (ESS)

ESS-001 — External Integrations Specification (EIS)

1. Purpose

This specification defines the governance, architecture, operational standards, and technical requirements for all third-party and external system integrations used by NexCargo.

Its objectives are to:

Establish a single source of truth for all external integrations.

Standardize integration architecture across the platform.

Prevent undocumented or AI-invented integrations.

Ensure security, auditability, resiliency, and maintainability.

Support future provider replacement with minimal architectural impact.

Enforce financial execution authority exclusively through regulated banking partners.

This document supplements the AI-EPRS and is authoritative for all external integration implementations.

2. Scope
This specification governs integrations with:

Regulated banking partners (escrow services)

Mobile Money aggregators (M-Pesa, mKesh, e-Mola)

Card payment processors (Visa/Mastercard)

PayPal

Banking APIs

SMS gateways

Email providers

Push notification providers

Mapping and geolocation services

OCR and document-processing services

Digital signature providers

Customs and border systems

ERP integrations

Insurance providers

AI providers (where approved)

Future third-party enterprise integrations

Scope Clarification:

ESS-001A defines the External Systems Catalog with detailed provider mappings.

ESS-001B defines the Authentication Standards Matrix.

ESS-001C defines the Retry & Timeout Policy Matrix.

ESS-001D defines the Webhook Governance Standard.

ESS-001E defines the Error Code Standardization framework.

ESS-001F defines the Financial Integration Architecture.

ESS-001G defines the Future Integration Roadmap.

3. Integration Governance Principles
Every external integration MUST:

Be documented before implementation.

Be version controlled.

Be independently testable.

Support monitoring and audit logging.

Be replaceable through abstraction.

Never expose provider-specific logic to business modules.

Follow least-privilege security principles.

Support graceful degradation when unavailable.

Maintain compliance with ESS-006 (Security & Compliance) and ESS-009 (Data Governance).

4. Integration Architecture
All integrations shall follow this pattern:

text
Application Module
         │
Integration Interface
         │
Provider Adapter
         │
External Provider API
Business modules MUST communicate only with the Integration Interface.

Provider-specific code MUST remain isolated inside Adapter implementations.

5. Integration Categories
The specification recognizes the following integration domains:

Financial Services

Regulated escrow banks

Mobile money aggregators

Card payment gateways

PayPal

Bank transfer services

Logistics Services

GPS providers

Mapping providers

Route optimization providers

Fleet telematics

Communication Services

SMS

Email

Push notifications

WhatsApp (future, if approved)

Compliance Services

KYC/KYB verification

Government registries

Customs systems

Digital signatures

AI Services

Approved AI providers

OCR services

Document intelligence

6. Standard Integration Contract
Every integration MUST define:

Integration ID

Provider Name

Business Purpose

Owning Module(s)

Authentication Method

API Version

Request Format

Response Format

Error Codes

Timeout Policy

Retry Policy

Rate Limits

Idempotency Rules

Audit Requirements

Monitoring Requirements

Security Classification

Detailed contract definitions are provided in ESS-004 (Integration Contracts).

7. Authentication Standards
Supported authentication methods include:

OAuth 2.0

API Keys

Mutual TLS (mTLS)

JWT

Digital certificates

Signed webhooks (where applicable)

Credentials MUST be stored in the centralized Secrets Management system defined in Prompt 8.

Authentication standards are further detailed in ESS-001B (Authentication Standards Matrix).

8. Resilience Requirements
Every integration MUST implement:

Configurable timeouts

Exponential backoff

Retry policies

Circuit breaker protection

Dead-letter handling (where asynchronous)

Graceful degradation

Health checks

Business modules must never block indefinitely while waiting for external providers.

Detailed timeout and retry policies are defined in ESS-001C (Retry & Timeout Policy Matrix).

9. Idempotency Standards
Financial and transaction-related integrations MUST support idempotent operations.

Applicable examples include:

Escrow creation

Escrow release

Payment capture

Refund requests

Wallet funding

Settlement requests

Each operation shall include a unique idempotency key to prevent duplicate execution.

10. Error Handling
Every provider adapter MUST normalize provider-specific errors into standardized NexCargo error codes as defined in ESS-001E (Error Code Standardization).

Business modules MUST never consume raw third-party error messages directly.

11. Audit Requirements
Every external interaction shall generate immutable audit records containing, at minimum:

Correlation ID

Request ID

Provider

Integration ID

Module

User/System identity

Timestamp

Operation

Result

Duration

Sensitive information shall never be written to logs.

All audit records must comply with ESS-009 (Data Governance) requirements.

12. Monitoring Requirements
Each integration shall expose operational metrics, including:

Request count

Success rate

Failure rate

Latency

Retry count

Timeout count

Circuit breaker state

Provider availability

These metrics shall integrate with the observability framework defined in Prompt 8 and ESS-005 (Operational Runbook).

13. Financial Integration Rules
All payment-related integrations are subject to the following additional requirements:

No Custody: NexCargo shall never assume custody of escrow funds. The regulated banking partner is the sole execution authority.

Escrow services shall be provided exclusively by regulated banking partners.

Mobile money, Visa, PayPal, and bank transfers are funding and payout channels only.

Financial operations require immutable audit trails.

Escrow initiation and release operations are governed by MOD-005.

Settlement and reconciliation workflows are governed by MOD-013 as the exclusive financial execution authority.

Financial integration architecture is defined in ESS-001F (Financial Integration Architecture).

14. Security Requirements
Every external integration MUST:

Encrypt communications using TLS 1.2 or higher.

Validate provider certificates.

Verify webhook signatures as defined in ESS-001D (Webhook Governance Standard).

Rotate credentials periodically.

Enforce least-privilege access.

Prevent replay attacks where applicable.

Comply with ESS-006 (Security & Compliance) standards.

15. Versioning Policy
Integrations shall support explicit versioning.

Breaking changes MUST:

Be documented.

Maintain backward compatibility where feasible.

Follow an approved migration strategy.

Update Integration Contracts Specification (ESS-004).

16. Change Management
No integration may be:

Added

Removed

Replaced

Significantly modified

without updating this specification and the corresponding integration contract.

Future integration planning is governed by ESS-001G (Future Integration Roadmap).

17. AI Governance Rules
AI Builders implementing integrations MUST:

Never invent undocumented APIs.

Never fabricate authentication methods.

Never simulate successful transactions.

Never bypass integration interfaces.

Never expose secrets.

Produce TODO markers when provider information is unavailable.

Always reference ESS-003 (AI Behavior Constraints) for AI-related integration limitations.

18. Traceability Matrix
Every integration must maintain traceability to:

AI-EPRS Module(s)

Relevant AI-DS Prompt(s)

ESS-004 Integration Contract

Database entities (where applicable)

Event definitions (where applicable)

Audit requirements

Test cases (ESS-002)

19. Appendix References
This specification is supported by the following appendices:

ESS-001A — External Systems Catalog

ESS-001B — Authentication Standards Matrix

ESS-001C — Retry & Timeout Policy Matrix

ESS-001D — Webhook Governance Standard

ESS-001E — Error Code Standardization

ESS-001F — Financial Integration Architecture

ESS-001G — Future Integration Roadmap