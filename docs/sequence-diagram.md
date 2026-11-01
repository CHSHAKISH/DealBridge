# End-to-End Sequence Diagram: Deal Closed Won to Paid

This diagram illustrates the lifecycle of the primary deal (**NovaTech Solutions LLC – Enterprise Software Implementation**) from the moment sales closes the deal to milestone billing and payment reconciliation.

```mermaid
sequenceDiagram
    autonumber
    actor Sales as Sales Rep (HubSpot)
    participant CRM as HubSpot CRM
    participant Webhook as DealBridge API Gateway
    participant Queue as BullMQ / Redis
    participant Worker as Integration Worker
    participant DB as PostgreSQL Database
    participant Zoho as Zoho Books API
    actor Finance as Finance Team (Zoho)

    %% 1. Deal Closed Won
    Note over Sales, CRM: Stage 1: Deal Closed Won
    Sales->>CRM: Marks Deal "Closed Won" (AED 120,000)
    CRM->>Webhook: POST /api/webhooks/hubspot (deal.propertyChange)
    Webhook->>DB: Check & record WebhookEvent (Hash Deduplication)
    Webhook->>Queue: Enqueue "deal-sync-queue" (Job ID: deal_360717339332)
    Webhook-->>CRM: HTTP 200 OK (Processed in < 50ms)

    %% 2. Background Customer & Order Processing
    Note over Worker, Zoho: Stage 2: Customer Matching & Sales Order
    Queue->>Worker: Dispatch deal sync job
    Worker->>DB: Check IntegrationOperation idempotency key
    Worker->>Zoho: GET /contacts?search_text=NovaTech Solutions LLC
    alt Customer Not Found
        Worker->>Zoho: POST /contacts (Currency: AED, TRN: 100234567800003)
        Zoho-->>Worker: Contact Created (ID: 4339973000000042001)
        Worker->>DB: Save Customer mapping
    else Single Exact Match
        Zoho-->>Worker: Return existing contact
    end

    Worker->>Zoho: GET /items?search_text=Enterprise Software Implementation
    Zoho-->>Worker: Item Verified (ID: item_esi_100)
    
    Worker->>Zoho: POST /salesorders (Total: AED 126,000 incl. 5% VAT)
    Zoho-->>Worker: Sales Order Created (SO-00003)
    Worker->>DB: Persist SalesOrder record

    %% 3. Milestone 1 Invoice (Signing: 50%)
    Note over Worker, Zoho: Stage 3: Milestone 1 Invoice (50% Signing)
    Worker->>Zoho: POST /invoices (Ref: SO-00003, Rate: AED 60,000 + 5% VAT = AED 63,000)
    Zoho-->>Worker: Invoice Created (INV-000003)
    Worker->>DB: Persist Invoice (M1, Status: SENT)
    Worker->>CRM: PATCH /objects/deals (SO: SO-00003, Total: 126k, Invoiced: 63k, % Invoiced: 50%)
    Worker->>DB: Mark IntegrationOperation as COMPLETED

    %% 4. Milestone 2 (Go-Live: 30%)
    Note over Sales, Zoho: Stage 4: Milestone 2 Invoice (30% Go-Live)
    Sales->>Worker: Project Reaches Go-Live Event
    Worker->>Zoho: POST /invoices (Ref: SO-00003, Rate: AED 36,000 + 5% VAT = AED 37,800)
    Zoho-->>Worker: Invoice Created (INV-000004)
    Worker->>DB: Persist Invoice (M2, Status: SENT)
    Worker->>CRM: PATCH /objects/deals (Total Invoiced: 100,800, % Invoiced: 80%)

    %% 5. Payment Recorded in Zoho Books
    Note over Finance, CRM: Stage 5: Payment Recorded & Reverse Sync
    Finance->>Zoho: Records Payment for Invoice INV-000003 (AED 63,000)
    Zoho->>Webhook: Webhook / Poller detects Payment (PMT-00001)
    Webhook->>DB: Create Payment & PaymentAllocation (Allocated: AED 63,000)
    Webhook->>Worker: Trigger ReverseSyncService.reconcileDealFinancials
    Worker->>DB: Recalculate: Invoiced: 100.8k, Collected: 63k (50%), Unpaid: 37.8k
    Worker->>CRM: PATCH /objects/deals (Collected: 63k, % Collected: 50%, Unpaid: 37.8k)
    CRM-->>Sales: Sales team sees live payment status & aging on Deal!
```

