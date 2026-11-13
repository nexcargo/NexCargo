# NexCargo Homepage Content & Information Architecture Reconciliation

**Date:** 2026-09-29
**Session Type:** Read-only reconciliation (no implementation)
**Authority Hierarchy:** PROMPT 0 v1.1 > ESS > AI-EPRS > Modules > Source Code
**Developer Decision:** Dono de Carga = Shipper (EN), Remetente / Expedidor / Embarcador are NOT approved replacements.

---

## A. Current Homepage Assessment

### What Is Good

1. **Clean six-section structure** — The current homepage has a logical flow: Hero → How It Works → For Shippers/Transporters → Platform Capabilities → Trust Signals → Bottom CTA. This is a sound starting hypothesis.
2. **i18n architecture exists** — Both EN and PT translations are structured under `Home` namespace in `common.json`. Language switching works.
3. **Brand-compliant palette** — Uses correct product UI colors (`#0A1628`, `#1A5C9E`, `#EE8426`, `#0F8B7A`). Gradient hero uses deep navy correctly.
4. **Shared components exist but unused** — `PublicHeader`, `PublicFooter`, `NexCargoLogo`, `NexCargoSymbol` are implemented but not rendered by the homepage.
5. **SkipNav accessibility** is present.
6. **Dark mode support** is built in consistently.
7. **Two-sided marketplace model** is attempted (Shipper card + Transporter card).
8. **No fabricated metrics** — The current page does not invent user counts, coverage statistics, or savings claims. This is compliant with the governance rules.
9. **TypeScript clean, build successful.**

### What Is Incomplete

1. **PublicHeader is NOT rendered.** The homepage renders its own gradient hero directly without the branded sticky header containing logo, navigation links, language switcher, and mobile hamburger menu.
2. **PublicFooter is NOT rendered.** There is no footer on the current homepage. The final CTA section is the last element before closing `</div>`.
3. **Trust signal cards have titles but empty descriptions** — `MarketplacePreviewCard` desc props are all `""` (empty strings on lines 227-229 of page.tsx).
4. **"For Shippers & Transporters" section CTAs both link to `/register`** with the same label ("Get Started"). No distinction between shipper and transporter paths.
5. **Bottom CTA also sends everyone to `/register`** — two identical buttons pointing to the same destination.
6. **The workflow description "Post Cargo → Receive Offers → Book & Track" simplifies too much** and references "escrow via regulated partners" which is a Wave 2 claim that should be carefully positioned.
7. **The hero CTA labels are generic SaaS language**: "Start Shipping" / "Browse Cargo" do not clearly map to the two marketplace roles.

### What Is Misleading

1. **"Smart Matching" feature card** — The matching engine exists at design-time level (Wave 1, Increments 1-5 complete, ~264 tests passing) and API layer is wired. However, the full production matching experience with 16-factor scoring requires authenticated transporters, verified fleet data, and real listing volume. Claiming "Smart Matching connects shippers with qualified transporters based on route, capacity, and reliability data" on the PUBLIC homepage is premature because the reliability data and qualified-transporter verification infrastructure is NOT yet live.
2. **"Live Tracking"** — GPS tracking state machine and entity types exist (MOD-003 Increment 1, design-time only). Real GPS tracking APIs exist as stubs in `api/tracking/route.ts` and related files. The capability description says "GPS-powered shipment tracking with border-crossing milestones and POD submission" — this overstates what is currently functional for end users.
3. **"Secure Escrow"** — Financial entity types, state machines, and BC contracts exist (MOD-005 Increment 1, MOD-013 Increment 2, both design-time/in working tree). Actual regulated banking partner integration is NOT implemented (scheduled for Wave 5). The escrow description "Funds held by regulated banking partners" describes the intended model but not an available feature.
4. **"Instant cargo listing"** — The listings CRUD API exists (Wave 1 Increment 4). This is closer to reality but posting cargo requires authentication which the homepage doesn't showcase.
5. **"AI-assisted matching"** — Advisory quotes module exists (Wave 1 Increment 5) as conceptual API. AI capabilities (MOD-006, MOD-018) are design-time only per wave classification.

### What Is Missing

