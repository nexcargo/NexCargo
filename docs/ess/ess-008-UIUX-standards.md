**ESS-008 - UI/UX Standards Specification**

**Document ID:** ESS-008
**System:** NexCargo
**Stack:** Next.js 14 + Tailwind CSS + Supabase
**Version:** 1.0
**Status:** Execution Authority Spec (Lean)



1\. PURPOSE



This specification defines the \*\*UI/UX rules, layout constraints, and interaction standards\*\* for NexCargo.



It ensures:



\- consistent user experience across all roles

\- predictable dashboard behavior

\- scalable component reuse

\- mobile-first logistics usability

\- AI-generated UI consistency

\- multilingual user interface support



2\. CORE UX PRINCIPLES



2.1 System Consistency Principl



Every screen must behave like a system, not a custom design.



\*\*2.2 Multilingual-First Principle\*\*



All user-facing content must support Portuguese (pt) and English (en) from the outset.



\*\*2.3 Role-Clarity Principle\*\*



UI must clearly reflect the user's role and permissions. No role sees functionality they cannot use.



3\. DESIGN SYSTEM RULES



3.1 Tailwind-First Rule



\- ALL styling MUST use Tailwind CSS

\- no inline styles (except rare dynamic cases)

\- no external CSS frameworks



3.2 Design Consistency Rule



All UI MUST follow:



\- consistent spacing scale

\- consistent typography hierarchy

\- consistent card-based layout structure



3.3 Layout Structure Standard



All dashboards MUST follow:



Sidebar (navigation)

Top bar (context + actions)

Main content (cards / tables / maps)

Right panel (optional context/AI insights)



4\. ROLE-BASED UI RULES (CRITICAL)



4.1 Shipper UI



Must prioritize:



\- shipment creation

\- tracking visibility

\- financial status (escrow only)



4.2 Transporter UI



Must prioritize:



\- load discovery

\- bidding

\- active trips

\- earnings visibility



4.3 Driver UI (Mobile-first)



Must prioritize:



\- simplicity

\- offline capability

\- trip execution

\- minimal navigation steps



4.4 Admin / Moderator UI



Must prioritize:



\- system visibility

\- audit logs

\- dispute resolution

\- risk alerts



5\. COMPONENT DESIGN RULES



5.1 Reusability Rule



All UI MUST be built using:



\- reusable components

\- shared UI primitives

\- no duplicated UI patterns



5.2 Component Types



Mandatory standard components:



\- Card

\- Table

\- Modal

\- Form

\- Status Badge

\- Timeline (for shipment tracking)

\- Map Container



5.3 No One-Off UI Rule



\- no unique layouts per page unless justified

\- new UI patterns require reuse justification



6\. DATA VISUALIZATION RULES



\- charts MUST be minimal and functional

\- avoid decorative visuals

\- focus on logistics metrics:

&#x20; - delivery time

&#x20; - route efficiency

&#x20; - cost per km

&#x20; - escrow status



7\. NAVIGATION RULES



7.1 Global Navigation



Must be:



\- role-based

\- minimal

\- consistent across modules



7.2 Deep Navigation Rule



\- avoid deep nesting beyond 3 levels

\- breadcrumbs required for complex flows



8\. MOBILE UX RULES (CRITICAL FOR SADC CONTEXT)



\- mobile-first design mandatory for drivers

\- low-bandwidth optimization required

\- offline mode must degrade gracefully

\- large tap targets required



9\. PERFORMANCE UX RULES



\- loading states must always exist

\- skeleton loaders required for tables/cards

\- no blank screens allowed

\- optimistic UI allowed only for non-financial actions



10\. MAP \& TRACKING UI RULES



\- maps must be lightweight (no heavy re-renders)

\- tracking must update incrementally

\- avoid real-time overpolling (aligned with ESS-001C GPS rules)

\- border-crossing events must be visually distinct



11\. FINANCIAL UI RULES (CRITICAL)



All financial UI MUST:



\- clearly separate escrow vs actual payout

\- never show "available funds" incorrectly

\- show transaction status states:

&#x20; - Pending

&#x20; - Locked (Escrow)

&#x20; - Released

&#x20; - Failed



\*\*No Custody Principle:\*\* UI must never imply NexCargo holds or controls funds. All financial UI must clearly indicate that funds are held by regulated banking partners.



12\. AI UI RULES



AI elements MUST:



\- be clearly labeled as "Suggestions"

\- never appear as final actions

\- always require user confirmation for execution



Example:



\- "AI Suggested Route"

