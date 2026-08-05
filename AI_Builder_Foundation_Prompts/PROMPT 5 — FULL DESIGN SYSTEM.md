\# NEXCARGO PROMPT ENVELOPE v1.0



task\_id: PROMPT-5.design-system.v1

module: PROMPT-5

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



prerequisites:

&#x20; - PROMPT-0 status=FROZEN

&#x20; - PROMPT-1 status=FROZEN

&#x20; - PROMPT-2 status=FROZEN

&#x20; - PROMPT-3 status=FROZEN

&#x20; - PROMPT-4 status=FROZEN

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



expected\_outputs:

&#x20; - Complete production-grade design system and component library

&#x20; - Fully compliant with Prompt 0-4 and ESS-008

&#x20; - No behaviour outside the scope of UI presentation and styling

&#x20; - STOP → TODO for any missing authoritative specification



validation:

&#x20; - PROMPT-0 behavioural rules respected

&#x20; - PROMPT-1 architectural rules respected

&#x20; - PROMPT-2 data rules respected

&#x20; - PROMPT-3 module rules respected

&#x20; - PROMPT-4 UI rules respected

&#x20; - ESS-008 (UI/UX Standards) constraints respected

&#x20; - No conflict with ARBITRATION rules

&#x20; - No conflicts with INDEX dependencies

&#x20; - No unauthorised assumptions

&#x20; - No new features introduced

&#x20; - No scope drift

&#x20; - STOP on ambiguity

&#x20; - Multilingual UI support (pt/en) enforced

&#x20; - Module-specific constraints reflected in UI components (No Custody, No Execution, etc.)



completion\_criteria:

&#x20; - All validation checks pass

&#x20; - OR emit STOP → TODO



\---



PROMPT 5 — FULL DESIGN SYSTEM



NexCargo UI System Layer (Tailwind + Component Library)



\---



\## ROLE CONTINUATION



You are operating under:



\- PROMPT 0 — Master System Prompt (v1.0)

\- PROMPT 1 — Architecture Bootstrap

\- PROMPT 2 — Database + Event Store Design

\- PROMPT 3 — Module Implementation Bootstrap

\- PROMPT 4 — UI/UX Integration Bootstrap



All rules are inherited without modification.



Prompt 0 is always the highest authority.



\---



\## PURPOSE OF THIS PROMPT



You are responsible for creating:



A production-grade design system and reusable UI component library for NexCargo



This includes:



\- Tailwind configuration system

\- Design tokens (colors, spacing, typography)

\- Component library architecture

\- Accessibility standards

\- UI consistency rules

\- Reusable layout primitives



\---



\## CRITICAL CONSTRAINTS



You MUST:



\- Use Tailwind CSS as the primary styling system

\- Ensure full design consistency across all roles

\- Build reusable, composable components only

\- Follow accessibility standards (WCAG 2.1 minimum)

\- Ensure UI is pure presentation layer only

\- Align with App Router architecture (Prompt 4)



You MUST NOT:



\- Embed business logic in components

\- Create feature-specific UI components

\- Duplicate UI primitives

\- Hardcode styles outside Tailwind system

\- Mix domain logic into UI system



\---



\## DESIGN SYSTEM ARCHITECTURE



The design system consists of:



\*\*1. DESIGN TOKENS (CORE FOUNDATION)\*\*



You MUST define a centralized token system:

colors:

primary

secondary

success

warning

danger

neutral



spacing:

4px base scale (4, 8, 12, 16, 24, 32, 48, 64)



typography:

font-sans

font-mono

scale: xs → sm → md → lg → xl → 2xl → 4xl



radius:

sm / md / lg / xl



shadow:

sm / md / lg / xl





\*\*2. TAILWIND CONFIGURATION SYSTEM\*\*



You MUST extend Tailwind with:



\- custom color palette

\- spacing scale

\- typography system

\- responsive breakpoints aligned to logistics dashboards



\*\*Breakpoints:\*\*

\- mobile (driver-first)

\- tablet (fleet operations)

\- desktop (admin + analytics)

\- ultra-wide (control rooms)



\*\*3. COMPONENT LIBRARY STRUCTURE\*\*



All components MUST live in:

/shared/ui/

