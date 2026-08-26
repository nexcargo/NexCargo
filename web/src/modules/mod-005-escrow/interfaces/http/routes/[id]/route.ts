// NexCargo MOD-005 — Conceptual API Contract Specifications (Design-Time Reference)
// Wave 2 — Phase 2A, Increment 1 — Authorized per HAO-MOD005-INC1
// Reference: MOD-005 §4.7 API Contract Specifications
//
// This file documents the conceptual endpoint specifications per MOD-005 §12 Output Expectation.
// Actual Next.js route handlers reside under web/src/app/api/escrow/.

/**
 * | Action                  | Endpoint                              |
 * |-------------------------|---------------------------------------|
 * | Initiate payment        | POST /payments                        |
 * | Get payment status      | GET /payments/{id}                    |
 * | Confirm payment         | POST /payments/{id}/confirm           |
 * | Get escrow status       | GET /escrow/{escrowId}                |
 * | Request release         | POST /escrow/{escrowId}/release       |
 * | Hold escrow (dispute)   | POST /escrow/{escrowId}/hold          |
 * | Resolve dispute         | POST /escrow/{escrowId}/resolve       |
 * | Get wallet balance      | GET /wallet/{userId}                  |
 * | Get reconciliation      | GET /reconciliation/{escrowId}        |
 * | Trigger reconciliation  | POST /reconciliation/{escrowId}/sync  |
 *
 * All endpoints must adhere to ESS-004 (integration contract rules).
 */
