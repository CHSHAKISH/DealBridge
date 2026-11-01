import prisma from '../database/prisma.js';
import { FinancialEngine } from '../services/financial/financial-engine.js';
import { SyncStatus, InvoiceStatus, MilestoneStatus } from '@prisma/client';

const CUSTOMERS = [
  { name: 'NovaTech Solutions LLC', taxNumber: '100234567800003', domain: 'novatechsolutions.ae' },
  { name: 'Apex Cloud Technologies LLC', taxNumber: '100345678900003', domain: 'apexcloud.ae' },
  { name: 'Desert Horizon Trading FZ-LLC', taxNumber: '100456789000003', domain: 'deserthorizon.ae' },
  { name: 'Gulf Media Group LLC', taxNumber: '100567890100003', domain: 'gulfmedia.ae' },
  { name: 'Falcon Logistics UAE', taxNumber: '100678901200003', domain: 'falconlogistics.ae' },
  { name: 'Al-Manara Consulting Ltd', taxNumber: '100789012300003', domain: 'almanara.ae' },
  { name: 'Emirates Smart Systems LLC', taxNumber: '100890123400003', domain: 'emiratessmart.ae' },
  { name: 'Oasis Healthcare Solutions LLC', taxNumber: '100901234500003', domain: 'oasishealth.ae' },
  { name: 'Zabeel Financial Services', taxNumber: '100012345600003', domain: 'zabeelfinance.ae' },
  { name: 'Burj Horizon Hospitality LLC', taxNumber: '100123456700003', domain: 'burjhorizon.ae' },
  { name: 'Marina Retail Ventures Ltd', taxNumber: '100234509800003', domain: 'marinaretail.ae' },
  { name: 'Al-Ain Engineering Works LLC', taxNumber: '100345610900003', domain: 'alaineng.ae' },
  { name: 'Palm Digital Commerce LLC', taxNumber: '100456721000003', domain: 'palmdigital.ae' },
  { name: 'Sharjah Freight Forwarders', taxNumber: '100567832100003', domain: 'sharjahfreight.ae' },
  { name: 'Ras Al Khaimah Cement Tech', taxNumber: '100678943200003', domain: 'rakcement.ae' },
];

const DEALS_CONFIG = [
  // 1. Primary Assignment Deal - Partly Paid
  { customerIdx: 0, name: 'Enterprise Software Implementation', baseAmount: 120000, scenario: 'PRIMARY_PARTLY_PAID' },
  // 2. Fully Invoiced and Fully Paid Deals
  { customerIdx: 1, name: 'Cloud Infrastructure Migration', baseAmount: 80000, scenario: 'FULLY_PAID' },
  { customerIdx: 2, name: 'ERP Modernization Package', baseAmount: 150000, scenario: 'FULLY_PAID' },
  { customerIdx: 3, name: 'Omnichannel Digital Platform', baseAmount: 95000, scenario: 'FULLY_PAID' },
  // 3. Partly Invoiced Deals (M1 only or M1 + M2)
  { customerIdx: 4, name: 'Supply Chain Tracking Engine', baseAmount: 110000, scenario: 'M1_ONLY' },
  { customerIdx: 5, name: 'Corporate Analytics Suite', baseAmount: 60000, scenario: 'M1_AND_M2' },
  { customerIdx: 6, name: 'Smart Building IoT Integration', baseAmount: 130000, scenario: 'M1_ONLY' },
  { customerIdx: 7, name: 'Telemedicine Core Rollout', baseAmount: 90000, scenario: 'M1_AND_M2' },
  // 4. Partial Payment Deals
  { customerIdx: 8, name: 'Core Banking API Middleware', baseAmount: 200000, scenario: 'PARTIAL_PAYMENT' },
  { customerIdx: 9, name: 'Guest Experience Mobile App', baseAmount: 70000, scenario: 'PARTIAL_PAYMENT' },
  // 5. Overdue Aging Invoices (1-30, 31-60, 61-90, 90+ days)
  { customerIdx: 10, name: 'E-Commerce Marketplace Sync', baseAmount: 85000, scenario: 'OVERDUE_1_30' },
  { customerIdx: 11, name: 'Industrial SCADA Interface', baseAmount: 115000, scenario: 'OVERDUE_31_60' },
  { customerIdx: 12, name: 'Payment Gateway Integration', baseAmount: 65000, scenario: 'OVERDUE_61_90' },
  { customerIdx: 13, name: 'Customs Clearance Automation', baseAmount: 140000, scenario: 'OVERDUE_90_PLUS' },
  { customerIdx: 14, name: 'Plant Telemetry Architecture', baseAmount: 175000, scenario: 'OVERDUE_90_PLUS' },
  // 6. Voided & Re-issued Invoices Deal
  { customerIdx: 0, name: 'Data Governance & Compliance', baseAmount: 50000, scenario: 'VOIDED_AND_REISSUED' },
  // 7. Multi-deal payment scenario
  { customerIdx: 1, name: 'Disaster Recovery Warm Site', baseAmount: 45000, scenario: 'MULTI_DEAL_PAYMENT_A' },
  { customerIdx: 1, name: 'Zero Trust Security Audit', baseAmount: 40000, scenario: 'MULTI_DEAL_PAYMENT_B' },
  // 8. Additional Real-World Deals
  { customerIdx: 3, name: 'Content Distribution Platform', baseAmount: 55000, scenario: 'M1_ONLY' },
  { customerIdx: 5, name: 'HRMS Workflow Modernization', baseAmount: 65000, scenario: 'M1_AND_M2' },
];

