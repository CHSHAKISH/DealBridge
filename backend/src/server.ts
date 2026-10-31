import app from './app.js';
import { config } from './config/index.js';

const server = app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(`🚀 DealBridge Integration Server running on port ${config.port}`);
  console.log(`🔗 Health check available at http://localhost:${config.port}/health`);
  console.log(`🌍 Environment: ${config.nodeEnv}`);
  console.log(`💰 Base Currency: ${config.business.defaultCurrency} | VAT: ${config.business.vatRatePercent}%`);
  console.log(`===============================================`);
});

const gracefulShutdown = () => {
  console.log('\nReceived shutdown signal, terminating server gracefully...');
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

