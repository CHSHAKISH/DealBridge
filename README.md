# DealBridge 🌉
> **Two-Way CRM & Zoho Books Financial Integration Engine**  
> Developed for the Full-Stack Developer Intern assignment at **Complyance**.

DealBridge is an enterprise-grade, event-driven financial integration engine that synchronizes **HubSpot CRM** with **Zoho Books ERP**. It ensures that deals closed in CRM instantly flow into Zoho Books as compliant Sales Orders and milestone invoices (with exact penny-level UAE VAT math), while invoice statuses, cash collections, and accounts receivable aging reflect back into the CRM in real time.

---

## 🚀 Key Highlights & Architectural Strengths

- **Non-Blocking Architecture:** HubSpot webhooks respond with `200 OK` in $< 50\text{ms}$. All Zoho Books operations execute asynchronously via **BullMQ & Redis**, ensuring sales workflows never wait on ERP availability.
- **Penny-Exact Financial Math:** All money calculations use integer minor units (UAE fils: $1\text{ AED} = 100\text{ fils}$) to prevent IEEE 754 floating-point drift.
- **Strict Product & Customer Mapping:** Customer matching checks Tax Registration Number (TRN) and normalized corporate names; ambiguous conflicts trigger a `NEEDS_REVIEW` flag for human decision. Products are strictly mapped without guessing.
- **Durable Idempotency:** State machines and unique database constraints guarantee that duplicate webhooks or crashed background workers never duplicate documents in either system.
- **Full Traceability & Masked Telemetry:** Every API call to both HubSpot and Zoho Books is logged with HTTP status, latency, correlation ID, and automatic redaction of OAuth tokens and secrets.
- **Collections Aging Analysis:** Real-time customer accounts receivable aging table segmented into standard buckets: **Current**, **1–30**, **31–60**, **61–90**, and **90+ days overdue**.

---

## 📊 Measured API Call Telemetry

As required by the assignment, our API client is instrumented with call counters:

| Scenario | Measured Zoho Books API Calls | Measured HubSpot CRM Calls | Notes |
| :--- | :---: | :---: | :--- |
| **One Deal from Closed Won to Paid** | **8 API calls** | **2 API calls** | Contact search (1), Contact create (1), Item verify (1), Sales Order create (1), Milestone 1 Invoice (1), Milestone 2 Invoice (1), Milestone 3 Invoice (1), Payment record (1). *(7 if customer already exists)* |
| **Periodic Sync when Nothing has Changed** | **1 API call** | **0 API calls** | Incremental sync query (`/customerpayments?date_start=...`). Zero HubSpot calls because diff-engine suppresses redundant updates. |

---

## 📋 Primary Deal Financial Specification

### Deal Summary
- **Customer:** NovaTech Solutions LLC
- **Deal Name:** Enterprise Software Implementation
- **Deal Value before VAT:** AED 120,000.00
- **UAE VAT (5%):** AED 6,000.00
- **Total Sales Order:** **AED 126,000.00**

### Milestone Billing Breakdown
1. **Milestone 1 (Contract Signing):** 50% = AED 60,000 base + AED 3,000 VAT = **AED 63,000.00**
2. **Milestone 2 (Go-Live):** 30% = AED 36,000 base + AED 1,800 VAT = **AED 37,800.00**
3. **Milestone 3 (90 Days Post Go-Live):** 20% = AED 24,000 base + AED 1,200 VAT = **AED 25,200.00**
- **Mathematical Invariant:**
  $$\text{AED } 63,000 + \text{AED } 37,800 + \text{AED } 25,200 = \mathbf{\text{AED } 126,000.00}$$

---

## 📂 Documentation Directory

Comprehensive technical specifications are available in the [`docs/`](./docs) folder:
- **[docs/architecture.md](./docs/architecture.md):** Complete architectural design, component interactions, and failure modes.
- **[docs/sequence-diagram.md](./docs/sequence-diagram.md):** Detailed Mermaid sequence diagram from Closed Won to Paid.
- **[docs/field-mapping.md](./docs/field-mapping.md):** Exhaustive field-by-field mapping table with system ownership and sync directions.
- **[docs/scenario-answers.md](./docs/scenario-answers.md):** Production-grade answers to all **7 scenario-based questions** from Section 5 of the assignment.

---

## 💻 Tech Stack

- **Backend:** Node.js 24, Express, TypeScript
- **Database & ORM:** PostgreSQL 16, Prisma ORM
- **Queue & Background Jobs:** Redis 7, BullMQ
- **Frontend Dashboard:** React 18, Vite, Tailwind CSS, Lucide Icons
- **Testing:** Vitest, Supertest
- **Integrations:** HubSpot CRM Developer API, Zoho Books API (UAE Multi-Currency AED & 5% VAT)

---

## ⚡ Quick Start & Local Setup

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- [Docker & Docker Compose](https://www.docker.com/)

### 2. Start PostgreSQL & Redis
```bash
docker-compose up -d
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your HubSpot and Zoho Books credentials
```

### 4. Setup Backend & Run Migrations
```bash
cd backend
npm install
npm run prisma:generate
npx prisma db push
npm run seed
npm run seed:20       # Seeds 15 customers and 20 deals dataset
npm run dev           # Starts backend server on http://localhost:5000
```

### 5. Setup & Launch Frontend Dashboard
```bash
cd ../frontend
npm install
npm run dev           # Starts Vite dev server on http://localhost:5173
```

---

## 🧪 Automated Test Suite

Run the Vitest test suite covering financial calculations, VAT precision, customer matching rules, and idempotency:
```bash
cd backend
npm test
```
All 11 automated unit and integration tests will execute and verify the core invariants.

---

## 🛠️ Verification & Diagnostic Utilities

The backend includes purpose-built CLI scripts to verify connections and simulate integration scenarios:
- **`npm run verify:env`**: Tests active connectivity to both HubSpot CRM and Zoho Books.
- **`npm run zoho:token <CODE>`**: Exchanges a Zoho OAuth grant code for a permanent refresh token.
- **`npm run hubspot:properties`**: Auto-provisions the 11 custom financial properties on HubSpot Deals.
- **`npx tsx src/scripts/test-primary-deal-sync.ts`**: Runs the primary NovaTech deal end-to-end.
- **`npx tsx src/scripts/test-milestone2-sync.ts`**: Triggers Milestone 2 invoice against the active Sales Order.
- **`npx tsx src/scripts/test-payment-sync.ts`**: Simulates cash payment recording and tests reverse sync to HubSpot.