1. **Product demonstration / marketplace preview section** — The audit noted the homepage does not convincingly show the actual product. The MarketplacePreviewCard component exists (line 10-23) but is used only for trust signals with empty descriptions.
2. **Authentic Portuguese terminology** — PT uses "Remetente" instead of the decided "Dono de Carga".
3. **Clear two-sided journey visualization** — How it works is a single linear flow (1→2→3) shared by both sides. It doesn't distinguish the Shipper path from the Transporter path.
4. **Mozambique/SADC geographic positioning** — "Mozambique & Regional Focus" appears as a trust bullet but has no dedicated section or contextual framing.
5. **Legal pages** — Privacy Policy, Terms of Service links appear in footer in many designs but do not exist in code. They should not be faked if they don't exist.

---

## B. Recommended Homepage Information Architecture

### Section Order Recommendation

```
[0] PublicHeader (sticky, branded)
[1] Hero — "What is NexCargo?"
[2] Product Demonstration — "See the marketplace in action"
[3] Two-Sided Journey — "How NexCargo Works" (split by role)
[4] For Shippers — "Dono de Carga" card
[5] For Transporters — "Transportador" card
[6] Platform Capabilities — Verified features only
[7] Trust & Operating Model — Why the platform is safe
[8] Mozambique & Regional Positioning
[9] Final Conversion — Dual CTAs
[10] PublicFooter
```

### Detailed Section Specifications

