import { Router, Request, Response } from 'express';
import { handleHubSpotWebhook } from '../controllers/webhook.controller.js';
import { DealSyncService } from '../services/sync/deal-sync.service.js';
import { apiMetrics } from '../services/logger/audit-logger.js';
import prisma from '../database/prisma.js';

export const router = Router();

// Webhook Endpoints
router.post('/webhooks/hubspot', handleHubSpotWebhook);

// Manual Sync Trigger Endpoint (for testing and on-demand sync)
router.post('/sync/deal', async (req: Request, res: Response) => {
  try {
    const { hubspotDealId, dealName, amountAed, companyName, hubspotCompanyId } = req.body;

    if (!hubspotDealId || !dealName) {
      return res.status(400).json({ error: 'hubspotDealId and dealName are required' });
    }

    const result = await DealSyncService.syncClosedWonDeal({
      hubspotDealId: String(hubspotDealId),
      dealName,
      amountAed: parseFloat(amountAed || '120000'),
      companyName,
      hubspotCompanyId,
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Trigger Milestone Invoicing (Milestone 2: Go-Live or Milestone 3: 90 Days)
router.post('/sync/milestone/:dealId', async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params;
    const { milestoneNumber } = req.body; // 2 or 3

    if (milestoneNumber !== 2 && milestoneNumber !== 3) {
      return res.status(400).json({ error: 'milestoneNumber must be 2 or 3' });
    }

    const invoice = await DealSyncService.triggerMilestoneInvoice(dealId, milestoneNumber);
    return res.status(200).json({ success: true, invoice });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Deals Explorer Endpoint
router.get('/deals', async (_req: Request, res: Response) => {
  try {
    const deals = await prisma.deal.findMany({
      include: {
        customer: true,
        salesOrder: true,
        invoices: true,
        milestones: true,
        paymentAllocations: {
          include: { payment: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Serialize BigInt values to string/number for JSON response
    const serialized = deals.map((d) => ({
      ...d,
      dealValueMinorUnits: d.dealValueMinorUnits.toString(),
      vatAmountMinorUnits: d.vatAmountMinorUnits.toString(),
      totalAmountMinorUnits: d.totalAmountMinorUnits.toString(),
      dealValueAed: Number(d.dealValueMinorUnits) / 100,
      vatAmountAed: Number(d.vatAmountMinorUnits) / 100,
      totalAmountAed: Number(d.totalAmountMinorUnits) / 100,
      salesOrder: d.salesOrder
        ? {
            ...d.salesOrder,
            totalMinorUnits: d.salesOrder.totalMinorUnits.toString(),
            vatMinorUnits: d.salesOrder.vatMinorUnits.toString(),
            totalAed: Number(d.salesOrder.totalMinorUnits) / 100,
            vatAed: Number(d.salesOrder.vatMinorUnits) / 100,
          }
        : null,
      invoices: d.invoices.map((inv) => ({
        ...inv,
        amountMinorUnits: inv.amountMinorUnits.toString(),
        vatMinorUnits: inv.vatMinorUnits.toString(),
        totalMinorUnits: inv.totalMinorUnits.toString(),
        paidMinorUnits: inv.paidMinorUnits.toString(),
        balanceMinorUnits: inv.balanceMinorUnits.toString(),
        totalAmountAed: Number(inv.totalMinorUnits) / 100,
        balanceAed: Number(inv.balanceMinorUnits) / 100,
      })),
      milestones: d.milestones.map((m) => ({
        ...m,
        targetMinorUnits: m.targetMinorUnits.toString(),
        targetAed: Number(m.targetMinorUnits) / 100,
      })),
      paymentAllocations: d.paymentAllocations.map((alloc) => ({
        ...alloc,
        allocatedMinorUnits: alloc.allocatedMinorUnits.toString(),
        allocatedAed: Number(alloc.allocatedMinorUnits) / 100,
        payment: alloc.payment
          ? {
              ...alloc.payment,
              totalMinorUnits: alloc.payment.totalMinorUnits.toString(),
              totalAed: Number(alloc.payment.totalMinorUnits) / 100,
            }
          : null,
      })),
    }));

    return res.status(200).json(serialized);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Live Integration Logs Endpoint
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const system = req.query.system as any;

    const where: any = {};
    if (system && (system === 'HUBSPOT' || system === 'ZOHO')) {
      where.system = system;
    }

    const logs = await prisma.integrationLog.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        deal: {
          select: { id: true, name: true, hubspotDealId: true },
        },
      },
    });

    return res.status(200).json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// API Telemetry Metrics
router.get('/metrics', async (_req: Request, res: Response) => {
  await apiMetrics.syncFromDb();
  return res.status(200).json(apiMetrics.getMetrics());
});

// Collections Aging View Endpoint
router.get('/collections', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const invoices = await prisma.invoice.findMany({
      where: {
        balanceMinorUnits: { gt: 0n },
        status: { not: 'VOID' },
      },
      include: {
        deal: {
          include: { customer: true },
        },
      },
    });

    // Group unpaid invoices by Customer (grouped by TRN or normalized company name to prevent duplicate rows)
    const customerMap: Record<string, any> = {};

    for (const inv of invoices) {
      const customer = inv.deal.customer;
      const key = customer.taxRegistrationNo
        ? `TRN_${customer.taxRegistrationNo.trim()}`
        : customer.companyName.trim().toLowerCase();

      if (!customerMap[key]) {
        customerMap[key] = {
          customerId: customer.id,
          customerName: customer.companyName,
          taxNumber: customer.taxRegistrationNo,
          totalOutstandingFils: 0n,
          oldestInvoiceDate: inv.dueDate,
          oldestInvoiceNumber: inv.invoiceNumber,
          agingBuckets: {
            currentFils: 0n,
            days1_30Fils: 0n,
            days31_60Fils: 0n,
            days61_90Fils: 0n,
            days90PlusFils: 0n,
          },
          deals: new Set<string>(),
        };
      }

      const entry = customerMap[key];
      entry.totalOutstandingFils += inv.balanceMinorUnits;
      entry.deals.add(inv.deal.name);

      // Track oldest unpaid invoice
      if (inv.dueDate < entry.oldestInvoiceDate) {
        entry.oldestInvoiceDate = inv.dueDate;
        entry.oldestInvoiceNumber = inv.invoiceNumber;
      }

      // Calculate days overdue
      const diffTime = now.getTime() - new Date(inv.dueDate).getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 0) {
        entry.agingBuckets.currentFils += inv.balanceMinorUnits;
      } else if (diffDays <= 30) {
        entry.agingBuckets.days1_30Fils += inv.balanceMinorUnits;
      } else if (diffDays <= 60) {
        entry.agingBuckets.days31_60Fils += inv.balanceMinorUnits;
      } else if (diffDays <= 90) {
        entry.agingBuckets.days61_90Fils += inv.balanceMinorUnits;
      } else {
        entry.agingBuckets.days90PlusFils += inv.balanceMinorUnits;
      }
    }

    // Format response
    const result = Object.values(customerMap).map((c: any) => ({
      customerId: c.customerId,
      customerName: c.customerName,
      taxNumber: c.taxNumber,
      totalOutstandingAed: Number(c.totalOutstandingFils) / 100,
      oldestInvoiceNumber: c.oldestInvoiceNumber,
      oldestInvoiceDate: c.oldestInvoiceDate,
      deals: Array.from(c.deals),
      aging: {
        current: Number(c.agingBuckets.currentFils) / 100,
        days1_30: Number(c.agingBuckets.days1_30Fils) / 100,
        days31_60: Number(c.agingBuckets.days31_60Fils) / 100,
        days61_90: Number(c.agingBuckets.days61_90Fils) / 100,
        days90Plus: Number(c.agingBuckets.days90PlusFils) / 100,
      },
    }));

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;

