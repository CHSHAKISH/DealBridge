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
  origin: true, // Allow all origins including Vercel and local development
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

// Root Welcome Route
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'DealBridge Integration Engine API',
    status: 'online',
    health: '/health',
    api: '/api',
    endpoints: {
      deals: '/api/deals',
      logs: '/api/logs',
      collections: '/api/collections',
      metrics: '/api/metrics',
    },
  });
});

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

// Serve frontend static build in production if available
import path from 'path';
import fs from 'fs';
const frontendDistPath = path.resolve(process.cwd(), '../frontend/dist');
const altFrontendDistPath = path.resolve(process.cwd(), 'frontend/dist');
const finalDistPath = fs.existsSync(frontendDistPath) 
  ? frontendDistPath 
  : (fs.existsSync(altFrontendDistPath) ? altFrontendDistPath : null);

if (finalDistPath) {
  app.use(express.static(finalDistPath));
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(finalDistPath, 'index.html'));
  });
}

export default app;

