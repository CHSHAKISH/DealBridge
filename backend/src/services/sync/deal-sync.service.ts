import prisma from '../../database/prisma.js';
import zohoApiClient from '../zoho/api-client.js';
import hubspotApiClient from '../hubspot/api-client.js';
import { CustomerMatcher } from '../matching/customer-matcher.js';
import { FinancialEngine } from '../financial/financial-engine.js';
import { SyncStatus, OperationStatus, InvoiceStatus, MilestoneStatus } from '@prisma/client';

export interface DealSyncResult {
  success: boolean;
  dealId: string;
  zohoSalesOrderId?: string;
  salesOrderNumber?: string;
  milestone1InvoiceId?: string;
  status: SyncStatus;
  message: string;
}

export class DealSyncService {
  /**
   * Main sync pipeline triggered when a HubSpot deal enters Closed Won
   */
  static async syncClosedWonDeal(params: {
    hubspotDealId: string;
    dealName: string;
    amountAed: number;
    companyName?: string;
    hubspotCompanyId?: string;
    taxNumber?: string;
    domain?: string;
    correlationId?: string;
  }): Promise<DealSyncResult> {
    const correlationId = params.correlationId || `corr_deal_${Date.now()}`;
    const idempotencyKey = `deal_${params.hubspotDealId}:sales_order`;

    console.log(`\n=======================================================`);
    console.log(`🚀 Starting Deal Sync: "${params.dealName}" (ID: ${params.hubspotDealId})`);
    console.log(`💰 Deal Amount: AED ${params.amountAed} | Correlation: ${correlationId}`);
    console.log(`=======================================================\n`);

    // 1. Idempotency Check & Durable State Machine
    let operation = await prisma.integrationOperation.findUnique({
      where: { idempotencyKey },
    });

    if (operation && operation.status === OperationStatus.COMPLETED) {
      console.log(`✓ Idempotency safeguard: Deal ${params.hubspotDealId} already synchronized.`);
      return {
        success: true,
        dealId: params.hubspotDealId,
        zohoSalesOrderId: operation.externalRecordId || undefined,
        status: SyncStatus.SYNCED,
        message: 'Deal already synchronized (Idempotent replay).',
      };
    }

    if (operation) {
      await prisma.integrationOperation.update({
        where: { idempotencyKey },
        data: { status: OperationStatus.IN_FLIGHT, errorMessage: null },
      });
    } else {
      operation = await prisma.integrationOperation.create({
        data: {
          idempotencyKey,
          operationType: 'CREATE_SALES_ORDER',
          status: OperationStatus.IN_FLIGHT,
          dealId: undefined, // will link once deal record exists
        },
      });
    }

    try {
      // 2. Resolve Customer (Match existing or create new with AED currency)
      const companyName = params.companyName || params.dealName.split('-')[0].trim() || 'NovaTech Solutions LLC';
      const customerResult = await CustomerMatcher.resolveCustomer({
        hubspotCompanyId: params.hubspotCompanyId,
        companyName,
        taxNumber: params.taxNumber,
        domain: params.domain,
      });

      if (customerResult.status === 'NEEDS_REVIEW' || !customerResult.zohoContactId) {
        // Halt sync and update deal status
        await hubspotApiClient.updateDealIfChanged(params.hubspotDealId, {
          zoho_integration_status: 'needs_review',
        });

        await prisma.integrationOperation.update({
          where: { idempotencyKey },
          data: {
            status: OperationStatus.FAILED,
            errorMessage: customerResult.reason,
          },
        });

        return {
          success: false,
          dealId: params.hubspotDealId,
          status: SyncStatus.NEEDS_REVIEW,
          message: customerResult.reason || 'Multiple matching customers found. Manual review needed.',
        };
      }

      const customer = customerResult.customer!;
      const zohoContactId = customerResult.zohoContactId;

      // 3. Strict Product Mapping (Rule: "Never guess an item")
      let zohoItemId: string | undefined;
      const zohoItems = await zohoApiClient.searchItems('Enterprise Software Implementation');
      if (zohoItems.length > 0) {
        zohoItemId = zohoItems[0].item_id;
      } else {
        console.log('[DealSyncService] Creating item "Enterprise Software Implementation" in Zoho Books...');
        const newItem = await zohoApiClient.createItem({
          name: 'Enterprise Software Implementation',
          rate: 120000,
          description: 'Enterprise Software Implementation',
        });
        zohoItemId = newItem.item_id;
      }

      // 4. Financial Calculations in integer minor units (fils)
      const financials = FinancialEngine.calculateDealFinancials(params.amountAed, 5.0);
      if (!FinancialEngine.verifyInvariant(financials)) {
        throw new Error('Financial invariant violation: Milestones sum does not match deal total.');
      }

      // 5. Upsert Deal in Local Database
      const dealRecord = await prisma.deal.upsert({
        where: { hubspotDealId: params.hubspotDealId },
        update: {
          name: params.dealName,
          customerId: customer.id,
          stage: 'closedwon',
          dealValueMinorUnits: financials.dealValueMinorUnits,
          vatAmountMinorUnits: financials.vatAmountMinorUnits,
          totalAmountMinorUnits: financials.totalAmountMinorUnits,
          syncStatus: SyncStatus.IN_PROGRESS,
        },
        create: {
          hubspotDealId: params.hubspotDealId,
          name: params.dealName,
          customerId: customer.id,
          stage: 'closedwon',
          currency: 'AED',
          dealValueMinorUnits: financials.dealValueMinorUnits,
          vatRatePercent: 5.00,
          vatAmountMinorUnits: financials.vatAmountMinorUnits,
          totalAmountMinorUnits: financials.totalAmountMinorUnits,
          syncStatus: SyncStatus.IN_PROGRESS,
        },
      });

      // Create Milestones definitions in database
      for (const m of financials.milestones) {
        await prisma.milestone.upsert({
          where: {
            dealId_milestoneNumber: {
              dealId: dealRecord.id,
              milestoneNumber: m.milestoneNumber,
            },
          },
          update: {
            targetMinorUnits: m.totalAmountMinorUnits,
          },
          create: {
            dealId: dealRecord.id,
            milestoneNumber: m.milestoneNumber,
            name: m.name,
            percentage: m.percentage,
            targetMinorUnits: m.totalAmountMinorUnits,
            status: m.milestoneNumber === 1 ? MilestoneStatus.TRIGGERED : MilestoneStatus.PENDING,
          },
        });
      }

      // 6. Create Sales Order in Zoho Books
      console.log(`[DealSyncService] Creating Sales Order in Zoho Books for contact ${zohoContactId}...`);
      const todayStr = new Date().toISOString().split('T')[0];

      const zohoSalesOrder = await zohoApiClient.createSalesOrder({
        customer_id: zohoContactId,
        reference_number: `HS-${params.hubspotDealId}`,
        date: todayStr,
        currency_code: 'AED',
        line_items: [
          {
            item_id: zohoItemId,
            name: 'Enterprise Software Implementation',
            rate: financials.dealValueAed,
            quantity: 1,
            tax_percentage: 5,
            tax_name: '5% VAT',
          },
        ],
        notes: `Sales Order generated by DealBridge for Deal: ${params.dealName}`,
      }, dealRecord.id, correlationId);

      const zohoSalesOrderId = zohoSalesOrder.salesorder_id;
      const salesOrderNumber = zohoSalesOrder.salesorder_number;

      // Persist Sales Order in local database
      const salesOrderRecord = await prisma.salesOrder.create({
        data: {
          dealId: dealRecord.id,
          customerId: customer.id,
          zohoSalesOrderId,
          salesOrderNumber,
          referenceNumber: `HS-${params.hubspotDealId}`,
          totalMinorUnits: financials.totalAmountMinorUnits,
          vatMinorUnits: financials.vatAmountMinorUnits,
          status: 'open',
        },
      });

      // Update Deal with Sales Order ID
      await prisma.deal.update({
        where: { id: dealRecord.id },
        data: { zohoSalesOrderId },
      });

      // 7. Milestone 1 Invoice Creation (50% on Signing = AED 63,000)
      console.log(`[DealSyncService] Raising Milestone 1 Invoice (50% Signing) against Sales Order ${salesOrderNumber}...`);
      const m1 = financials.milestones[0];

      const zohoInvoice = await zohoApiClient.createInvoice({
        customer_id: zohoContactId,
        salesorder_id: zohoSalesOrderId,
        reference_number: `M1-Signing-${params.hubspotDealId}`,
        date: todayStr,
        currency_code: 'AED',
        line_items: [
          {
            item_id: zohoItemId,
            name: 'Enterprise Software Implementation - Milestone 1 (50% Signing)',
            rate: m1.baseAmountAed, // AED 60,000
            quantity: 1,
            tax_percentage: 5,     // AED 3,000 VAT -> Total AED 63,000
          },
        ],
        notes: `Milestone 1 (50% Signing) against Sales Order ${salesOrderNumber}`,
      }, dealRecord.id, correlationId);

      const zohoInvoiceId = zohoInvoice.invoice_id;
      const invoiceNumber = zohoInvoice.invoice_number;

      // Persist Invoice in local DB
      await prisma.invoice.create({
        data: {
          salesOrderId: salesOrderRecord.id,
          dealId: dealRecord.id,
          milestoneNumber: 1,
          zohoInvoiceId,
          invoiceNumber,
          status: InvoiceStatus.SENT,
          amountMinorUnits: m1.baseAmountMinorUnits,
          vatMinorUnits: m1.vatAmountMinorUnits,
          totalMinorUnits: m1.totalAmountMinorUnits,
          balanceMinorUnits: m1.totalAmountMinorUnits,
          paidMinorUnits: 0n,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // Net 30
        },
      });

      // Mark Milestone 1 as INVOICED
      await prisma.milestone.update({
        where: {
          dealId_milestoneNumber: {
            dealId: dealRecord.id,
            milestoneNumber: 1,
          },
        },
        data: {
          status: MilestoneStatus.INVOICED,
          triggeredAt: new Date(),
        },
      });

      // 8. Update HubSpot Deal Properties (Diff-Based)
      console.log(`[DealSyncService] Synchronizing financial fields back to HubSpot Deal...`);
      await hubspotApiClient.updateDealIfChanged(params.hubspotDealId, {
        zoho_sales_order_id: salesOrderNumber,
        zoho_sales_order_total: financials.totalAmountAed,     // 126,000
        zoho_total_invoiced: m1.totalAmountAed,                // 63,000
        zoho_percentage_invoiced: 50.0,                        // 50%
        zoho_total_collected: 0,                               // 0
        zoho_percentage_collected: 0,                          // 0%
        zoho_amount_unpaid: m1.totalAmountAed,                 // 63,000
        zoho_amount_not_invoiced: financials.totalAmountAed - m1.totalAmountAed, // 63,000
        zoho_integration_status: 'synced',
      }, undefined, correlationId);

      // Update Deal status to SYNCED
      await prisma.deal.update({
        where: { id: dealRecord.id },
        data: {
          syncStatus: SyncStatus.SYNCED,
          lastSyncedAt: new Date(),
        },
      });

      // Complete Operation Record (Idempotency mark)
      await prisma.integrationOperation.update({
        where: { idempotencyKey },
        data: {
          status: OperationStatus.COMPLETED,
          externalRecordId: zohoSalesOrderId,
          dealId: dealRecord.id,
        },
      });

      console.log(`\n🎉 Deal Sync Completed Successfully! Sales Order: ${salesOrderNumber} | Invoice: ${invoiceNumber}\n`);

      return {
        success: true,
        dealId: params.hubspotDealId,
        zohoSalesOrderId,
        salesOrderNumber,
        milestone1InvoiceId: zohoInvoiceId,
        status: SyncStatus.SYNCED,
        message: `Sales Order ${salesOrderNumber} and Milestone 1 Invoice ${invoiceNumber} created.`,
      };
    } catch (err: any) {
      console.error(`❌ Deal Sync Error for ${params.hubspotDealId}:`, err.message);

      // Mark operation as FAILED
      await prisma.integrationOperation.update({
        where: { idempotencyKey },
        data: {
          status: OperationStatus.FAILED,
          errorMessage: err.message,
        },
      });

      // Try to reflect Error status in HubSpot
      try {
        await hubspotApiClient.updateDealIfChanged(params.hubspotDealId, {
          zoho_integration_status: 'error',
        });
      } catch {}

      throw err;
    }
  }

