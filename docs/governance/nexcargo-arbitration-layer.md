NEXCARGO ARBITRATION LAYER v1.0

---

## 1. MODULE IDENTITY

Name: NexCargo Arbitration Layer
Version: v1.0
System Role: Global Conflict Resolution Authority (Specification-Level Only)
Type: System Governance Layer (Non-Executing)

---

## 2. PURPOSE

The Arbitration Layer defines the final deterministic conflict resolution system for NexCargo specifications.

It governs how the system behaves when:

- BOOT conflicts with ESS
- ESS conflicts with MOD modules
- MOD modules conflict with each other
- INDEX references are inconsistent
- instructions are incomplete or ambiguous

It does NOT execute logic.

It defines:

how the system resolves contradictions in specifications before any implementation occurs.

---

## 3. CORE PRINCIPLE

Arbitration Layer is the final authority for specification consistency, not system behavior.

It only activates when:

- deterministic rules are insufficient
- hierarchy is ambiguous
- multiple valid interpretations exist
- structural contradictions occur

---

## 4. ARBITRATION TRIGGERS

Arbitration is REQUIRED when:

### 4.1 Structural Conflict

- conflicting module responsibilities
- overlapping ownership of data or logic
- duplicated system authority definitions

### 4.2 Hierarchy Conflict

- BOOT vs ESS contradiction
- ESS vs MOD contradiction
- INDEX mismatch with actual module definitions

### 4.3 Missing Specification

- required logic not defined in BOOT / ESS / MOD
- undefined dependency required for execution

### 4.4 Behavioral Ambiguity

- multiple valid interpretations of a rule
- unclear execution boundaries

---

## 5. ARBITRATION PRIORITY MODEL

When conflict exists, resolution follows this strict hierarchy:

### 5.1 Absolute Priority Order

0. **PROMPT 0 v1.3 (Master System Prompt)**
   - The current governing authority. PROMPT 0 §DOCUMENT PRECEDENCE sets the order PROMPT 0 → ESS → MOD → approved integration contracts → source code, and PROMPT 1 §conflict rule records that Prompt 0 always overrides. BOOT states that it does not override any other specification layer. Where the numbered list below appears to place any layer above PROMPT 0, PROMPT 0 v1.3 governs (HAO decision D-01 Item 3, direction 3-D).

1. **BOOT (NEXCARGO_BOOT.md)**
   - Behavioral kernel overrides all structural interpretation, subject to its own stated limitation that it does not override another specification layer

2. **ESS (Execution Support Specifications)**
   - Security, financial, compliance, integration rules override MODs

3. **ARBITRATION LAYER (this document)**
   - resolves ambiguity between BOOT and ESS when both apply

4. **MOD-001 → MOD-018**
   - domain-specific logic (never overrides ESS or BOOT)

5. **INDEX**
   - reference-only, never authoritative in conflicts

---

## 6. ARBITRATION DECISION TYPES

### 6.1 TYPE A — STRICT OVERRIDE

Used when hierarchy is explicit.

**Example:**

ESS-001F says "No Custody: NexCargo NEVER holds funds"
MOD-005 suggests storing escrow balances

**Resolution:** ESS wins automatically. No balance storage.

### 6.2 TYPE B — STRUCTURAL REASSIGNMENT

Used when responsibility overlaps.

**Example:**

MOD-005 and MOD-013 define escrow logic

**Resolution:**

- MOD-005 = escrow orchestration only (initiation, release)
- MOD-013 = settlement instruction handling and reconciliation; it performs no funds movement and holds no external execution authority (MOD-013 §7.1, §7.2; PROMPT 0 v1.3 §FINANCIAL SYSTEM RULES). The bank or authorised payment provider remains the sole external execution authority (HAO decision D-01 Item 3, direction 3-D).

### 6.3 TYPE C — SPECIFICATION GAP

Used when missing information exists.

**Output required:**

TODO: requires specification from BOOT / ESS / MOD

No guessing allowed.

### 6.4 TYPE D — BIDIRECTIONAL CONFLICT (BOOT vs ESS)

Used when both define valid but conflicting constraints.

**Resolution rules:**

- ESS governs execution safety
- BOOT governs behavioral constraints
- Arbitration defines compatibility transformation, not override

---

## 7. ARBITRATION RESOLUTION PRINCIPLES

### 7.1 No Creative Resolution Rule

Arbitration MUST NOT invent new logic.

Only:

- reassign authority
- clarify precedence
- mark missing specs
- normalize contradictions

### 7.2 Deterministic Outcome Rule

Same conflict → same resolution ALWAYS.

No contextual variation allowed.

### 7.3 Non-Execution Rule

Arbitration:

- does NOT execute decisions
- does NOT implement fixes
- does NOT modify system state
- does NOT autonomously resolve incidents

It only produces:

- resolution directives or TODO markers

### 7.4 Minimal Change Principle

When resolving conflicts:

- change as little as possible
- preserve original intent where safe
- prefer clarification over redesign

### 7.5 Safety Dominance Rule

If any conflict involves:

