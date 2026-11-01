import axios from 'axios';
import { config } from '../config/index.js';

/**
 * Script to exchange a Zoho OAuth grant code (from Zoho API Console Self-Client)
 * for a permanent refresh_token and active access_token.
 * 
 * Usage:
 * npm run zoho:token <AUTHORIZATION_GRANT_CODE>
 */
async function exchangeCode() {
  const code = process.argv[2];

  if (!code) {
    console.error('❌ Error: Please provide the authorization grant code.');
    console.log('Usage: npm run zoho:token <GRANT_CODE>');
    console.log('\nSteps to get GRANT_CODE:');
    console.log('1. Go to Zoho API Console (https://api-console.zoho.com or https://api-console.zoho.ae)');
    console.log('2. Click "Add Client" -> Choose "Self Client"');
    console.log('3. Enter Scopes: ZohoBooks.fullaccess.all');
    console.log('4. Time Duration: 10 minutes -> Click "Generate"');
    console.log('5. Copy the generated code and run: npm run zoho:token <CODE>');
    process.exit(1);
  }

  const clientId = config.zoho.clientId;
  const clientSecret = config.zoho.clientSecret;
  const region = config.zoho.region || 'ae';

  if (!clientId || !clientSecret) {
    console.error('❌ Error: ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET must be configured in your .env file.');
    process.exit(1);
  }

  // Determine regional accounts domain
  const domainMap: Record<string, string> = {
    com: 'https://accounts.zoho.com',
    ae: 'https://accounts.zoho.ae',
    in: 'https://accounts.zoho.in',
    eu: 'https://accounts.zoho.eu',
    com_au: 'https://accounts.zoho.com.au',
  };

  const accountsUrl = domainMap[region] || 'https://accounts.zoho.com';
  const tokenUrl = `${accountsUrl}/oauth/v2/token`;

  console.log(`\n🔄 Exchanging grant code with Zoho Accounts (${accountsUrl})...`);

  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code.trim(),
    });

    const response = await axios.post(tokenUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = response.data;

    if (data.error) {
      console.error('\n❌ Zoho OAuth Error:', data.error);
      process.exit(1);
    }

    console.log('\n🎉 SUCCESS! Generated Zoho OAuth Tokens:\n');
    console.log(`ZOHO_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`Current Access Token=${data.access_token}`);
    console.log(`Expires In=${data.expires_in} seconds`);
    console.log(`API Domain=${data.api_domain}`);
    console.log('\n👉 Copy the ZOHO_REFRESH_TOKEN above into your .env file!');
  } catch (error: any) {
    console.error('\n❌ Failed to exchange code:', error.response?.data || error.message);
    process.exit(1);
  }
}

exchangeCode();

