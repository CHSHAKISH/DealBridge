import prisma from './prisma.js';

async function main() {
  console.log('🌱 Seeding database initial configuration...');

  // 1. Seed Product Mapping (Strict mapping - Never guess an item)
  const defaultProduct = await prisma.product.upsert({
    where: { crmProductName: 'Enterprise Software Implementation' },
    update: {},
    create: {
      crmProductName: 'Enterprise Software Implementation',
      crmProductCode: 'ESI-100',
      zohoItemId: 'item_esi_default',
      zohoItemName: 'Enterprise Software Implementation',
      taxRatePercent: 5.00,
    },
  });
  console.log(`✓ Product mapped: ${defaultProduct.crmProductName} -> ${defaultProduct.zohoItemName}`);

  // 2. Seed Sync Cursors for Incremental Reconciliation
  await prisma.syncCursor.upsert({
    where: {
      source_entityType: {
        source: 'ZOHO',
        entityType: 'INVOICES',
      },
    },
    update: {},
    create: {
      source: 'ZOHO',
      entityType: 'INVOICES',
      lastSyncedAt: new Date(0),
    },
  });

  await prisma.syncCursor.upsert({
    where: {
      source_entityType: {
        source: 'ZOHO',
        entityType: 'PAYMENTS',
      },
    },
    update: {},
    create: {
      source: 'ZOHO',
      entityType: 'PAYMENTS',
      lastSyncedAt: new Date(0),
    },
  });

  console.log('✓ Initial sync cursors created for invoices and payments.');
  console.log('✅ Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