| # | Section | Purpose | Visitor Question | Audience | Actual Capability | Content Direction | CTA | Visual |
|---|---------|---------|-----------------|----------|-------------------|-------------------|-----|--------|
| 0 | PublicHeader | Navigation, brand identity, language switching, auth entry | "Am I in the right place? How do I navigate?" | All | PublicHeader component exists; uses NexCargoLogo/NexCargoSymbol, LanguageSwitcher, mobile hamburger | Logo left, nav center, auth CTA right, language toggle. Nav: Home, About, Sign In, Register | "Sign In" / "Register" | NexCargoLogo desktop / NexCargoSymbol mobile |
| 1 | Hero | Establish identity and purpose immediately | "What is NexCargo and what can I do here?" | All | Listings API exists (POST/GET); transporter offers exist (POST/GET); Auth system exists (Supabase) | Tagline above headline; headline answers "what"; body explains briefly; TWO CTAs side-by-side | Shipper: "Publicar Carga" / "Publish Cargo" → `/register`; Transporter: "Encontrar Cargas" / "Find Loads" → `/register` | Brand-compliant gradient background; optional subtle logistics illustration |
| 2 | Product Demonstration | Show the actual product, not abstract descriptions | "Is this a real product or just a landing page?" | Both + curious visitors | Marketplace listings UI EXISTS in authenticated space (ShipperDashboard shows listings table); Offer submissions exist; Match proposals exist | Representative screenshot/mockup of the ACTUAL marketplace listing view showing origin, destination, cargo type, weight, dates. Use representative/fictional data. Show the real table/card UI. | "Create Account to Browse" / "Registar para Explorar" | REAL product UI screenshot or faithful representation (NOT illustration/photography) |
| 3 | Two-Sided Journey — How NexCargo Works | Explain the marketplace workflow honestly | "How does NexCargo actually work?" | Both | Wave 1: Listings CRUD, Offers, Matching API, Quotes, Publish Action. Wave 2: Booking, Contracts, Escrow entities (design-time). Wave 3+: Tracking (design-time) | Split presentation showing TWO parallel paths. Do NOT simplify to single 1→2→3 linear flow. Path A (Dono de Carga): Publicar → Receber Ofertas → Selecionar → Reservar → Acompanhar. Path B (Transportador): Descobrir → Ofertar → Reservar → Executar → Entregar. Shared nodes: Contract, Payment (regulated partners), Tracking. | N/A (informational) | Step visualization with connector arrows; color-coded by side (blue=shipper, teal=transporter) |
| 4 | For Shippers — Dono de Carga | Detail the shipper journey | "What's in it for me as a cargo owner?" | Donos de Carga | Listings CRUD, Offer aggregation, Match proposals, Booking creation, Quote generation, Document management (design-time) | Title: "Para Donos de Carga" / "For Shippers". Description: publish cargo details, receive transporter offers, compare and select, manage bookings, track shipments. Feature bullets matching actual capability scope. | "Registar como Dono de Carga" / "Sign Up as Shipper" → `/register` | Role-specific iconography; feature checklist |
| 5 | For Transporters — Transportador | Detail the transporter journey | "What's in it for me as a transport operator?" | Transportadores | Offer submission, Listing discovery, Match proposal viewing, Accept/reject, Booking confirmation, Fleet registry | Title: "Para Transportadores" / "For Transporters". Description: discover cargo loads matching routes/capacity, submit competitive offers, book confirmed jobs, manage fleet operations. Feature bullets matching actual capability scope. | "Registar como Transportador" / "Sign Up as Transporter" → `/register` | Role-specific iconography; feature checklist |
| 6 | Platform Capabilities | List verifiable platform features | "What tools does NexCargo provide?" | Both | Listed per evidence below in Section E | Only include capabilities with documented implementation. Exclude "smart matching", "live tracking", "secure escrow" from public marketing language until implementations reach production status. Reposition as "Planned" or remove. | N/A | Icon grid (4 columns on lg, 2 on sm, 1 on xs) |
| 7 | Trust & Operating Model | Explain why users can trust the platform | "Can I trust NexCargo with my business?" | All | NO CUSTODY PRINCIPLE (PROMPT 0 v1.1 §109, Primitive Registry §3, AI-EPRS §5); RLS policies enforced (C1 closed); KYC/KYB design-time (MOD-010) | Neutral marketplace principle (not carrier, not bank, not insurer); funds handled by regulated partners through escrow mechanism; transporter-side commission only; operational visibility provided; document management for traceability. Avoid vague trust claims. | N/A | Simple icon-based trust markers |
| 8 | Mozambique & Regional Positioning | Ground NexCargo in its origin and market context | "Where does NexCargo operate?" | All | AI-EPRS states Mozambique and SADC region; CORS/cross-border entity types exist (MOD-009 design-time); Multilingual i18n exists (PT/EN) | "Construída em Moçambique" / "Built in Mozambique"; designed for regional growth across SADC corridors; operates primarily in Portuguese and English; acknowledges cross-border complexity. Distinguish stated intent from current availability. | N/A | Subtle geographic visual (map motif or corridor lines) |
| 9 | Final Conversion | Drive registration | "What should I do next?" | Both | Auth system ready (Supabase, sign-in/register/sign-out all implemented) | Dual CTA layout matching hero; clear separation of shipper vs transporter paths; brief reinforcing description | Shipper: "Publicar Carga" / "Publish Cargo" → `/register`; Transporter: "Encontrar Cargas" / "Find Loads" → `/register` | Gradient background matching brand colors |
| 10 | PublicFooter | Navigation closure, legal, branding | "What else is there? Who owns this?" | All | Footer component exists but contains hardcoded strings needing i18n | Brand column with logo + short description; Navigation links; Support area (only if support ticket system exists — check `api/support/tickets/route.ts` ✓ YES it exists); Legal (only if pages exist); Copyright + trust badges | N/A | 4-column grid layout (existing component) |

---

## C. PT-PT Content Direction

### Terminology Audit — Current State

| Current Term | Location | Classification | Required Change |
|-------------|----------|---------------|-----------------|
| Remetente | PT register page (shipper_option) | INCORRECT | Must be **Dono de Carga** |
| Painel do Remetente | PT ShipperDashboard.title | INCORRECT | Must be **Painel do Dono de Carga** |
| Portal do Remetente | PT home shipper_title | INCORRECT | Must be **Portal do Dono de Carga** |
| Remetentes | PT trust_title | INCORRECT | Must be **Donos de Carga** |
| Remetentes (in how_step1_desc, feature_matching_desc) | PT home | INCORRECT | Must be **Donos de Carga** |
| Shipper (English key name) | PT/common.json keys (e.g., shipper_title) | CONTEXTUAL/Internal | Key names OK; values MUST use "Dono de Carga" |
| Transportadora | PT throughout | CORRECT | Retain |
| Transporte/Mercado online de cargas | PT tagline | ACCEPTABLE | Retain as candidate |
| Conta Garantia | PT escrow translations | REVIEW | Consider whether "Conta Garantia" is accurate enough or needs refinement per MOD-005/MOD-013 |

