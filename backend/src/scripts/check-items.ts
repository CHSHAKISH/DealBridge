import zohoApiClient from '../services/zoho/api-client.js';

async function main() {
  const items = await zohoApiClient.searchItems('');
  console.log(`Found ${items.length} items in Zoho Books:`);
  items.forEach((it: any) => {
    console.log(` - ID: ${it.item_id} | Name: "${it.name}" | Rate: ${it.rate}`);
  });
}

main();

