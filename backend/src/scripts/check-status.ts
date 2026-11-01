import prisma from '../database/prisma.js';

async function main() {
  const deals = await prisma.deal.findMany({
    include: {
      customer: true,
      salesOrder: true,
      invoices: true,
      milestones: true,
    },
  });

  console.log(`\n======================================================`);
  console.log(`📊 Synchronized Deals in Database: ${deals.length}`);
  console.log(`======================================================`);

  for (const deal of deals) {
    console.log(`\nDeal: ${deal.name} (HubSpot ID: ${deal.hubspotDealId})`);
    console.log(`Customer: ${deal.customer.companyName} | Zoho Contact: ${deal.customer.zohoContactId}`);
    console.log(`Sales Order: ${deal.salesOrder?.salesOrderNumber} (Zoho ID: ${deal.salesOrder?.zohoSalesOrderId})`);
    console.log(`Total Value: AED ${Number(deal.totalAmountMinorUnits) / 100}`);
    console.log(`Invoices (${deal.invoices.length}):`);
    deal.invoices.forEach((inv) => {
      console.log(`  - ${inv.invoiceNumber} (Milestone ${inv.milestoneNumber}): AED ${Number(inv.totalMinorUnits) / 100} [Status: ${inv.status}]`);
    });
  }

  const logsCount = await prisma.integrationLog.count();
  console.log(`\nTotal Audit Logs in DB: ${logsCount}`);
  await prisma.$disconnect();
}

main();
