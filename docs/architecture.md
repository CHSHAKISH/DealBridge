# System Architecture & Technical Specifications

## 1. Architectural Overview

DealBridge is an event-driven, bidirectional synchronization bridge linking **HubSpot CRM** and **Zoho Books ERP**. It operates on the architectural principle that **sales workflows in the CRM must never block on accounting system operations**, while maintaining ACID-compliant transactional consistency across both systems.

```mermaid
flowchart TD
    subgraph CRM_Layer["CRM Layer (HubSpot)"]
        HS_Deal["Deal: Closed Won"]
        HS_Props["Deal Properties (Synced, Unpaid, % Invoiced)"]
        HS_Webhook["Webhook: deal.propertyChange"]
    end

    subgraph DealBridge_Engine["DealBridge Backend Engine (Node.js + TypeScript)"]
        API_Gateway["API Gateway / Webhook Ingestion"]
        Deduplicator["Event Deduplication & Inbox"]
        BullMQ_Queue["BullMQ Job Queue (Redis)"]
        
        subgraph Workers["Asynchronous Workers"]
            DealWorker["Deal Sync Worker"]
            MilestoneWorker["Milestone Invoice Worker"]
            ReverseSyncWorker["Zoho to CRM Reverse Sync Worker"]
        end

        subgraph Core_Services["Domain Services"]
            Matcher["Customer Matching Engine (TRN & Normalization)"]
            ProductEngine["Strict Product Mapping (Zero Guessing)"]
            Financials["Financial Math Engine (Fils / UAE 5% VAT)"]
            IdempotencyMgr["Durable State Machine & Idempotency"]
            TokenManager["Zoho OAuth Mutex & Auto-Refresh"]
            AuditLogger["Secret-Masked Telemetry Logger"]
        end
    end

    subgraph Persistence["Storage Layer"]
        Postgres[(PostgreSQL 16 Database)]
        Redis[(Redis 7 Cache / Queue)]
    end

    subgraph ERP_Layer["Accounting Layer (Zoho Books)"]
        ZB_Contact["Customer Contact (AED Currency)"]
        ZB_SO["Sales Order (AED 126,000)"]
        ZB_Inv["Milestone Invoices (50% / 30% / 20%)"]
        ZB_Pay["Payment Records"]
    end

    subgraph UI_Layer["Frontend Dashboard (React + Vite + Tailwind)"]
        OverviewUI["Overview KPI Metrics"]
        DealsUI["Deals & Milestone Explorer"]
        LogsUI["Live Redacted Audit Logs"]
        CollectionsUI["Accounts Receivable Aging View"]
    end

    %% CRM to Zoho Flow
    HS_Deal -->|Stage Change Event| HS_Webhook
    HS_Webhook -->|POST /api/webhooks/hubspot| API_Gateway
    API_Gateway -->|Immediate 200 OK| Deduplicator
    Deduplicator --> BullMQ_Queue
    BullMQ_Queue --> Redis
    BullMQ_Queue --> DealWorker
    DealWorker --> IdempotencyMgr
    DealWorker --> Matcher
    DealWorker --> ProductEngine
    DealWorker --> Financials
    DealWorker --> TokenManager
    TokenManager --> ZB_Contact
    DealWorker --> ZB_SO
    DealWorker --> Postgres
    DealWorker --> AuditLogger

    %% Milestone Flow
    DealWorker --> MilestoneWorker
    MilestoneWorker --> ZB_Inv
    MilestoneWorker --> Postgres

    %% Reverse Sync Flow
    ZB_Pay --> ReverseSyncWorker
    ReverseSyncWorker --> Financials
    ReverseSyncWorker --> Postgres
    ReverseSyncWorker -->|Diff-Based PATCH Only Changed Fields| HS_Props

    %% Frontend
    Postgres --> OverviewUI
    Postgres --> DealsUI
    Postgres --> LogsUI
    Postgres --> CollectionsUI
```

---

## 2. Core Architectural Pillars

### 2.1 Non-Blocking Webhook Processing
- When a sales rep moves a deal to **Closed Won** in HubSpot, the incoming webhook is validated, hashed for duplicate detection, and persisted to `webhook_events`.
- An asynchronous job is dispatched to BullMQ, and the endpoint immediately returns an HTTP `200 OK` in under **50ms**.
- If Zoho Books experiences high latency or downtime, the sales team in HubSpot experiences zero disruption.

### 2.2 Financial Minor-Unit Precision (UAE VAT 5%)
- All financial balances and calculations are executed using integer minor units (UAE fils: $1\text{ AED} = 100\text{ fils}$) using BigInt arithmetic.
- Eliminates floating-point rounding inaccuracies:
  $$\text{Deal Base: } 12,000,000\text{ fils (AED 120,000)}$$
  $$\text{VAT 5\%: } 600,000\text{ fils (AED 6,000)}$$
  $$\text{Total Sales Order: } 12,600,000\text{ fils (AED 126,000)}$$
  $$\text{M1 (50\% Signing): } 6,300,000\text{ fils (AED 63,000)}$$
  $$\text{M2 (30\% Go-Live): } 3,780,000\text{ fils (AED 37,800)}$$
  $$\text{M3 (20\% 90-Day): } 2,520,000\text{ fils (AED 25,200)}$$
  $$\text{Invariant Verified: } 63,000 + 37,800 + 25,200 = 126,000.00\text{ AED}$$

### 2.3 Durable State Machine & Idempotency
- Every operation is registered in `integration_operations` with a deterministic key:
  - Customer Sync: `deal_{deal_id}:customer_sync`
  - Sales Order: `deal_{deal_id}:sales_order`
  - Milestone Invoice: `deal_{deal_id}:invoice:milestone_{1|2|3}`
- Replaying the same webhook or restarting crashed workers re-reads the completed state and returns without duplicating documents in Zoho Books.

### 2.4 OAuth Mutex & Concurrency Locking
- The `ZohoTokenManager` maintains an asynchronous mutex lock. If an OAuth token expires, concurrent worker jobs await a single shared refresh promise, preventing duplicate token refreshes and race conditions.

### 2.5 Diff-Based CRM Property Updates
- HubSpot deal property writes are diff-checked against current values. If no values changed, the write is suppressed, conserving API quotas.
