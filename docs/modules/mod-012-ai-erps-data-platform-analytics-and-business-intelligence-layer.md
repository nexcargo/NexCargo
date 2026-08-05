MOD-012 — AI ERPS Data Platform Analytics \& Business Intelligence Layer Module v1.0



Interpret all NexCargo specifications according to the AI Specification Interpretation Policy v1.0. (1-nexcargo-ai-specification-interpretation-policy.md)



1\. MODULE IDENTITY



Module ID: MOD-012

Module Name: AI ERPS Data Platform Analytics \& Business Intelligence Layer Module

Version: 1.0

System: NexCargo

Type: Domain Specification Module



2\. PURPOSE



This module defines the data intelligence, analytics, and business insight architecture of NexCargo.



It governs how:



operational, financial, logistical, and system-wide data is collected, structured, transformed, and exposed for analytical and decision-support purposes



data is centralised into a unified analytics system that powers business intelligence dashboards, AI models, predictive analytics, regulatory reporting, and operational optimisation



corridor-level logistics intelligence is derived and structured



financial reconciliation is supported through structured data alignment



Critical constraint: This module does NOT implement analytics engines, BI tools, or perform runtime computations.



This module defines the structural data pipeline, semantic model, and intelligence boundaries of the system.



3\. DOMAIN SCOPE



MOD-012 governs:



3.1 Data Ingestion Layer



structured event ingestion from all modules (MOD-001 → MOD-018)



external event ingestion via MOD-011



system-generated event streams



real-time and batch ingestion models



3.2 Data Processing Layer



normalisation of raw events



transformation into analytical models (ETL/ELT)



aggregation rules (structural only)



versioned data transformations



3.3 Data Storage Layer (Logical)



operational data store (ODS concept)



analytical data store (warehouse concept)



event store (immutable log concept)



data lake for raw event storage



3.4 Business Intelligence Layer



KPI definition structure (not computation)



reporting model definitions



insight categorisation framework



role-based BI dashboards (executive, operations, financial, corridor, risk)



3.5 AI Data Consumption Layer



structured datasets for MOD-006 AI Intelligence Platform



anomaly detection datasets



predictive modelling input structures



AI training data pipelines



3.5.1 Geospatial Indexing



All location data MUST be stored with:



PostGIS extension for spatial queries



Indexed latitude/longitude fields



Support for radius-based queries



Geofencing support for border detection



3.6 Corridor Intelligence



corridor-level analytics (transit time, border delays, cost, congestion patterns)



carrier performance by corridor



seasonal pattern analysis



3.7 Financial Analytics \& Reconciliation



revenue, escrow utilisation, payment delays



carrier payout performance



fee structures and margins



multi-currency normalisation



4\. CORE DOMAIN ENTITIES



These are data architecture representations only.



4.1 Data Event Object



Represents raw system event ingestion unit.



Required attributes:



eventId



eventType



sourceModule



timestamp



payload – structured JSON



correlationId



schemaVersion



Business rules:



All system data MUST originate from immutable event streams.



No direct database mutations are considered authoritative.



Raw event data MUST never be modified.



4.2 Analytical Dataset Object



Represents structured analytical grouping.



Attributes:



datasetId



datasetName



sourceEvents – array of event type references



transformationRules – structured JSON



refreshPolicy – REAL\_TIME / BATCH / MANUAL



accessLevel – PUBLIC / RESTRICTED / CONFIDENTIAL



ownerModule



version



lineageMetadata – traceability information



Business rules:



Every dataset MUST preserve origin traceability.



Transformations MUST be documented, not assumed.



Data transformations must be versioned.



4.3 KPI Definition Object



Represents structured business metric definition.



Attributes:



kpiId



kpiName



description



sourceDatasets – array of dataset references



calculationDefinition – logical only (not executable)



aggregationLevel – GLOBAL / REGIONAL / USER / SHIPMENT / CORRIDOR



refreshInterval



ownerModule



Business rules:



KPIs are defined structurally, not computed.



KPI definitions must reference source datasets.



KPI definitions must specify aggregation level.



4.4 Insight Object



Represents derived intelligence output.



Attributes:



insightId



insightType – TREND / ANOMALY / PREDICTION / OPTIMIZATION



sourceDataReferences – array of dataset references



confidenceLevel



generatedByModule – usually MOD-006



timestamp



4.5 Corridor Analytics Dataset



Represents structured corridor-level analytics.



Attributes:



corridorAnalyticsId



corridorId – reference to MOD-009 corridor



timePeriod



averageTransitTime



borderDelayDistribution – structured JSON



averageCost



seasonalPattern – structured seasonal data



carrierPerformance – array of carrier metrics



congestionData – structured congestion metrics



generatedAt



Business rules:



Corridor data is a primary analytics dimension.



Must integrate with MOD-009 corridor definitions.



AI uses this data for predictions (MOD-006).



4.6 Financial Reconciliation Dataset



Represents financial analytics and reconciliation structures.



Attributes:



reconciliationDatasetId



escrowId – reference to MOD-005 escrow



shipmentId



transactionAmount



settlementCurrency



conversionRateApplied



escrowStatus



reconciliationStatus – ALIGNED / MISMATCH\_DETECTED



generatedAt



Business rules:



Must reconcile escrow transactions with shipment completion.



Financial data must be auditable.



Multi-currency normalisation is required.



4.7 AI Training Dataset



Represents structured data prepared for AI model training.



Attributes:



trainingDatasetId



datasetName



purpose – ETA\_PREDICTION / DELAY\_DETECTION / PRICING / FRAUD\_DETECTION / DEMAND\_FORECAST



sourceDataReferences – array of dataset references



anonymizationStatus – ANONYMIZED / RAW



version



trainingStartDate



trainingEndDate



validationMetrics – structured JSON (model performance)



Business rules:



Only validated data is used for training.



Data must be anonymised where required.



Versioning of datasets is required.



Feedback loops from AI performance are included.



4.8 Report Definition Object



Represents a structured report definition.



Attributes:



reportId



reportName



reportType – OPERATIONAL / FINANCIAL / COMPLIANCE / EXECUTIVE



dataSources – array of dataset references



outputFormats – CSV / PDF / API



schedule – ON\_DEMAND / DAILY / WEEKLY / MONTHLY



ownerModule



accessLevel



Business rules:



Reports must be consistent with real-time data.



Scheduled reporting is supported.



Reports must respect RBAC constraints.



4.9 Data Lineage Record



Represents data origin and transformation traceability.



Attributes:



lineageId



datasetId



sourceEventId



transformationStep – structured transformation description



inputSchema



outputSchema



timestamp



executedByModule



Business rules:



Every dataset must have lineage metadata.



Data transformations must be traceable.



Supports audit and compliance requirements.



5\. DATA ARCHITECTURE MODEL



5.1 Event-Driven Data Foundation



All system data MUST originate from:



immutable event streams generated by MOD-001 → MOD-018



No direct database mutations are considered authoritative.



5.2 Multi-Layer Data Structure



MOD-012 defines three logical layers:



Operational Layer:



real-time system state



transactional events



current shipment status



Analytical Layer:



aggregated and transformed datasets



historical analysis structures



corridor intelligence



financial reconciliation



Intelligence Layer:



AI-consumed datasets



predictive modeling inputs



anomaly detection structures



AI training data pipelines



5.3 Data Lifecycle



DATA GENERATED (by MOD-001 → MOD-018)

&#x20;      ↓

INGESTION (event ingestion)

&#x20;      ↓

VALIDATION (schema and integrity)

&#x20;      ↓

TRANSFORMATION (ETL/ELT processing)

&#x20;      ↓

STORAGE (operational, analytical, intelligence layers)

&#x20;      ↓

ANALYTICS / AI PROCESSING (consumption by MOD-006 and BI)

&#x20;      ↓

VISUALIZATION / API OUTPUT (MOD-007 dashboards, MOD-011 APIs)



5.4 Data Lineage Rule



Every data point MUST:



trace back to a source event



include module origin



include transformation history



maintain immutability of raw source



6\. RESPONSIBILITIES

MOD-012 is responsible for:



6.1 Data Structuring



defining how system data is organised



ensuring consistency across modules



defining data domains (shipments, users, payments, tracking, documents, AI predictions)



6.2 Event Aggregation Model



defining how events are grouped into datasets



ensuring traceable transformations



defining refresh policies (real-time, batch, manual)



6.3 BI Structure Definition



defining KPI structure (not computation)



defining reporting frameworks



defining dashboard data structures



6.4 Corridor Intelligence Structuring

defining corridor analytics data structures



enabling corridor performance tracking



supporting seasonal and congestion analysis



6.5 Financial Reconciliation Structuring



defining reconciliation data structures



ensuring escrow-transaction alignment



supporting multi-currency normalisation



6.6 AI Data Preparation

structuring datasets for MOD-006



enabling predictive and anomaly models



defining AI training data pipelines



6.7 Data Governance Structuring



defining data lineage and traceability



ensuring audit and compliance support



maintaining data versioning rules



7\. RULES OF OPERATION



7.1 No Computation Rule (CRITICAL)



MOD-012 MUST NOT:



calculate KPIs



execute analytics logic



perform data transformations at runtime



generate live insights



compute BI metrics



It only defines structure, not execution.



7.2 Event Source Authority Rule



ALL data MUST originate from events.



No manual or ad-hoc data injection is allowed.



Event integrity overrides all derived datasets.



No module may bypass data ingestion pipeline.



7.3 Data Lineage Integrity Rule



Every dataset MUST preserve origin traceability.



Transformations MUST be documented, not assumed.



Full traceability from raw data to analytics output is required.



7.4 Immutability Rule



Raw event data MUST never be modified.



Corrections MUST be new events, not overwrites.



Historical data is immutable.



7.5 AI Data Isolation Rule