### Recommended PT Copy

**Hero:**
- Tagline: "O Mercado Online de Cargas"
- Headline: "Infraestrutura logística com inteligência artificial para Moçambique e região SADC"
- Body: "Uma plataforma neutra que conecta Donos de Carga e Transportadores através de um marketplace digital seguro. Publique cargas, receba ofertas de transportadoras, reserve e acompanhe cada envio."
- Primary CTA: "Publicar Carga"
- Secondary CTA: "Encontrar Cargas"

**How it Works (Path A - Dono de Carga):**
- Step 1: "Publique a sua carga com origem, destino, tipo de carga e datas"
- Step 2: "Receba ofertas competitivas de transportadores disponíveis"
- Step 3: "Selecione a melhor oferta, reserve e acompanhe o envio"

**How it Works (Path B - Transportador):**
- Step 1: "Descubra cargas compatíveis com a sua rota e capacidade"
- Step 2: "Submeta ofertas competitivas aos Donos de Carga"
- Step 3: "Confirme a reserva, execute o transporte e receba"

**Section Titles:**
- "Para Donos de Carga" / "Para Transportadores"
- "Capacidades da Plataforma"
- "Por Que Confiam na NexCargo"
- "Pronto para mover a sua primeira carga?"

**Final CTAs:**
- "Registar como Dono de Carga" / "Registar como Transportador"
- "Começar Agora" / "Explorar Marketplace"

---

## D. EN Content Direction

### Terminology Audit — Current State

| Current Term | Location | Classification | Required Change |
|-------------|----------|---------------|-----------------|
| Shipper | EN throughout | CORRECT | Retain — this is the approved canonical term |
| Shippers | EN how_step1_desc, trust_title, prop1_desc | CORRECT | Retain |
| Transporter | EN throughout | CORRECT | Retain |
| Transporters | EN throughout | CORRECT | Retain |
| Post Cargo | EN how_step1_label | ACCEPTABLE | Retain or refine to "List Your Cargo" for clarity |
| Find Loads | Not used in EN i18n (hardcoded in footer) | MISSING FROM i18n | Add to common.json translation keys |

### Recommended EN Copy

**Hero:**
- Tagline: "The Cargo Marketplace"
- Headline: "AI-native logistics infrastructure for Mozambique and the SADC region"
- Body: "A neutral matchmaking platform connecting Shippers and Transporters through a secure digital marketplace. Post cargo, receive transporter offers, book instantly, and track every shipment."
- Primary CTA: "Post Cargo"
- Secondary CTA: "Find Loads"

**How it Works (Path A - Shipper):**
- Step 1: "List your cargo with origin, destination, cargo type and schedule"
- Step 2: "Receive competitive offers from available transporters"
- Step 3: "Select the best offer, book and track the shipment"

**How it Works (Path B - Transporter):**
- Step 1: "Discover cargo matching your route and capacity"
- Step 2: "Submit competitive offers to Shippers"
- Step 3: "Confirm the booking, execute the transport and get paid"

**Section Titles:**
- "For Shippers" / "For Transporters"
- "Platform Capabilities"
- "Why Participants Choose NexCargo"
- "Ready to move your first cargo?"

**Final CTAs:**
- "Sign Up as Shipper" / "Sign Up as Transporter"
- "Get Started" / "Browse Marketplace"

---

## E. Product Capability Reconciliation