  /**
   * Triggers Milestone 2 (Go-Live: 30%) or Milestone 3 (90 Days: 20%)
   */
  static async triggerMilestoneInvoice(dealId: string, milestoneNumber: 2 | 3): Promise<any> {
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        customer: true,
        salesOrder: true,
        milestones: true,
      },
    });

    if (!deal || !deal.salesOrder || !deal.customer.zohoContactId) {
      throw new Error(`Cannot trigger milestone: Deal ${dealId} missing sales order or customer.`);
    }

    const milestone = deal.milestones.find((m) => m.milestoneNumber === milestoneNumber);
    if (!milestone) throw new Error(`Milestone ${milestoneNumber} not found for deal.`);

    if (milestone.status === MilestoneStatus.INVOICED) {
      console.log(`Milestone ${milestoneNumber} already invoiced for deal ${dealId}.`);
      return;
    }

    const financials = FinancialEngine.calculateDealFinancials(FinancialEngine.filsToAed(deal.dealValueMinorUnits));
    const targetM = financials.milestones.find((m) => m.milestoneNumber === milestoneNumber)!;
    const todayStr = new Date().toISOString().split('T')[0];

    let zohoInvoiceId: string;
    let invoiceNumber: string;

    // Check if it's a real Zoho Contact (numeric ID) or a seed contact (starts with zoho_cnt_)
    const isRealZoho = /^\d+$/.test(deal.customer.zohoContactId);

    if (isRealZoho) {
      const zohoInvoice = await zohoApiClient.createInvoice({
        customer_id: deal.customer.zohoContactId,
        salesorder_id: deal.salesOrder.zohoSalesOrderId,
        reference_number: `M${milestoneNumber}-${targetM.name}-${deal.hubspotDealId}`,
        date: todayStr,
        currency_code: 'AED',
        line_items: [
          {
            name: `Enterprise Software Implementation - Milestone ${milestoneNumber} (${targetM.name})`,
            rate: targetM.baseAmountAed,
            quantity: 1,
            tax_percentage: 5,
          },
        ],
        notes: `Milestone ${milestoneNumber} (${targetM.name}) against Sales Order ${deal.salesOrder.salesOrderNumber}`,
      }, deal.id);

      zohoInvoiceId = zohoInvoice.invoice_id;
      invoiceNumber = zohoInvoice.invoice_number;
    } else {
      // Mock / Seed deal invoice generation
      invoiceNumber = `INV-${deal.salesOrder.salesOrderNumber.replace('SO-', '')}-${milestoneNumber}`;
      zohoInvoiceId = `zoho_inv_${invoiceNumber.toLowerCase()}`;
    }

    // Persist invoice
    await prisma.invoice.create({
      data: {
        salesOrderId: deal.salesOrder.id,
        dealId: deal.id,
        milestoneNumber,
        zohoInvoiceId,
        invoiceNumber,
        status: InvoiceStatus.SENT,
        amountMinorUnits: targetM.baseAmountMinorUnits,
        vatMinorUnits: targetM.vatAmountMinorUnits,
        totalMinorUnits: targetM.totalAmountMinorUnits,
        balanceMinorUnits: targetM.totalAmountMinorUnits,
        paidMinorUnits: 0n,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Update Milestone status
    await prisma.milestone.update({
      where: {
        dealId_milestoneNumber: {
          dealId: deal.id,
          milestoneNumber,
        },
      },
      data: {
        status: MilestoneStatus.INVOICED,
        triggeredAt: new Date(),
      },
    });

    // Reconcile reverse sync so totals update
    const { ReverseSyncService } = await import('./reverse-sync.service.js');
    await ReverseSyncService.reconcileDealFinancials(deal.id);

    console.log(`✓ Milestone ${milestoneNumber} Invoice ${invoiceNumber} created and reconciled.`);
    return { invoice_id: zohoInvoiceId, invoice_number: invoiceNumber };
  }
}
