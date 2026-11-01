import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { router as apiRouter } from './routes/api.routes.js';

// Global BigInt JSON serialization support
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const app = express();

app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

// We need raw body for webhook signature verification on specific routes
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
const handleHealth = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'DealBridge Integration Engine',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    zohoRegion: config.zoho.region,
    baseCurrency: config.business.defaultCurrency,
  });
};

app.get('/health', handleHealth);
app.get('/api/health', handleHealth);

// Root API Welcome
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to DealBridge API',
    endpoints: {
      health: '/health',
      webhooksHubspot: '/api/webhooks/hubspot',
      webhooksZoho: '/api/webhooks/zoho',
      deals: '/api/deals',
      logs: '/api/logs',
      collections: '/api/collections',
    }
  });
});

// API Routes
app.use('/api', apiRouter);

export default app;