MOD-006 consumes data but does not define structure.



MOD-012 defines data structure but not AI behaviour.



AI models rely only on validated datasets.



7.6 Financial Reconciliation Rule



Financial data must be auditable.



Reconciliation datasets must align with escrow ledger.



Multi-currency normalisation is required.



7.7 Neutrality Rule



MOD-012 MUST NOT:



compute analytics results



generate dashboard logic



execute BI processing



mutate event data



override AI-generated insights (MOD-006 authority)



7.8 Geospatial Indexing Rule



All GPS coordinates MUST be stored with spatial indexing



Radius queries MUST be optimized with spatial indexes

Geofencing MUST leverage spatial indexing



8\. EVENT MODEL (SPECIFICATION ONLY)



Declared data events:



DataEventIngested



DatasetGenerated



DatasetVersioned



KPIUpdated – structural event only, not computed logic



InsightGenerated – by MOD-006



DataPipelineTriggered



DataLineageRecorded



CorridorAnalyticsGenerated



FinancialReconciliationPerformed – structural event only



AITrainingDatasetPrepared



ReportGenerated



DataGovernanceEventLogged



Consumed by:



MOD-006 → AI intelligence processing



MOD-003 → tracking analytics



MOD-005 → financial analytics (ESS-001F aligned)



MOD-010 → compliance monitoring



MOD-017 → observability and monitoring



MOD-018 → commercial optimisation



MOD-007 → BI dashboard rendering



MOD-011 → analytics API exposure



9\. INTEGRATION BOUNDARIES



MOD-012 interacts conceptually with:



MOD-001 → marketplace data generation (listings, offers, matches)



MOD-002 → contract lifecycle analytics



MOD-003 → shipment tracking data streams



MOD-004 → document metadata extraction



MOD-005 → financial transaction analytics and reconciliation



MOD-006 → AI intelligence layer (primary consumer)



MOD-007 → BI dashboard data structures



MOD-008 → edge data ingestion



MOD-009 → corridor analytics



MOD-010 → audit logs and compliance data



MOD-011 → external data ingestion and analytics API



MOD-017 → observability metrics



MOD-012 does NOT:



execute analytics computations



generate reports dynamically



modify operational system state



override module data ownership



compute BI metrics at runtime



10\. ESS DEPENDENCY REFERENCES (CANONICAL)



MOD-012 is constrained by:



ESS-009 → Data Governance Specification (PRIMARY AUTHORITY)



ESS-004 → Integration Contracts Specification



ESS-006 → Compliance \& Audit Rules



ESS-007 → coding standards for data integrity systems



ESS-003 → AI behaviour constraints (data consumption rules)



ESS-001C → retry and ingestion reliability rules



ESS-001E → error standardisation rules



11\. ARCHITECTURE BOUNDARY RULE



MOD-012 MUST NOT:



compute analytics results



generate dashboards logic



execute BI processing



mutate event data



override AI-generated insights (MOD-006 authority)



MOD-012 IS:



a deterministic data structuring and lineage system that defines how all NexCargo data is collected, organised, and prepared for analytical and AI consumption



a framework for unified data warehousing, corridor intelligence, and financial reconciliation



a governance structure that ensures data traceability and auditability across all modules



12\. OUTPUT EXPECTATION FOR AI BUILDER



When generating implementation from MOD-012, the AI App Builder MUST:



implement event-driven data ingestion pipelines from all modules



ensure immutable event storage design (no modification of raw events)



enforce dataset lineage tracking (origin, transformation, ownership)



structure KPI definitions without computation logic



prepare AI-consumable datasets for MOD-006 (training, prediction, anomaly detection)



implement unified data warehouse logical structure



implement real-time data streaming pipeline (low-latency updates)



implement ETL/ELT processing engine with versioned transformations



implement operational analytics engine (delivery time, carrier efficiency, route optimisation, border delays)



implement financial analytics and reconciliation layer (escrow alignment, multi-currency normalisation)



implement corridor intelligence system (transit time, border delays, cost, seasonal patterns)



implement AI training data pipeline with dataset versioning and anonymisation



implement BI dashboard data structures for all roles



implement data governance and lineage tracking



implement reporting and export engine (CSV, PDF, API)



include edge-case handling (data loss prevention, pipeline failures, schema changes, reconciliation mismatches)



ensure data consistency across all modules



ensure no module may bypass the data ingestion pipeline



maintain strict data access control per role (MOD-010 integration)



If incomplete:



Output: TODO: requires specification from MOD-012



13\. DESIGN PRINCIPLE



MOD-012 ensures:



all intelligence in NexCargo is built on a fully traceable, event-driven, immutable data foundation that separates structure from computation



data is centralised, consistent, and auditable across all modules



corridor intelligence enables region-specific operational insights



financial reconciliation aligns escrow with shipment execution



AI models are fed with high-quality, validated, versioned datasets



BI dashboards provide role-specific operational and strategic visibility



the platform operates as a data-driven logistics intelligence system, not just a transactional marketplace