\- "AI Recommended Carrier"

\- "AI Risk Alert"



No Execution Principle: AI UI elements must never include an "Execute" or "Confirm" button without explicit human confirmation. All AI-generated actions must be advisory-only.



13\. ACCESSIBILITY RULES



\- minimum contrast compliance required

\- keyboard navigation supported

\- readable typography hierarchy

\- no critical function hidden behind hover-only UI



14\. ERROR UI RULE



All errors MUST:



\- use ESS-001E standardized codes

\- be user-readable

\- avoid technical jargon in UI

\- provide retry option when applicable



15\. STATE INDICATION RULE



Every entity MUST clearly show state:



Examples:



\- Shipment → Pending / In Transit / Delivered / Disputed

\- Payment → Locked / Released / Failed

\- Driver → Active / Idle / Offline



16\. AI-GENERATED UI RULE



AI MUST:



\- reuse existing components

\- never invent new UI systems

\- maintain layout consistency

\- follow role-based UI rules



AI MUST NOT:



\- redesign dashboards randomly

\- introduce new visual paradigms

\- break navigation consistency



17\. INTERNATIONALIZATION AND LOCALIZATION REQUIREMENTS (MANDATORY)



17.1 Language Support



All user-facing UI MUST support:



\- Portuguese (pt) — default language

\- English (en)



17.2 Language Detection and Switching



\- Automatic detection: IP geolocation → country → language

\- Manual override: User language preference stored in user profile

\- Language switcher MUST be clearly visible in the UI



17.3 Locale-Aware Formatting



\- Dates: Must follow locale conventions (DD/MM/YYYY for pt, MM/DD/YYYY for en) or use ISO format consistently

\- Currency: Must display correct symbols and decimal separators (MZN, USD, ZAR)

\- Numbers: Must use correct thousands and decimal separators



17.4 Content Requirements



\- All UI text, labels, buttons, and navigation MUST be localized

\- All error messages and system prompts MUST be localized

\- All notification templates (MOD-016) MUST support pt and en

\- All document templates MUST support pt and en



17.5 Implementation Rules



\- All user-facing strings MUST be externalized (no hardcoded text)

\- Translation files MUST reside in a dedicated /locales folder

\- UI components MUST use a localization framework (e.g., next-intl)

\- Language preference MUST be included in JWT claims



17.6 RTL Support



RTL support is NOT required (Portuguese and English are LTR languages).



18\. MODULE UI RESPONSIBILITY MATRIX



|Module|UI Responsibility|Key Constraint|
|-|-|-|
|MOD-001|Marketplace listings, matching suggestions|No Auto-Booking (confirmation required)|
|MOD-002|Booking forms, contract viewer|Contract Immutability (read-only after signing)|
|MOD-003|Tracking dashboard, map view|No Dispatch|
|MOD-004|Document upload, viewer, POD|No Legal Execution|
|MOD-005|Escrow status, transaction history|No Custody (never show fund holding)|
|MOD-006|AI suggestion panels, recommendations|No Execution (advisory labels required)|
|MOD-007|All user dashboards|Localization support|
|MOD-008|Mobile driver interface|Offline capability|
|MOD-009|Cross-border information panels|No Legal Execution (advisory only)|
|MOD-010|Security settings, audit logs|RBAC enforcement|
|MOD-011|API management UI, webhook logs|Contract adherence|
|MOD-012|Analytics dashboards (read-only)|No Computation|
|MOD-013|Settlement and reconciliation views|No Custody|
|MOD-014|Fleet asset viewer|No Dispatch|
|MOD-015|Support tickets, dispute interface|No Decision Authority|
|MOD-016|Notification preferences|Localization|
|MOD-017|Monitoring dashboards|No Intervention|
|MOD-018|Pricing and incentive suggestions|No Execution (advisory labels required)|





19\. EXTERNAL INTEGRATION REFERENCES



\- ESS-001A — External Systems Catalogue

\- ESS-001C — Retry \& Timeout Policy Matrix (GPS polling rules)

\- ESS-001E — Error Code Standardization

\- ESS-001F — Financial Integration Architecture

\- ESS-003 — AI Behavior Constraints

\- ESS-007 — Coding Standards

\- MOD-008 — User Dashboards \& Experience

\- MOD-009 — Regional \& Cross-Border Logistics Operations (region mapping)

\- MOD-016 — Notifications, Messaging \& Communication Orchestration



FINAL PRINCIPLE



ESS-008 ensures:



NexCargo feels like one unified operating system, not multiple disconnected apps — in both Portuguese and English.