/components

/primitives

/layouts

/forms

/data-display

/feedback

/navigation





\---



\## 🧱 CORE COMPONENTS (MANDATORY)



\*\*1. Button System\*\*



Variants:

\- primary

\- secondary

\- outline

\- danger

\- ghost



States:

\- loading

\- disabled

\- active



\*\*2. Input System\*\*



Supports:

\- text

\- number

\- password

\- select

\- textarea

\- search

\- file upload



Includes:

\- validation states

\- error display

\- helper text



\*\*3. Card System\*\*



Used across:

\- shipments

\- loads

\- analytics panels

\- dashboards



Must support:

\- header

\- body

\- footer

\- clickable variant



\*\*4. Table System (CRITICAL FOR LOGISTICS)\*\*



Must support:

\- pagination

\- sorting

\- filtering

\- row selection

\- expandable rows

\- loading skeletons



Used in:

\- shipments

\- payments

\- fleet management

\- analytics



\*\*5. Modal System\*\*



Must include:

\- confirm modal

\- form modal

\- alert modal

\- full-screen modal (driver workflows)



\*\*6. Badge System\*\*



Used for:

\- shipment status

\- payment status

\- verification status

\- risk flags



\*\*7. Navigation System\*\*



Must support:

\- role-based sidebar

\- collapsible menus

\- mobile bottom navigation (driver app)

\- admin dashboard navigation



\*\*8. Notification System\*\*



Types:

\- success

\- error

\- warning

\- info



Must support:

\- toast notifications

\- persistent alerts



\*\*9. Loading System\*\*



Must include:

\- skeleton loaders

\- spinner states

\- progress indicators



\---



\## UI DESIGN PRINCIPLES



You MUST enforce:



\*\*1. CONSISTENCY PRINCIPLE\*\*



All UI components MUST:

\- use same spacing system

\- use same typography scale

\- use same color logic



\*\*2. COMPOSITION PRINCIPLE\*\*



Components MUST be:

\- composable

\- reusable

\- non-duplicated



\*\*3. DOMAIN-AGNOSTIC RULE\*\*



UI components MUST NOT know:

\- shipment logic

\- financial rules

\- AI logic

\- domain behavior



They only render props.



\*\*4. ACCESSIBILITY RULE\*\*



All components MUST:

\- support keyboard navigation

\- support screen readers

\- include aria labels

\- maintain contrast compliance



\*\*5. RESPONSIVE DESIGN RULE\*\*



System MUST support:

\- mobile-first driver workflows

\- tablet fleet operations

\- desktop admin dashboards



\---



\## COMPONENT ARCHITECTURE RULE



Every component MUST:

\- be typed in TypeScript

\- accept props only

\- not fetch data directly

\- not contain business logic

\- remain stateless unless explicitly required



\---



\## UI STATE RULE



UI state MUST:

\- come from API layer (Prompt 4)

\- NOT be source of truth

\- NOT store financial or operational logic



\---



\## DESIGN SYSTEM OUTPUT REQUIREMENT



You MUST generate:



\*\*SECTION 1 — TAILWIND CONFIG EXTENSION\*\*



Full configuration structure



\*\*SECTION 2 — DESIGN TOKENS FILE\*\*



Centralized token system



\*\*SECTION 3 — COMPONENT LIBRARY STRUCTURE\*\*



Folder architecture



\*\*SECTION 4 — CORE COMPONENT IMPLEMENTATIONS\*\*



Code for:

\- Button

\- Input

\- Card

\- Table

\- Modal

\- Badge

\- Navigation

\- Notification system



\*\*SECTION 5 — RESPONSIVE SYSTEM RULES\*\*



Breakpoints + layout behavior rules



\*\*SECTION 6 — ACCESSIBILITY FRAMEWORK\*\*



ARIA + WCAG compliance structure



\---



\## FAILURE HANDLING RULE



If UI behavior or design is unclear:



STOP and output: TODO: requires specification from AI-EPRS



No assumptions allowed.



\---



\## FINAL PRINCIPLE



This design system is:



a deterministic UI foundation for an enterprise logistics operating system



NOT:



\- a branding exercise

\- a marketing UI kit

\- a decorative design system

