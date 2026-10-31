# DealBridge 🌉
> **Two-Way CRM & Zoho Books Financial Integration Engine**  
> Developed for the Full-Stack Developer Intern assignment at Complyance.

DealBridge is an enterprise-grade, event-driven integration platform that links **HubSpot CRM** with **Zoho Books ERP**. It ensures that sales transactions closed in CRM automatically flow into Zoho Books as compliant Sales Orders and milestone invoices (with exact minor-unit financial precision), while invoice status, payments, and collections aging reflect back into the CRM in real time.

---

## 🏗️ Architecture & Core Components

- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Prisma ORM (ACID compliance, idempotency keys, payment allocations)
- **Queues:** Redis & BullMQ (asynchronous processing, rate-limit backoff, retry policies)
- **Frontend Dashboard:** React, Vite, Tailwind CSS, Lucide Icons
- **CRM:** HubSpot CRM Developer Portal (Deals, Webhooks, Custom Properties)
- **ERP:** Zoho Books UAE Trial Organization (AED Currency, 5% UAE VAT, Milestone Billing)

---

## ⚡ Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended, v24 supported)
- [Docker & Docker Compose](https://www.docker.com/)

### 2. Infrastructure Setup (PostgreSQL & Redis)
```bash
docker-compose up -d
```

### 3. Environment Configuration
Copy the template and configure your external API credentials:
```bash
cp .env.example .env
```

### 4. Running the Backend
```bash
cd backend
npm install
npm run dev
```

### 5. Running the Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```

---

## 📋 Milestone Financial Calculation Spec

- **Deal Value before VAT:** AED 120,000.00
- **VAT (5% UAE):** AED 6,000.00
- **Total Sales Order:** AED 126,000.00

### Milestone Billing Breakdown
1. **Milestone 1 (Contract Signing):** 50% = AED 60,000 + AED 3,000 VAT = **AED 63,000**
2. **Milestone 2 (Go-Live):** 30% = AED 36,000 + AED 1,800 VAT = **AED 37,800**
3. **Milestone 3 (90 Days Post Go-Live):** 20% = AED 24,000 + AED 1,200 VAT = **AED 25,200**
- **Verification:** AED 63,000 + AED 37,800 + AED 25,200 = **AED 126,000.00**

---

## 🛡️ Reliability & Idempotency
- **Never Wait on Zoho:** HubSpot webhooks respond with `200 OK` in < 100ms. All Zoho Books calls are executed asynchronously via BullMQ.
- **Idempotency Keys:** Deterministic keys (`deal_{id}:sales_order`, `deal_{id}:invoice:{milestone}`) prevent duplicate document generation even on repeat delivery.
- **Strict Matching:** Customer matching relies on Tax Registration Number (TRN) or normalized domain/company naming; ambiguous duplicates halt for human decision.
- **Audit Logging:** Every external API call (HubSpot & Zoho) is recorded with masked credentials, latency, HTTP status, and deal correlation IDs.

