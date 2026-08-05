**ESS-001A — APPENDIX A - Integration Inventory (External Systems Catalogue)**



**Integration Inventory (External Systems Catalogue)**

**Document ID:** ESS-001A
**Parent Spec:** ESS-001 — External Integrations Specification
**System:** NexCargo
**Version:** 1.0
**Status:** Authoritative Source of Truth



**ESS-001A — APPENDIX A - Integration Inventory (External Systems Catalogue)**



**1. PURPOSE**



**This appendix defines the complete inventory of all external integrations used by NexCargo.**



**It is the canonical registry of:**



**All third-party providers**



**Integration ownership (which module uses what)**



**Criticality level**



**Dependency relationships**



**Regional applicability**



**Failure impact classification**



**This prevents:**



**AI hallucinated integrations**



**duplicate providers**



**ungoverned API usage**



**architecture drift**



**2. INTEGRATION CRITICALITY LEVELS**



**Each integration is classified as:**



**CRITICAL → System cannot operate without it**



**HIGH → Major functional degradation if unavailable**



**MEDIUM → Feature degradation only**



**LOW → Optional enhancement**



**3. FINANCIAL INTEGRATIONS (CRITICAL DOMAIN)**



**3.1 Regulated Escrow Banking Partner**



**| --------------------- | ------------------------------------------------------------------------------|**

**| Field 		| Value 							       		|**

**| --------------------- | ------------------------------------------------------------------------------|**

**| Provider Type 	| Regulated Bank 						       		|**

**| Function		| Escrow custody \& settlement 					      		|**

**| Criticality 		| CRITICAL 							       		|**

**| Owning Module 	| MOD-005 (Escrow initiation \& release), MOD-013 (Settlement \& reconciliation) 	|**

**| Role in System 	| Holds all escrow funds 							|**

**| NexCargo Custody	| ❌ NEVER 									|**

**| --------------------- | ------------------------------------------------------------------------------|**





**Responsibilities:**



**Escrow account management**



**Funds locking**



**Settlement execution**



**Dispute holds**



**Audit reporting**



**Reference: ESS-001F (Financial Integration Architecture)**



**3.2 Mobile Money Aggregator Layer**



**|-------------------------------|-------------------------------------------------------|**

**| Provider Examples 		| M-Pesa (Vodacom), mKesh (Tmcel), e-Mola (Movitel) 	|**

**| Criticality 			| CRITICAL 						|**

**| Region 			| Mozambique + SADC		 			|**

**| Owning Module 		| MOD-005 (Funding), MOD-013 (Payouts) 			|**

**|-------------------------------|-------------------------------------------------------|**





**Responsibilities:**



**Wallet funding**



**Payouts to transporters**



**Payment initiation**



**Transaction confirmation callbacks**



**Reference: ESS-001F**



**3.3 Card Payment Networks**



**|-----------------------|-----------------------------------------------|**

**| Provider 		| Visa / Mastercard 				|**

**| Criticality 		| HIGH 						|**

**| Owning Module 	| MOD-005 (Funding), MOD-013 (Settlement) 	|**

**|-----------------------|-----------------------------------------------|**



**Responsibilities:**



**Shipper funding**



**Cross-border payments**



**Deposit to escrow accounts**



**Reference: ESS-001F**



**3.4 PayPal Integration**



**|-----------------------|-----------------------|**

**| Criticality 		| MEDIUM 		|**

**| Usage 		| Shipper deposits only |**

**| Constraint 		| No transporter payouts|**

**| Owning Module 	| MOD-005 		|**

**|-----------------------|-----------------------|**



**4. LOGISTICS \& TRACKING INTEGRATIONS**



**4.1 Mapping \& Geolocation Services**



**|-----------------------|-----------------------------------------------------------------------|**

**| Provider Examples 	| Google Maps, Mapbox, OpenStreetMap 					|**

**| Criticality 		| HIGH 									|**

**| Owning Module 	| MOD-003 (Tracking \& Visibility), MOD-014 (Fleet \& Asset Management) 	|**

**|-----------------------|-----------------------------------------------------------------------|**



**Responsibilities:**



**Route calculation**



**Distance estimation**



**Map rendering**



**Geofencing**



**ETA estimation support**



**4.2 GPS / Telematics Providers**



**|-------------------------------|---------------------------------------|**

**| Type 				| Device / Mobile GPS APIs 		|**

**| Criticality 			| HIGH 					|**

**| Owning Module 		| MOD-003 (Tracking), MOD-014 (Assets) 	|**

**|-------------------------------|---------------------------------------|**



**Responsibilities:**



**Vehicle tracking**



**Interval location updates**



**Trip monitoring**



**Geofence triggers**



**5. COMMUNICATION INTEGRATIONS**



**5.1 SMS Gateway**



**|-----------------------|-----------------------------------------------------------------------|**

**| Providers 		| Africa’s Talking, Twilio 						|**

**| Criticality 		| HIGH 									|**

**| Module Ownership 	| MOD-016 (Notifications, Messaging \& Communication Orchestration) 	|**

**|-----------------------|-----------------------------------------------------------------------|**



**Responsibilities:**



**OTP delivery**



**Shipment alerts**



**Payment notifications**



**5.2 Email Services**



**|-------------------------------|-----------------------|**

**| Providers 			| SendGrid, AWS SES 	|**

**| Criticality 			| MEDIUM 		|**

**| Module Ownership 		| MOD-016 		|**

**|-------------------------------|-----------------------|**



**5.3 Push Notifications**



