# Field Mapping & Data Ownership Specification

This document defines the field-level mappings, authoritative system ownership, and data synchronization direction between **HubSpot CRM**, the **DealBridge Integration Engine**, and **Zoho Books ERP**.

---

## 1. Primary Entity Field Mappings

| CRM Field (HubSpot) | Zoho Books Field | System Owner | Sync Direction | Data Transformation & Rules |
| :--- | :--- | :--- | :--- | :--- |
| **Company Name** (`name`) | **Contact Display Name** (`contact_name`) | CRM | CRM $\to$ Zoho | Normalized (trimmed, lowercase, legal suffixes removed for matching). |
| **Tax Number / TRN** (`tax_number`) | **Tax Registration No.** (`tax_registration_number`) | CRM | CRM $\to$ Zoho | Exact 15-digit UAE TRN format matching. |
| **Company Domain** (`domain`) | **Website** (`website`) | CRM | CRM $\to$ Zoho | Used for secondary deduplication. |
| **Deal Name** (`dealname`) | **Sales Order Notes / Reference** (`notes`) | CRM | CRM $\to$ Zoho | Formatted as `HS-{deal_id}` reference. |
| **Deal Amount** (`amount`) | **Sales Order Subtotal** (`sub_total`) | CRM | CRM $\to$ Zoho | Base deal value before VAT (e.g. AED 120,000.00). |
| *(DealBridge Calculated)* | **Tax Percentage** (`tax_percentage`) | Integration | Integration $\to$ Zoho | Standard UAE VAT rate (5.00%). |
| *(DealBridge Calculated)* | **Sales Order Total** (`total`) | Integration | Integration $\to$ Zoho | Integer minor units: $\text{Base} + 5\% \text{ VAT}$ (AED 126,000.00). |
| **Product Line Item** (`product`) | **Item Name** (`item_name`) | CRM | CRM $\to$ Zoho | **Strict Mapping:** Exact match required in `products` table. Never guessed. |
| `zoho_sales_order_id` | **Sales Order Number** (`salesorder_number`) | Zoho Books | Zoho $\to$ CRM | Reference number (e.g. `SO-00003`). |
| `zoho_sales_order_total` | **Sales Order Total** (`total`) | Zoho Books | Zoho $\to$ CRM | Sales order value including VAT (AED 126,000.00). |
| `zoho_total_invoiced` | *(Sum of Active Invoices)* | Zoho Books | Zoho $\to$ CRM | Sum of sent, partially paid, and paid invoices (excluding VOID). |
| `zoho_percentage_invoiced` | *(Calculated Ratio)* | Integration | Integration $\to$ CRM | $\frac{\text{Total Invoiced}}{\text{Sales Order Total}} \times 100$ |
| `zoho_total_collected` | *(Sum of Payment Allocations)* | Zoho Books | Zoho $\to$ CRM | Sum of allocated payments to this specific deal's invoices. |
| `zoho_percentage_collected` | *(Calculated Ratio)* | Integration | Integration $\to$ CRM | $\frac{\text{Total Collected}}{\text{Sales Order Total}} \times 100$ |
| `zoho_amount_unpaid` | *(Outstanding Balance)* | Integration | Integration $\to$ CRM | $\text{Total Invoiced} - \text{Total Collected}$ |
| `zoho_amount_not_invoiced` | *(Remaining Contract Balance)* | Integration | Integration $\to$ CRM | $\text{Sales Order Total} - \text{Total Invoiced}$ |
| `zoho_next_due_date` | **Due Date** (`due_date`) | Zoho Books | Zoho $\to$ CRM | Earliest due date among unpaid active invoices. |
| `zoho_is_overdue` | *(Aging Calculation)* | Integration | Integration $\to$ CRM | `true` if $\text{Current Date} > \text{Due Date}$ and balance $> 0$. |
| `zoho_integration_status` | *(Sync State Machine)* | Integration | Both $\to$ Both | `synced`, `pending`, `needs_review`, `error`. |

---

## 2. Ownership & Idempotency Rules

1. **CRM Owns Deal & Customer Data:** Sales owns the customer identity and initial contract value. Changes in CRM propagate downstream to Zoho Books.
2. **Zoho Books Owns Financial Documents & Cash:** Zoho Books is the single source of truth for invoice statuses, payments received, credit notes, and tax reporting.
3. **Integration Owns Telemetry & Derived Metrics:** DealBridge owns synchronization timestamps, aging bucket classifications, payment multi-deal allocations, and idempotency states.
4. **Diff-Based Writes Only:** HubSpot custom fields are updated **only** when calculated values differ from current CRM values, preventing redundant API calls and audit clutter.