- financial systems (MOD-005, MOD-013 / ESS-001F)
- security (ESS-006)
- compliance (ESS-006)
- custody of funds (No Custody)

**SAFETY ALWAYS OVERRIDES ALL OTHER CONSIDERATIONS**

### 7.6 Module Constraint Enforcement Rule

Arbitration MUST enforce all module-specific constraints when resolving conflicts:

| Principle | Applies To | Enforcement |
|-----------|------------|-------------|
| No Custody | MOD-005, MOD-013 | Safety dominance applies. Bank is sole execution authority. |
| No Execution | MOD-006, MOD-018 | AI advisory-only. No autonomous execution. |
| No Intervention | MOD-017 | Observability observes only. No fixes or restarts. |
| No Dispatch | MOD-014 | Asset registry only. No dispatch or assignment. |
| No Decision Authority | MOD-015 | Support does not decide outcomes. |
| No Computation | MOD-012 | Analytics does not compute KPIs or BI logic. |
| No Legal Execution | MOD-009 | Cross-border does not enforce customs. |
| No Auto-Booking | MOD-001 | Matching advisory. Final selection requires confirmation. |
| Contract Immutability | MOD-002 | Contracts immutable once signed. |
| Asset Truth | MOD-014 | Single source of truth for asset structure. |

---

## 8. ARBITRATION OUTPUT FORMAT

All arbitration results MUST output one of:

### 8.1 RESOLVED
RESOLVED:

conflict: <description>

decision: <final rule>

authority: <BOOT / ESS / ARBITRATION>

text

### 8.2 DEFERRED
DEFERRED:

reason: insufficient specification

required: BOOT / ESS / MOD clarification

text

### 8.3 RESTRUCTURED
RESTRUCTURED:

original: <conflict>

new assignment: <module responsibilities>

text

---

## 9. SYSTEM BOUNDARY

The Arbitration Layer:

- does NOT define business logic
- does NOT define architecture
- does NOT define modules
- does NOT define financial flows

It ONLY resolves contradictions between them.

---

## 10. INTEGRATION RELATIONSHIPS

Arbitration Layer interacts conceptually with:

- **BOOT** → behavioral kernel validation
- **ESS** → execution safety enforcement
- **INDEX** → structural reference validation
- **MOD-001 → MOD-018** → structural conflict detection
- **AI-EPRS** → architectural consistency
- **Prompt 0** → master system governance
- **Prompt 1-8** → architecture and implementation alignment

BUT:

It does NOT control any system layer.

---

## 11. FAILURE MODE RULE

If arbitration cannot resolve a conflict:

**SYSTEM MUST STOP**

and output:
CRITICAL FAILURE:
Arbitration cannot resolve conflict without additional specification.

text

---

## 12. LOCALIZATION GOVERNANCE

The Arbitration Layer MUST ensure:

- All specifications are consistent with localization requirements (pt/en support)
- Region-to-language mapping (MOD-009) is respected
- User-facing content requirements are non-contradictory

---

## 13. DESIGN PRINCIPLE

The Arbitration Layer ensures:

NexCargo remains logically consistent, structurally deterministic, and non-contradictory across all layers of its specification ecosystem.

---

DOCUMENTATION CHANGE HISTORY

| Date | Assignment | Change | Authority basis |
|-|-|-|-|
| 2026-11-03 | NXC-HOA-AUTH-D01-ITEM-06-STAGE-1 | Change-history block established under the INDEX §7.4 Document Change-History Standard. History in this document commences with this row. Earlier changes to this document are not reconstructed here; the governing record for them is the Development State decision register. The row below records the evidenced change that the register supports, dated when the change was actually made. Creating this block altered no precedence rule, conflict class or resolution procedure in this layer. | HAO decision D-01 Item 6 Stage 1 (NXC-HOA-AUTH-D01-ITEM-06-STAGE-1); INDEX §7.4 |
| 2026-11-02 | NXC-HOA-AUTH-D01-ITEM-03-001 | Direction 3-D applied: §5.1's priority order now leads with the current PROMPT 0 version, because PROMPT 0 §DOCUMENT PRECEDENCE sets the order PROMPT 0 → ESS → MOD → approved integration contracts → source code and PROMPT 1 records that Prompt 0 always overrides, together with the note that BOOT states it does not override any other specification layer; §6.2's MOD-013 entry now records that MOD-013 handles settlement instruction and reconciliation, performs no funds movement and holds no external execution authority, the bank or authorised payment provider remaining the sole external execution authority. The remaining ordering of those ladders is unchanged and any structural re-ordering still requires a separate architecture decision; no conflict class, arbitration trigger, escalation path or safety-dominance rule was created or altered. | HAO decision D-01 Item 3, direction 3-D (NXC-HOA-AUTH-D01-ITEM-03-001); Development State register, D-01 Item 3 row; PROMPT 0 v1.3 §DOCUMENT PRECEDENCE, §FINANCIAL SYSTEM RULES |

Version effect: the Arbitration Layer remains v1.0 — no version increase, no loader change and no INDEX §7.1 change. This block records a change already made and registered under the authorisation cited in it; creating the block changed no rule in this layer.