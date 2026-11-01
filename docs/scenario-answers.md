# Engineering Answers to Section 5 Scenario-Based Questions

This document contains detailed architectural and operational answers to the 7 real-world integration edge cases specified in Section 5 of the Complyance assignment.

---

### Q1. Zoho Books is unreachable for six hours on the last day of the month. What happens?

#### Architectural Behavior:
1. **Zero Disruption for Sales:** HubSpot sales operations continue normally. Inbound Closed Won webhooks are received by DealBridge's API Gateway, persisted to the `webhook_events` table, and immediately acknowledged with HTTP `200 OK` in $< 50\text{ms}$.
2. **Resilient Background Queuing:** BullMQ holds pending jobs in Redis. When the background worker attempts to call Zoho Books, the client detects connection timeouts (`ETIMEDOUT`, `ECONNREFUSED`) or HTTP 5xx responses.
3. **Exponential Backoff & Circuit Breaking:** Jobs enter an exponential backoff retry loop with randomized jitter ($2\text{s}, 4\text{s}, 8\text{s}, 16\text{s}, 32\text{s}...$). If failure persists across all retry attempts, jobs move to the **Dead-Letter Queue (DLQ)** without losing data.
4. **Idempotency Protection:** Because every operation is tracked in `integration_operations` in an `IN_FLIGHT` or `FAILED` state, resuming after 6 hours will **never create duplicate Sales Orders or Invoices**.
5. **Dashboard Visibility:** The DealBridge dashboard highlights delayed synchronization under "System Status: Degraded (Zoho API Unreachable)". Finance sees exact pending items awaiting sync.
6. **Automatic Recovery:** Once Zoho Books resumes availability, the reconciler automatically drains the queue, creates all pending Sales Orders and Milestone Invoices, and updates HubSpot deal statuses to `synced`.

---

### Q2. The deal is reopened after the first invoice was sent. What should happen?

#### Policy & Technical Handling:
1. **Financial Preservation (Never Auto-Delete Invoices):** Because Milestone 1 (50% Signing = AED 63,000) has already been sent to the client or accounted for in Zoho Books, the integration **must never automatically delete or alter existing accounting documents**. Invoices have legal and VAT audit implications under UAE FTA tax regulations.
2. **Pause Downstream Milestone Automation:** DealBridge detects the stage change from `closedwon` back to `under_review` or `negotiation`. It marks the deal status as `NEEDS_REVIEW` and **freezes automatic creation of Milestone 2 (Go-Live) and Milestone 3 (90-Day)**.
3. **CRM Status Flag:** HubSpot Deal custom property `zoho_integration_status` is updated to `needs_review` with a note: *"Deal reopened after Invoice INV-000003 was issued. Future milestone invoicing paused pending human review."*
4. **Finance & Sales Alignment Workflow:** If the deal is formally cancelled, Finance issues a standard Credit Note or Voids the invoice inside Zoho Books. DealBridge's reverse sync detects this and adjusts the active invoiced amount accordingly.

---

### Q3. The deal amount changes after the sales order exists but before the second invoice.

#### Policy & Technical Handling:
1. **Delta Detection:** When HubSpot triggers an `amount` property update (e.g. from AED 120,000 to AED 150,000), DealBridge compares the new value with the persisted `totalMinorUnits` on the active `sales_orders` record.
2. **Sales Order Amendment vs Supplement:**
   - **Scenario A (Amendment):** If the Sales Order in Zoho Books is still in `open` / `draft` status, an authorized user or reconciliation job updates the Sales Order line item rate to reflect the revision.
   - **Scenario B (Already Invoiced Milestone 1):** Milestone 1 was already invoiced at AED 63,000 (50% of original AED 120,000 + VAT). The business rule determines how the remaining AED 30,000 increase is billed:
     - *Policy 1 (Recalculate remaining milestones):* Milestones 2 and 3 absorb the variance.
     - *Policy 2 (Supplementary change order):* An amendment order or adjustment invoice is created for the difference.
3. **Guardrail:** The integration halts automatic issuance of Milestone 2, flags the deal in the dashboard as `NEEDS_REVIEW` (Amount Variance Detected), and requires user approval before generating Milestone 2 under revised terms.

