import axios from 'axios';
import { config } from '../config/index.js';

async function verifyConnections() {
  console.log('==================================================');
  console.log('🔍 DealBridge Connectivity & Environment Check');
  console.log('==================================================\n');

  let hubspotOk = false;
  let zohoOk = false;

  // 1. Verify HubSpot CRM
  console.log('1️⃣ Checking HubSpot CRM Connection...');
  if (!config.hubspot.accessToken) {
    console.log('⚠️ HUBSPOT_ACCESS_TOKEN is not set in .env');
  } else {
    try {
      const response = await axios.get('https://api.hubapi.com/crm/v3/objects/deals?limit=1', {
        headers: {
          Authorization: `Bearer ${config.hubspot.accessToken}`,
        },
      });
      if (response.status === 200) {
        console.log('✅ HubSpot CRM connected successfully!');
        console.log(`   Sample Deals Found: ${response.data.results?.length || 0}`);
        hubspotOk = true;
      }
    } catch (err: any) {
      console.error('❌ HubSpot Connection Failed:', err.response?.data?.message || err.message);
    }
  }

  console.log('\n--------------------------------------------------\n');

  // 2. Verify Zoho Books
  console.log('2️⃣ Checking Zoho Books Connection...');
  if (!config.zoho.clientId || !config.zoho.clientSecret || !config.zoho.refreshToken) {
    console.log('⚠️ Zoho Books OAuth credentials (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) not fully set in .env');
  } else {
    try {
      // Refresh token first
      const domainMap: Record<string, string> = {
        com: 'https://accounts.zoho.com',
        ae: 'https://accounts.zoho.ae',
        in: 'https://accounts.zoho.in',
        eu: 'https://accounts.zoho.eu',
      };
      const accountsUrl = domainMap[config.zoho.region] || 'https://accounts.zoho.com';
      const tokenUrl = `${accountsUrl}/oauth/v2/token`;

      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.zoho.clientId,
        client_secret: config.zoho.clientSecret,
        refresh_token: config.zoho.refreshToken,
      });

      const tokenRes = await axios.post(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const accessToken = tokenRes.data.access_token;
      if (!accessToken) {
        throw new Error(`Token refresh failed: ${JSON.stringify(tokenRes.data)}`);
      }

      console.log('   Zoho Access Token refreshed successfully.');

      // Check organization
      const booksDomainMap: Record<string, string> = {
        com: 'https://www.zohoapis.com/books/v3',
        ae: 'https://www.zohoapis.ae/books/v3',
        in: 'https://www.zohoapis.in/books/v3',
        eu: 'https://www.zohoapis.eu/books/v3',
      };
      const booksUrl = booksDomainMap[config.zoho.region] || 'https://www.zohoapis.com/books/v3';

      const orgRes = await axios.get(`${booksUrl}/organizations`, {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
        },
      });

      const orgs = orgRes.data.organizations || [];
      console.log(`✅ Zoho Books API connected! Organizations found: ${orgs.length}`);
      orgs.forEach((o: any) => {
        console.log(`   - Org Name: ${o.name} | ID: ${o.organization_id} | Currency: ${o.currency_code}`);
      });
      zohoOk = true;
    } catch (err: any) {
      console.error('❌ Zoho Books Connection Failed:', err.response?.data?.message || err.message);
    }
  }

  console.log('\n==================================================');
  console.log(`Result: HubSpot: ${hubspotOk ? 'READY ✅' : 'PENDING ⏳'} | Zoho Books: ${zohoOk ? 'READY ✅' : 'PENDING ⏳'}`);
  console.log('==================================================\n');
}

verifyConnections();
