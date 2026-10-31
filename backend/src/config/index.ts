import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:5000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  
  hubspot: {
    accessToken: process.env.HUBSPOT_ACCESS_TOKEN || '',
    clientId: process.env.HUBSPOT_CLIENT_ID || '',
    clientSecret: process.env.HUBSPOT_CLIENT_SECRET || '',
    webhookSecret: process.env.HUBSPOT_WEBHOOK_SECRET || '',
  },

  zoho: {
    clientId: process.env.ZOHO_CLIENT_ID || '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET || '',
    refreshToken: process.env.ZOHO_REFRESH_TOKEN || '',
    organizationId: process.env.ZOHO_ORGANIZATION_ID || '',
    region: process.env.ZOHO_REGION || 'ae',
    redirectUri: process.env.ZOHO_REDIRECT_URI || 'http://localhost:5000/api/auth/zoho/callback',
    webhookToken: process.env.ZOHO_WEBHOOK_TOKEN || '',
  },

  business: {
    vatRatePercent: parseFloat(process.env.VAT_RATE_PERCENT || '5.0'),
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'AED',
    syncPollIntervalMinutes: parseInt(process.env.SYNC_POLL_INTERVAL_MINUTES || '15', 10),
  }
};

