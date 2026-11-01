import prisma from '../database/prisma.js';

async function main() {
  const log = await prisma.integrationLog.findFirst({
    where: { system: 'ZOHO' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('Endpoint:', log?.endpoint);
  console.log('Status:', log?.statusCode);
  console.log('Error Message:', log?.errorMessage);
  console.log('Response Body:', log?.responseBodyMasked);
  await prisma.$disconnect();
}

main();