async function seedDataset() {
  console.log('================================================================');
  console.log('🌱 Seeding 15 Customers and 20 Deals Dataset (Assignment Coverage)');
  console.log('================================================================\n');

  const now = new Date();

  // 1. Upsert Customers
  const createdCustomers: any[] = [];
  for (const c of CUSTOMERS) {
    const cust = await prisma.customer.upsert({
      where: { hubspotCompanyId: `hs_comp_${c.domain.replace('.', '_')}` },
      update: {
        companyName: c.name,
        taxRegistrationNo: c.taxNumber,
        domain: c.domain,
      },
      create: {
        hubspotCompanyId: `hs_comp_${c.domain.replace('.', '_')}`,
        zohoContactId: `zoho_cnt_${c.domain.replace('.', '_')}`,
        companyName: c.name,
        normalizedName: c.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
        taxRegistrationNo: c.taxNumber,
        domain: c.domain,
        currency: 'AED',
        syncStatus: SyncStatus.SYNCED,
      },
    });
    createdCustomers.push(cust);
  }
  console.log(`✅ Created/verified ${createdCustomers.length} corporate customers.`);

  // 2. Generate 20 Deals
  let dealCounter = 100;
  for (const cfg of DEALS_CONFIG) {
    dealCounter++;
    const customer = createdCustomers[cfg.customerIdx];
    const hubspotDealId = `deal_seed_${dealCounter}`;
    const financials = FinancialEngine.calculateDealFinancials(cfg.baseAmount, 5.0);

    const deal = await prisma.deal.upsert({
      where: { hubspotDealId },
      update: {},
      create: {
        hubspotDealId,
        name: `${customer.companyName} - ${cfg.name}`,
        customerId: customer.id,
        stage: 'closedwon',
        currency: 'AED',
        dealValueMinorUnits: financials.dealValueMinorUnits,
        vatRatePercent: 5.0,
        vatAmountMinorUnits: financials.vatAmountMinorUnits,
        totalAmountMinorUnits: financials.totalAmountMinorUnits,
        syncStatus: SyncStatus.SYNCED,
      },
    });

    // Create Sales Order
    const soNumber = `SO-${dealCounter}`;
    const salesOrder = await prisma.salesOrder.upsert({
      where: { dealId: deal.id },
      update: {},
      create: {
        dealId: deal.id,
        customerId: customer.id,
        zohoSalesOrderId: `zoho_so_${dealCounter}`,
        salesOrderNumber: soNumber,
        referenceNumber: `HS-${hubspotDealId}`,
        totalMinorUnits: financials.totalAmountMinorUnits,
        vatMinorUnits: financials.vatAmountMinorUnits,
        status: 'confirmed',
      },
    });

    // Update deal with sales order
    await prisma.deal.update({
      where: { id: deal.id },
      data: { zohoSalesOrderId: salesOrder.zohoSalesOrderId },
    });

    // Generate Milestones definitions
    for (const m of financials.milestones) {
      await prisma.milestone.upsert({
        where: {
          dealId_milestoneNumber: { dealId: deal.id, milestoneNumber: m.milestoneNumber },
        },
        update: {},
        create: {
          dealId: deal.id,
          milestoneNumber: m.milestoneNumber,
          name: m.name,
          percentage: m.percentage,
          targetMinorUnits: m.totalAmountMinorUnits,
          status: MilestoneStatus.PENDING,
        },
      });
    }

    // Invoice Scenarios
    const m1 = financials.milestones[0];
    const m2 = financials.milestones[1];
    const m3 = financials.milestones[2];

    const createInvoiceRecord = async (
      m: typeof m1,
      invNum: string,
      status: InvoiceStatus,
      daysOffsetDue: number,
      paidMinor: bigint = 0n
    ) => {
      const dueDate = new Date(now.getTime() + daysOffsetDue * 24 * 60 * 60 * 1000);
      const balanceMinor = m.totalAmountMinorUnits - paidMinor;

      const inv = await prisma.invoice.create({
        data: {
          salesOrderId: salesOrder.id,
          dealId: deal.id,
          milestoneNumber: m.milestoneNumber,
          zohoInvoiceId: `zoho_inv_${invNum.toLowerCase()}`,
          invoiceNumber: invNum,
          status,
          amountMinorUnits: m.baseAmountMinorUnits,
          vatMinorUnits: m.vatAmountMinorUnits,
          totalMinorUnits: m.totalAmountMinorUnits,
          balanceMinorUnits: balanceMinor,
          paidMinorUnits: paidMinor,
          dueDate,
        },
      });

      // If paid, create payment record
      if (paidMinor > 0n) {
        const pmt = await prisma.payment.create({
          data: {
            zohoPaymentId: `zoho_pmt_${invNum.toLowerCase()}`,
            paymentNumber: `PMT-${invNum.slice(-4)}`,
            paymentDate: new Date(),
            totalMinorUnits: paidMinor,
            paymentMode: 'Bank Transfer',
          },
        });

        await prisma.paymentAllocation.create({
          data: {
            paymentId: pmt.id,
            invoiceId: inv.id,
            dealId: deal.id,
            allocatedMinorUnits: paidMinor,
          },
        });
      }

      await prisma.milestone.update({
        where: { dealId_milestoneNumber: { dealId: deal.id, milestoneNumber: m.milestoneNumber } },
        data: { status: MilestoneStatus.INVOICED },
      });

      return inv;
    };

    // Apply Scenario rules
    switch (cfg.scenario) {
      case 'PRIMARY_PARTLY_PAID':
        // M1 (paid), M2 (sent, unpaid)
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.PAID, 30, m1.totalAmountMinorUnits);
        await createInvoiceRecord(m2, `INV-${dealCounter}-2`, InvoiceStatus.SENT, 30, 0n);
        break;

      case 'FULLY_PAID':
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.PAID, -10, m1.totalAmountMinorUnits);
        await createInvoiceRecord(m2, `INV-${dealCounter}-2`, InvoiceStatus.PAID, -5, m2.totalAmountMinorUnits);
        await createInvoiceRecord(m3, `INV-${dealCounter}-3`, InvoiceStatus.PAID, 15, m3.totalAmountMinorUnits);
        break;

      case 'M1_ONLY':
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, 25, 0n);
        break;

      case 'M1_AND_M2':
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, 20, 0n);
        await createInvoiceRecord(m2, `INV-${dealCounter}-2`, InvoiceStatus.SENT, 35, 0n);
        break;

      case 'PARTIAL_PAYMENT':
        // 50% partial payment on Milestone 1
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.PARTIALLY_PAID, 15, m1.totalAmountMinorUnits / 2n);
        break;

      case 'OVERDUE_1_30':
        // Due 15 days ago -> 1-30 days overdue
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, -15, 0n);
        break;

      case 'OVERDUE_31_60':
        // Due 45 days ago -> 31-60 days overdue
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, -45, 0n);
        break;

      case 'OVERDUE_61_90':
        // Due 75 days ago -> 61-90 days overdue
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, -75, 0n);
        break;

      case 'OVERDUE_90_PLUS':
        // Due 110 days ago -> 90+ days overdue
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, -110, 0n);
        break;

      case 'VOIDED_AND_REISSUED':
        // Invoice 1 was voided, Invoice 2 reissued
        const voided = await createInvoiceRecord(m1, `INV-${dealCounter}-VOID`, InvoiceStatus.VOID, -10, 0n);
        await prisma.invoice.update({ where: { id: voided.id }, data: { voidedAt: new Date() } });
        await createInvoiceRecord(m1, `INV-${dealCounter}-REISSUE`, InvoiceStatus.SENT, 20, 0n);
        break;

      case 'MULTI_DEAL_PAYMENT_A':
      case 'MULTI_DEAL_PAYMENT_B':
        await createInvoiceRecord(m1, `INV-${dealCounter}-1`, InvoiceStatus.SENT, 25, 0n);
        break;
    }
  }

  console.log(`\n================================================================`);
  console.log(`🎉 15 Customers and 20 Deals Seeded Successfully!`);
  console.log(`================================================================\n`);
}

seedDataset()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
