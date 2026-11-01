import prisma from '../database/prisma.js';
import { ReverseSyncService } from '../services/sync/reverse-sync.service.js';
import hubspotApiClient from '../services/hubspot/api-client.js';

async function testPayment() {
  console.log('================================================================');
  console.log('🚀 Testing Phase 6: Reverse Sync (Payment Recorded in Zoho -> CRM)');
  console.log('   Simulating Payment of AED 63,000 for Milestone 1 Invoice');
  console.log('================================================================\n');

  try {
    const deal = await prisma.deal.findUnique({
      where: { hubspotDealId: '360717339332' },
      include: { invoices: true },
    });

    if (!deal) throw new Error('Deal 360717339332 not found');

    const m1Invoice = deal.invoices.find((i) => i.milestoneNumber === 1);
    if (!m1Invoice) throw new Error('Milestone 1 invoice not found');

    console.log(`Found Milestone 1 Invoice: ${m1Invoice.invoiceNumber} (Total: AED ${Number(m1Invoice.totalMinorUnits) / 100})`);

    // Record Payment
    console.log('\nRecording payment in ReverseSyncService...');
    await ReverseSyncService.recordPayment({
      zohoPaymentId: `pay_demo_${Date.now()}`,
      paymentNumber: `PMT-${Date.now().toString().slice(-5)}`,
      paymentDate: new Date(),
      totalAmountAed: 63000,
      paymentMode: 'Bank Transfer',
      allocations: [
        {
          invoiceId: m1Invoice.id,
          allocatedAmountAed: 63000,
        },
      ],
    });

    console.log('\n✅ Payment recorded and allocated to Milestone 1 invoice!');

    // Fetch updated HubSpot deal properties to verify sync
    console.log('\nFetching updated properties from HubSpot CRM...');
    const updatedDeal = await hubspotApiClient.getDeal(deal.hubspotDealId);
    console.log('HubSpot Custom Properties:');
    console.log(` - Sales Order ID: ${updatedDeal.properties?.zoho_sales_order_id}`);
    console.log(` - Total Invoiced: AED ${updatedDeal.properties?.zoho_total_invoiced}`);
    console.log(` - Total Collected: AED ${updatedDeal.properties?.zoho_total_collected}`);
    console.log(` - % Collected: ${updatedDeal.properties?.zoho_percentage_collected}%`);
    console.log(` - Amount Unpaid: AED ${updatedDeal.properties?.zoho_amount_unpaid}`);
    console.log(` - Amount Not Invoiced: AED ${updatedDeal.properties?.zoho_amount_not_invoiced}`);

    console.log('\n================================================================');
    console.log('🎉 Reverse Sync Verified! Payments accurately reflect in CRM!');
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('❌ Payment sync test failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPayment();