---

### Q4. The CRM sends the same Closed Won event three times, out of order with an earlier stage change.

#### Technical Handling:
1. **Deduplication Hash:** Inbound payloads are hashed via SHA-256 (`payloadHash`). Duplicate raw events arriving within seconds are identified immediately in `webhook_events` and discarded with `200 OK` without triggering background workers.
2. **Deterministic Idempotency Key:** The core operation uses a deterministic key:
   $$\text{Key: } \texttt{deal\_\{hubspotDealId\}:sales\_order}$$
   The PostgreSQL unique constraint ensures that only the first thread transitions the operation to `IN_FLIGHT` and `COMPLETED`. Concurrent or duplicate threads find `COMPLETED` and exit harmlessly.
3. **Out-of-Order Versioning:**
   - If an older stage change (e.g. "Presentation Scheduled") arrives after "Closed Won", DealBridge checks the HubSpot property timestamp (`occurredAt` / `updatedAt`) and queries the **current live deal state** directly from the HubSpot Deals API.
   - Because the live deal state is `closedwon`, the stale event is ignored, preventing regressions.

---

### Q5. An invoice is voided in Zoho Books and re-issued under a new number.

#### Technical Handling:
1. **Webhook Ingestion:** Zoho Books fires an `invoice_voided` event for `INV-000003`.
2. **Status Update in Database:** The `invoices` table marks `INV-000003` with `status: VOID`, `voidedAt: NOW()`, and resets `balanceMinorUnits = 0`.
3. **Active Balance Recomputation:**
   - DealBridge queries only active invoices:
     $$\text{Active Invoiced} = \sum_{\text{status} \ne \text{VOID}} \text{Invoice Totals}$$
   - The voided invoice is excluded from `zoho_total_invoiced`, preventing double-counting.
4. **Linking the Replacement Invoice:** When the replacement invoice (e.g. `INV-000003-R`) is created against the same Sales Order, DealBridge links it to the deal, updates `zoho_total_invoiced`, and refreshes the deal properties in HubSpot.

---

### Q6. One payment is recorded against two invoices that belong to two different deals.

#### Technical Handling:
1. **Relational Payment Allocation Architecture:**
   - The database maintains a dedicated `payment_allocations` table linking one payment to multiple invoices and deals:
     ```
     Payment (PMT-100: Total AED 50,000)
       ├── PaymentAllocation -> Invoice INV-101 (Deal A: AED 20,000)
       └── PaymentAllocation -> Invoice INV-205 (Deal B: AED 30,000)
     ```
2. **Proportional Reverse Sync:**
   - Deal A's `zoho_total_collected` increases by **exactly AED 20,000**.
   - Deal B's `zoho_total_collected` increases by **exactly AED 30,000**.
   - Neither deal is incorrectly credited with the entire AED 50,000 payment.
3. **Independent Aging:** In the Collections Aging View, each invoice's remaining balance is aged independently according to its own due date.

---

### Q7. You reach Zoho Books' daily API limit in the afternoon. What does Finance see?

#### Operational & Technical Handling:
1. **Rate Limit Detection:** Zoho Books returns HTTP `429 Too Many Requests` or error code `57` (Daily API limit exceeded).
2. **Client Quota Backoff:** `ZohoApiClient` captures the 429 response, pauses further outbound API dispatches, and records a critical telemetry log.
3. **What Finance Sees on the DealBridge Dashboard:**
   - An amber/red system warning banner:
     > **"Zoho Books Daily API Limit Reached (Reset at 00:00 UTC). Outbound synchronization paused; transactions safely queued."**
   - **Queue Visibility:** Finance can see the exact list of queued deals, sales orders, and invoices waiting to sync.
   - **Last Synced Timestamp:** The dashboard shows the exact timestamp of the last successful synchronization.
4. **HubSpot Deals Remain Operational:** Deals in HubSpot show `zoho_integration_status = 'pending'`, preventing sales from believing orders were lost.
5. **Auto-Resume at Quota Reset:** BullMQ resumes job execution as soon as the quota resets at midnight, clearing all pending orders with zero duplicate records.