| Homepage Claim | Actual Implementation Status | Recommendation |
|---------------|------------------------------|----------------|
| **Smart Matching** | Design-time types + API endpoints (Wave 1, Increments 1-5). 16-factor scoring model defined. 264 tests passing. NOT production-ready for end-user-facing claims. | REMOVE from public homepage capabilities section. May mention "Intelligent freight matching (coming soon)" as planned. |
| **Secure Escrow** | Entity types, state machines, BC contracts exist (MOD-005 Inc 1 + MOD-013 Inc 2). Both in working tree, uncommitted. Regulated banking partner integration NOT implemented (Wave 5 scope). | REPOSITION as "Escrow-supported payments through regulated banking partners (planned)". DO NOT claim escrow is currently live. |
| **Live Tracking (GPS-powered)** | Tracking state machine, entity types, GPS validation services exist (MOD-003 Inc 1, design-time). API stubs exist. NOT production-real-time tracking. | REMOVE from current capabilities. Can say "Shipment tracking (development underway)" or defer to future version. |
| **Multi-Language (PT/EN)** | IMPLEMENTED. Full `common.json` with 311 lines each for EN and PT. LanguageSwitcher component works. i18n routing via `[locale]/` structure operational. | KEEP. This is a current, verified capability. |
| **Instant Cargo Listing** | POST/GET/PUT/DELETE /api/listings EXISTS. Authenticated users can create and view listings. | KEEP but clarify "Authenticated cargo listing" rather than "instant" which implies zero friction. |
| **One-Tap Booking** | Booking API exists (/api/bookings POST, confirm endpoint). Atomic handoff procedure exists. Requires match acceptance first. | REMOVE "one-tap" — overly simplistic for the actual multi-step booking process (offer → match → accept → book). |
| **Real-Time Visibility** | VisibilitySnapshot entity exists (MOD-003). Snapshot REQUEST validation service exists. Real-time delivery depends on GPS tracking which is design-time. | REPOSITION as "Shipment visibility and milestone tracking" without "real-time" qualifier. |
| **AI-Assisted Matching** | AdvisoryQuoteService exists (corridor-based pricing). Design-time AI (MOD-006 Wave 3). | Can mention "AI-assisted advisory quotes" but must not claim autonomous matching or AI-driven decisions. |
| **Cross-Border Compliance** | CrossBorderComplianceRecord entity exists (MOD-014). MOD-009 design-time. | Not appropriate for public homepage current state. Internal capability only. |
| **Document Management** | Document state machine, entity types, OCR, digital signatures (MOD-004). Design-time. | Can list as "Digital document management" without claiming OCR/e-signature functionality is active. |
| **Dispute Resolution** | Dispute routes exist at `/api/disputes/`. MOD-015 design-time. | Can mention "Support and dispute resolution" as a capability area. |
| **Payment Processing (M-Pesa, Card, Mobile Money)** | M-Pesa webhook route EXISTS at `/api/webhooks/mpesa`. MOD-013 financial services design-time. Actual payment gateway integration NOT confirmed as live. | Keep "No Custody — Funds Handled by Regulated Partners" as operating principle (this IS true architecturally). Remove specific payment method claims unless verified live. |

### Verification Notes

Capabilities with ✗ need explicit confirmation before being placed on the public homepage:
- Smart Matching (✗ design-time only)
- Secure Escrow (✗ design-time only, banking partner integration pending Wave 5)
- Live/GPS Tracking (✗ design-time only)
- One-Tap Booking (✗ oversimplification)
- Real-Time Visibility (✗ depends on GPS which is design-time)
- Digital Signatures (✗ design-time)
- OCR (✗ design-time)
- AI-Assisted Matching (✗ advisory quotes only)
- Cross-Border Operations (✗ MOD-009 design-time)

Capabilities with ✓ are verified as implemented:
- Multi-language PT/EN (✓ live i18n)
- Cargo listing API (✓ Wave 1 Increment 4)
- Offer management (✓ Wave 1 Increment 4)
- Match proposals (✓ Wave 1 Increment 5)
- Booking API (✓ C2 Increment 2)
- Booking confirmation (✓ C2 Increment 2)
- Auth system (Supabase) (✓ C1 closed)
- Atomic handoff (✓ C2 Increment 3)
- M-Pesa webhook (✓ route exists)
- Dispute system (✓ routes exist)
- Support tickets (✓ route exists)

---

## F. Trust / Business-Model Claims

### What Can Safely Be Stated Publicly