**|-------------------------------|-------------------------------|**

**| Provider 			| Firebase Cloud Messaging 	|**

**| Criticality 			| HIGH 				|**

**| Platforms 			| Mobile + Web 			|**

**| Module Ownership		| MOD-016 			|**

**|-------------------------------|-------------------------------|**



**6. COMPLIANCE \& GOVERNMENT INTEGRATIONS**



**6.1 KYC/KYB Verification Services**



**|-----------------------|-----------------------------------------------|**

**| Type 			| Identity verification systems 		|**

**| Criticality 		| CRITICAL 					|**

**| Module		| MOD-010 (Security, Compliance \& Governance) 	|**

**|-----------------------|-----------------------------------------------|**



**Responsibilities:**



**Transporter verification**



**Business validation**



**License checks (Alvará validation where applicable)**



**6.2 Customs \& Border Systems**



**|-----------------------|---------------------------------------------------------|**

**| Type 			| Government APIs 					  |**

**| Criticality 		| HIGH 							  |**

**| Region 		| SADC corridors 					  |**

**| Module 		| MOD-009 (Regional \& Cross-Border Logistics Operations)  |**

**|-----------------------|---------------------------------------------------------|**





**6.3 Digital Signature Providers**



**|-----------------------|---------------------------------------------------------|**

**| Type 			| e-Signature systems 					  |**

**| Criticality`		| HIGH 							  |**

**| Module 		| MOD-002 (Booking \& Contract Management) 		  |**

**| Use Cases 		| contracts, POD validation, shipment agreements 	  |**

**|-----------------------|---------------------------------------------------------|**



**7. DOCUMENT \& DATA PROCESSING**



**7.1 OCR / Document Intelligence**



**|-----------------------|---------------------------------------------------------|**

**| Providers 		| Azure OCR, Google Vision, AWS Textract 		  |**

**| Criticality 		| MEDIUM 						  |**

**| Module 		| MOD-004 (Document Management) 			  |**

**|-----------------------|---------------------------------------------------------|**



**7.2 Storage Providers**



**|-----------------------|---------------------------------------------------------------|**

**| Type 			| Object Storage (Supabase Storage) 		  	|**

**| Criticality 		| CRITICAL						  	|**

**| Module 		| MOD-004 (Document Management), MOD-011 (Platform Integration) |**

**|-----------------------|---------------------------------------------------------------|**



**Responsibilities:**



**document storage**



**POD images**



**invoices**



**shipment documents**



**8. AI \& ANALYTICS INTEGRATIONS**



**8.1 AI Service Providers**



**|-----------------------|---------------------------------------------------------------|**

**| Type 			| LLM / AI APIs 						|**

**| Criticality 		| MEDIUM 							|**

**| Module 		| MOD-006 (AI Intelligence Platform) 				|**

**|-----------------------|---------------------------------------------------------------|**





**Responsibilities:**



**pricing prediction**



**ETA estimation**



**fraud detection assistance**



**optimization suggestions**



**Reference: ESS-003 (AI Behavior Constraints)**



**9. FUTURE / OPTIONAL INTEGRATIONS**



**9.1 Insurance Providers**



**|-----------------------|---------------------------------------------------------------|**

**| Criticality 		| MEDIUM 							|**

**| Purpose 		| Cargo insurance at booking 					|**

**| Module 		| MOD-002 							|**

**|-----------------------|---------------------------------------------------------------|**



**9.2 ERP Systems**



**|-----------------------|---------------------------------------------------------------|**

**| Criticality 		| LOW–MEDIUM 							|**

**| Purpose 		| Enterprise shipper integration 				|**

**| Module 		| MOD-011 (Platform Integration) 				|**

**|-----------------------|---------------------------------------------------------------|**





**9.3 Blockchain / Audit Systems (Optional)**



**|-----------------------|---------------------------------------------------------------|**

**| Criticality 		| LOW 								|**

**| Purpose 		| Future audit immutability layer 				|**

**| Module		| TBD 								|**

**|-----------------------|---------------------------------------------------------------|**





**10. INTEGRATION DEPENDENCY MATRIX**



**|-----------------------|---------------------------------------------------------------|**

**| Domain		|	Dependency						|**

**|-----------------------|---------------------------------------------------------------|**

**| Payments		| Banks, Mobile Money, Visa 					|**

**| Logistics		| GPS, Maps							|**

**| Compliance		| KYC, Customs							|**

**| Communication		| SMS, Email							|**

**| Documents		| OCR, Storage							|**

**| AI	LLM Providers	|								|**

**|-----------------------|---------------------------------------------------------------|**





**11. SYSTEM-CRITICAL DEPENDENCIES**



**The following are SYSTEM BREAKING IF DOWN:**



**Escrow Bank Integration**



**Mobile Money Aggregators**



**Authentication Services**



**GPS Tracking**



**Object Storage**



**KYC Verification**



**If any of these fail:**



**→ Platform enters degraded operational mode**



**12. AI GOVERNANCE RULE (IMPORTANT)**



**AI Builders MUST:**



**NEVER invent new providers**



**NEVER assume regional availability**



**NEVER replace listed providers**



**NEVER bypass integration contracts**



**ALWAYS map integrations to this inventory**



**Refer to ESS-003 for AI-related constraints on integration usage**



**If missing:**



**→ TODO: Integration not defined in ESS-001A**



**13. VERSIONING RULE**



**This inventory is:**



**version controlled**



**extensible only via ESS update**



**reviewed per system release**



**No ad-hoc integrations allowed.**

