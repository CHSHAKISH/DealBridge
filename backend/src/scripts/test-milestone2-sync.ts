import prisma from '../database/prisma.js';
import { DealSyncService } from '../services/sync/deal-sync.service.js';
import hubspotApiClient from '../services/hubspot/api-client.js';

async function testMilestone2() {
  console.log('================================================================');
  console.log('🚀 Triggering Milestone 2 (Go-Live: 30% = AED 37,800)');
  console.log('================================================================\n');

  try {
    const deal = await prisma.deal.findUnique({
      where: { hubspotDealId: '360717339332' },
      include: { salesOrder: true },
    });

    if (!deal) {
      throw new Error('Deal 360717339332 not found in DB');
    }

    console.log(`Triggering Milestone 2 for Deal ${deal.name}...`);
    const inv = await DealSyncService.triggerMilestoneInvoice(deal.id, 2);

    console.log(`✅ Milestone 2 Invoice Created: ${inv.invoice_number} (ID: ${inv.invoice_id})`);

    // Calculate total invoiced (M1: 63,000 + M2: 37,800 = 100,800 AED = 80%)
    const allInvoices = await prisma.invoice.findMany({
      where: { dealId: deal.id, status: { not: 'VOID' } },
    });

    const totalInvoicedFils = allInvoices.reduce((acc, i) => acc + i.totalMinorUnits, 0n);
    const totalInvoicedAed = Number(totalInvoicedFils) / 100;
    const pctInvoiced = (totalInvoicedAed / 126000) * 100;

    console.log(`\n📊 Deal Financials After Milestone 2:`);
    console.log(`   Total Invoiced: AED ${totalInvoicedAed} (${pctInvoiced}%)`);
    console.log(`   Outstanding Unpaid: AED ${totalInvoicedAed}`);
    console.log(`   Not Yet Invoiced: AED ${126000 - totalInvoicedAed}`);

    // Update HubSpot
    await hubspotApiClient.updateDealIfChanged(deal.hubspotDealId, {
      zoho_total_invoiced: totalInvoicedAed,
      zoho_percentage_invoiced: pctInvoiced,
      zoho_amount_unpaid: totalInvoicedAed,
      zoho_amount_not_invoiced: 126000 - totalInvoicedAed,
    });

    console.log(`✅ HubSpot Deal Properties Synchronized with Milestone 2 totals!`);
  } catch (err: any) {
    console.error('❌ Milestone 2 trigger failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testMilestone2();