1. **NexCargo is a neutral marketplace platform** — Supported by PROMPT 0 v1.1 §96-113, Primitive Registry §3, AI-EPRS Part I §4-5.
2. **NexCargo is NOT a carrier, freight forwarder, insurer, or bank** — Explicitly stated in PROMPT 0 v1.1 §99-102 and Primitive Registry §3.
3. **Transport execution remains with Transporters** — Implicit in primitive hierarchy (§4.2 External Actor definition).
4. **Funds are handled through regulated banking partners via escrow** — Described as architectural model in AI-EPRS §5 (Capability 05), MOD-005, MOD-013. EXACT STATUS: design-time entities exist; LIVE INTEGRATION NOT YET IMPLEMENTED. The ARCHITECTURAL INTENT is truthfully representable.
5. **NexCargo operates on a transporter-side commission model** — Implied by AI-EPRS §5 and MOD-018 (Pricing/Incentives). NOT explicitly stated anywhere as a business rule. REQUIRES CONFIRMATION.
6. **Portuguese and English interface** — VERIFIED live.
7. **Designed for Mozambique and the SADC region** — AI-EPRS Part I §1, §5.5 explicitly states this as vision/context. VERIFIED as stated intent.
8. **User verification (KYC/KYB) supported** — MOD-010 design-time. verification-status-manager.ts exists. Verification PROCESS exists but automated verification against external sources NOT confirmed live.
9. **Audit records maintained** — MOD-017 design-time. compliance-audit-trail.ts exists. LOGGING infrastructure exists. FULL AUDIT COMPOSING (Module 3) requires explicit HAO authorization.

### What Requires Verification Before Public Claim

1. **Commission rate** — Not specified in any authoritative document examined.
2. **"Verified Transporters Only"** — KYC/KYB framework exists design-time. No evidence of an ACTIVE verification gate preventing unverified users from submitting offers.
3. **"Guaranteed delivery" / any performance guarantee** — NOT supported anywhere. PROHIBITED by operational model (NexCargo is not a carrier).
4. **"Best rates" / price superiority claims** — NOT supported.
5. **"Trusted by thousands" / social proof metrics** — No metrics exist. PROHIBITED per prompt constraints.
6. **Specific banking partner names** — None named in any examined document.
7. **"SADC-wide coverage"** — Strategic vision includes SADC; current operational availability is Mozambique. Must distinguish these.
8. **Data protection/compliance certifications** — ESS-006 covers security standards conceptually. No certification mentioned.

---

## G. Visual Requirements

### Sections That Should Have Product Visuals

| Section | Visual Type | What It Should Show | Data Source |
|---------|------------|--------------------|-------------|
| Hero (optional) | Abstract/brand background | Subtle logistics-themed pattern or geometric shape using brand colors | Existing SVG pattern technique already in use |
| Product Demonstration | Real product UI screenshot/mockup | Actual marketplace listing view showing: origin city, destination city, cargo type, weight, pickup date, status badge | Fictional/representative data mapped to real database schema fields. Use realistic Mozambican cities (Maputo, Beira, Nampula). |
| How it Works | Process diagram | Color-coded two-path workflow showing Shipper journey and Transporter journey with shared nodes | Derived from state machines in MOD-001/002/003 |
| Trust & Operating Model | Icon-based trust markers | Three icons: neutral platform symbol, regulated partner handshake, document integrity | Generic iconography, no brand-specific graphics needed |
| Mozambique Positioning | Subtle geographic motif | Corridor line from Maputo inland; or simplified outline of Mozambique | Open-source geography data or stylized vector |

### Sections That Need No Visual

1. **PublicHeader** — Uses existing logo/symbol components.
2. **For Shippers / For Transporters cards** — Text-based with feature checkmarks.
3. **Platform Capabilities** — Icon grid (existing icon approach is adequate).
4. **Final Conversion** — Gradient background with text + button.
5. **PublicFooter** — Text-based with navigation links.

### Critical Visual Constraints

1. **NO invented product screenshots** — Any product UI shown must represent actual implemented screens, even if populated with fictional data.
2. **NO stock photography** — Does not align with brand direction or practical maintenance requirements.
3. **Representative data must follow real schema** — If showing origin/destination fields, they should match the ShipmentListing.originCity / ShipmentListing.destinationCity fields from the actual migration schema.
4. **Visuals can be replaced progressively** — The homepage architecture should allow replacing representative mockups with live data pulls when authenticated views become appropriate.

---

## H. Missing Information / Decisions for HAO Input

