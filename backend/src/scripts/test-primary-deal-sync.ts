import hubspotApiClient from '../services/hubspot/api-client.js';
import { DealSyncService } from '../services/sync/deal-sync.service.js';
import prisma from '../database/prisma.js';

async function testPrimaryDeal() {
  console.log('================================================================');
  console.log('🚀 Executing Primary Assignment Deal Sync');
  console.log('   Customer: NovaTech Solutions LLC');
  console.log('   Deal: Enterprise Software Implementation');
  console.log('   Value: AED 120,000 + 5% VAT (AED 6,000) = Total AED 126,000');
  console.log('================================================================\n');

  try {
    // 1. Create a REAL Deal in HubSpot CRM
    console.log('1️⃣ Creating real test Deal in HubSpot CRM portal...');
    const hsDeal = await hubspotApiClient.createDeal({
      dealname: 'NovaTech Solutions LLC - Enterprise Software Implementation',
      amount: '120000',
      dealstage: 'closedwon',
      pipeline: 'default',
    });

    const realHubspotDealId = hsDeal.id;
    console.log(`✅ Deal created in HubSpot CRM! Deal ID: ${realHubspotDealId}`);

    // 2. Execute DealBridge Two-Way Sync
    console.log('\n2️⃣ Executing DealBridge Sync Pipeline...');
    const result = await DealSyncService.syncClosedWonDeal({
      hubspotDealId: realHubspotDealId,
      dealName: 'NovaTech Solutions LLC - Enterprise Software Implementation',
      amountAed: 120000,
      companyName: 'NovaTech Solutions LLC',
      taxNumber: '100234567800003', // Valid UAE TRN
      domain: 'novatechsolutions.ae',
    });

    console.log('\n📊 Sync Execution Result:');
    console.log(JSON.stringify(result, null, 2));

    // 3. Verify in database
    const deal = await prisma.deal.findUnique({
      where: { hubspotDealId: realHubspotDealId },
      include: {
        customer: true,
        salesOrder: true,
        invoices: true,
        milestones: true,
      },
    });

    if (deal) {
      console.log('\n✅ Database Records Verified:');
      console.log(`   Customer: ${deal.customer.companyName} (Zoho Contact ID: ${deal.customer.zohoContactId})`);
      console.log(`   Sales Order: ${deal.salesOrder?.salesOrderNumber} (Total: AED ${Number(deal.totalAmountMinorUnits) / 100})`);
      console.log(`   Invoices count: ${deal.invoices.length}`);
      deal.invoices.forEach((inv) => {
        console.log(`     - Invoice ${inv.invoiceNumber} (Milestone ${inv.milestoneNumber}): AED ${Number(inv.totalMinorUnits) / 100} [Status: ${inv.status}]`);
      });
    }

    // 4. Verify updated deal properties in HubSpot
    console.log('\n3️⃣ Fetching updated deal properties from HubSpot CRM...');
    const updatedHsDeal = await hubspotApiClient.getDeal(realHubspotDealId);
    console.log('   HubSpot Custom Properties:');
    console.log(`   - Zoho Sales Order ID: ${updatedHsDeal.properties?.zoho_sales_order_id}`);
    console.log(`   - Zoho Sales Order Total: AED ${updatedHsDeal.properties?.zoho_sales_order_total}`);
    console.log(`   - Zoho Total Invoiced: AED ${updatedHsDeal.properties?.zoho_total_invoiced}`);
    console.log(`   - Zoho % Invoiced: ${updatedHsDeal.properties?.zoho_percentage_invoiced}%`);
    console.log(`   - Zoho Amount Unpaid: AED ${updatedHsDeal.properties?.zoho_amount_unpaid}`);
    console.log(`   - Zoho Integration Status: ${updatedHsDeal.properties?.zoho_integration_status}`);

    console.log('\n================================================================');
    console.log('🎉 Primary Deal Synced End-to-End Between HubSpot & Zoho Books!');
    console.log('================================================================\n');
  } catch (err: any) {
    console.error('❌ Sync failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPrimaryDeal();
