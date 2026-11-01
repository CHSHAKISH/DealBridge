import prisma from '../../database/prisma.js';
import hubspotApiClient from '../hubspot/api-client.js';
import { InvoiceStatus, SyncStatus } from '@prisma/client';

export class ReverseSyncService {
  /**
   * Reconciles financial metrics for a deal based on current active invoices and payments,
   * then pushes updates to HubSpot CRM only if values changed.
   */
  static async reconcileDealFinancials(dealId: string, correlationId?: string): Promise<any> {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true,
        salesOrder: true,
        invoices: {
          where: { status: { not: InvoiceStatus.VOID } },
          include: { paymentAllocations: true },
        },
        paymentAllocations: true,
      },
    });

    if (!deal || !deal.salesOrder) {
      console.warn(`[ReverseSync] Deal ${dealId} has no sales order yet.`);
      return;
    }

    const salesOrderTotalFils = deal.totalAmountMinorUnits;
    const salesOrderTotalAed = Number(salesOrderTotalFils) / 100;

    // 1. Total active invoiced
    let totalInvoicedFils = 0n;
    let totalCollectedFils = 0n;
    let earliestDueDate: Date | null = null;
    let isOverdue = false;
    const now = new Date();

    for (const inv of deal.invoices) {
      totalInvoicedFils += inv.totalMinorUnits;

      // Sum allocations for this invoice
      const paidForInvoice = inv.paymentAllocations.reduce((sum, alloc) => sum + alloc.allocatedMinorUnits, 0n);
      totalCollectedFils += paidForInvoice;

      const balance = inv.totalMinorUnits - paidForInvoice;

      // Update invoice paid & balance status in DB
      let newStatus: InvoiceStatus = inv.status;
      if (balance === 0n) {
        newStatus = InvoiceStatus.PAID;
      } else if (paidForInvoice > 0n) {
        newStatus = InvoiceStatus.PARTIALLY_PAID;
      }

      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          paidMinorUnits: paidForInvoice,
          balanceMinorUnits: balance,
          status: newStatus,
        },
      });

      // Check due date & overdue status
      if (balance > 0n) {
        if (!earliestDueDate || inv.dueDate < earliestDueDate) {
          earliestDueDate = inv.dueDate;
        }
        if (now > inv.dueDate) {
          isOverdue = true;
        }
      }
    }

    const totalInvoicedAed = Number(totalInvoicedFils) / 100;
    const totalCollectedAed = Number(totalCollectedFils) / 100;
    const amountUnpaidAed = Math.max(0, totalInvoicedAed - totalCollectedAed);
    const amountNotInvoicedAed = Math.max(0, salesOrderTotalAed - totalInvoicedAed);

    const pctInvoiced = salesOrderTotalAed > 0 ? (totalInvoicedAed / salesOrderTotalAed) * 100 : 0;
    const pctCollected = salesOrderTotalAed > 0 ? (totalCollectedAed / salesOrderTotalAed) * 100 : 0;

    console.log(`[ReverseSync] Calculated financial status for Deal ${deal.name}:`);
    console.log(`  - Total Invoiced: AED ${totalInvoicedAed} (${pctInvoiced.toFixed(2)}%)`);
    console.log(`  - Total Collected: AED ${totalCollectedAed} (${pctCollected.toFixed(2)}%)`);
    console.log(`  - Unpaid Balance: AED ${amountUnpaidAed}`);
    console.log(`  - Not Yet Invoiced: AED ${amountNotInvoicedAed}`);
    console.log(`  - Next Due Date: ${earliestDueDate ? earliestDueDate.toISOString().split('T')[0] : 'None'}`);
    console.log(`  - Overdue: ${isOverdue ? 'Yes' : 'No'}`);

    // Update HubSpot Deal Properties (Diff-Based update - only writes changed fields)
    const updateResult = await hubspotApiClient.updateDealIfChanged(
      deal.hubspotDealId,
      {
        zoho_sales_order_id: deal.salesOrder.salesOrderNumber,
        zoho_sales_order_total: salesOrderTotalAed,
        zoho_total_invoiced: totalInvoicedAed,
        zoho_percentage_invoiced: parseFloat(pctInvoiced.toFixed(2)),
        zoho_total_collected: totalCollectedAed,
        zoho_percentage_collected: parseFloat(pctCollected.toFixed(2)),
        zoho_amount_unpaid: amountUnpaidAed,
        zoho_amount_not_invoiced: amountNotInvoicedAed,
        zoho_next_due_date: earliestDueDate ? earliestDueDate.toISOString().split('T')[0] : '',
        zoho_is_overdue: isOverdue ? 'true' : 'false',
        zoho_integration_status: 'synced',
      },
      undefined,
      correlationId
    );

    if (updateResult.updated) {
      console.log(`✓ Synchronized updated fields to HubSpot: [${updateResult.changedFields.join(', ')}]`);
    } else {
      console.log(`✓ No property changes detected. HubSpot write omitted (Quota saved!).`);
    }

    return {
      totalInvoicedAed,
      pctInvoiced,
      totalCollectedAed,
      pctCollected,
      amountUnpaidAed,
      amountNotInvoicedAed,
      isOverdue,
    };
  }

  /**
   * Records a payment and allocates it across specific invoices and deals.
   * Solves Scenario Question 6: "One payment is recorded against two invoices that belong to two different deals."
   */
  static async recordPayment(params: {
    zohoPaymentId: string;
    paymentNumber: string;
    paymentDate: Date;
    totalAmountAed: number;
    paymentMode?: string;
    allocations: Array<{
      invoiceId: string; // Internal or Zoho Invoice ID
      allocatedAmountAed: number;
    }>;
  }): Promise<void> {
    const totalMinorUnits = BigInt(Math.round(params.totalAmountAed * 100));

    // 1. Upsert payment record
    const payment = await prisma.payment.upsert({
      where: { zohoPaymentId: params.zohoPaymentId },
      update: {
        totalMinorUnits,
        paymentDate: params.paymentDate,
        paymentMode: params.paymentMode,
      },
      create: {
        zohoPaymentId: params.zohoPaymentId,
        paymentNumber: params.paymentNumber,
        paymentDate: params.paymentDate,
        totalMinorUnits,
        paymentMode: params.paymentMode,
      },
    });

    const affectedDealIds = new Set<string>();

    // 2. Insert or update payment allocations
    for (const alloc of params.allocations) {
      const invoice = await prisma.invoice.findFirst({
        where: {
          OR: [
            { id: alloc.invoiceId },
            { zohoInvoiceId: alloc.invoiceId },
          ],
        },
      });

      if (!invoice) {
        console.warn(`[ReverseSync] Invoice ${alloc.invoiceId} not found in DB for payment allocation.`);
        continue;
      }

      const allocatedMinor = BigInt(Math.round(alloc.allocatedAmountAed * 100));

      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: invoice.id,
          dealId: invoice.dealId,
          allocatedMinorUnits: allocatedMinor,
        },
      });

      affectedDealIds.add(invoice.dealId);
    }

    // 3. Reconcile each affected deal
    for (const dealId of affectedDealIds) {
      await this.reconcileDealFinancials(dealId);
    }
  }

  /**
   * Handles invoice voiding in Zoho Books
   * Solves Scenario Question 5: "An invoice is voided in Zoho Books and re-issued under a new number."
   */
  static async handleInvoiceVoided(zohoInvoiceId: string): Promise<void> {
    const invoice = await prisma.invoice.findUnique({
      where: { zohoInvoiceId },
    });

    if (!invoice) {
      console.warn(`[ReverseSync] Invoice ${zohoInvoiceId} not found to void.`);
      return;
    }

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.VOID,
        voidedAt: new Date(),
        balanceMinorUnits: 0n,
      },
    });

    console.log(`✓ Invoice ${invoice.invoiceNumber} marked as VOID. Recalculating deal financials...`);
    await this.reconcileDealFinancials(invoice.dealId);
  }
}