### Genuine Decision Points

1. **Current operational availability statement** — Should the homepage explicitly state "Currently operational in Mozambique" or keep it implicit ("Built in Mozambique")? This affects geographic positioning credibility. REQUIRES HAO guidance.

2. **Commission model disclosure** — Should the homepage mention that NexCargo charges transporter-side commissions? This is implied by the business model but never explicitly codified as a policy. REQUIRES HAO clarification.

3. **"Verified Transporters Only" claim** — The current trust card makes this claim. Is there an ACTIVE verification gate, or is it aspirational? If aspirational, the claim should be rephrased. REQUIRES verification from implementation team.

4. **M-Pesa webhook status** — A webhook route exists at `/api/webhooks/mpesa`. Is M-Pesa integration LIVE for customer transactions, or is it developmental? REQUIRES confirmation.

5. **Support channel availability** — `/api/support/tickets/route.ts` exists as an API endpoint. Is there a user-accessible support channel for public visitors to contact? REQUIRES confirmation.

6. **Legal page existence** — Are Privacy Policy and Terms of Service pages created? If not, the footer should not reference them. REQUIRES confirmation.

7. **Public listing browsing** — Can unauthenticated visitors browse marketplace listings, or is listing discovery gated behind registration? This affects the "Browse Marketplace" CTA validity. REQUIRES confirmation via API behavior test.

8. **Tagline finalization** — Three candidates exist: "The Cargo Marketplace" (EN), "O Mercado Online de Cargas" (PT), "Mercado Online | Cargas" (PT alt). Which is AUTHORIZED as the definitive tagline? REQUIRES HAO decision.

### Non-Decisions (Already Authoritative)

- Dono de Carga = Shipper — DECIDED in this prompt
- Fleet Owner NOT a role — AUTHORITATIVE per PROMPT 0 and development-state reconciliation
- Global Dispatcher NOT a role — AUTHORITATIVE per development-state reconciliation
- CargoLink obsolete — STATED in this prompt as prohibition
- No-custody principle — CONFIRMED in PROMPT 0 v1.1 §109, Primitive Registry §3, AI-EPRS §5

---

## I. Implementation Readiness

### Current State: **Requires Targeted Clarification**

The homepage information architecture is structurally sound and can move toward implementation once the following clarifications are resolved:

**Pre-implementation blockers (3 items):**

1. **Terminology reconciliation** — PT translations use "Remetente" in 5+ occurrences where "Dono de Carga" is mandated. This is a high-priority fix regardless of other changes. The register page role selection also needs updating.

2. **Capability claims alignment** — Four feature cards currently make claims that outpace implementation (Smart Matching, Live Tracking, Secure Escrow, One-Tap Booking). These must either be removed, repositioned as "planned", or replaced with verified capabilities before the homepage is considered production-ready.

3. **Component integration** — PublicHeader and PublicFooter are built but not connected. The homepage needs to import and render these components. The PublicFooter also has hardcoded English strings ("Shipper — Post Cargo", "Transporter — Find Loads", "Browse Listings", "Marketplace") that must be internationalized.

**Post-clarification implementation tasks (estimated order):**

1. Fix PT terminology: Remetente → Dono de Carga across all translation keys and values
2. Wire PublicHeader and PublicFooter into the homepage layout
3. Internationalize PublicFooter hardcoded strings
4. Align capabilities section with verified implementation status
5. Restructure "How it Works" into two-sided path presentation
6. Replace generic hero CTAs with role-differentiated actions
7. Implement Product Demonstration section with real-product visual
8. Add Mozambique/Regional positioning section
9. Add supporting descriptions to trust signal cards
10. Refine final conversion CTAs for dual-path clarity
11. Verify support/legal/footer completeness
12. Test responsive layouts across all new sections
13. Run TypeScript compile + lint

**Confidence assessment:** HIGH. The specification is evidence-based, grounded in authoritative documentation, reconciled with actual implementation, and accounts for the agreed-upon terminology decision. The remaining uncertainty is limited to operational status questions (M-Pesa live? Public browsing enabled?) which can be answered quickly.

---

*Report produced as a read-only artifact. No files were modified, created, deleted, committed, or generated during this analysis.*
